/**
 * x402 payment middleware.
 *
 * Flow:
 *   - For POST /issueCredential: if Authorization Bearer or X-API-Key is present,
 *     validate API key (prepaid credits). If valid and balance >= 1, set req.apiKey and next().
 *   - Payment header present → validate and execute transferWithAuthorization
 *     directly via our EOA settler (no Thirdweb bundler / billing required).
 *   - No payment and no valid API key → 402 with PAYMENT-REQUIRED challenge.
 */

import { settlePayment, facilitator } from "thirdweb/x402";
import { createThirdwebClient } from "thirdweb";
import { Buffer } from "node:buffer";
import { ISSUE_CREDENTIAL_PRICE_USD, ENTITY_VERIFICATION_PRICE_USD } from "../utils/constants.js";
import { createEOASettler, usdToUsdcAtoms } from "../services/settleEOA.js";
import { getByPlainKey } from "../services/apiKeys.js";
import { getActiveChains } from "../utils/chains.js";

export function createThirdwebPaymentMiddleware(skipPayment = false) {
  if (skipPayment) {
    return (req, res, next) => next();
  }

  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  const payTo = process.env.PAY_TO;
  const settlerKey = process.env.SETTLER_PRIVATE_KEY;

  if (!secretKey) throw new Error("THIRDWEB_SECRET_KEY is required when skipPayment is false");
  if (!payTo)     throw new Error("PAY_TO is required when skipPayment is false");
  if (!settlerKey) throw new Error("SETTLER_PRIVATE_KEY is required when skipPayment is false");

  const client = createThirdwebClient({ secretKey });
  const thirdwebFacilitator = facilitator({ client, serverWalletAddress: payTo });
  const { settle } = createEOASettler(settlerKey);

  // Active chains read from X402_NETWORKS env var — change the network there, not here
  const activeChains = getActiveChains();

  const routeConfig = {
    "/issueCredential": {
      price: `$${ISSUE_CREDENTIAL_PRICE_USD}`,
      minAtoms: usdToUsdcAtoms(`$${ISSUE_CREDENTIAL_PRICE_USD}`),
      description: "Issue one verifiable credential (HashProof)",
    },
    "/entities/:id/verificationRequests": {
      price: `$${ENTITY_VERIFICATION_PRICE_USD}`,
      minAtoms: usdToUsdcAtoms(`$${ENTITY_VERIFICATION_PRICE_USD}`),
      description: "Request entity verification (HashProof)",
    },
  };

  function getRouteConfig(path) {
    if (path === "/issueCredential") return routeConfig["/issueCredential"];
    if (/^\/entities\/[^/]+\/verificationRequests$/.test(path)) {
      return routeConfig["/entities/:id/verificationRequests"];
    }
    return null;
  }

  return async (req, res, next) => {
    const config = getRouteConfig(req.path);
    if (!config) return next();

    // ── API key (prepaid credits) for issueCredential only ───────────────────
    if (req.method === "POST" && req.path === "/issueCredential") {
      const rawKey =
        req.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
        req.get("x-api-key")?.trim();
      if (rawKey) {
        const keyRow = await getByPlainKey(rawKey);
        if (!keyRow) {
          return res.status(401).json({ error: "Invalid API key" });
        }
        if (keyRow.credits_balance < 1) {
          return res.status(402).json({
            error: "Insufficient credits",
            code: "insufficient_credits",
            message: "Top up your prepaid credits to continue issuing credentials.",
          });
        }
        req.apiKey = keyRow;
        return next();
      }
    }

    const paymentData = req.get("X-PAYMENT") || req.get("PAYMENT-SIGNATURE") || null;
    const resourceUrl = `${req.protocol}://${req.get("host") || "localhost"}${req.originalUrl}`;

    // ── Payment present: settle via our EOA ──────────────────────────────────
    if (paymentData) {
      try {
        const { txHash } = await settle({
          paymentData,
          payTo,
          minPrice: config.minAtoms,
        });
        res.setHeader("X-PAYMENT-RESPONSE", txHash);
        return next();
      } catch (err) {
        console.error("[payment middleware] EOA settle failed:", err.message);
        return res.status(402).json({
          error: "Payment failed",
          errorMessage: err.message,
        });
      }
    }

    // ── No payment: generate 402 challenge using Thirdweb (format only) ──────
    // We call settlePayment once per network to collect the accepts[] entries,
    // then merge them into a single patched PAYMENT-REQUIRED header.
    // If the client signals a preferred network via X-Payment-Network, restrict to it.
    const requestedNetworkKey = req.get("x-payment-network");
    const chainsToOffer = requestedNetworkKey
      ? activeChains.filter((c) => c.key === requestedNetworkKey)
      : activeChains;

    const accepts = [];
    let baseResult = null;

    for (const chainConfig of chainsToOffer) {
      // eslint-disable-next-line no-await-in-loop
      const r = await settlePayment({
        resourceUrl,
        method: req.method,
        paymentData: null,
        payTo,
        network: chainConfig.thirdwebChain,
        price: config.price,
        facilitator: thirdwebFacilitator,
        routeConfig: { description: config.description, mimeType: "application/json" },
      });

      const pr = r?.responseHeaders?.["PAYMENT-REQUIRED"] || r?.responseHeaders?.["payment-required"];
      if (!pr) continue;

      try {
        const decoded = JSON.parse(Buffer.from(pr, "base64").toString("utf8"));
        if (Array.isArray(decoded.accepts)) {
          decoded.accepts = decoded.accepts.map((acc) => {
            if (!acc) return acc;
            // Lowercase asset address for Thirdweb client compatibility
            if (typeof acc.asset === "string") acc.asset = acc.asset.toLowerCase();
            return acc;
          });
        }
        const first = decoded?.accepts?.[0];
        if (first) accepts.push(first);
      } catch { /* ignore decode errors */ }

      if (!baseResult) baseResult = r;
    }

    // Patch the base result's PAYMENT-REQUIRED header with all accepts + lowercase assets
    const baseHeader =
      baseResult?.responseHeaders?.["PAYMENT-REQUIRED"] ||
      baseResult?.responseHeaders?.["payment-required"];

    if (baseHeader && accepts.length >= 1) {
      try {
        const decoded = JSON.parse(Buffer.from(baseHeader, "base64").toString("utf8"));
        if (Array.isArray(decoded.accepts)) {
          decoded.accepts = decoded.accepts.map((acc) => {
            if (acc && typeof acc.asset === "string") acc.asset = acc.asset.toLowerCase();
            return acc;
          });
        }
        decoded.accepts = accepts;
        const patched = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64");
        baseResult.responseHeaders = {
          ...(baseResult.responseHeaders || {}),
          "PAYMENT-REQUIRED": patched,
        };
      } catch { /* keep original */ }
    }

    // Build response body from patched PAYMENT-REQUIRED header so browser fallback works too
    let responseBody = baseResult?.responseBody ?? { error: "Payment required" };
    const finalPrHeader =
      baseResult?.responseHeaders?.["PAYMENT-REQUIRED"] ||
      baseResult?.responseHeaders?.["payment-required"];
    if (finalPrHeader) {
      try {
        responseBody = JSON.parse(Buffer.from(finalPrHeader, "base64").toString("utf8"));
      } catch { /* keep default body */ }
    }

    res.status(baseResult?.status || 402);
    if (baseResult?.responseHeaders) {
      for (const [key, value] of Object.entries(baseResult.responseHeaders)) {
        res.setHeader(key, value);
      }
    }
    return res.json(responseBody);
  };
}
