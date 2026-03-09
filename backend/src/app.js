/**
 * HashProof Express app factory.
 * Exported for testing (skipPayment bypasses x402).
 */

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { generateJwt } from "@coinbase/cdp-sdk/auth";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ISSUE_CREDENTIAL_PRICE_USD } from "./utils/constants.js";
import { executeIssueCredential } from "./services/issueCredential.js";
import { getCredentialById } from "./services/getCredential.js";
import { getEntityById } from "./services/getEntity.js";
import { generateCredentialPdf } from "./services/generatePdf.js";

const CELO_NETWORK = "eip155:42220";

export function createApp(options = {}) {
  const { skipPayment = false } = options;

  const PAY_TO =
    process.env.PAY_TO ||
    (skipPayment ? "0x0000000000000000000000000000000000000000" : null);
  const FACILITATOR_URL =
    process.env.FACILITATOR_URL ||
    "https://api.cdp.coinbase.com/platform/v2/x402";
  const RATE_LIMIT_WINDOW_MS =
    Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
  const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 60;
  const RATE_LIMIT_NO_PAYMENT_MAX =
    Number(process.env.RATE_LIMIT_NO_PAYMENT_MAX) || 10;

  if (!skipPayment && !PAY_TO) {
    throw new Error("Missing required env: PAY_TO");
  }

  let paymentMw = (req, res, next) => next();
  if (!skipPayment) {
    const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
    const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
    const isCdpFacilitator = FACILITATOR_URL.includes("api.cdp.coinbase.com");

    function buildFacilitatorClient() {
      const config = { url: FACILITATOR_URL };
      if (isCdpFacilitator && CDP_API_KEY_ID && CDP_API_KEY_SECRET) {
        const facilitatorUrl = new URL(FACILITATOR_URL);
        const host = facilitatorUrl.host;
        const basePath = facilitatorUrl.pathname.replace(/\/$/, "") || "";
        config.createAuthHeaders = async () => {
          const [supportedJwt, verifyJwt, settleJwt] = await Promise.all([
            generateJwt({
              apiKeyId: CDP_API_KEY_ID,
              apiKeySecret: CDP_API_KEY_SECRET,
              requestMethod: "GET",
              requestHost: host,
              requestPath: `${basePath}/supported`,
            }),
            generateJwt({
              apiKeyId: CDP_API_KEY_ID,
              apiKeySecret: CDP_API_KEY_SECRET,
              requestMethod: "POST",
              requestHost: host,
              requestPath: `${basePath}/verify`,
            }),
            generateJwt({
              apiKeyId: CDP_API_KEY_ID,
              apiKeySecret: CDP_API_KEY_SECRET,
              requestMethod: "POST",
              requestHost: host,
              requestPath: `${basePath}/settle`,
            }),
          ]);
          return {
            supported: { Authorization: `Bearer ${supportedJwt}` },
            verify: { Authorization: `Bearer ${verifyJwt}` },
            settle: { Authorization: `Bearer ${settleJwt}` },
          };
        };
      } else if (isCdpFacilitator) {
        throw new Error(
          "CDP facilitator requires CDP_API_KEY_ID and CDP_API_KEY_SECRET",
        );
      }
      return new HTTPFacilitatorClient(config);
    }

    const facilitatorClient = buildFacilitatorClient();
    const resourceServer = new x402ResourceServer(facilitatorClient).register(
      CELO_NETWORK,
      new ExactEvmScheme(),
    );
    paymentMw = paymentMiddleware(
      {
        "POST /issueCredential": {
          accepts: [
            {
              scheme: "exact",
              price: `$${ISSUE_CREDENTIAL_PRICE_USD}`,
              network: CELO_NETWORK,
              payTo: PAY_TO,
            },
          ],
          description: "Issue one verifiable credential (HashProof)",
          mimeType: "application/json",
        },
      },
      resourceServer,
    );
  }

  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({ origin: true })); // allow all origins in dev; restrict in production
  app.use(express.json());

  const noPaymentRateLimit = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_NO_PAYMENT_MAX,
    message: { error: "Too many requests. Include x402 payment to proceed." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use((req, res, next) => {
    const paidPaths = ["/issueCredential"];
    const isPaidRoute =
      req.method === "POST" && paidPaths.some((p) => req.path === p);
    if (!isPaidRoute) return next();
    const hasPayment = req.get("payment-signature") || req.get("x-payment");
    if (hasPayment) return next();
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
      const result = await executeIssueCredential(payload);
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
      const nowMs = Date.now();
      const revokedAtMs = cred.revoked_at ? new Date(cred.revoked_at).getTime() : null;
      const expiresAtMs = cred.expires_at ? new Date(cred.expires_at).getTime() : null;
      const derivedStatus = revokedAtMs
        ? "revoked"
        : expiresAtMs && nowMs > expiresAtMs
          ? "expired"
          : "active";
      const issuerVerified =
        (issuerEntity?.email_verified || issuerEntity?.domain_verified || issuerEntity?.kyb_verified) === true;
      const platformVerified =
        (platformEntity?.email_verified || platformEntity?.domain_verified || platformEntity?.kyb_verified) === true;
      // Prefer self-contained credential JSON; fallback to DB for legacy credentials
      return res.json({
        credential: cred.credential_json,
        status: derivedStatus,
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
        platform_verified: platformVerified,
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

  app.get("/entities/:id", readOnlyRateLimit, async (req, res) => {
    try {
      const entity = await getEntityById(req.params.id);
      if (!entity) {
        return res.status(404).json({ error: "Entity not found" });
      }

      const verifiedCount =
        (entity.email_verified ? 1 : 0) +
        (entity.domain_verified ? 1 : 0) +
        (entity.kyb_verified ? 1 : 0);
      const verifiedPercentage = (verifiedCount / 3) * 100;

      return res.json({
        entity,
        id: entity.id,
        role: entity.role,
        display_name: entity.display_name,
        slug: entity.slug,
        website: entity.website,
        logo_url: entity.logo_url,
        status: entity.status,
        email_verified: entity.email_verified,
        domain_verified: entity.domain_verified,
        kyb_verified: entity.kyb_verified,
        last_verified_at: entity.last_verified_at,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
        verified_count: verifiedCount,
        verified_percentage: verifiedPercentage,
      });
    } catch (err) {
      console.error("[entity] error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/", readOnlyRateLimit, (_req, res) => {
    res.json({
      name: "HashProof API",
      description: "Issue verifiable credentials via x402 payment on Celo.",
      endpoints: {
        "POST /issueCredential": `Paid (${ISSUE_CREDENTIAL_PRICE_USD} USD). Issue one credential. Full payload required.`,
      },
    });
  });

  return app;
}
