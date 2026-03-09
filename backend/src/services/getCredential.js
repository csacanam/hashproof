/**
 * Fetch credential by id for verification.
 */

import { supabase } from "../supabase.js";

export async function getCredentialById(id) {
  const { data, error } = await supabase
    .from("credentials")
    .select(
      "id, credential_json, status, credential_type, title, issued_at, expires_at, credential_hash, tx_hash, platform_entity_id, templates(page_width, page_height), contexts(title), platform:entities!platform_entity_id(display_name)"
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  // Fallback: if platform join failed (e.g. PostgREST syntax varies), fetch entity by id
  if (!data.platform?.display_name && data.platform_entity_id) {
    const { data: platformEntity } = await supabase
      .from("entities")
      .select("display_name")
      .eq("id", data.platform_entity_id)
      .single();
    if (platformEntity) {
      data.platform = platformEntity;
    }
  }

  return data;
}
