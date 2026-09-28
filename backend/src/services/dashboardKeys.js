/**
 * API keys as an organization manages them from the Developers section.
 *
 * Reuses the key format and hashing of apiKeys.js, so a key made here is
 * indistinguishable to /issueCredential from one made through /admin.
 */

import crypto from "node:crypto";
import { supabase } from "../supabase.js";
import { generateSecret } from "./apiKeys.js";
import { appError } from "../utils/appError.js";

const MAX_ACTIVE_KEYS = 20;

/** Keys of an entity, newest first. Never includes secrets or hashes. */
export async function listEntityKeys(entityId) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, kind, credits_balance, credits_used, created_at, last_used_at, revoked_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`database: ${error.message}`);
  // The panel key is the organization's dashboard balance, shown on its own.
  return (data || []).map((k) => ({ ...k, kind: k.kind || "api" }));
}

/**
 * New key for the entity. The secret is returned once and never stored.
 * Starts at zero credits: credits are bought, or moved from another key.
 */
export async function createEntityKey({ entityId, userId, name }) {
  const label = String(name || "").trim().slice(0, 80) || "API key";

  const { count, error: countErr } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", entityId)
    .eq("kind", "api")
    .is("revoked_at", null);
  if (countErr) throw new Error(`database: ${countErr.message}`);
  if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
    throw appError(`An organization can have at most ${MAX_ACTIVE_KEYS} active keys; revoke one first`, 409, "too_many_keys");
  }

  const { secret, keyHash } = generateSecret();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({ entity_id: entityId, key_hash: keyHash, name: label, kind: "api", credits_balance: 0, created_by: userId })
    .select("id, name, kind, credits_balance, credits_used, created_at, last_used_at, revoked_at")
    .single();
  if (error) throw new Error(`database: ${error.message}`);
  return { ...data, api_key: secret };
}

/**
 * Revoke a key: the old secret stops working at once.
 *
 * Done by overwriting the hash with one of random bytes rather than by adding
 * a check to key lookup — the lookup /issueCredential uses stays exactly as it
 * was. The row stays, with its balance, so jobs and purchases still resolve;
 * leftover credits can be moved to another key first.
 */
export async function revokeEntityKey({ entityId, keyId }) {
  const key = await getEntityKey(entityId, keyId);
  if (key.kind === "panel") throw appError("The dashboard balance cannot be revoked");
  if (key.revoked_at) return key;

  const unusableHash = crypto.createHash("sha256").update(crypto.randomBytes(32)).digest("hex");
  const { data, error } = await supabase
    .from("api_keys")
    .update({ key_hash: unusableHash, revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("entity_id", entityId)
    .select("id, name, kind, credits_balance, credits_used, created_at, last_used_at, revoked_at")
    .single();
  if (error) throw new Error(`database: ${error.message}`);
  return data;
}

/**
 * Move credits between two keys of the same entity. Deduct first, through the
 * same atomic function issuance uses one credit at a time; only credit the
 * destination once the source has actually paid.
 */
export async function transferCredits({ entityId, fromKeyId, toKeyId, amount }) {
  const n = Math.trunc(Number(amount));
  if (!Number.isFinite(n) || n < 1) throw new Error("amount must be a positive whole number");
  if (fromKeyId === toKeyId) throw new Error("from and to must be different keys");

  const [from, to] = await Promise.all([getEntityKey(entityId, fromKeyId), getEntityKey(entityId, toKeyId)]);
  if (to.revoked_at) throw appError("Cannot move credits to a revoked key");

  const { data, error } = await supabase.rpc("move_api_credits", {
    p_from: from.id,
    p_to: to.id,
    p_amount: n,
  });
  if (error) throw new Error(`database: ${error.message}`);
  if (data?.ok !== true) throw appError("The source key does not have that many credits", 402, "insufficient_credits");
  return { from_balance: data.from_balance, to_balance: data.to_balance };
}

/** A key that belongs to the entity, or a not-found error. */
export async function getEntityKey(entityId, keyId) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, kind, credits_balance, credits_used, created_at, last_used_at, revoked_at, entity_id")
    .eq("id", keyId)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);
  if (!data) throw new Error("API key not found");
  return data;
}
