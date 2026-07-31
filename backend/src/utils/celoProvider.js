/**
 * Failover JSON-RPC provider for Celo.
 *
 * Reads CELO_RPC_URL as a comma-separated list. Tries URLs in order; if one
 * returns a capacity/rate-limit error, it is blocked for 1 hour and the next
 * URL is used. Falls back to https://forno.celo.org as a last resort.
 *
 * Examples:
 *   CELO_RPC_URL=https://celo-mainnet.g.alchemy.com/v2/KEY1,https://celo-mainnet.g.alchemy.com/v2/KEY2
 *   CELO_RPC_URL=https://forno.celo.org
 */

import { JsonRpcProvider, Network } from "ethers";

const BLOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour
const FORNO_URL = "https://forno.celo.org";
const POLLING_INTERVAL_MS = Number(process.env.CELO_POLLING_INTERVAL_MS || 500);

function isCapacityError(err) {
  const msg = (err?.message || err?.info?.responseBody || "").toLowerCase();
  return (
    msg.includes("monthly capacity limit") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    err?.info?.responseStatus?.startsWith("429") ||
    err?.info?.responseStatus?.startsWith("599")
  );
}

function maskUrl(url) {
  return url.replace(/\/v2\/[^/]+/, "/v2/***");
}

function parseUrls() {
  const raw = process.env.CELO_RPC_URL || FORNO_URL;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Always include forno as a last-resort fallback (deduped)
  if (!list.includes(FORNO_URL)) list.push(FORNO_URL);
  return list;
}

export class FailoverCeloProvider extends JsonRpcProvider {
  constructor() {
    const urls = parseUrls();
    const network = Network ? new Network("celo", 42220) : undefined;
    if (network) {
      super(urls[0], network, { staticNetwork: network });
    } else {
      super(urls[0]);
    }
    this._urls = urls;
    this._blockedUntil = new Map();
    // ethers defaults to 4000ms, which dominates tx.wait() on a chain with ~1s
    // blocks: a receipt that already exists sits unseen for up to 4s. Celo blocks
    // are fast, so poll accordingly.
    this.pollingInterval = POLLING_INTERVAL_MS;
  }

  _isBlocked(url) {
    const until = this._blockedUntil.get(url) || 0;
    return until > Date.now();
  }

  _markBlocked(url) {
    // Never block the public fallback — it must always be tried as a last resort
    if (url === FORNO_URL) return;
    this._blockedUntil.set(url, Date.now() + BLOCK_DURATION_MS);
    console.warn(`[celo-rpc] blocked ${maskUrl(url)} for 1h (capacity/rate-limit)`);
  }

  async _tryUrl(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (/monthly capacity limit|rate limit|too many requests/i.test(text)) {
      return { ok: false, capacity: true, err: new Error(`capacity/rate limit on ${maskUrl(url)}`) };
    }
    if (!res.ok) {
      return { ok: false, capacity: false, err: new Error(`HTTP ${res.status} from ${maskUrl(url)}: ${text.slice(0, 200)}`) };
    }
    try {
      const parsed = JSON.parse(text);
      return { ok: true, result: Array.isArray(parsed) ? parsed : [parsed] };
    } catch {
      return { ok: false, capacity: false, err: new Error(`invalid JSON from ${maskUrl(url)}`) };
    }
  }

  async _attemptAll(payload, ignoreBlocks) {
    let lastErr;
    for (const url of this._urls) {
      if (!ignoreBlocks && this._isBlocked(url)) continue;
      try {
        const r = await this._tryUrl(url, payload);
        if (r.ok) return { ok: true, result: r.result };
        if (r.capacity) this._markBlocked(url);
        lastErr = r.err;
      } catch (err) {
        if (isCapacityError(err)) this._markBlocked(url);
        lastErr = err;
      }
    }
    return { ok: false, err: lastErr };
  }

  async _send(payload) {
    // Retry with exponential backoff for transient rate limits on the public RPC
    const delays = [0, 250, 750, 2000];
    let lastErr;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) {
        const jitter = Math.floor(delays[i] * (0.5 + Math.random()));
        await new Promise((r) => setTimeout(r, jitter));
      }
      const r = await this._attemptAll(payload, i >= 1);
      if (r.ok) return r.result;
      lastErr = r.err;
    }
    throw lastErr || new Error("All Celo RPC URLs exhausted");
  }
}

// Single shared instance: the 1h block list only works if it survives between
// calls, and building a provider per request also throws away ethers' internal
// caches. Reset only exists for tests.
let sharedProvider = null;

export function getCeloProvider() {
  if (!sharedProvider) sharedProvider = new FailoverCeloProvider();
  return sharedProvider;
}

export function resetCeloProvider() {
  sharedProvider = null;
}
