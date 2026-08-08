/**
 * Pins template backgrounds to IPFS and remembers the resulting CID.
 *
 * The credential's design is what makes the certificate reproducible without
 * HashProof, and the background is the bulk of it. Today it lives behind a
 * storage URL owned by us or the issuer — if that bucket goes away, so does
 * every certificate's appearance, no matter what the chain still proves.
 *
 * Cached per URL because a background belongs to a template, not to a
 * credential: an event with ten thousand attendees pins one image, once. The
 * in-flight map matters for the same reason it does in backgroundCache — a cold
 * burst must not fire the same upload hundreds of times.
 *
 * Failures are not fatal. A credential whose background could not be pinned is
 * still issued; it just carries no `design.background`, and the next issuance
 * retries.
 */

import { getBackgroundImage } from "./backgroundCache.js";
import { pinFileToIpfs } from "./pinata.js";

const PIN_TIMEOUT_MS = Number(process.env.BACKGROUND_PIN_TIMEOUT_MS) || 20_000;

/** url → cid */
const cidByUrl = new Map();
/** url → Promise<string|null> */
const inFlight = new Map();

function extensionFor(url) {
  const match = /\.(png|jpe?g|webp|gif)(?:\?|$)/i.exec(url);
  return match ? match[1].toLowerCase() : "png";
}

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export async function getBackgroundCid(url) {
  if (!url) return null;
  if (cidByUrl.has(url)) return cidByUrl.get(url);

  const pending = inFlight.get(url);
  if (pending) return pending;

  const task = (async () => {
    try {
      const buffer = await getBackgroundImage(url);
      if (!buffer) return null;

      const ext = extensionFor(url);
      // Bounded: this runs inside issuance, and a hanging upload would hold a
      // credential open. Losing the design anchor is recoverable; a stuck
      // issuance queue during an event is not.
      const cid = await Promise.race([
        pinFileToIpfs(buffer, `background.${ext}`, MIME[ext] ?? "image/png"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("pin timed out")), PIN_TIMEOUT_MS)),
      ]);
      if (cid) cidByUrl.set(url, cid);
      return cid;
    } catch (err) {
      console.warn("[background-ipfs] pin failed:", err.message);
      return null;
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, task);
  return task;
}

/** Test seam. */
export function resetBackgroundCidCache() {
  cidByUrl.clear();
  inFlight.clear();
}
