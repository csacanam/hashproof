/**
 * Revoke a credential: on-chain first, where verification reads it, and in the
 * database alongside.
 *
 * Irreversible — the registry has no un-revoke — which is why the route asks
 * for an explicit confirmation and this function refuses anyone but the entity
 * that issued (or the platform that issued for it).
 */

import { supabase } from "../supabase.js";
import { revokeOnChain } from "./issueCredential.js";
import { invalidateContractCache } from "./verifyPipeline.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON = 500;

// The contract's custom error when the record is already revoked. Seen when a
// credential was revoked by hand before this endpoint existed.
function isAlreadyRevokedOnChain(err) {
  const text = `${err?.shortMessage || ""} ${err?.message || ""} ${err?.revert?.name || ""}`;
  return /AlreadyRevoked/.test(text);
}

/**
 * @param {{ credentialId: string, caller: { kind: string, entityId?: string }, reason?: string }} args
 * @returns {Promise<{ id: string, status: "revoked", revoked_at: string, tx_hash: string | null, already_revoked: boolean }>}
 */
export async function revokeCredential({ credentialId, caller, reason }) {
  if (!UUID_RE.test(credentialId || "")) throw new Error("Credential not found");

  const { data: cred, error } = await supabase
    .from("credentials")
    .select("id, issuer_entity_id, platform_entity_id, contract_address, revoked_at, revocation_tx_hash")
    .eq("id", credentialId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cred) throw new Error("Credential not found");

  const owns =
    caller.kind === "admin" ||
    caller.entityId === cred.issuer_entity_id ||
    caller.entityId === cred.platform_entity_id;
  // Same answer as a missing id: a key must not learn which ids exist elsewhere.
  if (!owns) throw new Error("Credential not found");

  if (cred.revoked_at) {
    return {
      id: cred.id,
      status: "revoked",
      revoked_at: cred.revoked_at,
      tx_hash: cred.revocation_tx_hash ?? null,
      already_revoked: true,
    };
  }

  const cleanReason = typeof reason === "string" ? reason.trim().slice(0, MAX_REASON) || null : null;

  // Claim the row before sending anything: of two simultaneous revokes only one
  // gets it, so only one tx is sent and the other doesn't revert on-chain.
  const revokedAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from("credentials")
    .update({ revoked_at: revokedAt, revocation_reason: cleanReason })
    .eq("id", cred.id)
    .is("revoked_at", null)
    .select("id");
  if (claimErr) throw new Error(claimErr.message);
  if (!claimed?.length) {
    // Lost the race; report what the winner wrote.
    return revokeCredential({ credentialId, caller, reason });
  }

  let txHash = null;
  try {
    txHash = await revokeOnChain({ credentialId: cred.id, contractAddress: cred.contract_address });
  } catch (err) {
    if (!isAlreadyRevokedOnChain(err)) {
      // Nothing happened on-chain, so the database must not say it did.
      await supabase
        .from("credentials")
        .update({ revoked_at: null, revocation_reason: null })
        .eq("id", cred.id);
      console.error(`[revokeCredential] on-chain revoke failed for ${cred.id}:`, err?.message);
      const wrapped = new Error("On-chain revocation failed");
      wrapped.code = "revoke_chain_failed";
      wrapped.cause = err;
      throw wrapped;
    }
  }

  if (txHash) {
    await supabase.from("credentials").update({ revocation_tx_hash: txHash }).eq("id", cred.id);
  }
  invalidateContractCache(cred.id);

  return { id: cred.id, status: "revoked", revoked_at: revokedAt, tx_hash: txHash, already_revoked: false };
}
