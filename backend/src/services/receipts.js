/**
 * Invoices and receipts for credit purchases, as PDF — the pair any app that
 * charges through Stripe offers: the invoice says what was sold and for how
 * much, the receipt that it was paid and how.
 *
 * Both exist for every completed purchase, whichever way it was paid, so an
 * organization's documents all look the same. A refund made afterwards is shown
 * on both.
 *
 * The seller block comes from BILLING_LEGAL_NAME and BILLING_ADDRESS (lines
 * separated by "|"), so the company's details can change without a deploy of
 * code.
 */

import PDFDocument from "pdfkit";
import { supabase } from "../supabase.js";

export const DOCUMENT_KINDS = ["invoice", "receipt"];

const TEXT = {
  en: {
    invoice: "Invoice",
    receipt: "Receipt",
    invoiceNumber: "Invoice number",
    receiptNumber: "Receipt number",
    issued: "Date of issue",
    paidOn: "Date paid",
    status: "Status",
    paid: "Paid",
    from: "From",
    billedTo: "Bill to",
    method: "Payment method",
    reference: "Payment reference",
    description: "Description",
    qty: "Qty",
    unit: "Unit price",
    amount: "Amount",
    item: "HashProof credits (1 credit = 1 verifiable credential)",
    subtotal: "Subtotal",
    total: "Total",
    amountPaid: "Amount paid",
    amountDue: "Amount due",
    refunded: "Refunded",
    refundedCredits: "{n} credits withdrawn on {date}",
    paidBig: "{amount} paid on {date}",
    methods: { stripe: "Card", voulti: "Crypto (USDC via Voulti)", x402: "USDC (x402)" },
    footer: "Questions? Write to hi@hashproof.dev",
  },
  es: {
    invoice: "Factura",
    receipt: "Recibo",
    invoiceNumber: "Número de factura",
    receiptNumber: "Número de recibo",
    issued: "Fecha de emisión",
    paidOn: "Fecha de pago",
    status: "Estado",
    paid: "Pagada",
    from: "De",
    billedTo: "Facturar a",
    method: "Medio de pago",
    reference: "Referencia del pago",
    description: "Descripción",
    qty: "Cant.",
    unit: "Precio unitario",
    amount: "Valor",
    item: "Créditos HashProof (1 crédito = 1 credencial verificable)",
    subtotal: "Subtotal",
    total: "Total",
    amountPaid: "Valor pagado",
    amountDue: "Saldo pendiente",
    refunded: "Reembolsado",
    refundedCredits: "{n} créditos retirados el {date}",
    paidBig: "{amount} pagados el {date}",
    methods: { stripe: "Tarjeta", voulti: "Cripto (USDC vía Voulti)", x402: "USDC (x402)" },
    footer: "¿Preguntas? Escríbenos a hi@hashproof.dev",
  },
};

const PREFIX = { invoice: "INV", receipt: "RCT" };

