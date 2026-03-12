/**
 * Generate PDF for a credential from template + credential_json.
 */

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { supabase } from "../supabase.js";

export async function generateCredentialPdf(credentialId, baseUrl) {
  const { data: cred, error } = await supabase
    .from("credentials")
    .select(
      "id, credential_json, background_url_override, templates(background_url, page_width, page_height, fields_json)"
    )
    .eq("id", credentialId)
    .single();

  if (error || !cred) {
    return null;
  }

  const template = Array.isArray(cred.templates) ? cred.templates[0] : cred.templates;
  if (!template) return null;

  const page_width = Number(template.page_width) || 595;
  const page_height = Number(template.page_height) || 842;
  const fields_json = template.fields_json ?? [];
  const background_url = cred.background_url_override || template.background_url;

  const credentialJson = cred.credential_json;
  const verificationUrl = `${baseUrl}/verify/${credentialId}`;
  const subject = credentialJson?.credentialSubject ?? {};

  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({
      size: [page_width, page_height],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      if (background_url) {
        try {
          const res = await fetch(background_url);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            doc.image(buf, 0, 0, { width: page_width, height: page_height });
          }
        } catch (bgErr) {
          console.warn("[generatePdf] background fetch failed:", bgErr.message);
        }
      }

      const fields = Array.isArray(fields_json) ? fields_json : [];
      for (const f of fields) {
        const key = f?.key;
        if (!key) continue;
        const text = String(subject[key] ?? "").trim();
        if (!text) continue;
        const x = Number(f.x) ?? 0;
        const y = Number(f.y) ?? 0;
        const w = Math.max(1, Number(f.width) || page_width - x - 20);
        const fontSize = Math.min(200, Math.max(6, Number(f.font_size) || 12));
        const fontColor = f.font_color ?? "#000000";
        const align = f.align === "center" ? "center" : f.align === "right" ? "right" : "left";
        const bold = f.bold === true;
        const italic = f.italic === true;
        const fontName =
          bold && italic
            ? "Helvetica-BoldOblique"
            : bold
              ? "Helvetica-Bold"
              : italic
                ? "Helvetica-Oblique"
                : "Helvetica";
        const textOpts = {
          width: w,
          align,
          ellipsis: true,
          ...(f.underline === true && { underline: true }),
          ...(f.strike === true && { strike: true }),
        };
        doc.font(fontName).fontSize(fontSize).fillColor(fontColor).text(text, x, y, textOpts);
      }

      // Scale QR from a reference size (360px at 3508px width, ~20% larger) so it looks good on any page size
      const REFERENCE_PAGE_WIDTH = 3508;
      const REFERENCE_QR_SIZE = 360;
      const QR_SIZE_MIN = 96;
      const QR_SIZE_MAX = 360;
      const qrSize = Math.round(
        Math.min(QR_SIZE_MAX, Math.max(QR_SIZE_MIN, REFERENCE_QR_SIZE * (page_width / REFERENCE_PAGE_WIDTH)))
      );
      const qrMargin = Math.round(qrSize * 0.4); // margin scales with QR
      const qrX = page_width - qrSize - qrMargin;
      const qrY = qrMargin; // same margin, but from the top edge (top-right corner)
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: qrSize });
      doc.image(qrDataUrl, qrX, qrY, { width: qrSize, height: qrSize });

      doc.end();
    } catch (err) {
      doc.end();
      reject(err);
    }
  });
}
