/**
 * CSV parsing for bulk issuance. Handles quoted fields, escaped quotes, CRLF,
 * a BOM, and picks the delimiter (comma or semicolon — Excel in Spanish
 * locales writes semicolons) from the header line.
 */
export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";

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
    else if (ch === delimiter) {
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

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim());
  return {
    headers,
    rows: nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))),
  };
}

export function toCsv(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

const NAME_HEADERS = ["name", "full_name", "fullname", "nombre", "nombre completo", "nombres", "holder_name", "participante", "asistente"];
const EMAIL_HEADERS = ["email", "e-mail", "correo", "correo electrónico", "correo electronico", "mail"];

/** Best guess of which column holds what, by header name. */
export function guessColumn(headers, kind) {
  const wanted = kind === "name" ? NAME_HEADERS : EMAIL_HEADERS;
  return headers.find((h) => wanted.includes(h.trim().toLowerCase())) ?? "";
}

/** A short, stable hex digest — identifies a batch so re-running it resumes instead of duplicating. */
export async function digest(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}