/** Short, stable number of a purchase's invoice or receipt: INV-/RCT- plus the id's first 8 characters. */
export function documentNumber(kind, purchaseId) {
  return `${PREFIX[kind]}-${String(purchaseId).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function seller() {
  return {
    name: process.env.BILLING_LEGAL_NAME || "HashProof",
    lines: [...(process.env.BILLING_ADDRESS || "").split("|"), "hi@hashproof.dev", "hashproof.dev"]
      .map((l) => l.trim())
      .filter(Boolean),
  };
}

function usd(cents, locale, digits = 2) {
  return new Intl.NumberFormat(locale === "es" ? "es-CO" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

function date(iso, locale) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-CO" : "en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
}

/**
 * The invoice or receipt of one of the organization's purchases, or null when
 * there is none to give (not the organization's, or not paid).
 * @returns {Promise<{ filename: string, pdf: Buffer } | null>}
 */
export async function getBillingDocument({ entity, purchaseId, kind, locale }) {
  if (!DOCUMENT_KINDS.includes(kind)) return null;
  const { data: p, error } = await supabase
    .from("credit_purchases")
    .select("id, method, credits, amount_usd_cents, status, external_ref, payment_ref, user_id, created_at, completed_at, refunded_credits, refunded_at")
    .eq("entity_id", entity.id)
    .eq("id", purchaseId)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);
  if (!p || p.status !== "completed") return null;

  let buyer = null;
  if (p.user_id) {
    const { data } = await supabase.auth.admin.getUserById(p.user_id).catch(() => ({ data: null }));
    buyer = data?.user?.email ?? null;
  }

  const pdf = await renderBillingDocument({ kind, purchase: p, entity, buyer, locale: locale === "es" ? "es" : "en" });
  return { filename: `HashProof-${documentNumber(kind, p.id)}.pdf`, pdf };
}

/** Draw an invoice or a receipt. Pure: everything it prints comes in the arguments. */
export function renderBillingDocument({ kind, purchase: p, entity, buyer, locale }) {
  const t = TEXT[locale] || TEXT.en;
  const loc = locale === "es" ? "es-CO" : "en-US";
  const number = documentNumber(kind, p.id);
  const paidAt = p.completed_at || p.created_at;
  const unitCents = p.amount_usd_cents / p.credits;
  const refundedCents = p.refunded_credits > 0 ? Math.min(Math.round(unitCents * p.refunded_credits), p.amount_usd_cents) : 0;

  const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: `${t[kind]} ${number}`, Author: "HashProof" } });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const INK = "#111827";
  const MUTED = "#6b7280";
  const LINE = "#e5e7eb";
  const GREEN = "#15803d";
  const RED = "#b91c1c";
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const half = width / 2;

  // Title and wordmark.
  doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text(t[kind], left, 56);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text("HashProof", left, 60, { width, align: "right" });

  // Key facts, label: value.
  let y = 100;
  const facts =
    kind === "invoice"
      ? [
          [t.invoiceNumber, number],
          [t.issued, date(paidAt, locale)],
          [t.status, t.paid],
        ]
      : [
          [t.receiptNumber, number],
          [t.invoiceNumber, documentNumber("invoice", p.id)],
          [t.paidOn, date(paidAt, locale)],
          [t.method, t.methods[p.method] || p.method],
          [t.reference, p.payment_ref || p.external_ref],
        ];
  for (const [label, value] of facts) {
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(label, left, y, { width: 130 });
    doc.font("Helvetica").fontSize(9.5).fillColor(label === t.status ? GREEN : INK).text(value, left + 130, y, { width: half + 60 });
    y = doc.y + 4;
  }
  y += 18;

  // From / Bill to.
  const s = seller();
  const block = (label, lines, x) => {
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(label, x, y, { width: half - 16 });
    let yy = doc.y + 3;
    lines.forEach((line, i) => {
      doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(i === 0 ? INK : MUTED).text(line, x, yy, { width: half - 16 });
      yy = doc.y + 1;
    });
    return yy;
  };
  const fromEnd = block(t.from, [s.name, ...s.lines], left);
  const toEnd = block(t.billedTo, [entity.display_name, buyer].filter(Boolean), left + half);
  y = Math.max(fromEnd, toEnd) + 22;

  // Headline amount, as Stripe puts it.
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(INK)
    .text(t.paidBig.replace("{amount}", usd(p.amount_usd_cents, locale)).replace("{date}", date(paidAt, locale)), left, y);
  y = doc.y + 18;

  // Line items.
  const cols = [
    { key: "description", x: left, w: width * 0.52, align: "left" },
    { key: "qty", x: left + width * 0.52, w: width * 0.12, align: "right" },
    { key: "unit", x: left + width * 0.64, w: width * 0.17, align: "right" },
    { key: "amount", x: left + width * 0.81, w: width * 0.19, align: "right" },
  ];
  for (const c of cols) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(t[c.key], c.x, y, { width: c.w, align: c.align });
  }
  y = doc.y + 6;
  doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).lineWidth(1).stroke();
  y += 10;
  const values = {
    description: t.item,
    qty: p.credits.toLocaleString(loc),
    unit: usd(unitCents, locale, 3),
    amount: usd(p.amount_usd_cents, locale),
  };
  let rowEnd = y;
  for (const c of cols) {
    doc.font("Helvetica").fontSize(10).fillColor(INK).text(values[c.key], c.x, y, { width: c.w, align: c.align });
    rowEnd = Math.max(rowEnd, doc.y);
  }
  y = rowEnd + 10;
  doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
  y += 10;

  // Totals.
  const tx = left + half;
  const tw = half;
  const line = (label, value, { bold = false, color = INK, rule = false } = {}) => {
    if (rule) {
      doc.moveTo(tx, y - 4).lineTo(right, y - 4).strokeColor(LINE).stroke();
      y += 4;
    }
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(color);
    doc.text(label, tx, y, { width: tw / 2 });
    doc.text(value, tx + tw / 2, y, { width: tw / 2, align: "right" });
    y = doc.y + 7;
  };
  if (kind === "invoice") {
    line(t.subtotal, usd(p.amount_usd_cents, locale));
    line(t.total, usd(p.amount_usd_cents, locale), { rule: true });
    line(t.amountPaid, usd(p.amount_usd_cents, locale));
    line(t.amountDue, usd(0, locale), { bold: true, rule: true });
  } else {
    line(t.total, usd(p.amount_usd_cents, locale));
    line(t.amountPaid, usd(p.amount_usd_cents, locale), { bold: true, rule: true });
  }
  if (refundedCents > 0) {
    line(t.refunded, `- ${usd(refundedCents, locale)}`, { color: RED });
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(
      t.refundedCredits.replace("{n}", p.refunded_credits.toLocaleString(loc)).replace("{date}", date(p.refunded_at || paidAt, locale)),
      tx,
      y,
      { width: tw, align: "right" },
    );
  }

  // Footer.
  const footY = doc.page.height - doc.page.margins.bottom - 20;
  doc.moveTo(left, footY - 10).lineTo(right, footY - 10).strokeColor(LINE).stroke();
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
  doc.text(`${number} · ${t.footer}`, left, footY, { width, align: "center", lineBreak: false });

  doc.end();
  return done;
}
