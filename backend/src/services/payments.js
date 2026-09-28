/**
 * Buying credits for a key: by card through Stripe Checkout, or in USDC over
 * x402.
 *
 * The price follows the payment method, not the credit. x402 is what an
 * issuance costs on the open API ($0.10) because settling it costs us almost
 * nothing; a card payment carries Stripe's fee, and is priced at $0.20. Stripe
 * also charges a fixed fee per payment, which is why card purchases have a
 * minimum.
 *
 * Every purchase is a row in credit_purchases, unique by (method, external_ref),
 * and credits land through complete_credit_purchase — which only credits a
 * pending row. A webhook delivered twice, or a user returning to the success
 * page twice, credits once.
 */

import Stripe from "stripe";
import { supabase } from "../supabase.js";
import { sendTelegramAlert } from "../utils/notify.js";
import { ISSUE_CREDENTIAL_PRICE_USD } from "../utils/constants.js";
import { escapeHtml } from "./accounts.js";

export const STRIPE_CREDIT_PRICE_CENTS = 20;
export const STRIPE_MIN_CREDITS = 50;
export const X402_CREDIT_PRICE_CENTS = Math.round(Number(ISSUE_CREDENTIAL_PRICE_USD) * 100);
export const X402_MIN_CREDITS = 10;
export const MAX_CREDITS_PER_PURCHASE = 100_000;

// The Stripe account is shared with other products, and so is its event stream.
// Every session we create carries this tag, on the session and on its payment
// intent, and the webhook ignores anything without it.
export const STRIPE_PRODUCT_TAG = "hashproof";

let stripeClient = null;
function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/** Whole credits within the allowed range for a method, or a message saying why not. */
export function parseCredits(value, method) {
  const n = Math.trunc(Number(value));
  const min = method === "stripe" ? STRIPE_MIN_CREDITS : X402_MIN_CREDITS;
  if (!Number.isFinite(n) || n < min || n > MAX_CREDITS_PER_PURCHASE) {
    throw new Error(`credits must be a whole number between ${min} and ${MAX_CREDITS_PER_PURCHASE}`);
  }
  return n;
}

export function priceCents(credits, method) {
  return credits * (method === "stripe" ? STRIPE_CREDIT_PRICE_CENTS : X402_CREDIT_PRICE_CENTS);
}

/**
 * Start a Stripe Checkout for `credits` on `key`. Returns the URL to send the
 * browser to. Credits are added by the webhook, not by the redirect back:
 * a redirect can be faked or lost, the signed webhook cannot.
 */
