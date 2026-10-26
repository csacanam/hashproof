/**
 * Quotes: what a number of certificates costs, in USD or COP.
 *
 * Three items, all priced in USD and converted at the day's rate:
 *   certificates  — one credit each, at the dashboard's card price
 *   verification  — becoming a verified issuer, once (same price as the
 *                   verification page)
 *   managed       — we run the issuance for them (load the list, set up the
 *                   template, send), once per quote
 *
 * The server prices the quote, never the browser: whatever the page shows and
 * whatever lands in the PDF or the email come from here.
 */

import { randomBytes } from "node:crypto";
import { STRIPE_CREDIT_PRICE_CENTS } from "./payments.js";

export const QUOTE_PRICES_USD_CENTS = {
  certificate: STRIPE_CREDIT_PRICE_CENTS,
  verification: 4900,
  managed: 5000,
};

export const QUOTE_MAX_QUANTITY = 1_000_000;
export const QUOTE_VALID_DAYS = 15;
const CURRENCIES = ["USD", "COP"];

// ── USD → COP ────────────────────────────────────────────────────────────

const RATE_URL = "https://open.er-api.com/v6/latest/USD";
const RATE_TTL_MS = 6 * 60 * 60 * 1000;
const RATE_TIMEOUT_MS = 4000;
let rateCache = null; // { rate, date, source, fetchedAt }

function fallbackRate() {
  const n = Number(process.env.QUOTE_USD_COP_FALLBACK);
  return Number.isFinite(n) && n > 0 ? n : 4000;
}

/**
 * Today's USD→COP rate. Cached for a few hours; when the source is down the
 * last good rate is kept, and with none at all the configured fallback is used
 * and labelled as such, so a quote is never blocked on it.
 */
export async function getUsdCopRate({ fetchImpl = fetch, now = Date.now() } = {}) {
  if (rateCache && now - rateCache.fetchedAt < RATE_TTL_MS) return rateCache;
  try {
    const res = await fetchImpl(RATE_URL, { signal: AbortSignal.timeout(RATE_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const rate = Number(body?.rates?.COP);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("no COP rate in response");
    const updated = body.time_last_update_unix ? new Date(body.time_last_update_unix * 1000) : new Date(now);
    rateCache = { rate, date: updated.toISOString().slice(0, 10), source: "market", fetchedAt: now };
    return rateCache;
  } catch (err) {
    console.warn(`[quotes] USD/COP rate unavailable: ${err.message}`);
    if (rateCache) return rateCache;
    return { rate: fallbackRate(), date: new Date(now).toISOString().slice(0, 10), source: "fallback", fetchedAt: now };
  }
}

/** For tests. */
export function clearRateCache() {
  rateCache = null;
}

// ── Pricing ──────────────────────────────────────────────────────────────

export class QuoteError extends Error {
  constructor(message, field) {
    super(message);
    this.status = 400;
    this.code = "invalid_quote";
    this.field = field;
  }
}

function text(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Who the quote is for. `requireContact` for anything that leaves the page. */
export function parseClient(input, { requireContact = false } = {}) {
  const client = {
    name: text(input?.name, 120),
    company: text(input?.company, 120),
    email: text(input?.email, 254).toLowerCase(),
    event: text(input?.event, 160),
  };
  if (requireContact) {
    if (client.name.length < 2) throw new QuoteError("Enter the name the quote is addressed to.", "name");
    if (!EMAIL_RE.test(client.email)) throw new QuoteError("Enter a valid email address.", "email");
  } else if (client.email && !EMAIL_RE.test(client.email)) {
    client.email = "";
  }
  return client;
}

/** COP amounts are shown without decimals; fixed items round to the thousand. */
function toCop(usdCents, rate, { roundTo = 1 } = {}) {
  const pesos = (usdCents / 100) * rate;
  return Math.round(pesos / roundTo) * roundTo;
}

/**
 * Price a quote. Pure apart from the rate, which the caller passes in.
 *
 * Amounts are integers in the quote's minor unit: cents for USD, pesos for COP
 * (COP has no cents in practice). `unit_decimals` says how to show them.
 */
export function priceQuote(input, rate, { now = new Date(), client = parseClient(input?.client) } = {}) {
  const currency = CURRENCIES.includes(String(input?.currency).toUpperCase()) ? String(input.currency).toUpperCase() : "USD";
  const locale = input?.locale === "en" ? "en" : "es";

  const quantity = Number(input?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > QUOTE_MAX_QUANTITY) {
    throw new QuoteError(`Quantity must be a whole number between 1 and ${QUOTE_MAX_QUANTITY}.`, "quantity");
  }
  const includeVerification = input?.verification !== false;
  const includeManaged = input?.managed === true;

  const usd = currency === "USD";
  // The certificate's unit price converts to whole pesos, then multiplies, so
  // unit × quantity always equals the line total shown.
  const unit = (cents) => (usd ? cents : toCop(cents, rate.rate));
  const fixed = (cents) => (usd ? cents : toCop(cents, rate.rate, { roundTo: 1000 }));

  const lines = [];
  const certUnit = unit(QUOTE_PRICES_USD_CENTS.certificate);
  lines.push({ key: "certificates", quantity, unit_amount: certUnit, amount: certUnit * quantity });
  if (includeVerification) {
    const a = fixed(QUOTE_PRICES_USD_CENTS.verification);
    lines.push({ key: "verification", quantity: 1, unit_amount: a, amount: a });
  }
  if (includeManaged) {
    const a = fixed(QUOTE_PRICES_USD_CENTS.managed);
    lines.push({ key: "managed", quantity: 1, unit_amount: a, amount: a });
  }

  const issued = new Date(now);
  const validUntil = new Date(issued.getTime() + QUOTE_VALID_DAYS * 24 * 60 * 60 * 1000);
  return {
    locale,
    currency,
    unit_decimals: usd ? 2 : 0,
    lines,
    total: lines.reduce((s, l) => s + l.amount, 0),
    rate: usd ? null : { usd_cop: rate.rate, date: rate.date, source: rate.source },
    issued_at: issued.toISOString().slice(0, 10),
    valid_until: validUntil.toISOString().slice(0, 10),
    client,
  };
}

/** A reference to quote back: HP-261026-7F3A. */
export function quoteNumber(now = new Date()) {
  const d = new Date(now).toISOString().slice(2, 10).replace(/-/g, "");
  return `HP-${d}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

/** Amount as people read it: "USD 100.00", "COP 400.000". */
export function formatAmount(amount, quote) {
  const value = amount / (quote.unit_decimals ? 100 : 1);
  const n = new Intl.NumberFormat(quote.locale === "en" ? "en-US" : "es-CO", {
    minimumFractionDigits: quote.unit_decimals,
    maximumFractionDigits: quote.unit_decimals,
  }).format(value);
  return `${quote.currency} ${n}`;
}
