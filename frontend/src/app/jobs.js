import { publicApi } from "./api.js";

const POLL_MS = 3000;

/** Poll an issuance job until it finishes. */
export async function waitForJob(jobId, { signal } = {}) {
  for (;;) {
    if (signal?.aborted) return null;
    const res = await publicApi(`/issuanceJobs/${jobId}`);
    const job = await res.json().catch(() => null);
    if (job && (job.status === "completed" || job.status === "failed")) return job;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
