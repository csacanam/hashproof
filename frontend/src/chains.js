/**
 * Supported x402 payment networks on the frontend.
 *
 * To change the active network: set VITE_X402_NETWORKS in .env (e.g. VITE_X402_NETWORKS=base)
 * This must match X402_NETWORKS in the backend .env.
 */

import { base, celo, polygon, arbitrum } from "thirdweb/chains";

export const CHAIN_CONFIG = {
  base: {
    name: "Base",
    chain: base,
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  celo: {
    name: "Celo",
    chain: celo,
    usdcAddress: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  },
  polygon: {
    name: "Polygon",
    chain: polygon,
    usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
  arbitrum: {
    name: "Arbitrum",
    chain: arbitrum,
    usdcAddress: "0xaF88d065e77c8cC2239327C5EDb3A432268e5831",
  },
};

const activeKeys = (import.meta.env.VITE_X402_NETWORKS || "base")
  .split(",")
  .map((s) => s.trim())
  .filter((k) => k in CHAIN_CONFIG);

export const ACTIVE_CHAINS = activeKeys.map((k) => ({ key: k, ...CHAIN_CONFIG[k] }));
export const PRIMARY_CHAIN_CONFIG = ACTIVE_CHAINS[0] ?? { key: "base", ...CHAIN_CONFIG.base };
