import { supabase } from "../supabase.js";

/**
 * Create an entity verification request.
 * Protected by x402 (Thirdweb facilitator). Caller pays before request is created.
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
      tx_hash: meta.tx_hash ?? null,
      tx_explorer_url: meta.tx_explorer_url ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

