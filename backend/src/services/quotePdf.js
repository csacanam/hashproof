/**
 * The quote as a branded PDF: prices on the first page, what HashProof is and
 * what the certificates look like on the second.
 */

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { getBackgroundImage } from "./backgroundCache.js";
import { QUOTE_COPY, DEMO_VERIFY_URL } from "./quoteCopy.js";
import { formatAmount } from "./quotes.js";

const LOGO_URL = "https://www.hashproof.dev/hashproof-logo.png";

const C = {
  ink: "#0a0a0b",
  text: "#27272a",
  muted: "#71717a",
  line: "#e4e4e7",
  soft: "#f4f4f5",
  accent: "#22d3ee",
  accentDark: "#0e7490",
  white: "#ffffff",
};

const W = 612;
const H = 792;
const M = 48;

function formatDate(iso, locale) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale === "en" ? "en-US" : "es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function logo() {
  try {
    return await getBackgroundImage(LOGO_URL);
  } catch {
    return null;
  }
}

function header(doc, logoBuf, height) {
  doc.rect(0, 0, W, height).fill(C.ink);
  doc.rect(0, height, W, 3).fill(C.accent);
  if (logoBuf) {
    try {
      doc.image(logoBuf, M, height / 2 - 17, { height: 34 });
      return;
    } catch {
      // fall through to the wordmark
    }
  }
  doc.font("Helvetica-Bold").fontSize(22).fillColor(C.white).text("HashProof", M, height / 2 - 12, { lineBreak: false });
}

function footer(doc, L) {
  doc.font("Helvetica").fontSize(8).fillColor(C.muted).text(L.footer, M, H - 36, { width: W - 2 * M, align: "center", lineBreak: false });
}

