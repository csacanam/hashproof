/**
 * API keys for institutions (no crypto). 1 credit = 1 credential.
 * Key is hashed (SHA-256); we never store the plain secret.
 */

import crypto from "node:crypto";
import { supabase } from "../supabase.js";

const KEY_PREFIX = "hp_";
const KEY_BYTES = 24;

function hashKey(plainKey) {
  return crypto.createHash("sha256").update(plainKey, "utf8").digest("hex");
}

/**
 * Generate a new secret key (returned once to the client).
 * @returns {{ secret: string, keyHash: string }}
 */
export function generateSecret() {
  const secret = KEY_PREFIX + crypto.randomBytes(KEY_BYTES).toString("base64url");
  return { secret, keyHash: hashKey(secret) };
}

/**
 * Find API key by plain secret. Returns row with entity_id, id, credits_balance.
 * @param {string} plainKey
 * @returns {Promise<{ id: string, entity_id: string, credits_balance: number } | null>}
 */
export async function getByPlainKey(plainKey) {
  if (!plainKey || typeof plainKey !== "string") return null;
  const keyHash = hashKey(plainKey.trim());
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, entity_id, credits_balance")
    .eq("key_hash", keyHash)
    .single();
  if (error || !data) return null;
  return data;
}

/**
 * Spend one credit. Call BEFORE issuing — this is the reservation, not the
 * receipt. ok=false means the key had nothing left and the caller must not do
 * the work; refund it with refundCredit if the work then fails.
 *
 * The whole decision happens in one conditional UPDATE inside Postgres. Reading
 * the balance here and writing it back would leave the gap that let a key with
 * one credit buy N certificates by firing N requests at once.
 *
 * @param {string} keyId - api_keys.id
 * @returns {Promise<{ ok: boolean, remaining: number, reason: string | null }>}
 */
export async function deductCredit(keyId) {
  const { data, error } = await supabase.rpc("deduct_api_credit", { p_key_id: keyId });
  if (error) {
    console.error("[apiKeys] deduct_api_credit failed:", error.message, "keyId:", keyId);
    // Refusing on an unreachable database is the safe direction: a caller sees a
    // retryable error, rather than getting a credential nobody was charged for.
    return { ok: false, remaining: 0, reason: "unavailable" };
  }
  return {
    ok: data?.ok === true,
    remaining: data?.remaining ?? 0,
    reason: data?.reason ?? null,
  };
}

/**
 * Return a credit taken for work that never completed.
 *
 * Never throws: it runs on the failure path, where the caller is already
 * handling a different error and must not have it replaced by this one. A
 * refund that fails is logged with the key id so it can be corrected by hand.
 *
 * @param {string} keyId - api_keys.id
 * @returns {Promise<{ ok: boolean, remaining: number }>}
 */
export async function refundCredit(keyId) {
  try {
    const { data, error } = await supabase.rpc("refund_api_credit", { p_key_id: keyId });
    if (error) throw new Error(error.message);
    if (data?.ok !== true) throw new Error("key not found");
    return { ok: true, remaining: data.remaining ?? 0 };
  } catch (err) {
    console.error(
      "[apiKeys] credit refund failed — this key was charged for work that did not complete. keyId:",
      keyId,
      "reason:",
      err.message,
    );
    return { ok: false, remaining: 0 };
  }
}

/**
 * Create a new API key for an entity. Returns the secret once (never stored).
 * @param {string} entityId - entities.id (uuid)
 * @param {number} initialCredits
 * @param {string} [name] - optional label
 * @returns {Promise<{ id: string, secret: string, entity_id: string, name: string | null, credits_balance: number }>}
 */
export async function createKey(entityId, initialCredits, name = null) {
  const { secret, keyHash } = generateSecret();
  const credits = Math.max(0, Number(initialCredits) || 0);
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      entity_id: entityId,
      key_hash: keyHash,
      name: name || null,
      credits_balance: credits,
    })
    .select("id, entity_id, name, credits_balance")
    .single();
  if (error) throw new Error(`Failed to create API key: ${error.message}`);
  return {
    ...data,
    secret,
    credits_balance: credits,
  };
}

/**
 * List all API keys (no secrets). Joins entity slug/display_name.
 */
export async function listKeys() {
  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, entity_id, name, credits_balance, credits_used, created_at, last_used_at");
  if (error) throw new Error(error.message);
  if (!keys?.length) return [];
  const entityIds = [...new Set(keys.map((k) => k.entity_id))];
  const { data: entities } = await supabase
    .from("entities")
    .select("id, slug, display_name")
    .in("id", entityIds);
  const byId = (entities || []).reduce((acc, e) => {
    acc[e.id] = e;
    return acc;
  }, {});
  return keys.map((k) => ({
    ...k,
    entity_slug: byId[k.entity_id]?.slug ?? null,
    entity_display_name: byId[k.entity_id]?.display_name ?? null,
  }));
}

/**
 * Add credits to an API key.
 * @param {string} keyId
 * @param {number} addCredits
 */
export async function addCredits(keyId, addCredits) {
  const amount = Math.max(0, Number(addCredits) || 0);
  if (amount === 0) return;
  const { error } = await supabase.rpc("add_api_credits", {
    p_key_id: keyId,
    p_amount: amount,
  });
  if (error) throw new Error(error.message);
}
