/**
 * x402 for a price that depends on the request — buying N credits.
 *
 * The middleware in thirdwebPayment.js prices each route once, at startup, and
 * serves the public API; it is left exactly as it is. This one computes the
 * price per request from `priceFor(req)` and otherwise follows the same steps:
 * no payment header → a 402 challenge listing every active network; a payment
 * header → settle through our EOA for at least that price, then next() with
 * req.x402 = { txHash, cents }.
 *
 * The price is recomputed when the paid request comes back, so a payment signed
 * for 10 credits cannot be replayed with a body asking for 1,000: settle()
 * refuses anything below the minimum for the body it is attached to.
 */

import { settlePayment, facilitator } from "thirdweb/x402";
import { createThirdwebClient } from "thirdweb";
import { Buffer } from "node:buffer";
import { createEOASettler, usdToUsdcAtoms } from "../services/settleEOA.js";
import { getActiveChains } from "../utils/chains.js";

/**
 * @param {{ priceFor: (req) => Promise<{ cents: number, description: string }> | { cents: number, description: string }, skipPayment?: boolean }} opts
 */
export function createX402Charge({ priceFor, skipPayment = false }) {
  let ctx = null;
  function context() {
    if (ctx) return ctx;
    const secretKey = process.env.THIRDWEB_SECRET_KEY;
    const payTo = process.env.PAY_TO;
    const settlerKey = process.env.SETTLER_PRIVATE_KEY;
    if (!secretKey || !payTo || !settlerKey) throw new Error("x402 not configured");
    const client = createThirdwebClient({ secretKey });
    ctx = {
      payTo,
      facilitator: facilitator({ client, serverWalletAddress: payTo }),
      settle: createEOASettler(settlerKey).settle,
      chains: getActiveChains(),
    };
    return ctx;
  }

  return async (req, res, next) => {
    let price;
    try {
      price = await priceFor(req);
    } catch (err) {
      return res.status(400).json({ error: err.message, code: "invalid_payload" });
    }
    const usd = `$${(price.cents / 100).toFixed(2)}`;

    if (skipPayment) {
      req.x402 = { txHash: `0xskip${Date.now().toString(16)}`, cents: price.cents };
      return next();
    }

    let c;
    try {
      c = context();
    } catch (err) {
      console.error("[x402Charge]", err.message);
      return res.status(503).json({ error: "USDC payments are not available right now.", code: "service_misconfigured" });
    }

    const paymentData = req.get("X-PAYMENT") || req.get("PAYMENT-SIGNATURE") || null;
    if (paymentData) {
      try {
        const { txHash } = await c.settle({ paymentData, payTo: c.payTo, minPrice: usdToUsdcAtoms(usd) });
        res.setHeader("X-PAYMENT-RESPONSE", txHash);
        req.x402 = { txHash, cents: price.cents };
        return next();
      } catch (err) {
        console.error("[x402Charge] settle failed:", err.message);
        return res.status(402).json({ error: "Payment failed", errorMessage: err.message });
      }
    }

    // Challenge: one accepts[] entry per active network, merged into one header.
    const resourceUrl = `${req.protocol}://${req.get("host") || "localhost"}${req.originalUrl}`;
    const wanted = req.get("x-payment-network");
    const chains = wanted ? c.chains.filter((ch) => ch.key === wanted) : c.chains;

    const accepts = [];
    let base = null;
    for (const chain of chains) {
      // eslint-disable-next-line no-await-in-loop
      const r = await settlePayment({
        resourceUrl,
        method: req.method,
        paymentData: null,
        payTo: c.payTo,
        network: chain.thirdwebChain,
        price: usd,
        facilitator: c.facilitator,
        routeConfig: { description: price.description, mimeType: "application/json" },
      });
      const header = r?.responseHeaders?.["PAYMENT-REQUIRED"] || r?.responseHeaders?.["payment-required"];
      if (!header) continue;
      try {
        const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
        const first = decoded?.accepts?.[0];
        if (first) {
          // Lowercase asset address for Thirdweb client compatibility.
          if (typeof first.asset === "string") first.asset = first.asset.toLowerCase();
          accepts.push(first);
        }
        if (!base) base = { result: r, decoded };
      } catch {
        /* ignore decode errors */
      }
    }

    if (!base) return res.status(503).json({ error: "USDC payments are not available right now." });

    base.decoded.accepts = accepts;
    const patched = Buffer.from(JSON.stringify(base.decoded), "utf8").toString("base64");
    const headers = { ...(base.result.responseHeaders || {}), "PAYMENT-REQUIRED": patched };
    delete headers["payment-required"];
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    return res.status(402).json(base.decoded);
  };
}
