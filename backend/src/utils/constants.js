/**
 * HashProof API constants.
 * x402 pricing — amounts in USD, billed in USDC on-chain.
 */

/** Price in USD for issuing one credential (caller pays via x402) */
export const ISSUE_CREDENTIAL_PRICE_USD = "0.10";

/** Price in USD for an entity verification request (to be paid in USDC on Celo) */
export const ENTITY_VERIFICATION_PRICE_USD = "49";

// ─── Health-check alert thresholds ────────────────────────────────────────

/** SETTLER wallet on Celo: native CELO */
export const SETTLER_CELO_WARNING = 0.5;
export const SETTLER_CELO_CRITICAL = 0.1;

/** SETTLER wallet on Base: native ETH */
export const SETTLER_BASE_WARNING = 0.002;
export const SETTLER_BASE_CRITICAL = 0.0005;

/** REGISTRY wallet on Celo: native CELO */
export const REGISTRY_CELO_WARNING = 0.5;
export const REGISTRY_CELO_CRITICAL = 0.1;

/** Status report every N cron cycles (144 × 5 min = 12 hours) */
export const STATUS_REPORT_INTERVAL = 144;

