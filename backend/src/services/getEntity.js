import { supabase } from "../supabase.js";

/**
 * Fetch entity (issuer/platform) by id to display its status and verification levels.
 */
export async function getEntityById(id) {
  const { data, error } = await supabase
    .from("entities")
    .select(
      "id, display_name, slug, website, logo_url, email_verified, last_verified_at, status, authorized_wallets, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

