/**
 * Buying credits for an organization: by card through Stripe Checkout, or in
 * stablecoins through Voulti.
 *
 * Credits belong to the organization, and every API key of it and its dashboard
 * spend from that one balance (migration 009), so a purchase names no key.
 *
 * Credits cost $0.25 by card and $0.225 in crypto: below the pay-as-you-go price
 * of the closest platform (POK, $0.30), whatever the volume. The 10% crypto
 * discount is roughly what a card costs us that stablecoins do not — Stripe's
 * fee over Voulti's, plus chargeback risk — so it can be explained, and it does
 * not make the card price look inflated.
 * Paying per call with x402 on /issueCredential stays at $0.10 — the developer
 * path, for agents and scripts that carry their own wallet.
 * Card purchases have a higher minimum because Stripe charges a fixed fee per
 * payment.
 *
 * Every purchase is a row in credit_purchases, unique by (method, external_ref),
 * and credits land through complete_credit_purchase — which only credits a
 * pending row. A webhook delivered twice, a poll racing the webhook, or a user
 * returning to the page twice, credits once.
 *
 * A card refund made in Stripe takes the refunded share of the credits back
 * (refund_credit_purchase, migration 011), never below zero; credits already
 * spent are reported instead of taken.
 */

import crypto from "node:crypto";
import Stripe from "stripe";
import { supabase } from "../supabase.js";
import { sendTelegramAlert } from "../utils/notify.js";
import { escapeHtml } from "./accounts.js";

export const STRIPE_CREDIT_PRICE_CENTS = 25;
export const STRIPE_MIN_CREDITS = 25;
// Fractional on purpose: exactly 10% under the card price. Totals round to the cent.
export const VOULTI_CREDIT_PRICE_CENTS = 22.5;
export const VOULTI_MIN_CREDITS = 10;
export const MAX_CREDITS_PER_PURCHASE = 100_000;

const VOULTI_API = process.env.VOULTI_API_URL || "https://api.voulti.com";
const VOULTI_CHECKOUT = "https://voulti.com/checkout";
const VOULTI_INVOICE_TTL_MS = 60 * 60 * 1000;

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

export function isVoultiConfigured() {
  return Boolean(process.env.VOULTI_COMMERCE_ID);
}

const PRICING = {
  stripe: { cents: STRIPE_CREDIT_PRICE_CENTS, min: STRIPE_MIN_CREDITS },
  voulti: { cents: VOULTI_CREDIT_PRICE_CENTS, min: VOULTI_MIN_CREDITS },
};

/** Whole credits within the allowed range for a method, or a message saying why not. */
export function parseCredits(value, method) {
  const n = Math.trunc(Number(value));
  const { min } = PRICING[method];
  if (!Number.isFinite(n) || n < min || n > MAX_CREDITS_PER_PURCHASE) {
    throw new Error(`credits must be a whole number between ${min} and ${MAX_CREDITS_PER_PURCHASE}`);
  }
  return n;
}

/** Total in whole cents; a fractional unit price (crypto) rounds half up. */
export function priceCents(credits, method) {
  return Math.round(credits * PRICING[method].cents);
}

// ── Stripe ────────────────────────────────────────────────────────────────

/**
 * Start a Stripe Checkout for `credits`. Returns the URL to send the browser
 * to. Credits are added by the webhook, not by the redirect back: a redirect
 * can be faked or lost, the signed webhook cannot.
 */
