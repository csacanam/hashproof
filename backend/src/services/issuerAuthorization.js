import { supabase } from "../supabase.js";

/**
 * Check if a platform is approved to issue on behalf of an issuer.
 * Returns true if an approved authorization row exists.
 */
export async function isPlatformAuthorized(issuerEntityId, platformEntityId) {
  const { data, error } = await supabase
    .from("issuer_authorizations")
    .select("id")
    .eq("issuer_entity_id", issuerEntityId)
    .eq("platform_entity_id", platformEntityId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data !== null;
}

/**
 * Create or update an issuer authorization.
 * If a row already exists (any status), updates its status.
 * If not, inserts a new one.
 */
export async function upsertIssuerAuthorization(issuerEntityId, platformEntityId, status) {
  const { data, error } = await supabase
    .from("issuer_authorizations")
    .upsert(
      { issuer_entity_id: issuerEntityId, platform_entity_id: platformEntityId, status },
      { onConflict: "issuer_entity_id,platform_entity_id" }
    )
    .select("id, issuer_entity_id, platform_entity_id, status, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
