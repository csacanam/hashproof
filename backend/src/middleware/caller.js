/**
 * Who is calling a management route (list, revoke, …) — as opposed to paying
 * for one. Issuance authenticates in the payment middleware because a key there
 * is also a wallet; these routes cost nothing, so a key with zero credits must
 * still be able to see and revoke what it issued.
 *
 * Every management decision is made against `entityId`, never against the key
 * itself: two keys of the same entity manage the same credentials.
 */

import { getByPlainKey } from "../services/apiKeys.js";

/**
 * @returns {Promise<{ kind: "admin" } | { kind: "api_key", entityId: string, keyId: string } | null>}
 */
export async function resolveCaller(req) {
  const raw =
    (req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim() ||
    (req.get("x-api-key") || "").trim();
  if (!raw) return null;

  if (process.env.ADMIN_SECRET && raw === process.env.ADMIN_SECRET) return { kind: "admin" };

  const key = await getByPlainKey(raw);
  if (!key) return null;
  return { kind: "api_key", entityId: key.entity_id, keyId: key.id };
}

/** Express middleware: 401 unless an admin secret or a valid API key was sent. */
export function requireCaller() {
  return async (req, res, next) => {
    try {
      const caller = await resolveCaller(req);
      if (!caller) {
        return res.status(401).json({
          error: "Send your API key as Authorization: Bearer <key> or X-API-Key.",
          code: "unauthorized",
        });
      }
      req.caller = caller;
      next();
    } catch (err) {
      next(err);
    }
  };
}
