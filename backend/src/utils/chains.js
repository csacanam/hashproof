/**
 * Supported x402 payment networks.
 *
 * To change the active network: set X402_NETWORKS in .env (e.g. X402_NETWORKS=base)
 * To add a new network:
 *   1. Add an entry in CHAIN_CONFIG below
 *   2. Fund SETTLER_PRIVATE_KEY with gas on that network
 *   3. Add the network key to X402_NETWORKS
 */

import { base, celo, polygon, arbitrum } from "thirdweb/chains";

export const CHAIN_CONFIG = {
  base: {
    caip2: "eip155:8453",
    thirdwebChain: base,
    usdcAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    gasToken: "ETH",
    explorerTxUrl: (hash) => `https://basescan.org/tx/${hash}`,
    getRpcUrl: () => process.env.BASE_RPC_URL || "https://mainnet.base.org",
  },
  celo: {
    caip2: "eip155:42220",
    thirdwebChain: celo,
    usdcAddress: "0xceba9300f2b948710d2653dd7b07f33a8b32118c",
    gasToken: "CELO",
    explorerTxUrl: (hash) => `https://celoscan.io/tx/${hash}`,
    getRpcUrl: () => process.env.CELO_RPC_URL || "https://forno.celo.org",
  },
  polygon: {
    caip2: "eip155:137",
    thirdwebChain: polygon,
    usdcAddress: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    gasToken: "MATIC",
    explorerTxUrl: (hash) => `https://polygonscan.com/tx/${hash}`,
    getRpcUrl: () => process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
  },
  arbitrum: {
    caip2: "eip155:42161",
    thirdwebChain: arbitrum,
    usdcAddress: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    gasToken: "ETH",
    explorerTxUrl: (hash) => `https://arbiscan.io/tx/${hash}`,
    getRpcUrl: () => process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  },
};

/**
 * Returns chain configs for the networks listed in X402_NETWORKS env var (default: base).
 * Throws if none of the listed networks are recognized.
 */
export function getActiveChains() {
  const keys = (process.env.X402_NETWORKS || "base")
    .split(",")
    .map((s) => s.trim())
    .filter((k) => k in CHAIN_CONFIG);

  if (keys.length === 0) {
    throw new Error(
      "X402_NETWORKS contains no supported networks. Valid values: base, celo, polygon, arbitrum",
    );
  }

  return keys.map((k) => ({ key: k, ...CHAIN_CONFIG[k] }));
}

/**
 * Returns the chain config for a given CAIP-2 network identifier (e.g. "eip155:8453").
 * Returns null if not found.
 */
export function getChainByCaip2(caip2) {
  return Object.values(CHAIN_CONFIG).find((c) => c.caip2 === caip2) ?? null;
}
