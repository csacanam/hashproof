/**
 * HashProof Express app factory.
 *
 * All routes live here. Exported as createApp() so tests can instantiate it
 * with skipPayment=true to bypass x402.
 *
 * Paid routes (x402, USDC on Base):
 *   POST /issueCredential
 *   POST /entities/:id/verificationRequests
 */

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { ISSUE_CREDENTIAL_PRICE_USD, ENTITY_VERIFICATION_PRICE_USD } from "./utils/constants.js";
import { createThirdwebPaymentMiddleware } from "./middleware/thirdwebPayment.js";
import { executeIssueCredential } from "./services/issueCredential.js";
import { getCredentialById } from "./services/getCredential.js";
import { getEntityById } from "./services/getEntity.js";
import { createVerificationRequest } from "./services/createVerificationRequest.js";
import { deductCredit, createKey, listKeys, addCredits } from "./services/apiKeys.js";
import { approveEntity } from "./services/approveEntity.js";
import { isPlatformAuthorized, upsertIssuerAuthorization } from "./services/issuerAuthorization.js";
import { supabase } from "./supabase.js";
import { CHAIN_CONFIG } from "./utils/chains.js";
import { Buffer } from "node:buffer";
import { generateCredentialPdf } from "./services/generatePdf.js";
import {
  runVerificationPipeline,
  verifyContractOnly,
  verifyIpfsOnly,
} from "./services/verifyPipeline.js";

