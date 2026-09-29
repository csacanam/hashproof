/**
 * CSV parsing for bulk issuance.
 *
 * What a real export from Excel or Google Sheets brings, learned the hard way
 * in Peewah's certificate generator:
 *
 * - Excel in Spanish on Windows saves Windows-1252, not UTF-8: read as UTF-8,
 *   "María" becomes "Mar�a" — on a credential that cannot be edited later.
 *   decodeCsv() tries UTF-8 strictly and falls back to Windows-1252.
 * - The delimiter is read from the first line (comma, semicolon or tab). A file
 *   with a single column has none, and then nothing is split: "Pérez Gómez,
 *   María" is one name, not two fields.
 * - The first row is dropped as a header only when it is one — when it contains
 *   a column name we recognize. Dropping it otherwise leaves the first person
 *   without a certificate.
 */

/** Decode an uploaded file: strict UTF-8, or Windows-1252 when it isn't valid UTF-8. */
export function decodeCsv(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

const HEADER_WORDS = new Set([
  "name", "full name", "full_name", "fullname", "holder_name", "first name", "last name",
  "nombre", "nombres", "nombre completo", "apellido", "apellidos", "participante", "asistente",
  "email", "e-mail", "mail", "correo", "correo electronico",
  "documento", "cedula", "identificacion", "id", "dni",
  "details", "detalle", "horas", "hours", "curso", "evento", "course", "event",
]);

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** True when a row reads as column names rather than as a person. */
export function looksLikeHeader(cells) {
  return cells.some((c) => HEADER_WORDS.has(norm(c)));
}

function detectDelimiter(firstLine) {
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : null;
}

export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] || "";
  const parsed = splitRows(src, detectDelimiter(firstLine));
  // A comma with no header row is ambiguous: "Pérez Gómez, María" is one name.
  // It only separates columns when the other columns hold something no name
  // does — an email or a number of 4+ digits (a document, a phone).
  if (parsed.delimiter === "," && !looksLikeHeader(parsed.rows[0] || [])) {
    const extra = parsed.rows.flatMap((r) => r.slice(1));
    if (!extra.some((c) => /@|\d{4,}/.test(c))) return finish(splitRows(src, null).rows);
  }
  return finish(parsed.rows);
}

function splitRows(src, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (delimiter && ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return { delimiter, rows: rows.filter((r) => r.some((c) => c.trim() !== "")) };
}

function finish(nonEmpty) {
  if (!nonEmpty.length) return { headers: [], rows: [], hasHeader: false };

  const width = Math.max(...nonEmpty.map((r) => r.length));
  const hasHeader = looksLikeHeader(nonEmpty[0]);
  const headers = hasHeader
    ? nonEmpty[0].map((h, i) => h.trim() || `Columna ${i + 1}`)
    : Array.from({ length: width }, (_, i) => `Columna ${i + 1}`);
  const body = hasHeader ? nonEmpty.slice(1) : nonEmpty;
  return {
    headers,
    hasHeader,
    rows: body.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))),
  };
}

export function toCsv(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

const NAME_HEADERS = ["name", "full name", "full_name", "fullname", "nombre", "nombre completo", "nombres", "holder_name", "participante", "asistente"];
const EMAIL_HEADERS = ["email", "e-mail", "correo", "correo electronico", "mail"];

/** Best guess of which column holds what, by header name. Without headers, the name is the first column. */
export function guessColumn(headers, kind) {
  const wanted = kind === "name" ? NAME_HEADERS : EMAIL_HEADERS;
  const hit = headers.find((h) => wanted.includes(norm(h)));
  if (hit) return hit;
  return kind === "name" && headers[0] === "Columna 1" ? headers[0] : "";
}

/** A short, stable hex digest — identifies a batch so re-running it resumes instead of duplicating. */
export async function digest(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fill {Column} tags in a text with a row's values — like merge tags in an email
 * tool. Unknown tags are left as written, so a typo shows up in the preview
 * instead of silently printing an empty gap on a certificate.
 */
export function fillTags(text, row) {
  return String(text || "")
    .replace(/\{([^{}]+)\}/g, (m, name) => (Object.prototype.hasOwnProperty.call(row, name.trim()) ? row[name.trim()] : m))
    .trim();
}
