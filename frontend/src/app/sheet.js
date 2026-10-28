/**
 * Spreadsheets for bulk issuance: the file to fill in, built from the chosen
 * template, and reading back an .xlsx as well as a CSV.
 *
 * The headers are the ones the column mapping recognizes on its own — the
 * name, the email and each field's key — so a filled-in file maps itself.
 */

import { parseRows, toCsv } from "./csv.js";

const COPY = {
  es: { name: "nombre", email: "correo", people: ["María Fernanda López", "Andrés Gómez Ruiz"], mails: ["maria@ejemplo.com", "andres@ejemplo.com"] },
  en: { name: "name", email: "email", people: ["Maria Lopez", "Andrew Gomez"], mails: ["maria@example.com", "andrew@example.com"] },
};

/** A plausible value for a field, guessed from its key. */
function sample(key, i, locale) {
  const k = key.toLowerCase();
  const es = locale === "es";
  if (/hora|hour/.test(k)) return i ? "16" : "8";
  if (/doc|cedula|cédula|dni|ident|extra|^id$|_id$/.test(k)) return i ? "1009876543" : "1001234567";
  if (/fecha|date/.test(k)) return es ? "15 de octubre de 2026" : "October 15, 2026";
  if (/nota|grade|score|calif/.test(k)) return i ? "4.8" : "4.5";
  if (/detail|detalle/.test(k)) return es ? "Asistió al evento" : "Attended the event";
  return es ? "Texto de ejemplo" : "Sample text";
}

/** Headers and two example rows for a template's fields. */
export function sheetTemplate(extraFields, locale) {
  const L = COPY[locale === "en" ? "en" : "es"];
  const keys = extraFields.map((f) => f.key);
  const headers = [L.name, L.email, ...keys];
  const rows = [0, 1].map((i) => ({
    [L.name]: L.people[i],
    [L.email]: L.mails[i],
    ...Object.fromEntries(keys.map((k) => [k, sample(k, i, locale)])),
  }));
  return { headers, rows };
}

function save(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * CSV that opens right in Excel: a BOM so accents survive, and ";" in Spanish,
 * where Excel's list separator is the semicolon.
 */
export function downloadCsvTemplate({ headers, rows }, locale, filename) {
  const text = toCsv(headers, rows, locale === "en" ? "," : ";");
  save(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }), filename);
}

const xml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function colName(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** A one-sheet .xlsx, every cell text (so IDs keep their digits), header in bold. */
export async function downloadXlsxTemplate({ headers, rows }, filename) {
  const { default: JSZip } = await import("jszip");
  const cell = (v, r, c, style) =>
    `<c r="${colName(c)}${r}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  const lines = [
    `<row r="1">${headers.map((h, c) => cell(h, 1, c, 1)).join("")}</row>`,
    ...rows.map((row, i) => `<row r="${i + 2}">${headers.map((h, c) => cell(row[h], i + 2, c, 2)).join("")}</row>`),
  ];
  const widths = headers.map((h, c) => {
    const longest = Math.max(h.length, ...rows.map((r) => String(r[h] ?? "").length));
    return `<col min="${c + 1}" max="${c + 1}" width="${Math.min(60, longest + 4)}" customWidth="1"/>`;
  });

  const zip = new JSZip();
  // No folder entries: only the parts, as Excel writes them.
  const add = (path, body) => zip.file(path, body, { createFolders: false });
  add(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  );
  add(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  add(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Certificados" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  add(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  // Style 1: bold header. Style 2: text format (@), so a typed ID stays text.
  add(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  );
  add(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.join("")}</cols><sheetData>${lines.join("")}</sheetData></worksheet>`,
  );
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  save(blob, filename);
}

function colIndex(ref) {
  const letters = String(ref).match(/^[A-Z]+/)?.[0] ?? "A";
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

const text = (el) => (el ? [...el.getElementsByTagName("t")].map((t) => t.textContent).join("") : "");

/**
 * Read the first sheet of an .xlsx into the same shape parseCsv returns.
 * Every value comes back as text, as typed: numbers keep their digits.
 */
export async function readXlsx(buffer) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const parse = async (path) => {
    const f = zip.file(path);
    return f ? new DOMParser().parseFromString(await f.async("string"), "application/xml") : null;
  };

  const workbook = await parse("xl/workbook.xml");
  const rels = await parse("xl/_rels/workbook.xml.rels");
  const firstId = workbook?.getElementsByTagName("sheet")[0]?.getAttribute("r:id");
  const target = [...(rels?.getElementsByTagName("Relationship") ?? [])].find((r) => r.getAttribute("Id") === firstId)?.getAttribute("Target");
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`) : "xl/worksheets/sheet1.xml";
  const sheet = await parse(sheetPath);
  if (!sheet) throw new Error("No sheet found in this file.");

  const sharedDoc = await parse("xl/sharedStrings.xml");
  const shared = sharedDoc ? [...sharedDoc.getElementsByTagName("si")].map(text) : [];

  const rows = [...sheet.getElementsByTagName("row")].map((row) => {
    const out = [];
    for (const c of row.getElementsByTagName("c")) {
      const type = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      const value = type === "s" ? shared[Number(v)] ?? "" : type === "inlineStr" ? text(c.getElementsByTagName("is")[0]) : type === "b" ? (v === "1" ? "TRUE" : "FALSE") : v;
      out[colIndex(c.getAttribute("r"))] = value;
    }
    return Array.from(out, (x) => (x ?? "").trim());
  });
  return parseRows(rows);
}

export function isXlsx(file) {
  return /\.xlsx$/i.test(file?.name || "") || file?.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}
