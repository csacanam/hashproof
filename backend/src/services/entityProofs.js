/**
 * Domain proofs for issuers.
 *
 * An issuer publishes a token in a TXT record on a domain they control. We
 * resolve it live on every check, so the badge means "this domain says so right
 * now" rather than "we approved it once". If the domain changes hands or the
 * record is removed, the proof stops passing on its own.
 *
 * The token is derived rather than stored, so a third party can reach the same
 * answer without asking us anything:
 *
 *     sha256("<entity_id>:<fqdn>")   →   hashproof-verification=<hex>
 *
 * It is not a secret. Knowing it is useless without control of the domain,
 * which is exactly the claim being proven.
 */

import { createHash } from "node:crypto";
import { supabase } from "../supabase.js";

const TXT_PREFIX = "hashproof-verification=";
const CACHE_TTL_MS = Number(process.env.DNS_PROOF_CACHE_TTL_MS) || 5 * 60 * 1000;
const DNS_TIMEOUT_MS = Number(process.env.DNS_PROOF_TIMEOUT_MS) || 5_000;

// Two independent resolvers: a proof that quietly stops passing because one
// provider had a bad minute is worse than no badge at all.
const RESOLVERS = [
  (name) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
  (name) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`,
];

/** fqdn → { at, records } */
const cache = new Map();

/** Test seam. Resolutions are cached, so cases would otherwise bleed into each other. */
export function resetDnsCache() {
  cache.clear();
}

/** Accepts a domain or a URL; returns a bare lowercase hostname. */
export function normalizeDomain(input) {
  if (!input || typeof input !== "string") return null;
  let value = input.trim().toLowerCase();
  if (value.includes("://")) {
    try {
      value = new URL(value).hostname;
    } catch {
      return null;
    }
  }
  value = value.replace(/^www\./, "").replace(/\/.*$/, "").replace(/\.$/, "");
  // Deliberately strict: a malformed domain should fail here, not silently
  // become a proof that can never pass.
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value) ? value : null;
}

export function expectedToken(entityId, fqdn) {
  return createHash("sha256").update(`${entityId}:${fqdn}`).digest("hex");
}

export function expectedRecord(entityId, fqdn) {
  return `${TXT_PREFIX}${expectedToken(entityId, fqdn)}`;
}

async function resolveTxt(fqdn, { fresh = false } = {}) {
  const hit = cache.get(fqdn);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.records;

  for (const build of RESOLVERS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS);
      const res = await fetch(build(fqdn), {
        headers: { accept: "application/dns-json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;

      const json = await res.json();
      // Long TXT values arrive split into quoted chunks that must be rejoined.
      const records = (json.Answer ?? [])
        .filter((a) => a.type === 16)
        .map((a) => String(a.data).replace(/"\s*"/g, "").replace(/^"|"$/g, ""));

      cache.set(fqdn, { at: Date.now(), records });
      return records;
    } catch {
      // Try the next resolver.
    }
  }
  return null;
}

/**
 * Checks one declared proof against live DNS.
 * @returns {Promise<{verified: boolean, result: 'verified'|'missing'|'error', expected: string}>}
 */
export async function checkProof({ entity_id, resource }, { fresh = false } = {}) {
  const expected = expectedRecord(entity_id, resource);
  const records = await resolveTxt(resource, { fresh });

  if (records === null) return { verified: false, result: "error", expected };
  return { verified: records.includes(expected), result: records.includes(expected) ? "verified" : "missing", expected };
}

export async function listProofs(entityId) {
  const { data, error } = await supabase
    .from("entity_proofs")
    .select("id, platform, method, resource, active, last_checked_at, last_result")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Declares a domain and returns the record the issuer has to publish. */
export async function declareProof(entityId, domain) {
  const fqdn = normalizeDomain(domain);
  if (!fqdn) throw new Error("A valid domain is required, e.g. example.com");

  const { data, error } = await supabase
    .from("entity_proofs")
    .upsert(
      { entity_id: entityId, platform: "dns", method: "txt", resource: fqdn, active: true },
      { onConflict: "entity_id,platform,resource" }
    )
    .select("id, platform, method, resource, active")
    .single();

  if (error) throw new Error(error.message);

  // Bypasses the cache. This call is only ever made because a person pressed a
  // button, usually seconds after publishing the record — serving them a cached
  // "no" for the next five minutes would look exactly like a broken feature.
  const { verified } = await checkProof({ entity_id: entityId, resource: fqdn }, { fresh: true });

  return {
    ...data,
    verified,
    expected_record: expectedRecord(entityId, fqdn),
    instructions: `Publish a TXT record on ${fqdn} with this exact value, then the proof verifies automatically.`,
  };
}

/**
 * Live status of an entity's proofs, for the verification response.
 *
 * Never throws: a resolver having a bad minute must not take down credential
 * verification, so a failure surfaces as an unverified proof.
 */
export async function verifyEntityProofs(entityId) {
  let declared = [];
  try {
    declared = (await listProofs(entityId)).filter((p) => p.active);
  } catch {
    return [];
  }

  return Promise.all(
    declared.map(async (p) => {
      const { verified, result, expected } = await checkProof({ entity_id: entityId, resource: p.resource });

      // Recorded for display and for noticing proofs that lapsed. Best-effort:
      // the answer we just computed is the authority, not this row.
      supabase
        .from("entity_proofs")
        .update({ last_checked_at: new Date().toISOString(), last_result: result })
        .eq("id", p.id)
        .then(null, () => {});

      return { platform: p.platform, method: p.method, resource: p.resource, verified, expected_record: expected };
    })
  );
}
