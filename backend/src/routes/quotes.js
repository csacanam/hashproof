/**
 * Public quote calculator: price, PDF, and the PDF by email.
 *
 * Pricing is free and anonymous. The PDF and the email need a name and an
 * address — that is the lead — and each one tells us on Telegram. Both are
 * rate-limited per IP: the email goes out from our domain to an address the
 * visitor typed, so it must not become a way to mail strangers.
 */

import express from "express";
import rateLimit from "express-rate-limit";
import { sendError } from "../utils/errors.js";
import { sendTelegramAlert } from "../utils/notify.js";
import { sendQuoteEmail } from "../services/mailer.js";
import { QUOTE_COPY, DEMO_VERIFY_URL } from "../services/quoteCopy.js";
import { renderQuotePdf } from "../services/quotePdf.js";
import { formatAmount, getUsdCopRate, parseClient, priceQuote, quoteNumber } from "../services/quotes.js";

function limiter(windowMs, max) {
  return rateLimit({
    windowMs,
    max,
    message: { error: "Too many requests, please try again later.", code: "rate_limited" },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

function fail(res, err, handler) {
  if (err?.code === "invalid_quote") {
    return res.status(400).json({ error: err.message, code: err.code, field: err.field });
  }
  return sendError(res, err, { handler });
}

/** The quote as the page shows it: amounts already formatted. */
function present(quote) {
  return {
    ...quote,
    lines: quote.lines.map((l) => ({
      ...l,
      unit_label: formatAmount(l.unit_amount, quote),
      amount_label: formatAmount(l.amount, quote),
    })),
    total_label: formatAmount(quote.total, quote),
  };
}

async function build(body, { requireContact }) {
  const client = parseClient(body?.client, { requireContact });
  const rate = await getUsdCopRate();
  const quote = priceQuote(body, rate, { client });
  return { ...quote, number: quoteNumber() };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

function alertLead(kind, quote) {
  const c = quote.client;
  const qty = quote.lines.find((l) => l.key === "certificates")?.quantity;
  const extras = quote.lines.filter((l) => l.key !== "certificates").map((l) => l.key).join(", ") || "—";
  sendTelegramAlert(
    "quote_lead",
    [
      `🧾 <b>Quote ${kind}</b> ${esc(quote.number)}`,
      `${esc(c.name)}${c.company ? ` · ${esc(c.company)}` : ""}`,
      esc(c.email),
      c.event ? `Event: ${esc(c.event)}` : null,
      `${qty} certificates · extras: ${extras} · ${quote.locale.toUpperCase()}`,
      `<b>${esc(formatAmount(quote.total, quote))}</b>`,
    ]
      .filter(Boolean)
      .join("\n"),
  ).catch(() => {});
}

export function createQuotesRouter() {
  const router = express.Router();
  const priceLimit = limiter(60 * 1000, 60);
  const pdfLimit = limiter(15 * 60 * 1000, 20);
  const emailLimit = limiter(60 * 60 * 1000, 5);

  router.get("/rate", priceLimit, async (_req, res) => {
    try {
      const { rate, date, source } = await getUsdCopRate();
      return res.json({ usd_cop: rate, date, source });
    } catch (err) {
      return fail(res, err, "quotes/rate");
    }
  });

  router.post("/price", priceLimit, async (req, res) => {
    try {
      return res.json(present(await build(req.body, { requireContact: false })));
    } catch (err) {
      return fail(res, err, "quotes/price");
    }
  });

  router.post("/pdf", pdfLimit, async (req, res) => {
    try {
      const quote = await build(req.body, { requireContact: true });
      const pdf = await renderQuotePdf(quote);
      alertLead("downloaded", quote);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="HashProof-${quote.number}.pdf"`);
      res.setHeader("X-Quote-Number", quote.number);
      return res.send(pdf);
    } catch (err) {
      return fail(res, err, "quotes/pdf");
    }
  });

  router.post("/email", emailLimit, async (req, res) => {
    try {
      const quote = await build(req.body, { requireContact: true });
      const pdf = await renderQuotePdf(quote);
      const copy = QUOTE_COPY[quote.locale];
      const sent = await sendQuoteEmail({
        to: quote.client.email,
        quote: { ...quote, totalLabel: formatAmount(quote.total, quote) },
        pdf,
        copy,
        demoUrl: DEMO_VERIFY_URL,
      });
      alertLead(sent.ok ? "emailed" : "email FAILED", quote);
      if (!sent.ok) {
        return res.status(502).json({ error: "We could not send the email right now. Download the PDF instead.", code: "email_failed" });
      }
      return res.json({ ok: true, number: quote.number, email: quote.client.email });
    } catch (err) {
      return fail(res, err, "quotes/email");
    }
  });

  return router;
}
