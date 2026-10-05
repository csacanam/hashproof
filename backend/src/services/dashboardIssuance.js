/**
 * Issuing from the dashboard.
 *
 * The same pipeline as an API key issuing with `async: true`: charge one credit,
 * queue a job, let the worker register it, refund if the job never completes.
 * The credit comes from the organization's panel key. The issuer is always the
 * organization itself — nothing in the request can name another.
 */

import { validateIssuancePayload } from "./issueCredential.js";
import { createIssuanceJob } from "./issuanceJobs.js";
import { deductCredit, refundCredit } from "./apiKeys.js";
import { ensurePanelKey } from "./accounts.js";
import { supabase } from "../supabase.js";

const CONTEXT_TYPES = ["event", "course", "diploma", "training", "certification", "membership", "other"];
const CREDENTIAL_TYPES = ["attendance", "completion", "achievement", "participation", "membership", "certification"];
const MAX_KEY_LEN = 200;

export class DashboardIssueError extends Error {
  constructor(message, { status = 400, code = "invalid_payload", row } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.row = row;
  }
}

/**
 * Build the issuance payload for one credential. Pure: used both to validate a
 * whole CSV before anything is charged and to issue each row.
 */
export function buildPayload(entity, input) {
  const holderName = String(input?.holder_name ?? "").trim();
  if (!holderName) throw new DashboardIssueError("holder_name is required");

  const contextType = input.context_type || "event";
  if (!CONTEXT_TYPES.includes(contextType)) {
    throw new DashboardIssueError(`context_type must be one of ${CONTEXT_TYPES.join(", ")}`);
  }
  const credentialType = input.credential_type || "attendance";
  if (!CREDENTIAL_TYPES.includes(credentialType)) {
    throw new DashboardIssueError(`credential_type must be one of ${CREDENTIAL_TYPES.join(", ")}`);
  }

  const values = {};
  for (const [k, v] of Object.entries(input.values || {})) {
    if (v !== undefined && v !== null && String(v).trim() !== "") values[k] = String(v);
  }
  // The template's name field is almost always holder_name; fill it unless the
  // caller set it explicitly, so a CSV with just "name" works.
  if (values.holder_name === undefined) values.holder_name = holderName;

  const holder = { full_name: holderName };
  if (input.holder_email) holder.email = String(input.holder_email).trim();
  if (input.external_id) holder.external_id = String(input.external_id).trim().slice(0, 200);

  let expiresAt = null;
  if (input.expires_at) {
    const d = new Date(input.expires_at);
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      throw new DashboardIssueError("expires_at must be a future date");
    }
    expiresAt = d.toISOString();
  }

  const payload = {
    issuer_entity_id: entity.id,
    issuer: { display_name: entity.display_name, slug: entity.slug },
    platform: { display_name: entity.display_name, slug: entity.slug },
    holder,
    context: { type: contextType, title: String(input.context_title ?? "").trim() },
    credential_type: credentialType,
    title: String(input.title ?? "").trim(),
    values,
    ...(input.template_slug && { template_slug: String(input.template_slug) }),
    // Email the credential to the holder once it is issued: asked for per issue.
    ...(input.notify_holder === true && holder.email && {
      notify_holder: true,
      notify_locale: input.notify_locale === "en" ? "en" : "es",
    }),
    ...(expiresAt && { expires_at: expiresAt }),
  };

  try {
    validateIssuancePayload(payload);
  } catch (err) {
    throw new DashboardIssueError(err.message);
  }
  return payload;
}

/**
 * Queue one credential. `idempotencyKey` identifies the certificate within this
 * organization (e.g. a CSV row); sending it again returns the same job and
 * charges nothing.
 */
export async function issueFromDashboard({ entity, input, idempotencyKey }) {
  return queuePayload({ entity, payload: buildPayload(entity, input), idempotencyKey });
}

/** Charge one credit and queue the payload; refunds when nothing new was queued. */
async function queuePayload({ entity, payload, idempotencyKey }) {
  if (entity.status === "suspended") {
    throw new DashboardIssueError("This organization is suspended and cannot issue credentials.", {
      status: 403,
      code: "entity_suspended",
    });
  }

  const key = idempotencyKey ? `panel:${String(idempotencyKey).slice(0, MAX_KEY_LEN)}` : null;
  const panelKey = await ensurePanelKey(entity.id);

  const deduct = await deductCredit(panelKey.id);
  if (!deduct.ok) {
    throw new DashboardIssueError(
      deduct.reason === "unavailable"
        ? "Could not reach the database. Nothing was charged; retry in a few seconds."
        : "Your organization has no credits left. Buy credits to keep issuing.",
      { status: deduct.reason === "unavailable" ? 503 : 402, code: deduct.reason === "unavailable" ? "database_unavailable" : "insufficient_credits" },
    );
  }

  let job;
  let created;
  try {
    ({ job, created } = await createIssuanceJob({
      payload,
      issuerEntityId: entity.id,
      apiKeyId: panelKey.id,
      idempotencyKey: key,
    }));
  } catch (err) {
    await refundCredit(panelKey.id);
    throw err;
  }
  // A repeat of a row already queued costs nothing.
  if (!created) await refundCredit(panelKey.id);

  return { job_id: job.id, status: job.status, created, remaining: created ? deduct.remaining : deduct.remaining + 1 };
}

