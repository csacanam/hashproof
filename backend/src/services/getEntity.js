import { supabase } from "../supabase.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENTITY_FIELDS =
  "id, display_name, slug, website, logo_url, email_verified, last_verified_at, status, authorized_wallets, created_at, updated_at";

/**
 * Fetch entity by UUID or slug.
 */
export async function getEntityById(id) {
  const column = UUID_RE.test(id) ? "id" : "slug";

  const { data, error } = await supabase
    .from("entities")
    .select(ENTITY_FIELDS)
    .eq(column, id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  return data;
}