export async function createStripeCheckout({ entity, key, user, credits, returnUrl }) {
  const n = parseCredits(credits, "stripe");
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: n,
        price_data: {
          currency: "usd",
          unit_amount: STRIPE_CREDIT_PRICE_CENTS,
          product_data: {
            name: "HashProof credits",
            description: `1 credit = 1 verifiable credential. For ${entity.display_name} — ${key.name || "API key"}.`,
          },
        },
      },
    ],
    customer_email: user.email || undefined,
    client_reference_id: entity.id,
    metadata: {
      product: STRIPE_PRODUCT_TAG,
      entity_id: entity.id,
      api_key_id: key.id,
      user_id: user.id,
      credits: String(n),
    },
    payment_intent_data: {
      description: `HashProof credits — ${entity.display_name}`,
      metadata: { product: STRIPE_PRODUCT_TAG, entity_id: entity.id, api_key_id: key.id, credits: String(n) },
    },
    success_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}purchase=cancelled`,
  });

  const { error } = await supabase.from("credit_purchases").insert({
    entity_id: entity.id,
    api_key_id: key.id,
    user_id: user.id,
    method: "stripe",
    credits: n,
    amount_usd_cents: priceCents(n, "stripe"),
    external_ref: session.id,
    status: "pending",
  });
  // Not fatal: the webhook rebuilds the row from the session's metadata.
  if (error) console.error("[payments] could not record pending checkout", session.id, error.message);

  return { url: session.url, session_id: session.id };
}

/**
 * Handle a Stripe webhook. Verifies the signature against the raw body; only
 * checkout.session.completed with payment_status "paid" credits anything.
 * @returns {Promise<{ handled: boolean, credited?: boolean }>}
 */
export async function handleStripeWebhook(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  const event = stripe().webhooks.constructEvent(rawBody, signature, secret);

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return { handled: false };
  }
  const session = event.data.object;
  const md = session.metadata || {};
  // Another product's checkout on the same account: not ours, nothing to log.
  if (md.product !== STRIPE_PRODUCT_TAG) return { handled: false, ignored: "other_product" };
  if (session.payment_status !== "paid") return { handled: false };

  const credits = Math.trunc(Number(md.credits));
  if (!md.api_key_id || !md.entity_id || !(credits > 0)) {
    console.error("[payments] paid session without our metadata", session.id);
    return { handled: false };
  }
  // The amount is what was actually charged; never credit more than it paid for.
  if (session.amount_total !== priceCents(credits, "stripe")) {
    console.error("[payments] amount mismatch", session.id, session.amount_total, credits);
    return { handled: false };
  }

  const result = await recordAndComplete({
    method: "stripe",
    externalRef: session.id,
    entityId: md.entity_id,
    keyId: md.api_key_id,
    userId: md.user_id || null,
    credits,
    amountCents: session.amount_total,
  });
  return { handled: true, credited: result.credited };
}

/** Credit an x402 settlement. `txHash` is the USDC transfer that paid for it. */
export async function completeX402Purchase({ entity, key, user, credits, txHash }) {
  return recordAndComplete({
    method: "x402",
    externalRef: txHash,
    entityId: entity.id,
    keyId: key.id,
    userId: user.id,
    credits,
    amountCents: priceCents(credits, "x402"),
  });
}

async function recordAndComplete({ method, externalRef, entityId, keyId, userId, credits, amountCents }) {
  let { data: row, error } = await supabase
    .from("credit_purchases")
    .select("id, status, credits, api_key_id")
    .eq("method", method)
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);

  if (!row) {
    const ins = await supabase
      .from("credit_purchases")
      .insert({
        entity_id: entityId,
        api_key_id: keyId,
        user_id: userId,
        method,
        credits,
        amount_usd_cents: amountCents,
        external_ref: externalRef,
        status: "pending",
      })
      .select("id, status, credits, api_key_id")
      .single();
    if (ins.error && ins.error.code !== "23505") throw new Error(`database: ${ins.error.message}`);
    row = ins.data;
    if (!row) {
      // Inserted concurrently by the other delivery; take that row.
      ({ data: row } = await supabase
        .from("credit_purchases")
        .select("id, status, credits, api_key_id")
        .eq("method", method)
        .eq("external_ref", externalRef)
        .single());
    }
  }

  const { data, error: rpcErr } = await supabase.rpc("complete_credit_purchase", { p_purchase_id: row.id });
  if (rpcErr) throw new Error(`database: ${rpcErr.message}`);

  if (data?.credited) {
    const { data: ent } = await supabase.from("entities").select("display_name, slug").eq("id", entityId).maybeSingle();
    sendTelegramAlert(
      "credits_purchased",
      `💳 <b>Credits purchased</b> (${method})\n${escapeHtml(ent?.display_name || entityId)}: ` +
        `${credits.toLocaleString("en-US")} credits, $${(amountCents / 100).toFixed(2)}`,
    ).catch(() => {});
  }
  return { credited: data?.credited === true, purchase_id: row.id };
}

/** Purchases of an entity, newest first. */
export async function listPurchases(entityId) {
  const { data, error } = await supabase
    .from("credit_purchases")
    .select("id, api_key_id, method, credits, amount_usd_cents, status, created_at, completed_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`database: ${error.message}`);
  return data || [];
}
