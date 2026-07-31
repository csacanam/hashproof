/**
 * Durable issuance queue.
 *
 * The API enqueues a job and answers immediately; a worker replays the exact
 * same issuance pipeline in the background. Because the queue lives in Postgres
 * rather than in memory, an event that is halfway through issuing survives a
 * container restart.
 *
 * Retries are deliberately open-ended for infrastructure errors: a certificate
 * that was accepted must end up sealed on-chain, so a Celo outage delays a job
 * but never discards it. Only errors that cannot succeed on retry (an invalid
 * payload) end in a terminal 'failed' state.
 */

import { supabase } from "../supabase.js";

// Backoff between attempts, in seconds; the last value repeats forever.
const BACKOFF_SECONDS = [5, 15, 45, 120, 300, 600];

/** Errors that will fail identically on every retry — retrying just wastes work. */
export function isPermanentError(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("required") ||
    m.includes("does not match") ||
    m.includes("provide only one of") ||
    m.includes("template already exists") ||
    m.includes("not found") ||
    m.includes("suspended") ||
    m.includes("not authorized")
  );
}

export function backoffFor(attempts) {
  const i = Math.min(Math.max(attempts - 1, 0), BACKOFF_SECONDS.length - 1);
  return BACKOFF_SECONDS[i];
}

/**
 * Enqueue an issuance. When idempotencyKey is supplied and a job already exists
 * for it, the existing job is returned instead of creating a second one — this
 * is what makes a user clicking "generate" repeatedly harmless.
 */
export async function createIssuanceJob({ payload, issuerEntityId, apiKeyId, idempotencyKey }) {
  const { data, error } = await supabase.rpc("create_issuance_job", {
    p_payload: payload,
    p_issuer_entity_id: issuerEntityId ?? null,
    p_api_key_id: apiKeyId ?? null,
    p_idempotency_key: idempotencyKey ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data?.job) throw new Error("create_issuance_job returned no job");
  return { job: data.job, created: data.created === true };
}

/** Job status for the polling endpoint. Null when the id is unknown. */
export async function getIssuanceJob(id) {
  const { data, error } = await supabase.rpc("get_issuance_job", { p_id: id });
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Atomically take up to `limit` jobs. Safe to call from several instances. */
export async function claimIssuanceJobs(limit = 1, leaseSeconds = 300) {
  const { data, error } = await supabase.rpc("claim_issuance_jobs", {
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function completeIssuanceJob(jobId, credentialId) {
  const { error } = await supabase.rpc("complete_issuance_job", {
    p_job_id: jobId,
    p_credential_id: credentialId,
  });
  if (error) throw new Error(error.message);
}

export async function rescheduleIssuanceJob(jobId, message, delaySeconds) {
  const { error } = await supabase.rpc("reschedule_issuance_job", {
    p_job_id: jobId,
    p_error: String(message ?? "").slice(0, 500),
    p_delay_seconds: delaySeconds,
  });
  if (error) throw new Error(error.message);
}

export async function failIssuanceJob(jobId, message) {
  const { error } = await supabase.rpc("fail_issuance_job", {
    p_job_id: jobId,
    p_error: String(message ?? "").slice(0, 500),
  });
  if (error) throw new Error(error.message);
}

/** Queue depth by status, for stuck-job alerting in the cron health check. */
export async function getQueueStats() {
  const { data, error } = await supabase.rpc("get_issuance_queue_stats");
  if (error) throw new Error(error.message);
  return data ?? { queued: 0, processing: 0, oldest_pending_seconds: 0 };
}