function pageOne(doc, quote, L, logoBuf) {
  header(doc, logoBuf, 120);

  // Title block, right-aligned in the band.
  const right = { width: 240, align: "right" };
  doc.font("Helvetica-Bold").fontSize(24).fillColor(C.white).text(L.title, W - M - 240, 30, right);
  doc.font("Helvetica").fontSize(9).fillColor("#a1a1aa");
  doc.text(`${L.number} ${quote.number}`, W - M - 240, 64, right);
  doc.text(`${L.issued}: ${formatDate(quote.issued_at, quote.locale)}`, W - M - 240, 77, right);
  doc.text(`${L.validUntil}: ${formatDate(quote.valid_until, quote.locale)}`, W - M - 240, 90, right);

  // Who it is for.
  let y = 150;
  const c = quote.client;
  if (c.name || c.company || c.email || c.event) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(C.accentDark).text(L.preparedFor.toUpperCase(), M, y, { characterSpacing: 1 });
    y += 16;
    if (c.name) {
      doc.font("Helvetica-Bold").fontSize(14).fillColor(C.ink).text(c.name, M, y, { width: 320 });
      y = doc.y + 2;
    }
    doc.font("Helvetica").fontSize(10).fillColor(C.text);
    for (const v of [c.company, c.email]) {
      if (!v) continue;
      doc.text(v, M, y, { width: 320 });
      y = doc.y + 1;
    }
    if (c.event) {
      doc.fillColor(C.muted).text(`${L.event}: `, M, y, { continued: true }).fillColor(C.text).text(c.event, { width: 400 });
      y = doc.y;
    }
    y += 22;
  }

  // Items.
  const col = { concept: M, qty: 330, unit: 380, amount: 470 };
  const colW = { concept: 270, qty: 40, unit: 85, amount: W - M - 470 };
  doc.rect(M, y, W - 2 * M, 24).fill(C.soft);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.muted);
  doc.text(L.concept.toUpperCase(), col.concept + 10, y + 8, { width: colW.concept, characterSpacing: 0.5 });
  doc.text(L.qty.toUpperCase(), col.qty, y + 8, { width: colW.qty, align: "right", characterSpacing: 0.5 });
  doc.text(L.unit.toUpperCase(), col.unit, y + 8, { width: colW.unit, align: "right", characterSpacing: 0.5 });
  doc.text(L.amount.toUpperCase(), col.amount, y + 8, { width: colW.amount - 10, align: "right", characterSpacing: 0.5 });
  y += 34;

  const qtyFmt = new Intl.NumberFormat(quote.locale === "en" ? "en-US" : "es-CO");
  for (const line of quote.lines) {
    const copy = L.lines[line.key];
    const top = y;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(C.ink).text(copy.name, col.concept + 10, y, { width: colW.concept - 10 });
    doc.font("Helvetica").fontSize(8.5).fillColor(C.muted).text(copy.detail, col.concept + 10, doc.y + 3, { width: colW.concept - 10, lineGap: 1 });
    const bottom = doc.y;
    doc.font("Helvetica").fontSize(10.5).fillColor(C.text);
    doc.text(qtyFmt.format(line.quantity), col.qty, top, { width: colW.qty, align: "right" });
    doc.text(formatAmount(line.unit_amount, quote), col.unit, top, { width: colW.unit, align: "right" });
    doc.font("Helvetica-Bold").text(formatAmount(line.amount, quote), col.amount, top, { width: colW.amount - 10, align: "right" });
    y = bottom + 12;
    doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.6).strokeColor(C.line).stroke();
    y += 12;
  }

  // Total.
  doc.roundedRect(W - M - 250, y, 250, 50, 8).fill(C.ink);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#a1a1aa").text(L.total.toUpperCase(), W - M - 236, y + 19, { characterSpacing: 1, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(18).fillColor(C.accent).text(formatAmount(quote.total, quote), W - M - 236, y + 15, { width: 222, align: "right", lineBreak: false });
  y += 66;

  if (quote.rate) {
    const r = { ...quote.rate, dateLabel: formatDate(quote.rate.date, quote.locale) };
    const note = r.source === "market" ? L.rate(r) : L.rateFallback(r);
    doc.font("Helvetica").fontSize(8).fillColor(C.muted).text(note, M, y, { width: W - 2 * M, align: "right" });
    y = doc.y + 18;
  } else {
    y += 6;
  }

  // Terms.
  doc.font("Helvetica").fontSize(9.5).fillColor(C.text);
  for (const term of L.terms) {
    doc.circle(M + 3, y + 5, 2).fill(C.accent);
    doc.fillColor(C.text).text(term, M + 14, y, { width: W - 2 * M - 14, lineGap: 1.5 });
    y = doc.y + 8;
  }

  footer(doc, L);
}

async function sampleCertificate(doc, s, x, y, w, h, qr) {
  doc.save();
  doc.roundedRect(x, y, w, h, 6).fill(C.white);
  doc.roundedRect(x, y, w, h, 6).lineWidth(0.8).strokeColor(C.line).stroke();
  // Each sample has its own colours: that is the point being made.
  doc.rect(x, y + 6, 6, h - 12).fill(s.color);
  doc.rect(x + 6, y + 6, 2, h - 12).fill(s.accent);

  const inner = x + 18;
  const iw = w - 30;
  doc.font("Helvetica-Bold").fontSize(7).fillColor(s.color).text(s.org.toUpperCase(), inner, y + 14, { width: iw - 30, characterSpacing: 0.6 });
  doc.font("Times-Italic").fontSize(8).fillColor(C.muted).text(s.kind, inner, y + 38, { width: iw });
  doc.font("Times-Bold").fontSize(12.5).fillColor(C.ink).text(s.name, inner, y + 52, { width: iw });
  doc.moveTo(inner, y + 74).lineTo(inner + 60, y + 74).lineWidth(1).strokeColor(s.accent).stroke();
  doc.image(qr, x + w - 38, y + 10, { width: 28, height: 28 });
  doc.circle(inner + 3, y + h - 15, 3).fill(C.accent);
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(C.accentDark).text("HASHPROOF", inner + 10, y + h - 18, { characterSpacing: 0.8, lineBreak: false });
  doc.restore();
}

