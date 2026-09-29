/**
 * Whether a credential's email reached its holder, and sending it again.
 *
 * A status is set when the email is handed to SendGrid ("sent", or "failed" if
 * SendGrid refused it) and moved forward by SendGrid's Event Webhook. Statuses
 * only move forward: a late "deferred" never hides a "delivered", and the
 * outcomes that need someone's attention (bounced, dropped, spam) stick.
 */

import crypto from "node:crypto";
import { supabase } from "../supabase.js";
import { sendCredentialEmail } from "./mailer.js";
import { normalizeHolderEmail } from "./issueCredential.js";
import { appError } from "../utils/appError.js";

const RANK = { sent: 1, deferred: 2, delivered: 3, bounced: 4, dropped: 4, spam: 4, failed: 4 };

// SendGrid event name → our status. Anything else (processed, open, click…)
// changes nothing.
const FROM_EVENT = {
  delivered: "delivered",
  deferred: "deferred",
  bounce: "bounced",
  dropped: "dropped",
  spamreport: "spam",
};

/** Record the outcome of handing an email to SendGrid. */
export async function recordSend(credentialId, result) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("credential_holder_contacts")
    .update({
      notify_status: result.ok ? "sent" : "failed",
      notify_message_id: result.messageId ?? null,
      notified_at: now,
      notify_updated_at: now,
      notify_detail: result.ok ? null : result.error ?? null,
    })
    .eq("credential_id", credentialId);
  if (error) console.error("[holderNotify] could not record send for", credentialId, error.message);
}

/**
 * Check SendGrid's signed Event Webhook: an ECDSA signature over
 * timestamp + raw body, verified with the public key SendGrid shows when
 * signing is turned on (base64 DER), and a timestamp no older than 10 minutes.
 */
export function verifySendgridSignature(rawBody, signature, timestamp, publicKey, toleranceSeconds = 600) {
  if (!rawBody || !signature || !timestamp || !publicKey) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;
  try {
    const pem = publicKey.includes("BEGIN PUBLIC KEY")
      ? publicKey
      : `-----BEGIN PUBLIC KEY-----\n${publicKey.replace(/\s+/g, "").match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`;
    const verifier = crypto.createVerify("sha256");
    verifier.update(String(timestamp) + rawBody);
    return verifier.verify(pem, signature, "base64");
  } catch {
    return false;
  }
}

/**
 * Apply a batch of SendGrid events. Events without our custom arg (sign-in
 * emails sent through Supabase's SMTP, anything else on the account) are
 * ignored.
 * @returns {Promise<{ applied: number, ignored: number }>}
 */
export async function applySendgridEvents(events) {
  let applied = 0;
  let ignored = 0;
  for (const ev of Array.isArray(events) ? events : []) {
    const credentialId = ev?.hashproof_credential_id;
    const status = FROM_EVENT[ev?.event];
    if (!credentialId || !status) {
      ignored++;
      continue;
    }
    const { data: row } = await supabase
      .from("credential_holder_contacts")
      .select("notify_status")
      .eq("credential_id", credentialId)
      .maybeSingle();
    if (!row || (RANK[row.notify_status] ?? 0) > RANK[status]) {
      ignored++;
      continue;
    }
    const detail = [ev.reason, ev.response, ev.type].filter(Boolean).join(" · ").slice(0, 300) || null;
    const { error } = await supabase
      .from("credential_holder_contacts")
      .update({
        notify_status: status,
        notify_updated_at: new Date((Number(ev.timestamp) || Date.now() / 1000) * 1000).toISOString(),
        notify_detail: status === "delivered" ? null : detail,
      })
      .eq("credential_id", credentialId);
    if (error) console.error("[holderNotify] event update failed", credentialId, error.message);
    else applied++;
  }
  return { applied, ignored };
}

/**
 * Email a credential to its holder again — or for the first time, when it was
 * issued without an address. A corrected address replaces the stored one.
 * Only for credentials the organization issued, and not for revoked ones.
 */
export async function resendCredentialEmail({ entity, credentialId, email, locale, baseUrl }) {
  const { data: cred, error } = await supabase
    .from("credentials")
    .select("id, issuer_entity_id, platform_entity_id, revoked_at, credential_json, contexts(title)")
    .eq("id", credentialId)
    .maybeSingle();
  if (error) throw new Error(`database: ${error.message}`);
  if (!cred || (cred.issuer_entity_id !== entity.id && cred.platform_entity_id !== entity.id)) {
    throw new Error("Credential not found");
  }
  if (cred.revoked_at) throw appError("A revoked credential cannot be sent", 409, "credential_revoked");

  const { data: contact } = await supabase
    .from("credential_holder_contacts")
    .select("email")
    .eq("credential_id", credentialId)
    .maybeSingle();

  const to = email !== undefined && email !== null && email !== "" ? normalizeHolderEmail(email) : contact?.email;
  if (!to) throw appError("A valid email address is required", 400, "invalid_payload");

  if (!contact) {
    const { error: insErr } = await supabase.from("credential_holder_contacts").insert({ credential_id: credentialId, email: to });
    if (insErr) throw new Error(`database: ${insErr.message}`);
  } else if (contact.email !== to) {
    const { error: upErr } = await supabase
      .from("credential_holder_contacts")
      .update({ email: to })
      .eq("credential_id", credentialId);
    if (upErr) throw new Error(`database: ${upErr.message}`);
  }

  const cj = cred.credential_json || {};
  const result = await sendCredentialEmail({
    to,
    locale,
    holder: cj.credentialSubject?.full_name,
    issuer: cj.issuer?.display_name || entity.display_name,
    context: cj.context?.title || cred.contexts?.title,
    verificationUrl: `${baseUrl.replace(/\/$/, "")}/verify/${credentialId}`,
    credentialId,
  });
  await recordSend(credentialId, result);
  if (!result.ok) throw appError(`The email could not be sent: ${result.error}`, 502, "email_failed");
  return { email: to, status: "sent" };
}
