/**
 * Issue credential service.
 * Calls Supabase RPC issue_credential (Postgres function).
 * Blockchain registration is mocked in the DB function.
 */

import { supabase } from "../supabase.js";

/**
 * Validate that values satisfy template required keys.
 * Kept for unit tests; actual validation happens in Postgres.
 */
export function validateTemplateValues(fieldsJson, values) {
  const fields = Array.isArray(fieldsJson) ? fieldsJson : [];
  for (const f of fields) {
    if (f.key && f.required === true) {
      const v = values[f.key];
      if (v === undefined || v === null || String(v).trim() === "") {
        throw new Error(`Missing required template value for key: ${f.key}`);
      }
    }
  }
}

/**
 * Execute issuance via Supabase RPC.
 * @param {object} payload - Full issuance payload
 */
export async function executeIssueCredential(payload) {
  const {
    issuer,
    platform,
    holder,
    context,
    template,
    template_id,
    template_slug,
    credential_type,
    title,
    issued_at,
    expires_at,
    values = {},
  } = payload;

  if (!issuer?.display_name || !issuer?.slug) throw new Error("issuer.display_name and issuer.slug required");
  if (!platform?.display_name || !platform?.slug) throw new Error("platform.display_name and platform.slug required");
  if (!holder?.full_name) throw new Error("holder.full_name required");
  if (!context?.type || !context?.title) throw new Error("context.type and context.title required");
  if (!credential_type || !title) throw new Error("credential_type and title required");

  // Template optional: base template used when none passed

  const baseUrl = process.env.BASE_URL || "https://hashproof.example.com";

  const { data, error } = await supabase.rpc("issue_credential", {
    p_payload: {
      issuer,
      platform,
      holder,
      context,
      template: template || null,
      template_id: template_id || null,
      template_slug: template_slug || null,
      credential_type,
      title,
      issued_at: issued_at || null,
      expires_at: expires_at || null,
      values,
    },
    p_base_url: baseUrl,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