export function createApp(options = {}) {
  const { skipPayment = false } = options;

  const RATE_LIMIT_WINDOW_MS =
    Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
  const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 60;
  const RATE_LIMIT_NO_PAYMENT_MAX =
    Number(process.env.RATE_LIMIT_NO_PAYMENT_MAX) || 10;

  const paymentMw = createThirdwebPaymentMiddleware(skipPayment);

  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({
    origin: true,
    exposedHeaders: ["PAYMENT-REQUIRED", "payment-required", "X-PAYMENT-RESPONSE"],
  }));
  app.use(express.json());

  const noPaymentRateLimit = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_NO_PAYMENT_MAX,
    message: { error: "Too many requests. Include x402 payment to proceed." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use((req, res, next) => {
    const isIssueCredential =
      req.method === "POST" && req.path === "/issueCredential";
    const isVerificationRequest =
      req.method === "POST" && /^\/entities\/[^/]+\/verificationRequests$/.test(req.path);
    const isPaidRoute = isIssueCredential || isVerificationRequest;
    if (!isPaidRoute) return next();
    const hasPayment = req.get("payment-signature") || req.get("x-payment");
    const hasApiKey =
      isIssueCredential &&
      (req.get("authorization")?.startsWith("Bearer ") || req.get("x-api-key"));
    if (hasPayment || hasApiKey) return next();
    noPaymentRateLimit(req, res, next);
  });

  app.use(paymentMw);

  const baseUrl = process.env.BASE_URL || "https://hashproof.example.com";

  const readOnlyRateLimit = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/issueCredential", async (req, res) => {
    try {
      const payload = req.body;

      // API key (prepaid): bind issuer to the key's entity and skip wallet checks
      if (req.apiKey) {
        const keyEntity = await getEntityById(req.apiKey.entity_id);
        if (!keyEntity) {
          return res.status(400).json({ error: "API key entity not found" });
        }
        if (keyEntity.status === "suspended") {
          return res.status(403).json({
            error: "This entity is suspended and cannot issue credentials.",
          });
        }
        payload.issuer_entity_id = req.apiKey.entity_id;
        payload.issuer = payload.issuer || {};
        const expectedSlug = (keyEntity.slug || "").toLowerCase();
        const sentSlug = (payload.issuer.slug || "").trim().toLowerCase();
        if (sentSlug && sentSlug !== expectedSlug) {
          return res.status(403).json({
            error: "API key is for a different issuer. Use issuer.slug matching your key's entity.",
          });
        }
        payload.issuer.slug = keyEntity.slug;
        payload.issuer.display_name = payload.issuer.display_name || keyEntity.display_name;
      }

      // Consistency: if entity IDs are provided, they must match the slugs in issuer/platform objects.
      const normalizeSlug = (s) =>
        String(s || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-");

      if (payload.issuer_entity_id && payload.issuer?.slug) {
        const issuerEntityForId = await getEntityById(payload.issuer_entity_id);
        const expected = normalizeSlug(payload.issuer.slug);
        if (issuerEntityForId?.slug && issuerEntityForId.slug !== expected) {
          return res.status(400).json({
            error: "issuer_entity_id does not match issuer.slug",
          });
        }
      }

      if (payload.platform_entity_id && payload.platform?.slug) {
        const platformEntityForId = await getEntityById(payload.platform_entity_id);
        const expected = normalizeSlug(payload.platform.slug);
        if (platformEntityForId?.slug && platformEntityForId.slug !== expected) {
          return res.status(400).json({
            error: "platform_entity_id does not match platform.slug",
          });
        }
      }

      // Enforce issuer access control based on entity status (skip when using API key)
      if (payload.issuer_entity_id && !req.apiKey) {
        const VERIFIED_STATUSES = ["individual_verified", "organization_verified"];

        const [issuerEntity, platformEntity] = await Promise.all([
          getEntityById(payload.issuer_entity_id),
          payload.platform_entity_id && payload.platform_entity_id !== payload.issuer_entity_id
            ? getEntityById(payload.platform_entity_id)
            : null,
        ]);

        if (issuerEntity?.status === "suspended") {
          return res.status(403).json({
            error: "This entity is suspended and cannot issue credentials.",
          });
        }

        if (VERIFIED_STATUSES.includes(issuerEntity?.status)) {
          // Extract the paying wallet from the x402 payment header
          const paymentHeader = req.get("X-PAYMENT") || req.get("PAYMENT-SIGNATURE");
          let payingWallet = null;
          if (paymentHeader) {
            try {
              const decoded = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf8"));
              payingWallet = decoded?.payload?.authorization?.from?.toLowerCase();
            } catch { /* ignore decode errors */ }
          }

          const isSelfIssuance = !platformEntity; // issuer == platform or no platform specified
          const issuerWallets = (issuerEntity.authorized_wallets ?? []).map((w) => String(w).toLowerCase());

          if (isSelfIssuance) {
            // Wallet must be directly authorized by the issuer
            if (!payingWallet || !issuerWallets.includes(payingWallet)) {
              return res.status(403).json({
                error: "Wallet not authorized to issue credentials for this entity.",
              });
            }
          } else {
            // Platform is different from issuer — require an approved authorization
            const platformWallets = (platformEntity?.authorized_wallets ?? []).map((w) => String(w).toLowerCase());
            const walletIsFromPlatform = payingWallet && platformWallets.includes(payingWallet);
            const walletIsFromIssuer = payingWallet && issuerWallets.includes(payingWallet);

            if (!walletIsFromPlatform && !walletIsFromIssuer) {
              return res.status(403).json({
                error: "Wallet not authorized to issue credentials for this entity.",
              });
            }

            // The paying wallet must come from an entity that has an approved authorization
            if (walletIsFromPlatform) {
              const authorized = await isPlatformAuthorized(
                payload.issuer_entity_id,
                payload.platform_entity_id
              );
              if (!authorized) {
                return res.status(403).json({
                  error: "This platform is not authorized to issue credentials on behalf of this issuer. Request an authorization first.",
                });
              }
            }
            // If wallet is from the issuer's own wallets, always allow (issuer can always self-issue)
          }
        }
      }

      const result = await executeIssueCredential(payload);

      if (req.apiKey) {
        const deduct = await deductCredit(req.apiKey.id);
        if (!deduct.ok) {
          console.error("[issueCredential] API key credit deduction failed — check DB permissions on api_keys (UPDATE). keyId:", req.apiKey.id);
        }
      }

      return res.json(result);
    } catch (err) {
      console.error("[issueCredential] error:", err.message);
      const status =
        err.message.includes("required") ||
        err.message.includes("not found") ||
        err.message.includes("Template")
          ? 400
          : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  app.get("/verify/:id/pdf", readOnlyRateLimit, async (req, res) => {
    try {
      const pdf = await generateCredentialPdf(req.params.id, baseUrl);
      if (!pdf) {
        return res.status(404).json({ error: "Credential not found" });
      }
      const inline = req.query.inline === "1";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        inline
          ? `inline; filename="credential-${req.params.id}.pdf"`
          : `attachment; filename="credential-${req.params.id}.pdf"`
      );
      return res.send(pdf);
    } catch (err) {
      console.error("[verify/pdf] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  function normalizeSlug(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function extractPayingWallet(req) {
    const paymentHeader = req.get("X-PAYMENT") || req.get("PAYMENT-SIGNATURE");
    if (!paymentHeader) return null;
    try {
      const decoded = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf8"));
      return decoded?.payload?.authorization?.from?.toLowerCase() || null;
    } catch {
      return null;
    }
  }

  // Template requirements (for agents): required keys + full fields_json.
  // The same endpoint accepts either a slug or a UUID template ID.
  // Public and private templates are readable by anyone.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  app.get("/templates/:ref/requirements", readOnlyRateLimit, async (req, res) => {
    try {
      const refRaw = String(req.params.ref || "").trim();
      const isUuid = UUID_RE.test(refRaw);

      let query = supabase
        .from("templates")
        .select("id, entity_id, name, slug, visibility, fields_json")
        .limit(1);
      if (isUuid) query = query.eq("id", refRaw);
      else query = query.eq("slug", normalizeSlug(refRaw));

      const { data: rows, error } = await query;
      if (error) throw new Error(error.message);

      const tpl = rows?.[0];
      if (!tpl) return res.status(404).json({ error: "Template not found" });

      const fields = Array.isArray(tpl.fields_json) ? tpl.fields_json : [];
      const required_keys = fields
        .filter((f) => f && f.key && f.required === true)
        .map((f) => f.key);

      return res.json({
        id: tpl.id,
        slug: tpl.slug,
        name: tpl.name,
        visibility: tpl.visibility,
        owner_entity_id: tpl.entity_id,
        required_keys,
        fields_json: fields,
      });
    } catch (err) {
      console.error("[templates/requirements] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Template preview: generates a PDF with watermark, no blockchain/IPFS.
  app.post("/templates/:ref/preview", readOnlyRateLimit, async (req, res) => {
    try {
      const refRaw = String(req.params.ref || "").trim();
      const isUuid = UUID_RE.test(refRaw);

      let query = supabase
        .from("templates")
        .select("id, name, slug, fields_json, background_url, page_width, page_height")
        .limit(1);
      if (isUuid) query = query.eq("id", refRaw);
      else query = query.eq("slug", normalizeSlug(refRaw));

      const { data: rows, error } = await query;
      if (error) throw new Error(error.message);
      const tpl = rows?.[0];
      if (!tpl) return res.status(404).json({ error: "Template not found" });

      const { background_url, fields: fieldValues, locale } = req.body || {};
      const bgUrl = background_url || tpl.background_url;
      const page_width = Number(tpl.page_width) || 595;
      const page_height = Number(tpl.page_height) || 842;
      const fieldsSpec = Array.isArray(tpl.fields_json) ? tpl.fields_json : [];

      // Build the preview URL that the QR will point to
      const baseUrl = process.env.FRONTEND_URL || "https://hashproof.dev";
      const qrParams = new URLSearchParams();
      if (bgUrl) qrParams.set("background_url", bgUrl);
      if (fieldValues && typeof fieldValues === "object") {
        for (const [k, v] of Object.entries(fieldValues)) {
          qrParams.set(k, v);
        }
      }
      const previewUrl = `${baseUrl}/preview/${tpl.slug}?${qrParams.toString()}`;

      // Generate PDF with watermark
      const { default: PDFDocument } = await import("pdfkit");
      const QRCode = (await import("qrcode")).default;

      const doc = new PDFDocument({
        size: [page_width, page_height],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      const chunks = [];
      const pdfPromise = new Promise((resolve, reject) => {
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });

      // Background
      if (bgUrl) {
        try {
          const bgRes = await fetch(bgUrl);
          if (bgRes.ok) {
            const buf = Buffer.from(await bgRes.arrayBuffer());
            doc.image(buf, 0, 0, { width: page_width, height: page_height });
          }
        } catch (e) {
          console.warn("[preview] background fetch failed:", e.message);
        }
      }

      // Fields
      for (const f of fieldsSpec) {
        const key = f?.key;
        if (!key) continue;
        const text = String((fieldValues && fieldValues[key]) || "").trim();
        if (!text) continue;
        const x = Number(f.x) ?? 0;
        const y = Number(f.y) ?? 0;
        const w = Math.max(1, Number(f.width) || page_width - x - 20);
        const fontSize = Math.min(200, Math.max(6, Number(f.font_size) || 12));
        const fontColor = f.font_color ?? "#000000";
        const align = f.align === "center" ? "center" : f.align === "right" ? "right" : "left";
        const bold = f.bold === true;
        const italic = f.italic === true;
        const fontName = bold && italic ? "Helvetica-BoldOblique" : bold ? "Helvetica-Bold" : italic ? "Helvetica-Oblique" : "Helvetica";
        doc.font(fontName).fontSize(fontSize).fillColor(fontColor).text(text, x, y, {
          width: w,
          align,
          ellipsis: true,
          ...(f.underline === true && { underline: true }),
          ...(f.strike === true && { strike: true }),
        });
      }

      // QR code (same logic as generatePdf.js)
      const REFERENCE_PAGE_WIDTH = 3508;
      const REFERENCE_QR_SIZE = 360;
      const QR_SIZE_MIN = 96;
      const QR_SIZE_MAX = 360;
      const qrSize = Math.round(
        Math.min(QR_SIZE_MAX, Math.max(QR_SIZE_MIN, REFERENCE_QR_SIZE * (page_width / REFERENCE_PAGE_WIDTH)))
      );
      const qrMargin = Math.round(qrSize * 0.4);
      const qrX = page_width - qrSize - qrMargin;
      const qrY = qrMargin;
      const qrDataUrl = await QRCode.toDataURL(previewUrl, { width: qrSize });
      doc.image(qrDataUrl, qrX, qrY, { width: qrSize, height: qrSize });

      // Watermark: diagonal "PREVIEW" / "VISTA PREVIA"
      const watermarkText = locale === "es" ? "VISTA PREVIA" : "PREVIEW";
      doc.save();
      doc.translate(page_width / 2, page_height / 2);
      doc.rotate(-45);
      const wmFontSize = Math.round(page_width * 0.12);
      doc.font("Helvetica-Bold").fontSize(wmFontSize).fillColor("#000000").opacity(0.12);
      const wmWidth = doc.widthOfString(watermarkText);
      doc.text(watermarkText, -wmWidth / 2, -wmFontSize / 2, { lineBreak: false });
      doc.restore();

      doc.end();
      const pdfBuffer = await pdfPromise;

      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", `inline; filename="preview-${tpl.slug}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err) {
      console.error("[templates/preview] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/stats", readOnlyRateLimit, async (req, res) => {
    try {
      const rpcUrl = process.env.CELO_RPC_URL;
      const contractAddress = process.env.REGISTRY_CONTRACT_ADDRESS;
      if (!rpcUrl || !contractAddress) {
        return res.status(503).json({ error: "Chain not configured" });
      }

      const { Contract, JsonRpcProvider } = await import("ethers");
      const provider = new JsonRpcProvider(rpcUrl);
      const registry = new Contract(
        contractAddress,
        ["function totalIssued() view returns (uint256)"],
        provider
      );

      const [totalBn, entitiesResult] = await Promise.all([
        registry.totalIssued(),
        supabase
          .from("entities")
          .select("*", { count: "exact", head: true })
          .in("status", ["individual_verified", "organization_verified"]),
      ]);

      return res.json({
        total_credentials: Number(totalBn),
        verified_entities: entitiesResult.count ?? 0,
      });
    } catch (err) {
      console.error("[stats] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/verify/:id", readOnlyRateLimit, async (req, res) => {
    try {
      const cred = await getCredentialById(req.params.id);
      if (!cred) {
        return res.status(404).json({ error: "Credential not found" });
      }
      const template = Array.isArray(cred.templates) ? cred.templates[0] : cred.templates;
      const context = Array.isArray(cred.contexts) ? cred.contexts[0] : cred.contexts;
      const platformEntity = Array.isArray(cred.platform) ? cred.platform[0] : cred.platform;
      const issuerEntity = Array.isArray(cred.issuer) ? cred.issuer[0] : cred.issuer;
      const cj = cred.credential_json ?? {};
      const pageWidth = template?.page_width ?? 595;
      const pageHeight = template?.page_height ?? 842;
      const VERIFIED_STATUSES = ["individual_verified", "organization_verified"];
      const issuerVerified = VERIFIED_STATUSES.includes(issuerEntity?.status);
      const platformVerified = VERIFIED_STATUSES.includes(platformEntity?.status);

      // Run full verification pipeline: contract → IPFS → DB
      const pipeline = await runVerificationPipeline({
        credentialId: cred.id,
        dbCredential: cred,
      });

      const effectiveCredentialJson =
        pipeline.report?.ipfs?.available && pipeline.report.ipfs.matchesDatabaseJson
          ? pipeline.report.ipfs.json ?? cred.credential_json
          : cred.credential_json;

      // Prefer self-contained credential JSON; fallback to DB for legacy credentials
      return res.json({
        credential: effectiveCredentialJson,
        status: pipeline.effectiveStatus ?? "unknown",
        status_source: pipeline.statusSource ?? "unknown",
        verification_report: pipeline.report,
        verification_url: `${baseUrl}/verify/${cred.id}`,
        id: cred.id,
        title: cj.name ?? null,
        context_title: cj.context?.title ?? context?.title ?? null,
        credential_type: cred.credential_type ?? null,
        created_at: cred.created_at ?? null,
        expires_at: cred.expires_at ?? null,
        revoked_at: cred.revoked_at ?? null,
        tx_hash: cred.tx_hash ?? null,
        issuer_verified: issuerVerified,
        issuer_status: issuerEntity?.status ?? null,
        platform_verified: platformVerified,
        platform_status: platformEntity?.status ?? null,
        issuer_entity_id: cred.issuer_entity_id ?? null,
        platform_entity_id: cred.platform_entity_id ?? null,
        platform_name: cj.platform?.display_name ?? platformEntity?.display_name ?? null,
        page_width: pageWidth,
        page_height: pageHeight,
        ipfs_uri: cred.ipfs_cid ? `https://gateway.pinata.cloud/ipfs/${cred.ipfs_cid}` : null,
      });
    } catch (err) {
      console.error("[verify] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Step 1: Smart contract verification only
  app.get("/verify/:id/contract", readOnlyRateLimit, async (req, res) => {
    try {
      const { contract } = await verifyContractOnly({ credentialId: req.params.id });
      return res.json({ contract });
    } catch (err) {
      console.error("[verify/contract] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Step 2: IPFS vs DB JSON comparison
  app.get("/verify/:id/ipfs", readOnlyRateLimit, async (req, res) => {
    try {
      const cred = await getCredentialById(req.params.id);
      if (!cred) {
        return res.status(404).json({ error: "Credential not found" });
      }
      const { contract, ipfs } = await verifyIpfsOnly({
        credentialId: req.params.id,
        dbCredential: cred,
      });
      return res.json({ contract, ipfs });
    } catch (err) {
      console.error("[verify/ipfs] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/entities/:id", readOnlyRateLimit, async (req, res) => {
    try {
      const entity = await getEntityById(req.params.id);
      if (!entity) {
        return res.status(404).json({ error: "Entity not found" });
      }

      const VERIFIED_STATUSES = ["individual_verified", "organization_verified"];
      const isVerified = VERIFIED_STATUSES.includes(entity.status);

      return res.json({
        entity,
        id: entity.id,
        display_name: entity.display_name,
        slug: entity.slug,
        website: entity.website,
        logo_url: entity.logo_url,
        status: entity.status,
        is_verified: isVerified,
        email_verified: entity.email_verified,
        last_verified_at: entity.last_verified_at,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
      });
    } catch (err) {
      console.error("[entity] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/entities/:id/verificationRequests", async (req, res) => {
    try {
      const entityId = req.params.id;
      const { type, form } = req.body || {};

      if (!entityId) {
        return res.status(400).json({ error: "entityId is required" });
      }
      if (type !== "organization" && type !== "individual") {
        return res.status(400).json({ error: "type must be 'organization' or 'individual'" });
      }
      if (!form || typeof form !== "object") {
        return res.status(400).json({ error: "form payload is required" });
      }

      const priceUsd = ENTITY_VERIFICATION_PRICE_USD;

      const txHash = res.getHeader("X-PAYMENT-RESPONSE") || null;
      const networkKey = req.get("x-payment-network")
        ?? process.env.X402_NETWORKS?.split(",")[0]?.trim()
        ?? "base";
      const explorerTxUrl = txHash && CHAIN_CONFIG[networkKey]
        ? CHAIN_CONFIG[networkKey].explorerTxUrl(txHash)
        : null;

      const request = await createVerificationRequest(entityId, type, form, {
        price_usd: priceUsd,
        currency: "USDC",
        network: networkKey,
        tx_hash: txHash,
        tx_explorer_url: explorerTxUrl,
      });

      return res.status(201).json({
        request,
      });
    } catch (err) {
      console.error("[entities/verificationRequests] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: approve entity verification ──────────────────────────────────
  app.post("/admin/entities/:id/verify", async (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    const authHeader = req.get("Authorization") || "";
    if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const entityId = req.params.id;
      const { type, wallets, request_id } = req.body || {};

      if (type !== "organization" && type !== "individual") {
        return res.status(400).json({ error: "type must be 'organization' or 'individual'" });
      }
      if (!request_id && (!Array.isArray(wallets) || wallets.length === 0)) {
        return res.status(400).json({ error: "provide request_id (wallets will be read from the request) or an explicit wallets[] array" });
      }

      const result = await approveEntity({ entityId, type, wallets, requestId: request_id });
      return res.json(result);
    } catch (err) {
      console.error("[admin/verify] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: manage issuer authorizations ─────────────────────────────────
  app.post("/admin/issuer-authorizations", async (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    const authHeader = req.get("Authorization") || "";
    if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const { issuer_entity_id, platform_entity_id, status } = req.body || {};

      if (!issuer_entity_id || !platform_entity_id) {
        return res.status(400).json({ error: "issuer_entity_id and platform_entity_id are required" });
      }
      if (!["pending", "approved", "revoked"].includes(status)) {
        return res.status(400).json({ error: "status must be 'pending', 'approved', or 'revoked'" });
      }

      const result = await upsertIssuerAuthorization(issuer_entity_id, platform_entity_id, status);
      return res.json(result);
    } catch (err) {
      console.error("[admin/issuer-authorizations] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Admin: API keys (prepaid credits for institutions, no crypto) ─────────
  const requireAdmin = (req, res, next) => {
    const adminSecret = process.env.ADMIN_SECRET;
    const authHeader = req.get("Authorization") || "";
    if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  app.post("/admin/api-keys", requireAdmin, async (req, res) => {
    try {
      const { entity_id, initial_credits, name } = req.body || {};
      if (!entity_id) {
        return res.status(400).json({ error: "entity_id is required" });
      }
      const credits = Math.max(0, Number(initial_credits) ?? 0);
      const key = await createKey(entity_id, credits, name || null);
      return res.status(201).json({
        id: key.id,
        entity_id: key.entity_id,
        name: key.name,
        credits_balance: key.credits_balance,
        api_key: key.secret,
        message: "Store the api_key securely. It is shown only once.",
      });
    } catch (err) {
      console.error("[admin/api-keys] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/admin/api-keys", requireAdmin, async (_req, res) => {
    try {
      const keys = await listKeys();
      return res.json(keys);
    } catch (err) {
      console.error("[admin/api-keys list] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/admin/api-keys/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { add_credits } = req.body || {};
      const amount = Math.max(0, Number(add_credits) ?? 0);
      if (amount === 0) {
        return res.status(400).json({ error: "add_credits must be a positive number" });
      }
      await addCredits(id, amount);
      const { data } = await supabase.from("api_keys").select("credits_balance").eq("id", id).single();
      return res.json({ id, credits_balance: data?.credits_balance ?? 0 });
    } catch (err) {
      console.error("[admin/api-keys patch] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/", readOnlyRateLimit, (_req, res) => {
    res.json({
      name: "HashProof API",
      description: "Issue verifiable credentials with IPFS backup and on-chain registry. Paid endpoints use x402 (USDC).",
      endpoints: {
        "POST /issueCredential": `Paid ($${ISSUE_CREDENTIAL_PRICE_USD} USDC via x402). Issue one credential.`,
        "POST /entities/:id/verificationRequests": `Paid ($${ENTITY_VERIFICATION_PRICE_USD} USDC via x402). Submit a verification request for an entity.`,
      },
    });
  });

  return app;
}
