/**
 * Reliable native ETH balance reader for Base.
 *
 * The public Base RPC (https://mainnet.base.org) is load-balanced across nodes,
 * and occasionally routes a request to a pruned/out-of-sync node that answers
 * `0x0` for a perfectly funded address. A single read of that endpoint therefore
 * produces spurious "SETTLER (Base) Balance Low: 0 ETH" alerts.
 *
 * Strategy: read the balance from several Base RPCs and keep the MAX value.
 * A real balance is never under-reported, so the max defeats the transient-zero
 * glitch, while a genuinely empty wallet still reads 0 across every endpoint.
 *
 * Configure extra endpoints via BASE_RPC_URL (comma-separated). Public fallbacks
 * are always appended so monitoring degrades gracefully without an API key.
 */

import { ethers } from "ethers";

const PUBLIC_BASE_RPCS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base-rpc.publicnode.com",
];

// Base mainnet. Passed as staticNetwork so ethers skips eth_chainId detection —
// a dead endpoint then fails only on the balance call (bounded by READ_TIMEOUT_MS)
// instead of spinning a background network-detection retry loop that leaks connections.
const BASE_NETWORK = new ethers.Network("base", 8453);
const READ_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function parseBaseRpcUrls() {
  const configured = (process.env.BASE_RPC_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Dedup while preserving order (configured first, then public fallbacks).
  return [...new Set([...configured, ...PUBLIC_BASE_RPCS])];
}

/**
 * Returns the settler's native ETH balance on Base as a bigint (wei), taking the
 * maximum reading across all configured RPC endpoints. Endpoints that error or
 * time out are ignored. Throws only if EVERY endpoint fails to respond.
 */
export async function getBaseNativeBalance(address) {
  const urls = parseBaseRpcUrls();

  const readings = await Promise.allSettled(
    urls.map(async (url) => {
      const provider = new ethers.JsonRpcProvider(url, BASE_NETWORK, {
        staticNetwork: BASE_NETWORK,
      });
      try {
        return await withTimeout(provider.getBalance(address), READ_TIMEOUT_MS, `base getBalance(${url})`);
      } finally {
        provider.destroy();
      }
    }),
  );

  let max = null;
  let failures = 0;
  for (const r of readings) {
    if (r.status === "fulfilled") {
      max = max === null || r.value > max ? r.value : max;
    } else {
      failures += 1;
    }
  }

  if (max === null) {
    throw new Error(`Base balance unavailable: all ${urls.length} RPC endpoint(s) failed`);
  }
  if (failures > 0) {
    console.warn(`[base-rpc] ${failures}/${urls.length} endpoint(s) failed; used max of the rest`);
  }
  return max;
}
