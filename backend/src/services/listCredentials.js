/**
 * The credentials an entity issued, newest first — what an integrator reconciles
 * against and what the dashboard lists.
 *
 * Scoped by entity, not by key: every key of an entity sees the same list.
 * Credentials a platform issued on the entity's behalf are included, and so are
 * the ones the entity issued as a platform for someone else.
 */

import { supabase } from "../supabase.js";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/**
 * @param {{ entityId: string, status?: string, q?: string, context?: string, from?: string, to?: string, limit?: number, offset?: number }} args
 * @param {string} baseUrl
 */
export async function listCredentials(
  { entityId, status, q, context, from, to, limit, offset },
  baseUrl,
) {
  const lim = Math.min(Math.max(Math.trunc(Number(limit)) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const off = Math.max(Math.trunc(Number(offset)) || 0, 0);

  if (status && !["active", "revoked", "expired"].includes(status)) {
    throw new Error("status must be one of active, revoked, expired");
  }

  // The name comes from the credential itself rather than a join on holders:
  // it is what was issued, and the API role has no grant on holders.
  // !inner only when filtering on the context, so an unfiltered list doesn't
  // depend on the join.
  const contextSel = context ? "contexts!inner(title)" : "contexts(title)";

  let query = supabase
    .from("credentials")
    .select(
      `id, credential_type, created_at, expires_at, revoked_at, revocation_reason, revocation_tx_hash, tx_hash, issuer_entity_id, platform_entity_id, holder_name:credential_json->credentialSubject->>full_name, ${contextSel}, templates(slug)`,
      { count: "exact" },
    )
    .or(`issuer_entity_id.eq.${entityId},platform_entity_id.eq.${entityId}`)
    .order("created_at", { ascending: false })
    .range(off, off + lim - 1);

  const now = new Date().toISOString();
  if (status === "revoked") query = query.not("revoked_at", "is", null);
  if (status === "expired") query = query.is("revoked_at", null).lt("expires_at", now);
  if (status === "active") query = query.is("revoked_at", null).or(`expires_at.is.null,expires_at.gte.${now}`);
  if (q) query = query.ilike("credential_json->credentialSubject->>full_name", `%${escapeLike(q)}%`);
  if (context) query = query.ilike("contexts.title", `%${escapeLike(context)}%`);
  if (from) query = query.gte("created_at", toIso(from, "from"));
  if (to) query = query.lte("created_at", toIso(to, "to"));

  const { data, error, count } = await query;
  if (error) throw new Error(`database: ${error.message}`);

  const root = baseUrl.replace(/\/$/, "");
  return {
    total: count ?? 0,
    limit: lim,
    offset: off,
    credentials: (data || []).map((c) => ({
      id: c.id,
      holder_name: c.holder_name ?? null,
      context_title: c.contexts?.title ?? null,
      template: c.templates?.slug ?? null,
      credential_type: c.credential_type,
      status: c.revoked_at
        ? "revoked"
        : c.expires_at && c.expires_at < now
          ? "expired"
          : "active",
      issued_at: c.created_at,
      expires_at: c.expires_at,
      revoked_at: c.revoked_at,
      revocation_reason: c.revocation_reason ?? null,
      revocation_tx_hash: c.revocation_tx_hash ?? null,
      role: c.issuer_entity_id === entityId ? "issuer" : "platform",
      tx_hash: c.tx_hash,
      verification_url: `${root}/verify/${c.id}`,
    })),
  };
}

function escapeLike(s) {
  return String(s).slice(0, 100).replace(/[\\%_,()]/g, (ch) => `\\${ch}`);
}

function toIso(value, name) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${name} must be an ISO date`);
  return d.toISOString();
}