export async function createStripeCheckout({ entity, user, credits, returnUrl }) {
  const n = parseCredits(credits, "stripe");
  const tags = { product: STRIPE_PRODUCT_TAG, entity_id: entity.id, credits: String(n) };
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
            description: `1 credit = 1 verifiable credential. For ${entity.display_name}.`,
          },
        },
      },
    ],
    customer_email: user.email || undefined,
    client_reference_id: entity.id,
    metadata: { ...tags, user_id: user.id },
    payment_intent_data: { description: `HashProof credits — ${entity.display_name}`, metadata: tags },
    success_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}purchase=cancelled`,
  });

  const { error } = await supabase.from("credit_purchases").insert({
    entity_id: entity.id,
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
 * Handle a Stripe webhook. Verifies the signature against the raw body; only a
 * paid checkout tagged as ours credits anything, and only a refund of one of
 * our purchases takes credits back.
 * @returns {Promise<{ handled: boolean, credited?: boolean, withdrawn?: number, ignored?: string }>}
 */
export async function handleStripeWebhook(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  const event = stripe().webhooks.constructEvent(rawBody, signature, secret);

  if (event.type === "charge.refunded") return handleStripeRefund(event.data.object);
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return { handled: false };
  }
  const session = event.data.object;
  const md = session.metadata || {};
  // Another product's checkout on the same account: not ours, nothing to log.
  if (md.product !== STRIPE_PRODUCT_TAG) return { handled: false, ignored: "other_product" };
  if (session.payment_status !== "paid") return { handled: false };

  const credits = Math.trunc(Number(md.credits));
  if (!md.entity_id || !(credits > 0)) {
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
    userId: md.user_id || null,
    credits,
    amountCents: session.amount_total,
  });
  // Remember the payment behind the purchase: a refund names the payment, not
  // the checkout. Not fatal — the refund can still find it through Stripe.
  if (session.payment_intent) {
    const { error } = await supabase
      .from("credit_purchases")
      .update({ payment_ref: String(session.payment_intent) })
      .eq("id", result.purchase_id);
    if (error) console.error("[payments] could not record payment_ref", session.id, error.message);
  }
  return { handled: true, credited: result.credited };
}

/**
 * A charge was refunded, fully or in part. Stripe reports the total refunded so
 * far, so the credits to withdraw are recomputed from it every time: a repeated
 * event or a second partial refund never takes back more than was refunded.
 */
async function handleStripeRefund(charge) {
  const paymentIntent = charge.payment_intent ? String(charge.payment_intent) : null;
  // A charge carries its payment's metadata; another product's refund stops here.
  if (charge.metadata?.product && charge.metadata.product !== STRIPE_PRODUCT_TAG) {
    return { handled: false, ignored: "other_product" };
  }
  if (!paymentIntent) return { handled: false, ignored: "other_product" };

  const cols = "id, entity_id, credits, amount_usd_cents, status, refunded_credits";
  let { data: purchase, error } = await supabase
    .from("credit_purchases")
    .select(cols)
    .eq("method", "stripe")
    .eq("payment_ref", paymentIntent)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);

  if (!purchase) {
    // Not linked yet (the refund raced the checkout event): ask Stripe which
    // payment this is, and only follow it if it is ours.
    const pi = await stripe().paymentIntents.retrieve(paymentIntent);
    if (pi.metadata?.product !== STRIPE_PRODUCT_TAG) return { handled: false, ignored: "other_product" };
    const sessions = await stripe().checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
    const sessionId = sessions.data?.[0]?.id;
    if (sessionId) {
      ({ data: purchase, error } = await supabase
        .from("credit_purchases")
        .select(cols)
        .eq("method", "stripe")
        .eq("external_ref", sessionId)
        .maybeSingle());
      if (error) throw new Error(`database: ${error.message}`);
    }
  }
  if (!purchase || purchase.status !== "completed") {
    // Ours, but never credited: nothing to take back. Say so, it is unusual.
    console.error("[payments] refund for a purchase that was not credited", paymentIntent);
    sendTelegramAlert("credits_refund", `⚠️ <b>Stripe refund</b> for a purchase that was not credited\n${escapeHtml(paymentIntent)}`).catch(() => {});
    return { handled: false };
  }

  const total = Number(charge.amount) || purchase.amount_usd_cents;
  const refunded = Math.min(Number(charge.amount_refunded) || 0, total);
  // Round up: a partial refund never leaves a fraction of a credit unpaid.
  const target = Math.min(purchase.credits, Math.ceil((purchase.credits * refunded) / total));

  const { data, error: rpcErr } = await supabase.rpc("refund_credit_purchase", {
    p_purchase_id: purchase.id,
    p_refunded_credits: target,
  });
  if (rpcErr) throw new Error(`database: ${rpcErr.message}`);

  const taken = data?.taken ?? 0;
  const shortfall = data?.shortfall ?? 0;
  if (taken > 0 || shortfall > 0) {
    const { data: ent } = await supabase.from("entities").select("display_name").eq("id", purchase.entity_id).maybeSingle();
    sendTelegramAlert(
      "credits_refund",
      `↩️ <b>Credits refunded</b> (stripe)\n${escapeHtml(ent?.display_name || purchase.entity_id)}: ` +
        `$${(refunded / 100).toFixed(2)} refunded, ${taken.toLocaleString("en-US")} credits withdrawn` +
        (shortfall > 0 ? `\n⚠️ ${shortfall.toLocaleString("en-US")} credits were already spent and could not be withdrawn` : ""),
    ).catch(() => {});
  }
  return { handled: true, withdrawn: taken, shortfall };
}

// ── Voulti ────────────────────────────────────────────────────────────────

/**
 * Create a Voulti invoice for `credits` and return its checkout link. The
 * invoice id is stored as the purchase's external_ref, so every invoice maps
 * back to exactly one purchase.
 */
export async function createVoultiInvoice({ entity, user, credits, returnUrl }) {
  const commerceId = process.env.VOULTI_COMMERCE_ID;
  if (!commerceId) throw new Error("VOULTI_COMMERCE_ID not configured");
  const n = parseCredits(credits, "voulti");
  const cents = priceCents(n, "voulti");

  const res = await fetch(`${VOULTI_API}/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commerce_id: commerceId,
      amount_fiat: cents / 100,
      currency: "USD",
      reference: `hashproof:${entity.id}:${n}`,
      description: `${n.toLocaleString("en-US")} HashProof credits — ${entity.display_name}`.slice(0, 300),
      expires_at: new Date(Date.now() + VOULTI_INVOICE_TTL_MS).toISOString(),
      // Voulti sends the payer here once the invoice is final. Its domain must be
      // in the commerce's return domains, or Voulti rejects the invoice.
      ...(returnUrl && { return_url: returnUrl }),
    }),
  });
  const body = await res.json().catch(() => ({}));
  const invoice = body?.data;
  if (!res.ok || !invoice?.id) {
    console.error("[payments] voulti invoice failed", res.status, JSON.stringify(body).slice(0, 300));
    const err = new Error("Could not start the crypto payment. Try again in a moment.");
    err.status = 502;
    err.code = "payment_provider_unavailable";
    throw err;
  }

  const { data: row, error } = await supabase
    .from("credit_purchases")
    .insert({
      entity_id: entity.id,
      user_id: user.id,
      method: "voulti",
      credits: n,
      amount_usd_cents: cents,
      external_ref: invoice.id,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(`database: ${error.message}`);

  return { purchase_id: row.id, invoice_id: invoice.id, url: `${VOULTI_CHECKOUT}/${invoice.id}`, amount_usd_cents: cents };
}

/**
 * Ask Voulti whether an invoice is paid, and credit it if so. Called while the
 * payer waits on screen and after every webhook: the webhook only says which
 * invoice to look at, the invoice itself is what we trust.
 * @returns {Promise<{ status: string, credited: boolean }>}
 */
export async function syncVoultiInvoice(invoiceId) {
  const { data: purchase, error } = await supabase
    .from("credit_purchases")
    .select("id, entity_id, user_id, credits, amount_usd_cents, status")
    .eq("method", "voulti")
    .eq("external_ref", invoiceId)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);
  if (!purchase) return { status: "unknown", credited: false };
  if (purchase.status === "completed") return { status: "Paid", credited: false };

  const res = await fetch(`${VOULTI_API}/invoices/${encodeURIComponent(invoiceId)}`);
  // GET returns the invoice bare, unlike POST's { data } envelope.
  const invoice = await res.json().catch(() => null);
  if (!res.ok || !invoice?.status) return { status: "Pending", credited: false };

  if (invoice.status !== "Paid") return { status: invoice.status, credited: false };
  if (Math.round(Number(invoice.amount_fiat) * 100) !== purchase.amount_usd_cents || invoice.fiat_currency !== "USD") {
    console.error("[payments] voulti amount mismatch", invoiceId, invoice.amount_fiat, invoice.fiat_currency);
    return { status: "mismatch", credited: false };
  }

  const out = await recordAndComplete({
    method: "voulti",
    externalRef: invoiceId,
    entityId: purchase.entity_id,
    userId: purchase.user_id,
    credits: purchase.credits,
    amountCents: purchase.amount_usd_cents,
  });
  return { status: "Paid", credited: out.credited };
}

