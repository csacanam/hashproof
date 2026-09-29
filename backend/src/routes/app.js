/**
 * Dashboard API, under /app. Session-only (see middleware/session.js).
 *
 * Organization-scoped routes live under /app/organizations/:entityId and check
 * membership first; a user who is not a member gets the same 404 as for an id
 * that does not exist. Roles: every member can issue, list and revoke; owners
 * and admins also manage templates, keys, credits and members.
 */

import express from "express";
import rateLimit from "express-rate-limit";
import { requireSession } from "../middleware/session.js";
import { sendError } from "../utils/errors.js";
import { getEntityBalance } from "../services/apiKeys.js";
import { refreshSession, sendSignInEmail, verifyEmailCode, verifyEmailLink } from "../services/auth.js";
import { getEntityById } from "../services/getEntity.js";
import {
  MANAGER_ROLES,
  addMember,
  createOrganization,
  getMembership,
  listMembers,
  listMemberships,
  removeMember,
} from "../services/accounts.js";
import { listCredentials } from "../services/listCredentials.js";
import { revokeCredential } from "../services/revokeCredential.js";
import { resendCredentialEmail } from "../services/holderNotify.js";
import { buildPayload, issueFromDashboard } from "../services/dashboardIssuance.js";
import {
  createTemplate,
  listTemplates,
  updateTemplate,
  uploadBackground,
} from "../services/dashboardTemplates.js";
import {
  createEntityKey,
  getEntityKey,
  listEntityKeys,
  revokeEntityKey,
} from "../services/dashboardKeys.js";
import {
  MAX_CREDITS_PER_PURCHASE,
  STRIPE_CREDIT_PRICE_CENTS,
  STRIPE_MIN_CREDITS,
  VOULTI_CREDIT_PRICE_CENTS,
  VOULTI_MIN_CREDITS,
  createVoultiInvoice,
  getPurchase,
  isVoultiConfigured,
  syncVoultiInvoice,
  createStripeCheckout,
  isStripeConfigured,
  listPurchases,
} from "../services/payments.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_VALIDATE_ROWS = 5000;

function fail(res, err, context) {
  if (err?.status && err?.code) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.field && { field: err.field }),
      ...(err.row !== undefined && { row: err.row }),
    });
  }
  return sendError(res, err, context);
}

