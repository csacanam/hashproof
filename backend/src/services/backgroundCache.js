/**
 * In-memory cache for template background images.
 *
 * Every PDF used to re-download its background. The real files are 176–774 KB
 * and take 1.4–2.2s to fetch, which was the whole reason PDF generation topped
 * out at ~4.6/s: a thousand attendees downloading certificates for the same
 * event meant downloading the same image a thousand times.
 *
 * Backgrounds belong to a template and change only when someone edits the
 * template, so they are near-perfect cache material.
 *
 * The in-flight map matters as much as the cache itself. Without it, the first
 * moment of a burst — cache still cold, hundreds of requests arriving together —
 * fires hundreds of simultaneous downloads of the same file, which is worse than
 * the problem being fixed. Concurrent callers wait on one shared fetch instead.
 */

const TTL_MS = Number(process.env.BACKGROUND_CACHE_TTL_MS) || 60 * 60 * 1000; // 1h
const MAX_ENTRIES = Number(process.env.BACKGROUND_CACHE_MAX_ENTRIES) || 32;
const MAX_BYTES = Number(process.env.BACKGROUND_CACHE_MAX_BYTES) || 8 * 1024 * 1024; // per image
const FETCH_TIMEOUT_MS = Number(process.env.BACKGROUND_FETCH_TIMEOUT_MS) || 15_000;

/** url → { buffer, at, bytes } */
const cache = new Map();
/** url → Promise<Buffer|null>, so concurrent misses share one download */
const inFlight = new Map();

let hits = 0;
let misses = 0;

function evictIfNeeded() {
  // Small cache, few templates: plain oldest-first eviction is enough.
  while (cache.size > MAX_ENTRIES) {
    let oldestUrl = null;
    let oldestAt = Infinity;
    for (const [url, entry] of cache) {
      if (entry.at < oldestAt) {
        oldestAt = entry.at;
        oldestUrl = url;
      }
    }
    if (oldestUrl === null) break;
    cache.delete(oldestUrl);
  }
}

async function download(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[background-cache] fetch failed for ${url}: HTTP ${res.status}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    // Don't cache something absurd; still return it so this PDF renders.
    if (buffer.byteLength > MAX_BYTES) {
      console.warn(`[background-cache] ${url} is ${buffer.byteLength} bytes, too large to cache`);
      return buffer;
    }
    cache.set(url, { buffer, at: Date.now(), bytes: buffer.byteLength });
    evictIfNeeded();
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Background image bytes for a template URL.
 * Returns null when it can't be fetched — the caller renders without it rather
 * than failing the whole certificate.
 */
export async function getBackgroundImage(url) {
  if (!url) return null;

  const entry = cache.get(url);
  if (entry && Date.now() - entry.at < TTL_MS) {
    hits++;
    return entry.buffer;
  }

  const pending = inFlight.get(url);
  if (pending) {
    hits++; // riding an existing download still avoids a second round-trip
    return pending;
  }

  misses++;
  const promise = download(url)
    .catch((err) => {
      console.warn(`[background-cache] fetch error for ${url}: ${err.message}`);
      return null;
    })
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, promise);
  return promise;
}

export function getBackgroundCacheStats() {
  let bytes = 0;
  for (const entry of cache.values()) bytes += entry.bytes;
  return { entries: cache.size, bytes, hits, misses, inFlight: inFlight.size };
}

export function clearBackgroundCache() {
  cache.clear();
  inFlight.clear();
  hits = 0;
  misses = 0;
}
