import { supabase } from "../supabase.js";

/**
 * Approve an entity verification request.
 * Sets entity status, authorized wallets, and marks the request as approved.
 *
 * Wallets are read from the verification request payload automatically when
 * request_id is provided. An explicit wallets[] array overrides this.
 *
 * Called from POST /admin/entities/:id/verify (protected by ADMIN_SECRET).
 */
/** Stored with a scheme so the page can link it; the proof check normalises it. */
function normalizeWebsite(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function approveEntity({ entityId, type, wallets, requestId }) {
  const status = type === "organization" ? "organization_verified" : "individual_verified";

  let resolvedWallets = wallets ?? [];
  let requestedWebsite = null;

  // If no wallets passed explicitly but we have a request_id, read them from the request payload
  if (requestId) {
    const { data: verReq, error: verReqError } = await supabase
      .from("entity_verification_requests")
      .select("payload")
      .eq("id", requestId)
      .single();

    if (verReqError) throw new Error(`Could not load verification request: ${verReqError.message}`);

    const formWallets = verReq?.payload?.form?.wallets;
    if (resolvedWallets.length === 0 && Array.isArray(formWallets) && formWallets.length > 0) {
      resolvedWallets = formWallets;
    }

    // The website the applicant declared, and which this review is what
    // establishes. Everything downstream keys off it: it is the one domain the
    // issuer can later prove by DNS without credentials, so leaving it unset —
    // as this did — means an approved issuer has no domain to prove.
    requestedWebsite = normalizeWebsite(verReq?.payload?.form?.website);
  }

  if (resolvedWallets.length === 0) {
    throw new Error("No wallets found. Pass wallets[] explicitly or provide a valid request_id.");
  }

  // Normalize wallets to lowercase for consistent comparison
  const normalizedWallets = resolvedWallets.map((w) => w.toLowerCase());

  const { error: entityError } = await supabase
    .from("entities")
    .update({
      status,
      authorized_wallets: normalizedWallets,
      email_verified: true,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(requestedWebsite && { website: requestedWebsite }),
    })
    .eq("id", entityId);

  if (entityError) throw new Error(entityError.message);

  if (requestId) {
    const { error: reqError } = await supabase
      .from("entity_verification_requests")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (reqError) throw new Error(reqError.message);
  }

  return { entityId, status, authorized_wallets: normalizedWallets };
}
