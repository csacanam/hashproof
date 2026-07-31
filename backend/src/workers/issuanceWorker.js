/**
 * Background worker that drains the issuance queue.
 *
 * Runs in-process alongside the API. Several instances can run it at once —
 * claim_issuance_jobs uses SKIP LOCKED, so a job is only ever handed to one.
 *
 * Concurrency is bounded because the real limit is downstream: the on-chain
 * broadcast is serialized behind a single wallet at ~110ms each, so running more
 * workers than that just piles up requests waiting on the same lock.
 */

import {
  claimIssuanceJobs,
  completeIssuanceJob,
  rescheduleIssuanceJob,
  failIssuanceJob,
  isPermanentError,
  backoffFor,
} from "../services/issuanceJobs.js";
import { executeIssueCredential } from "../services/issueCredential.js";
import { addCredits } from "../services/apiKeys.js";

const POLL_INTERVAL_MS = Number(process.env.ISSUANCE_WORKER_POLL_MS) || 1_000;
const CONCURRENCY = Number(process.env.ISSUANCE_WORKER_CONCURRENCY) || 8;
const LEASE_SECONDS = Number(process.env.ISSUANCE_WORKER_LEASE_SECONDS) || 300;

const ERROR_POLL_INTERVAL_MS = 30_000;
const MAX_LOGGED_CLAIM_ERRORS = 3;

let running = false;
let timer = null;
let inFlight = 0;
let consecutiveClaimErrors = 0;

/** Run one job to completion, translating the outcome into a queue transition. */
async function processJob(job) {
  try {
    const result = await executeIssueCredential(job.payload);
    await completeIssuanceJob(job.id, result.id);
    return { ok: true };
  } catch (err) {
    const message = err?.message || String(err);

    if (isPermanentError(message)) {
      // Bad input: retrying cannot help, so stop and surface it to the client.
      await failIssuanceJob(job.id, message);
      // The credit was taken at enqueue time; give it back since no credential
      // was ever produced.
      if (job.api_key_id) {
        try {
          await addCredits(job.api_key_id, 1);
        } catch (refundErr) {
          console.error(
            `[issuance-worker] credit refund failed for job ${job.id} (key ${job.api_key_id}):`,
            refundErr.message,
          );
        }
      }
      console.error(`[issuance-worker] job ${job.id} failed permanently: ${message}`);
      return { ok: false, permanent: true };
    }

    // Infrastructure problem. Back off and try again — never drop it, because an
    // accepted certificate has to end up sealed on-chain eventually.
    const delay = backoffFor(job.attempts);
    await rescheduleIssuanceJob(job.id, message, delay);
    console.warn(
      `[issuance-worker] job ${job.id} attempt ${job.attempts} failed (${message}); retrying in ${delay}s`,
    );
    return { ok: false, permanent: false };
  }
}

async function tick() {
  if (!running) return;
  try {
    const slots = CONCURRENCY - inFlight;
    if (slots > 0) {
      const jobs = await claimIssuanceJobs(slots, LEASE_SECONDS);
      for (const job of jobs) {
        inFlight++;
        processJob(job)
          .catch((err) => {
            // A failure inside the queue transition itself: the lease expires and
            // the job gets reclaimed, so nothing is lost.
            console.error(`[issuance-worker] job ${job.id} bookkeeping failed:`, err.message);
          })
          .finally(() => {
            inFlight--;
          });
      }
    }
    consecutiveClaimErrors = 0;
  } catch (err) {
    consecutiveClaimErrors++;
    // Before the migration is applied the table doesn't exist, and polling every
    // second would bury the logs. Complain loudly a few times, then back off.
    if (consecutiveClaimErrors <= MAX_LOGGED_CLAIM_ERRORS) {
      console.error(
        `[issuance-worker] claim failed (${consecutiveClaimErrors}): ${err.message}` +
          (consecutiveClaimErrors === MAX_LOGGED_CLAIM_ERRORS ? " — muting further identical errors" : ""),
      );
    }
  } finally {
    if (running) {
      // Slow the loop right down while claims keep failing, so a missing table or
      // a database outage doesn't turn into a hot loop.
      const delay = consecutiveClaimErrors > MAX_LOGGED_CLAIM_ERRORS ? ERROR_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
      timer = setTimeout(tick, delay);
    }
  }
}

export function startIssuanceWorker() {
  if (running) return;
  running = true;
  console.log(`[issuance-worker] started (concurrency=${CONCURRENCY}, poll=${POLL_INTERVAL_MS}ms)`);
  timer = setTimeout(tick, POLL_INTERVAL_MS);
}

export function stopIssuanceWorker() {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

export function getWorkerLoad() {
  return { running, inFlight, concurrency: CONCURRENCY };
}
