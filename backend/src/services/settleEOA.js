/**
 * EOA-based x402 settlement.
 *
 * Instead of relying on Thirdweb's bundler/paymaster (which requires billing),
 * we execute transferWithAuthorization directly from a plain EOA wallet.
 * The client experience is identical: they sign an EIP-3009 authorization off-chain
 * (no gas). Our backend pays the (tiny) gas to submit the on-chain transaction.
 *
 * Required env:
 *   SETTLER_PRIVATE_KEY  — EOA that submits transactions. Must hold native gas
 *                          tokens on each supported network (ETH on Base/Arbitrum,
 *                          CELO on Celo, MATIC on Polygon).
 *
 * Network config lives in utils/chains.js — change the chain there.
 */

import { ethers } from "ethers";
import { Buffer } from "node:buffer";
import { getChainByCaip2 } from "../utils/chains.js";

// EIP-3009 transferWithAuthorization (v, r, s form — supported by all Circle USDC versions)
const TRANSFER_WITH_AUTH_ABI = [
  {
    name: "transferWithAuthorization",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from",        type: "address" },
      { name: "to",          type: "address" },
      { name: "value",       type: "uint256" },
      { name: "validAfter",  type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce",       type: "bytes32" },
      { name: "v",           type: "uint8"   },
      { name: "r",           type: "bytes32" },
      { name: "s",           type: "bytes32" },
    ],
    outputs: [],
  },
];

/**
 * Convert a USD price string (e.g. "$0.10") to USDC atomic units (6 decimals).
 * If already a number string (e.g. "10000"), returns it as-is.
 */
export function usdToUsdcAtoms(price) {
  if (typeof price === "bigint") return price;
  const str = String(price);
  if (str.includes("$")) {
    const amount = parseFloat(str.replace("$", ""));
    return BigInt(Math.round(amount * 1_000_000));
  }
  return BigInt(str);
}

/**
 * Creates an EOA settler bound to the given private key.
 * Returns a `settle` function you call when a paid request comes in.
 */
export function createEOASettler(settlerPrivateKey) {
  /**
   * Settle an x402 payment by executing transferWithAuthorization on-chain.
   *
   * @param {string} paymentData  - base64-encoded payment header from the client
   * @param {string} payTo        - expected recipient address (our PAY_TO)
   * @param {string|bigint} minPrice - minimum accepted amount: "$0.10" or raw atoms
   * @returns {{ txHash: string }} on success, throws on failure
   */
  async function settle({ paymentData, payTo, minPrice }) {
    // 1. Decode the x402 payment header
    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(paymentData, "base64").toString("utf8"));
    } catch {
      throw new Error("Invalid payment header: could not decode");
    }

    const { authorization, signature } = decoded?.payload ?? {};
    const network = decoded?.network;

    if (!authorization || !signature || !network) {
      throw new Error("Invalid payment header: missing payload fields");
    }

    // 2. Verify recipient matches our PAY_TO
    if (authorization.to.toLowerCase() !== payTo.toLowerCase()) {
      throw new Error(
        `Payment recipient mismatch: expected ${payTo}, got ${authorization.to}`,
      );
    }

    // 3. Verify amount >= minPrice
    const minAtoms = usdToUsdcAtoms(minPrice);
    if (BigInt(authorization.value) < minAtoms) {
      throw new Error(
        `Insufficient payment: got ${authorization.value} atoms, need >= ${minAtoms}`,
      );
    }

    // 4. Verify authorization hasn't expired
    const validBefore = BigInt(authorization.validBefore);
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (nowSec >= validBefore) {
      throw new Error("Payment authorization has expired");
    }

    // 5. Look up network config from centralized chains.js
    const chainConfig = getChainByCaip2(network);
    if (!chainConfig) {
      throw new Error(`Unsupported payment network: ${network}`);
    }
    const { usdcAddress, getRpcUrl } = chainConfig;
    const rpcUrl = getRpcUrl();

    // 6. Parse ECDSA signature into v, r, s
    const sig = ethers.Signature.from(signature);

    // 7. Submit transferWithAuthorization
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(settlerPrivateKey, provider);
    const contract = new ethers.Contract(usdcAddress, TRANSFER_WITH_AUTH_ABI, wallet);

    console.log(
      `[EOA settler] Submitting transferWithAuthorization on ${network} ` +
      `(${authorization.value} atoms from ${authorization.from})`,
    );

    const tx = await contract.transferWithAuthorization(
      authorization.from,
      authorization.to,
      BigInt(authorization.value),
      BigInt(authorization.validAfter),
      BigInt(authorization.validBefore),
      authorization.nonce,
      sig.v,
      sig.r,
      sig.s,
    );

    // 8. Wait for 1 confirmation
    const receipt = await tx.wait(1);
    if (receipt.status !== 1) {
      throw new Error(`Transaction reverted: ${tx.hash}`);
    }

    console.log(`[EOA settler] Settled. txHash=${tx.hash}`);
    return { txHash: tx.hash };
  }

  return { settle };
}
