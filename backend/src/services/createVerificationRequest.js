import { supabase } from "../supabase.js";

/**
 * Create an entity verification request.
 * For now this is open (no x402), but the endpoint is designed to be protected later via x402.
 */
export async function createVerificationRequest(entityId, type, form, meta = {}) {
  if (!entityId) {
    throw new Error("entityId is required");
  }
  if (type !== "organization" && type !== "individual") {
    throw new Error("type must be 'organization' or 'individual'");
  }

  const payload = {
    type,
    form,
    meta,
  };

  const { data, error } = await supabase
    .from("entity_verification_requests")
    .insert({
      entity_id: entityId,
      type,
      payload,
      price_usd: meta.price_usd ?? null,
      currency: meta.currency ?? undefined,
      network: meta.network ?? undefined,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