/** Check the X-Voulti-Signature header: HMAC-SHA256 of `${t}.${rawBody}`, 5-minute window. */
export function verifyVoultiSignature(rawBody, header, secret, toleranceSeconds = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    String(header)
      .split(",")
      .map((p) => p.trim().split("=")),
  );
  const { t, v1 } = parts;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(v1), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Shared ────────────────────────────────────────────────────────────────

async function recordAndComplete({ method, externalRef, entityId, userId, credits, amountCents }) {
  let { data: row, error } = await supabase
    .from("credit_purchases")
    .select("id, status, credits")
    .eq("method", method)
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);

  if (!row) {
    const ins = await supabase
      .from("credit_purchases")
      .insert({
        entity_id: entityId,
        user_id: userId,
        method,
        credits,
        amount_usd_cents: amountCents,
        external_ref: externalRef,
        status: "pending",
      })
      .select("id, status, credits")
      .single();
    if (ins.error && ins.error.code !== "23505") throw new Error(`database: ${ins.error.message}`);
    row = ins.data;
    if (!row) {
      // Inserted concurrently by the other delivery; take that row.
      ({ data: row } = await supabase
        .from("credit_purchases")
        .select("id, status, credits")
        .eq("method", method)
        .eq("external_ref", externalRef)
        .single());
    }
  }

  const { data, error: rpcErr } = await supabase.rpc("complete_credit_purchase", { p_purchase_id: row.id });
  if (rpcErr) throw new Error(`database: ${rpcErr.message}`);

  if (data?.credited) {
    const { data: ent } = await supabase.from("entities").select("display_name").eq("id", entityId).maybeSingle();
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
    .select("id, method, credits, amount_usd_cents, status, external_ref, created_at, completed_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`database: ${error.message}`);
  return data || [];
}

/** One purchase of an entity, or null. */
export async function getPurchase(entityId, purchaseId) {
  const { data, error } = await supabase
    .from("credit_purchases")
    .select("id, method, credits, amount_usd_cents, status, external_ref, created_at, completed_at")
    .eq("entity_id", entityId)
    .eq("id", purchaseId)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);
  return data;
}
