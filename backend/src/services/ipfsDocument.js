/**
 * Builds the document that gets pinned to IPFS.
 *
 * The database keeps the full credential; only the *published* copy is reduced.
 * `credentialSubject` carries whatever the issuer defined in their template, and
 * that is unbounded — in production it has included national ID numbers. IPFS is
 * public and permanent, and the CID sits in a contract event, so anything pinned
 * there is bulk-extractable forever. Templates keep working because the PDF
 * renders from the database, not from this.
 *
 * Nothing personal survives — not even the name. The line is where the data
 * lives, not how sensitive it is: our own surfaces (page, PDF, link preview) can
 * be corrected, restricted and deleted, so the name belongs there; a permanent
 * public network cannot, so nothing identifying belongs here. Keeping the name
 * would leave the full attendee roster of every event extractable in bulk by
 * walking the contract's `CredentialRegistered` events — which is the harm, not
 * any single credential being readable.
 *
 * What survives is a commitment to the full subject, so the backup stays
 * tamper-evident without disclosing what it commits to.
 *
 * The commitment is an HMAC keyed by a server secret, NOT a published salt. A
 * public salt would let anyone test a guess ("is the ID 1049…?") and brute-force
 * the very values we are trying to stop publishing.
 *
 * Deterministic on purpose: verification rebuilds this from the database row and
 * compares it against what IPFS actually returns.
 */

import { createHmac } from "node:crypto";

export const IPFS_DOC_VERSION = "hashproof/redacted-subject-v1";

/**
 * Subject keys that stay in the clear. Empty on purpose: every key in
 * `credentialSubject` is either the holder's name or an issuer-defined template
 * field, and neither belongs on a permanent public network.
 */
const PUBLIC_SUBJECT_KEYS = new Set();

/** Stable stringify — key order must not change the hash. */
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
    .join(",")}}`;
}

export function commitToSubject(subject, credentialId) {
  const secret = process.env.CREDENTIAL_HASH_SECRET;
  if (!secret || !secret.trim()) return null;
  const digest = createHmac("sha256", secret)
    .update(`${credentialId}:${canonical(subject ?? {})}`)
    .digest("hex");
  return `0x${digest}`;
}

/**
 * @param {object} credentialJson full credential as stored in the database
 * @param {string} credentialId   used so the same values under two credentials commit differently
 */
export function buildIpfsDocument(credentialJson, credentialId) {
  const subject = credentialJson?.credentialSubject ?? {};

  const publicSubject = {};
  for (const key of Object.keys(subject)) {
    if (PUBLIC_SUBJECT_KEYS.has(key)) publicSubject[key] = subject[key];
  }

  const commitment = commitToSubject(subject, credentialId);
  if (commitment) {
    publicSubject.hash = commitment;
    publicSubject.alg = "hmac-sha256";
  }

  return {
    ...credentialJson,
    credentialSubject: publicSubject,
    credentialSubjectRedaction: IPFS_DOC_VERSION,
  };
}

/** True when a document was produced by the redacted path (vs. a legacy full pin). */
export function isRedactedDocument(json) {
  return json?.credentialSubjectRedaction === IPFS_DOC_VERSION;
}

export { canonical };