async function pageTwo(doc, quote, L, logoBuf) {
  doc.addPage({ size: [W, H], margin: 0 });
  header(doc, logoBuf, 72);

  let y = 104;
  doc.font("Helvetica-Bold").fontSize(16).fillColor(C.ink).text(L.whyTitle, M, y);
  y = doc.y + 12;

  const boxW = (W - 2 * M - 14) / 2;
  const boxH = 74;
  L.why.forEach(([title, body], i) => {
    const bx = M + (i % 2) * (boxW + 14);
    const by = y + Math.floor(i / 2) * (boxH + 12);
    doc.roundedRect(bx, by, boxW, boxH, 8).fill(C.soft);
    doc.rect(bx, by + 12, 3, 20).fill(C.accent);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(C.ink).text(title, bx + 14, by + 13, { width: boxW - 26 });
    doc.font("Helvetica").fontSize(8.5).fillColor(C.text).text(body, bx + 14, doc.y + 4, { width: boxW - 26, lineGap: 1 });
  });
  y += 2 * (boxH + 12) + 16;

  doc.font("Helvetica-Bold").fontSize(16).fillColor(C.ink).text(L.samplesTitle, M, y);
  doc.font("Helvetica").fontSize(9).fillColor(C.muted).text(L.samplesBody, M, doc.y + 4, { width: W - 2 * M });
  y = doc.y + 14;

  const qr = await QRCode.toDataURL(DEMO_VERIFY_URL, { margin: 0, width: 120 });
  const sw = (W - 2 * M - 24) / 3;
  const sh = 112;
  for (let i = 0; i < L.samples.length; i++) {
    await sampleCertificate(doc, L.samples[i], M + i * (sw + 12), y, sw, sh, qr);
  }
  y += sh + 28;

  doc.font("Helvetica-Bold").fontSize(16).fillColor(C.ink).text(L.howTitle, M, y);
  y = doc.y + 12;
  const stepW = (W - 2 * M - 24) / 3;
  L.how.forEach(([title, body], i) => {
    const sx = M + i * (stepW + 12);
    doc.circle(sx + 11, y + 11, 11).fill(C.ink);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(C.accent).text(String(i + 1), sx, y + 6, { width: 22, align: "center" });
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(C.ink).text(title, sx + 30, y + 5, { width: stepW - 30 });
    doc.font("Helvetica").fontSize(8.5).fillColor(C.text).text(body, sx + 30, doc.y + 3, { width: stepW - 30, lineGap: 1 });
  });
  y += 84;

  doc.roundedRect(M, y, W - 2 * M, 54, 8).fill(C.ink);
  doc.font("Helvetica").fontSize(9).fillColor("#a1a1aa").text(L.demo, M + 16, y + 12, { width: W - 2 * M - 32 });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.accent).text(DEMO_VERIFY_URL, M + 16, y + 27, {
    width: W - 2 * M - 32,
    link: DEMO_VERIFY_URL,
    underline: false,
  });
  y += 72;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(C.ink).text(L.contact, M, y, { width: W - 2 * M, align: "center" });

  footer(doc, L);
}

/** Render a priced quote (see priceQuote) that carries its `number`. */
export async function renderQuotePdf(quote) {
  const L = QUOTE_COPY[quote.locale] ?? QUOTE_COPY.es;
  const logoBuf = await logo();
  const doc = new PDFDocument({
    size: [W, H],
    margin: 0,
    info: { Title: `HashProof — ${L.title} ${quote.number}`, Author: "HashProof" },
  });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  pageOne(doc, quote, L, logoBuf);
  await pageTwo(doc, quote, L, logoBuf);
  doc.end();
  return done;
}