/**
 * Reissuing: a new credential that is a copy of one already issued.
 *
 * Everything that shapes the certificate comes from the original — template,
 * background, event or course, title, type, expiry and the holder's stored
 * email — so the copy matches what the organization issued before. Only the
 * values the original already had can be corrected; nothing can be added and
 * the design cannot change. The original stays as it is: revoking it is a
 * separate, explicit step.
 */
const REISSUE_SELECT =
  "id, issuer_entity_id, template_id, credential_type, expires_at, revoked_at, background_url_override, " +
  "credential_json, contexts(type, title, external_id, description, starts_at, ends_at), credential_holder_contacts(email)";

/** The original credential, only if this organization issued it. */
export async function loadReissueSource(entity, credentialId) {
  const { data, error } = await supabase.from("credentials").select(REISSUE_SELECT).eq("id", credentialId).maybeSingle();
  if (error) throw new DashboardIssueError("Could not load the credential. Retry in a few seconds.", { status: 503, code: "database_unavailable" });
  if (!data || data.issuer_entity_id !== entity.id) {
    throw new DashboardIssueError("Credential not found", { status: 404, code: "not_found" });
  }
  return data;
}

function one(rel) {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

/** What the reissue form shows: the original's own values, ready to correct. */
export function describeReissue(source) {
  const subject = source.credential_json?.credentialSubject ?? {};
  const { full_name: fullName = "", ...values } = subject;
  return {
    id: source.id,
    holder_name: fullName,
    values,
    // holder_name on the certificate follows the holder's name unless the
    // original set it to something else.
    name_follows_holder: values.holder_name === undefined || values.holder_name === fullName,
    context_title: one(source.contexts)?.title ?? source.credential_json?.context?.title ?? "",
    title: source.credential_json?.name ?? "",
    revoked: Boolean(source.revoked_at),
    expired: Boolean(source.expires_at && new Date(source.expires_at).getTime() <= Date.now()),
  };
}

/**
 * Build the payload for the copy. Pure. `edits` may carry `holder_name` and
 * `values`; any key the original did not have is ignored.
 */
export function buildReissuePayload(entity, source, edits = {}) {
  const form = describeReissue(source);
  if (form.expired) throw new DashboardIssueError("This credential has expired; a copy would be issued already expired.");

  const holderName = String(edits.holder_name ?? form.holder_name).trim();
  if (!holderName) throw new DashboardIssueError("holder_name is required");

  const values = { ...form.values };
  for (const [k, v] of Object.entries(edits.values || {})) {
    if (!Object.prototype.hasOwnProperty.call(values, k)) continue;
    const text = String(v ?? "").trim();
    if (text) values[k] = text;
  }
  if (form.name_follows_holder && edits.values?.holder_name === undefined) values.holder_name = holderName;

  const ctx = one(source.contexts) ?? {};
  const context = { type: ctx.type || "event", title: form.context_title };
  for (const k of ["external_id", "description", "starts_at", "ends_at"]) if (ctx[k]) context[k] = ctx[k];

  const holder = { full_name: holderName };
  const email = one(source.credential_holder_contacts)?.email;
  if (email) holder.email = email;

  const payload = {
    issuer_entity_id: entity.id,
    issuer: { display_name: entity.display_name, slug: entity.slug },
    platform: { display_name: entity.display_name, slug: entity.slug },
    holder,
    context,
    credential_type: source.credential_type,
    title: form.title,
    values,
    ...(source.template_id && { template_id: source.template_id }),
    ...(source.background_url_override && { background_url_override: source.background_url_override }),
    ...(source.expires_at && { expires_at: new Date(source.expires_at).toISOString() }),
  };

  try {
    validateIssuancePayload(payload);
  } catch (err) {
    throw new DashboardIssueError(err.message);
  }
  return payload;
}

/** Queue the copy of `credentialId`. Same charging and idempotency as any issue. */
export async function reissueFromDashboard({ entity, credentialId, edits, idempotencyKey }) {
  const source = await loadReissueSource(entity, credentialId);
  const payload = buildReissuePayload(entity, source, edits);
  return queuePayload({ entity, payload, idempotencyKey });
}
