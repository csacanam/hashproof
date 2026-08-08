/**
 * Lightweight metadata for a credential — database only.
 *
 * Deliberately does NOT touch the contract or IPFS. `GET /verify/:id` runs the
 * full three-layer pipeline and takes seconds; social crawlers give up long
 * before that, so link previews need a cheap path of their own.
 */

import { supabase } from "../supabase.js";

export async function getCredentialMeta(id) {
  const { data, error } = await supabase
    .from("credentials")
    .select(
      "id, credential_json, credential_type, created_at, expires_at, revoked_at, background_url_override, templates(background_url, page_width, page_height, fields_json), contexts(title), issuer:entities!issuer_entity_id(display_name, status)"
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  const cj = data.credential_json ?? {};
  const subject = cj.credentialSubject ?? {};
  const template = Array.isArray(data.templates) ? data.templates[0] : data.templates;
  const context = Array.isArray(data.contexts) ? data.contexts[0] : data.contexts;
  const issuer = Array.isArray(data.issuer) ? data.issuer[0] : data.issuer;

  // Same precedence the verification page uses, so preview and page agree.
  const holderName = subject.holder_name || subject.full_name || subject.name || null;

  // Status here is derived from the database alone. The contract remains the
  // only source of truth (see verifyPipeline); this is for previews, not proof.
  const now = Date.now();
  let status = "active";
  if (data.revoked_at) status = "revoked";
  else if (data.expires_at && new Date(data.expires_at).getTime() < now) status = "expired";

  // Geometry for the link-preview image, so the name lands where the PDF puts
  // it. Deliberately only the name field: any other template field may hold an
  // identifier, and a social preview is the last place that should appear.
  const fields = Array.isArray(template?.fields_json) ? template.fields_json : [];
  const nameField = fields.find((f) => f?.key === "holder_name" || f?.key === "full_name") ?? null;

  return {
    id: data.id,
    holder_name: holderName,
    page_width: template?.page_width ?? null,
    page_height: template?.page_height ?? null,
    name_field: nameField
      ? {
          x: nameField.x ?? 0,
          y: nameField.y ?? 0,
          width: nameField.width ?? null,
          font_size: nameField.font_size ?? 32,
          font_color: nameField.font_color ?? "#000000",
          align: nameField.align ?? "left",
          bold: nameField.bold === true,
        }
      : null,
    credential_name: cj.name ?? null,
    context_title: cj.context?.title ?? context?.title ?? null,
    issuer_name: cj.issuer?.display_name ?? issuer?.display_name ?? null,
    issuer_status: issuer?.status ?? null,
    credential_type: data.credential_type ?? null,
    image_url: data.background_url_override ?? template?.background_url ?? null,
    created_at: data.created_at ?? null,
    expires_at: data.expires_at ?? null,
    status,
    status_source: "database",
  };
}
