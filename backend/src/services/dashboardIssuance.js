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
  if (entity.status === "suspended") {
    throw new DashboardIssueError("This organization is suspended and cannot issue credentials.", {
      status: 403,
      code: "entity_suspended",
    });
  }

  const payload = buildPayload(entity, input);
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
