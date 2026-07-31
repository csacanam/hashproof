/**
 * Persistent store for rendered certificate PDFs.
 *
 * A certificate is immutable once issued, so rendering it again on every
 * download is wasted work — and it was expensive work: generation was capped at
 * ~4.6/s, which is what would break an event where a thousand people download at
 * once. Render once, keep the bytes, serve them from then on.
 *
 * Storage failures are never fatal. If the bucket is missing or Supabase is
 * having a bad day, the caller falls back to generating on the fly: slower, but
 * the attendee still gets their certificate.
 */

import { supabase } from "../supabase.js";

const BUCKET = process.env.PDF_BUCKET || "certificates";

function objectPath(credentialId) {
  return `${credentialId}.pdf`;
}

/** Stored PDF bytes, or null if it hasn't been rendered yet. */
export async function getStoredPdf(credentialId) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(objectPath(credentialId));
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch (err) {
    console.warn(`[pdf-store] read failed for ${credentialId}: ${err.message}`);
    return null;
  }
}

/**
 * Save a rendered PDF. Best-effort: a failure here only means the next download
 * regenerates it, so callers should not await this on the response path.
 */
export async function storePdf(credentialId, buffer) {
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath(credentialId), buffer, {
      contentType: "application/pdf",
      // A certificate never changes, but upsert keeps a retry after a partial
      // write from failing forever on "already exists".
      upsert: true,
    });
    if (error) {
      console.warn(`[pdf-store] write failed for ${credentialId}: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[pdf-store] write threw for ${credentialId}: ${err.message}`);
    return false;
  }
}
