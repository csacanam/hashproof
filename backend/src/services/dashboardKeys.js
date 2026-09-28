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
    .select("id, name, kind, credits_used, created_at, last_used_at, revoked_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`database: ${error.message}`);
  // Keys hold no balance of their own: the organization's is shared. The panel
  // key is listed too, as the dashboard's own usage.
  return (data || []).map((k) => ({ ...k, kind: k.kind || "api" }));
}

/**
 * New key for the entity. The secret is returned once and never stored. It
 * spends from the organization's balance like every other key.
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
    .insert({ entity_id: entityId, key_hash: keyHash, name: label, kind: "api", created_by: userId })
    .select("id, name, kind, credits_used, created_at, last_used_at, revoked_at")
    .single();
  if (error) throw new Error(`database: ${error.message}`);
  return { ...data, api_key: secret };
}

/**
 * Revoke a key: the old secret stops working at once.
 *
 * Done by overwriting the hash with one of random bytes rather than by adding
 * a check to key lookup — the lookup /issueCredential uses stays exactly as it
 * was. The row stays so its usage history and queued jobs still resolve; the
 * organization's balance is untouched.
 */
export async function revokeEntityKey({ entityId, keyId }) {
  const key = await getEntityKey(entityId, keyId);
  if (key.kind === "panel") throw appError("The dashboard's own key cannot be revoked");
  if (key.revoked_at) return key;

  const unusableHash = crypto.createHash("sha256").update(crypto.randomBytes(32)).digest("hex");
  const { data, error } = await supabase
    .from("api_keys")
    .update({ key_hash: unusableHash, revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("entity_id", entityId)
    .select("id, name, kind, credits_used, created_at, last_used_at, revoked_at")
    .single();
  if (error) throw new Error(`database: ${error.message}`);
  return data;
}

/** A key that belongs to the entity, or a not-found error. */
export async function getEntityKey(entityId, keyId) {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, kind, credits_used, created_at, last_used_at, revoked_at, entity_id")
    .eq("id", keyId)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);
  if (!data) throw new Error("API key not found");
  return data;
}
