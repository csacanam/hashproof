/**
 * Produces the certificate PDF and the two anchors that travel with it.
 *
 * Since the pinned copy no longer carries the subject, on its own it can prove a
 * credential existed but nothing about the document a person is holding. These
 * two fields close that gap without publishing anything identifying:
 *
 *   document.hash — sha256 of the issued PDF. Whoever has the file can prove it
 *                   is the original. A PDF has far too much entropy to guess, so
 *                   unlike a hash of a name or an ID number this one cannot be
 *                   brute-forced by someone who merely crawled the pins.
 *   design        — background CID, page size and field geometry, so the
 *                   certificate can be re-rendered when our storage is gone.
 *                   Field *keys* only; values never leave the database.
 *
 * Both are attached to credential_json, which is already stored and pinned, so
 * verification rebuilds them without a schema change.
 */

import { createHash } from "node:crypto";
import { supabase } from "../supabase.js";
import { renderCredentialPdf } from "./generatePdf.js";
import { getBackgroundCid } from "./backgroundIpfs.js";

/** Geometry the renderer honours — no values, only which field goes where. */
function describeFields(fieldsJson) {
  const fields = Array.isArray(fieldsJson) ? fieldsJson : [];
  return fields
    .filter((f) => f?.key)
    .map((f) => ({
      key: f.key,
      x: Number(f.x) || 0,
      y: Number(f.y) || 0,
      ...(f.width != null && { width: Number(f.width) }),
      fontSize: Number(f.font_size) || 12,
      fontColor: f.font_color ?? "#000000",
      align: f.align ?? "left",
      ...(f.bold === true && { bold: true }),
      ...(f.italic === true && { italic: true }),
      ...(f.underline === true && { underline: true }),
      ...(f.strike === true && { strike: true }),
    }));
}

export async function buildCredentialArtifacts({
  credentialJson,
  templateId,
  backgroundUrlOverride,
  verificationUrl,
}) {
  const { data: template } = await supabase
    .from("templates")
    .select("background_url, page_width, page_height, fields_json")
    .eq("id", templateId)
    .single();

  if (!template) {
    // Should not happen — prepare_credential resolved this template moments ago.
    // Issue without the anchors rather than fail a paid credential over them.
    return { credentialJson, pdf: null };
  }

  const backgroundUrl = backgroundUrlOverride || template.background_url;

  // Rendering now sits on the issuance path, where it did not before: the hash
  // has to exist before the pin. A malformed template or an unreachable
  // background must not cost someone their credential, so a failure here drops
  // the anchor rather than aborting. The download endpoint still renders on
  // demand, exactly as it did before.
  let pdf = null;
  try {
    pdf = await renderCredentialPdf({ credentialJson, template, backgroundUrl, verificationUrl });
  } catch (err) {
    console.warn("[credential-artifacts] pdf render failed, issuing without document hash:", err.message);
  }

  // Pinning the background is best-effort and cached per template, so an event
  // with thousands of attendees uploads one image once.
  const backgroundCid = await getBackgroundCid(backgroundUrl);

  return {
    pdf,
    credentialJson: {
      ...credentialJson,
      ...(pdf && {
        document: {
          hash: `sha256:${createHash("sha256").update(pdf).digest("hex")}`,
          mediaType: "application/pdf",
        },
      }),
      design: {
        pageWidth: Number(template.page_width) || 595,
        pageHeight: Number(template.page_height) || 842,
        ...(backgroundCid && { background: `ipfs://${backgroundCid}` }),
        fields: describeFields(template.fields_json),
      },
    },
  };
}
