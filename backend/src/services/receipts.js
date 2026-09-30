/**
 * Payment receipts for credit purchases, as PDF.
 *
 * One per completed purchase, whichever way it was paid, so an organization's
 * receipts all look the same. A refund made afterwards is shown on it. It is a
 * receipt of payment, not a tax invoice.
 */

import PDFDocument from "pdfkit";
import { supabase } from "../supabase.js";

const TEXT = {
  en: {
    title: "Receipt",
        paidOn: "Date paid",
    method: "Payment method",
    reference: "Payment reference",
    billedTo: "Billed to",
    purchasedBy: "Purchased by",
    description: "Description",
    qty: "Qty",
    unit: "Unit price",
    amount: "Amount",
    item: "HashProof credits (1 credit = 1 verifiable credential)",
    total: "Total paid",
    refunded: "Refunded",
    refundedCredits: "{n} credits withdrawn on {date}",
    methods: { stripe: "Card (Stripe)", voulti: "Crypto (Voulti)", x402: "USDC (x402)" },
    footer: "Questions about this receipt: hi@hashproof.dev",
    notInvoice: "This is a receipt of payment, not a tax invoice.",
  },
  es: {
    title: "Recibo de pago",
        paidOn: "Fecha de pago",
    method: "Medio de pago",
    reference: "Referencia del pago",
    billedTo: "Cliente",
    purchasedBy: "Comprado por",
    description: "Descripción",
    qty: "Cant.",
    unit: "Precio unitario",
    amount: "Valor",
    item: "Créditos HashProof (1 crédito = 1 credencial verificable)",
    total: "Total pagado",
    refunded: "Reembolsado",
    refundedCredits: "{n} créditos retirados el {date}",
    methods: { stripe: "Tarjeta (Stripe)", voulti: "Cripto (Voulti)", x402: "USDC (x402)" },
    footer: "Preguntas sobre este recibo: hi@hashproof.dev",
    notInvoice: "Este documento es un recibo de pago, no una factura.",
  },
};

/** Short, stable number printed on the receipt: HP- plus the purchase id's first 8 characters. */
export function receiptNumber(purchaseId) {
  return `HP-${String(purchaseId).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
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
 * The receipt of one of the organization's purchases, or null when there is
 * none to give (not the organization's, or not paid).
 * @returns {Promise<{ filename: string, pdf: Buffer } | null>}
 */
export async function getReceipt({ entity, purchaseId, locale }) {
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

  const pdf = await renderReceipt({ purchase: p, entity, buyer, locale: locale === "es" ? "es" : "en" });
  return { filename: `hashproof-${receiptNumber(p.id)}.pdf`, pdf };
}

/** Draw the receipt. Pure: everything it prints comes in the arguments. */
export function renderReceipt({ purchase: p, entity, buyer, locale }) {
  const t = TEXT[locale] || TEXT.en;
  const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: `${t.title} ${receiptNumber(p.id)}`, Author: "HashProof" } });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const INK = "#111827";
  const MUTED = "#6b7280";
  const LINE = "#e5e7eb";
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // Header: wordmark and sender on the left, title and number on the right.
  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK).text("HashProof", left, 56);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("hashproof.dev · hi@hashproof.dev", left, 82);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(t.title, left, 56, { width, align: "right" });
  doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(receiptNumber(p.id), left, 78, { width, align: "right" });

  doc.moveTo(left, 112).lineTo(right, 112).strokeColor(LINE).lineWidth(1).stroke();

  // Details in two columns.
  const col2 = left + width / 2;
  let y = 132;
  const field = (label, value, x, yy) => {
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(label.toUpperCase(), x, yy, { width: width / 2 - 12, characterSpacing: 0.4 });
    doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(value || "—", x, yy + 13, { width: width / 2 - 12 });
    return doc.y;
  };
  const l1 = field(t.billedTo, entity.display_name, left, y);
  const r1 = field(t.paidOn, date(p.completed_at || p.created_at, locale), col2, y);
  y = Math.max(l1, r1) + 14;
  const l2 = field(t.method, t.methods[p.method] || p.method, left, y);
  // The card payment's id is what Stripe's dashboard and statements show.
  const r2 = field(t.reference, p.payment_ref || p.external_ref, col2, y);
  y = Math.max(l2, r2) + 14;
  if (buyer) y = field(t.purchasedBy, buyer, left, y) + 14;
  y += 16;

  // Line items.
  const cols = [
    { key: "description", x: left, w: width * 0.52, align: "left" },
    { key: "qty", x: left + width * 0.52, w: width * 0.12, align: "right" },
    { key: "unit", x: left + width * 0.64, w: width * 0.17, align: "right" },
    { key: "amount", x: left + width * 0.81, w: width * 0.19, align: "right" },
  ];
  doc.rect(left, y, width, 24).fill("#f9fafb");
  for (const c of cols) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(t[c.key], c.x + 8, y + 8, { width: c.w - 16, align: c.align });
  }
  y += 34;
  const unitCents = p.amount_usd_cents / p.credits;
  const values = {
    description: t.item,
    qty: p.credits.toLocaleString(locale === "es" ? "es-CO" : "en-US"),
    unit: usd(unitCents, locale, 3),
    amount: usd(p.amount_usd_cents, locale),
  };
  let rowEnd = y;
  for (const c of cols) {
    doc.font("Helvetica").fontSize(10).fillColor(INK).text(values[c.key], c.x + 8, y, { width: c.w - 16, align: c.align });
    rowEnd = Math.max(rowEnd, doc.y);
  }
  y = rowEnd + 12;
  doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
  y += 14;

  // Totals.
  const totalsX = left + width * 0.5;
  const totalsW = width * 0.5 - 8;
  const totalLine = (label, value, bold = false, color = INK) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor(color);
    doc.text(label, totalsX, y, { width: totalsW / 2 });
    doc.text(value, totalsX + totalsW / 2, y, { width: totalsW / 2, align: "right" });
    y = doc.y + 8;
  };
  totalLine(t.total, usd(p.amount_usd_cents, locale), true);
  if (p.refunded_credits > 0) {
    const refundedCents = Math.round(unitCents * p.refunded_credits);
    totalLine(t.refunded, `- ${usd(Math.min(refundedCents, p.amount_usd_cents), locale)}`, false, "#b91c1c");
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
      t.refundedCredits
        .replace("{n}", p.refunded_credits.toLocaleString(locale === "es" ? "es-CO" : "en-US"))
        .replace("{date}", date(p.refunded_at || p.completed_at, locale)),
      totalsX,
      y,
      { width: totalsW, align: "right" },
    );
  }

  // Footer.
  const footY = doc.page.height - doc.page.margins.bottom - 30;
  doc.moveTo(left, footY - 10).lineTo(right, footY - 10).strokeColor(LINE).stroke();
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
  doc.text(t.footer, left, footY, { width, align: "center", lineBreak: false });
  doc.text(t.notInvoice, left, footY + 12, { width, align: "center", lineBreak: false });

  doc.end();
  return done;
}
