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
import { createX402Charge } from "../middleware/x402Charge.js";
import { sendError } from "../utils/errors.js";
import { appError } from "../utils/appError.js";
import { refreshSession, sendSignInEmail, verifyEmailCode } from "../services/auth.js";
import { getEntityById } from "../services/getEntity.js";
import {
  MANAGER_ROLES,
  addMember,
  createOrganization,
  getMembership,
  getPanelKey,
  listMembers,
  listMemberships,
  removeMember,
} from "../services/accounts.js";
import { listCredentials } from "../services/listCredentials.js";
import { revokeCredential } from "../services/revokeCredential.js";
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
  transferCredits,
} from "../services/dashboardKeys.js";
import {
  MAX_CREDITS_PER_PURCHASE,
  STRIPE_CREDIT_PRICE_CENTS,
  STRIPE_MIN_CREDITS,
  X402_CREDIT_PRICE_CENTS,
  X402_MIN_CREDITS,
  completeX402Purchase,
  createStripeCheckout,
  isStripeConfigured,
  listPurchases,
  parseCredits,
  priceCents,
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
      x402: { cents_per_credit: X402_CREDIT_PRICE_CENTS, min_credits: X402_MIN_CREDITS, currency: "USDC" },
      max_credits_per_purchase: MAX_CREDITS_PER_PURCHASE,
    });
  });

  // x402 settles the payment before the handler runs, so membership and the key
  // must be checked before it too — nobody pays for a purchase that will fail.
  const x402Charge = createX402Charge({
    skipPayment,
    priceFor: (req) => {
      const credits = parseCredits(req.body?.credits, "x402");
      req.x402Credits = credits;
      return { cents: priceCents(credits, "x402"), description: `${credits} HashProof credits` };
    },
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
      await sendSignInEmail({ email: req.body?.email, redirectTo: `${frontendUrl}/app/auth` });
      return res.json({ sent: true });
    } catch (err) {
      return fail(res, err, { handler: "app/auth/email" });
    }
  });

  router.post("/auth/verify", emailLimit, async (req, res) => {
    try {
      return res.json(await verifyEmailCode({ email: req.body?.email, token: req.body?.token }));
    } catch (err) {
      return fail(res, err, { handler: "app/auth/verify" });
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
      const [panel, keys, all, revoked] = await Promise.all([
        getPanelKey(req.entity.id),
        listEntityKeys(req.entity.id),
        listCredentials({ entityId: req.entity.id, limit: 5 }, baseUrl),
        listCredentials({ entityId: req.entity.id, status: "revoked", limit: 1 }, baseUrl),
      ]);
      const { authorized_wallets: _w, ...entity } = req.entity;
      return res.json({
        entity,
        role: req.role,
        balance: panel?.credits_balance ?? 0,
        api_keys_balance: keys
          .filter((k) => k.kind === "api" && !k.revoked_at)
          .reduce((s, k) => s + (k.credits_balance || 0), 0),
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

  org.post("/keys/transfer", managersOnly, async (req, res) => {
    try {
      const { from_key_id, to_key_id, amount } = req.body || {};
      if (!UUID_RE.test(from_key_id || "") || !UUID_RE.test(to_key_id || "")) throw new Error("API key not found");
      return res.json(
        await transferCredits({ entityId: req.entity.id, fromKeyId: from_key_id, toKeyId: to_key_id, amount }),
      );
    } catch (err) {
      return fail(res, err, { handler: "app/keys transfer" });
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

  org.post("/keys/:keyId/checkout", managersOnly, loadKey, async (req, res) => {
    try {
      if (!isStripeConfigured()) {
        return res.status(503).json({ error: "Card payments are not available yet.", code: "stripe_unavailable" });
      }
      if (req.key.revoked_at) throw appError("Cannot buy credits for a revoked key");
      return res.json(
        await createStripeCheckout({
          entity: req.entity,
          key: req.key,
          user: req.user,
          credits: req.body?.credits,
          returnUrl: safeReturnUrl(req.body?.return_url, frontendUrl),
        }),
      );
    } catch (err) {
      return fail(res, err, { handler: "app/keys checkout" });
    }
  });

  org.post(
    "/keys/:keyId/x402",
    managersOnly,
    loadKey,
    (req, res, next) =>
      req.key.revoked_at
        ? res.status(400).json({ error: "Cannot buy credits for a revoked key", code: "invalid_payload" })
        : next(),
    x402Charge,
    async (req, res) => {
      try {
        const out = await completeX402Purchase({
          entity: req.entity,
          key: req.key,
          user: req.user,
          credits: req.x402Credits,
          txHash: req.x402.txHash,
        });
        const updated = await getEntityKey(req.entity.id, req.key.id);
        return res.json({ ...out, credits: req.x402Credits, tx_hash: req.x402.txHash, credits_balance: updated.credits_balance });
      } catch (err) {
        // Paid but not credited: log loudly with the tx so it can be fixed by hand.
        console.error(
          `[app/x402] PAID BUT NOT CREDITED entity=${req.entity.id} key=${req.key.id} tx=${req.x402?.txHash} credits=${req.x402Credits}:`,
          err.message,
        );
        return fail(res, err, { handler: "app/keys x402", tx: req.x402?.txHash });
      }
    },
  );

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
        await addMember({ entityId: req.entity.id, email: req.body?.email, role, redirectTo: `${frontendUrl}/app/auth` }),
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