/** Where Stripe may send the browser back to: our own frontend only. */
function safeReturnUrl(value, frontendUrl) {
  const fallback = `${frontendUrl}/app/developers`;
  try {
    const u = new URL(String(value || ""));
    const allowed = new URL(frontendUrl);
    return u.origin === allowed.origin ? u.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function createAppRouter({ baseUrl, frontendUrl, skipPayment = false }) {
  const router = express.Router();

  router.use(
    rateLimit({
      windowMs: 60_000,
      max: Number(process.env.APP_RATE_LIMIT_MAX) || 600,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests, slow down a moment.", code: "rate_limited" },
    }),
  );

  // Public: what credits cost, so the pricing page and the dashboard agree.
  router.get("/pricing", (_req, res) => {
    res.json({
      stripe: { cents_per_credit: STRIPE_CREDIT_PRICE_CENTS, min_credits: STRIPE_MIN_CREDITS, available: isStripeConfigured() },
      crypto: { cents_per_credit: VOULTI_CREDIT_PRICE_CENTS, min_credits: VOULTI_MIN_CREDITS, available: isVoultiConfigured() },
      max_credits_per_purchase: MAX_CREDITS_PER_PURCHASE,
    });
  });

  // Sign-in. Its own, tighter limit: each call can send an email.
  const emailLimit = rateLimit({
    windowMs: 60_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Wait a minute.", code: "rate_limited" },
  });

  router.post("/auth/email", emailLimit, async (req, res) => {
    try {
      await sendSignInEmail({ email: req.body?.email, redirectTo: `${frontendUrl}/app/auth`, locale: req.body?.locale });
      return res.json({ sent: true });
    } catch (err) {
      return fail(res, err, { handler: "app/auth/email" });
    }
  });

  router.post("/auth/verify", emailLimit, async (req, res) => {
    try {
      return res.json(await verifyEmailCode({ email: req.body?.email, token: req.body?.token, locale: req.body?.locale }));
    } catch (err) {
      return fail(res, err, { handler: "app/auth/verify" });
    }
  });

  router.post("/auth/verify-link", emailLimit, async (req, res) => {
    try {
      return res.json(await verifyEmailLink({ tokenHash: req.body?.token_hash, type: req.body?.type, locale: req.body?.locale }));
    } catch (err) {
      return fail(res, err, { handler: "app/auth/verify-link" });
    }
  });

  router.post("/auth/refresh", async (req, res) => {
    try {
      return res.json(await refreshSession(req.body?.refresh_token));
    } catch (err) {
      return fail(res, err, { handler: "app/auth/refresh" });
    }
  });

  router.use(requireSession());

  router.get("/me", async (req, res) => {
    try {
      return res.json({ user: req.user, organizations: await listMemberships(req.user.id) });
    } catch (err) {
      return fail(res, err, { handler: "app/me" });
    }
  });

  router.post("/organizations", async (req, res) => {
    try {
      const { display_name, slug, website } = req.body || {};
      const entity = await createOrganization({ user: req.user, displayName: display_name, slug, website });
      return res.status(201).json({ ...entity, role: "owner" });
    } catch (err) {
      return fail(res, err, { handler: "app/organizations create" });
    }
  });

  // ── Organization scope ──────────────────────────────────────────────────
  const org = express.Router({ mergeParams: true });
  router.use("/organizations/:entityId", org);

  org.use(async (req, res, next) => {
    try {
      const { entityId } = req.params;
      if (!UUID_RE.test(entityId)) return res.status(404).json({ error: "Organization not found", code: "not_found" });
      const role = await getMembership(req.user.id, entityId);
      if (!role) return res.status(404).json({ error: "Organization not found", code: "not_found" });
      const entity = await getEntityById(entityId);
      if (!entity) return res.status(404).json({ error: "Organization not found", code: "not_found" });
      req.entity = entity;
      req.role = role;
      next();
    } catch (err) {
      return fail(res, err, { handler: "app/org scope" });
    }
  });

  const managersOnly = (req, res, next) =>
    MANAGER_ROLES.includes(req.role)
      ? next()
      : res.status(403).json({ error: "Only owners and admins can do this.", code: "forbidden" });

  org.get("/", async (req, res) => {
    try {
      const [balance, keys, all, revoked] = await Promise.all([
        getEntityBalance(req.entity.id),
        listEntityKeys(req.entity.id),
        listCredentials({ entityId: req.entity.id, limit: 5 }, baseUrl),
        listCredentials({ entityId: req.entity.id, status: "revoked", limit: 1 }, baseUrl),
      ]);
      const { authorized_wallets: _w, ...entity } = req.entity;
      return res.json({
        entity,
        role: req.role,
        balance,
        active_api_keys: keys.filter((k) => k.kind === "api" && !k.revoked_at).length,
        credentials: { total: all.total, revoked: revoked.total, recent: all.credentials },
      });
    } catch (err) {
      return fail(res, err, { handler: "app/org overview" });
    }
  });

  // Credentials
  org.get("/credentials", async (req, res) => {
    try {
      const { status, q, context, from, to, limit, offset } = req.query;
      return res.json(
        await listCredentials({ entityId: req.entity.id, status, q, context, from, to, limit, offset }, baseUrl),
      );
    } catch (err) {
      return fail(res, err, { handler: "app/credentials" });
    }
  });

  org.post("/credentials/:credentialId/revoke", async (req, res) => {
    try {
      if (req.body?.confirm !== true) {
        return res.status(400).json({ error: "Revocation is permanent. Confirm to proceed.", code: "confirmation_required" });
      }
      return res.json(
        await revokeCredential({
          credentialId: req.params.credentialId,
          caller: { kind: "api_key", entityId: req.entity.id },
          reason: req.body?.reason,
        }),
      );
    } catch (err) {
      if (err?.code === "revoke_chain_failed") {
        return res.status(503).json({
          error: "Could not revoke on-chain right now. Nothing changed — retry in a few seconds.",
          code: "chain_unavailable",
          retryable: true,
        });
      }
      return fail(res, err, { handler: "app/revoke" });
    }
  });

  // Email a credential to its holder again, or for the first time; a new
  // address replaces the stored one.
  org.post("/credentials/:credentialId/notify", async (req, res) => {
    try {
      if (!UUID_RE.test(req.params.credentialId)) throw new Error("Credential not found");
      return res.json(
        await resendCredentialEmail({
          entity: req.entity,
          credentialId: req.params.credentialId,
          email: req.body?.email,
          locale: req.body?.locale === "en" ? "en" : "es",
          baseUrl,
        }),
      );
    } catch (err) {
      return fail(res, err, { handler: "app/credentials notify" });
    }
  });

  // Issue
  org.post("/issue/validate", (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows) return res.status(400).json({ error: "rows must be an array", code: "invalid_payload" });
    if (rows.length > MAX_VALIDATE_ROWS) {
      return res.status(400).json({ error: `At most ${MAX_VALIDATE_ROWS} rows per batch`, code: "invalid_payload" });
    }
    const errors = [];
    rows.forEach((row, i) => {
      try {
        buildPayload(req.entity, row);
      } catch (err) {
        errors.push({ row: i, error: err.message });
      }
    });
    return res.json({ valid: rows.length - errors.length, errors });
  });

  org.post("/issue", async (req, res) => {
    try {
      const out = await issueFromDashboard({
        entity: req.entity,
        input: req.body?.input || {},
        idempotencyKey: req.body?.idempotency_key || null,
      });
      return res.status(out.created ? 202 : 200).json({
        ...out,
        status_url: `${baseUrl.replace(/\/$/, "")}/issuanceJobs/${out.job_id}`,
      });
    } catch (err) {
      return fail(res, err, { handler: "app/issue", entity_id: req.entity.id });
    }
  });

  // Templates
  org.get("/templates", async (req, res) => {
    try {
      return res.json(await listTemplates(req.entity.id));
    } catch (err) {
      return fail(res, err, { handler: "app/templates" });
    }
  });

  org.post("/templates", managersOnly, async (req, res) => {
    try {
      return res.status(201).json(await createTemplate({ entity: req.entity, ...(req.body || {}) }));
    } catch (err) {
      return fail(res, err, { handler: "app/templates create" });
    }
  });

  org.put("/templates/:templateId", managersOnly, async (req, res) => {
    try {
      if (!UUID_RE.test(req.params.templateId)) throw new Error("Template not found");
      return res.json(
        await updateTemplate({ entityId: req.entity.id, templateId: req.params.templateId, ...(req.body || {}) }),
      );
    } catch (err) {
      return fail(res, err, { handler: "app/templates update" });
    }
  });

  org.post(
    "/backgrounds",
    managersOnly,
    express.raw({ type: ["image/png", "image/jpeg"], limit: "8mb" }),
    async (req, res) => {
      try {
        return res.status(201).json(await uploadBackground({ entityId: req.entity.id, buffer: req.body }));
      } catch (err) {
        return fail(res, err, { handler: "app/backgrounds" });
      }
    },
  );

  // Developers: keys and credits
  org.get("/keys", async (req, res) => {
    try {
      return res.json(await listEntityKeys(req.entity.id));
    } catch (err) {
      return fail(res, err, { handler: "app/keys" });
    }
  });

  org.post("/keys", managersOnly, async (req, res) => {
    try {
      return res.status(201).json(
        await createEntityKey({ entityId: req.entity.id, userId: req.user.id, name: req.body?.name }),
      );
    } catch (err) {
      return fail(res, err, { handler: "app/keys create" });
    }
  });

  const loadKey = async (req, res, next) => {
    try {
      if (!UUID_RE.test(req.params.keyId)) throw new Error("API key not found");
      req.key = await getEntityKey(req.entity.id, req.params.keyId);
      next();
    } catch (err) {
      return fail(res, err, { handler: "app/keys load" });
    }
  };

  org.post("/keys/:keyId/revoke", managersOnly, loadKey, async (req, res) => {
    try {
      return res.json(await revokeEntityKey({ entityId: req.entity.id, keyId: req.key.id }));
    } catch (err) {
      return fail(res, err, { handler: "app/keys revoke" });
    }
  });

  // Credits: bought for the organization, whichever way it pays.
  org.post("/purchases/stripe", managersOnly, async (req, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ error: "Card payments are not available yet.", code: "stripe_unavailable" });
      }
      return res.json(
        await createStripeCheckout({
          entity: req.entity,
          user: req.user,
          credits: req.body?.credits,
          returnUrl: safeReturnUrl(req.body?.return_url, frontendUrl),
        }),
      );
    } catch (err) {
      return fail(res, err, { handler: "app/purchases stripe" });
    }
  });

  org.post("/purchases/crypto", managersOnly, async (req, res) => {
    try {
      if (!isVoultiConfigured()) {
        return res.status(503).json({ error: "Crypto payments are not available yet.", code: "crypto_unavailable" });
      }
      return res.status(201).json(await createVoultiInvoice({
          entity: req.entity,
          user: req.user,
          credits: req.body?.credits,
          returnUrl: `${frontendUrl}/app/developers?purchase=crypto`,
        }));
    } catch (err) {
      return fail(res, err, { handler: "app/purchases crypto" });
    }
  });

  // The page polls this while the payer is on Voulti's checkout; each call asks
  // Voulti and credits the moment the invoice is paid.
  org.get("/purchases/:purchaseId", async (req, res) => {
    try {
      if (!UUID_RE.test(req.params.purchaseId)) throw new Error("Purchase not found");
      let purchase = await getPurchase(req.entity.id, req.params.purchaseId);
      if (!purchase) throw new Error("Purchase not found");
      let providerStatus = null;
      if (purchase.method === "voulti" && purchase.status === "pending") {
        providerStatus = (await syncVoultiInvoice(purchase.external_ref)).status;
        purchase = await getPurchase(req.entity.id, req.params.purchaseId);
      }
      const { external_ref: _ref, ...out } = purchase;
      return res.json({ ...out, provider_status: providerStatus, balance: await getEntityBalance(req.entity.id) });
    } catch (err) {
      return fail(res, err, { handler: "app/purchase status" });
    }
  });

  org.get("/purchases", async (req, res) => {
    try {
      return res.json(await listPurchases(req.entity.id));
    } catch (err) {
      return fail(res, err, { handler: "app/purchases" });
    }
  });

  // Members
  org.get("/members", async (req, res) => {
    try {
      return res.json(await listMembers(req.entity.id));
    } catch (err) {
      return fail(res, err, { handler: "app/members" });
    }
  });

  org.post("/members", managersOnly, async (req, res) => {
    try {
      const role = req.body?.role || "issuer";
      if (role === "owner" && req.role !== "owner") {
        return res.status(403).json({ error: "Only an owner can add another owner.", code: "forbidden" });
      }
      return res.status(201).json(
        await addMember({
          entityId: req.entity.id,
          email: req.body?.email,
          role,
          redirectTo: `${frontendUrl}/app/auth`,
          locale: req.body?.locale,
        }),
      );
    } catch (err) {
      return fail(res, err, { handler: "app/members add" });
    }
  });

  org.delete("/members/:userId", async (req, res) => {
    try {
      if (req.role !== "owner" && req.params.userId !== req.user.id) {
        return res.status(403).json({ error: "Only an owner can remove other members.", code: "forbidden" });
      }
      if (!UUID_RE.test(req.params.userId)) throw new Error("Member not found");
      await removeMember({ entityId: req.entity.id, userId: req.params.userId });
      return res.status(204).end();
    } catch (err) {
      return fail(res, err, { handler: "app/members remove" });
    }
  });

  return router;
}
