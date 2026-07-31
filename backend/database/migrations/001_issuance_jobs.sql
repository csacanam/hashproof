-- Issuance jobs: durable queue for asynchronous credential issuance.
--
-- Why this exists
-- ---------------
-- /issueCredential used to hold the HTTP connection open until the tx confirmed.
-- Under a burst (an event ending, hundreds of attendees clicking at once) the
-- connection died on a proxy timeout, the client read that as a failure, and the
-- attendee clicked again — one person ended up with 12 identical certificates.
--
-- A job row lets the API answer immediately and the work continue in the
-- background. Nothing is issued from memory: if the container restarts mid-event
-- the queue is still here and gets picked up again.
--
-- The credentials table is untouched — a row still only appears once IPFS and
-- the chain both succeeded, so "every credential has a tx_hash" still holds.

create table issuance_jobs (
  id uuid primary key default gen_random_uuid(),

  -- Set once the pipeline finishes. Null while queued/processing.
  credential_id uuid references credentials(id),

  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),

  -- Full issuance payload, replayed by the worker exactly as the sync path would.
  payload jsonb not null,

  -- Who asked for it, for authorization and credit accounting.
  issuer_entity_id uuid references entities(id),
  api_key_id uuid,

  -- Lets a client collapse repeated clicks onto one job. This is what stops the
  -- duplicate-certificate problem at the source.
  idempotency_key text,

  attempts integer not null default 0,
  last_error text,

  -- Backoff: the worker ignores rows until this moment.
  next_attempt_at timestamptz not null default now(),

  -- Claim marker. A row stuck in 'processing' past the lease is reclaimed, which
  -- is how a job survives a container dying mid-flight.
  locked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One job per idempotency key per issuer: a second click returns the first job.
create unique index issuance_jobs_idempotency_idx
  on issuance_jobs (issuer_entity_id, idempotency_key)
  where idempotency_key is not null;

-- The worker's claim query: pending work, oldest first.
create index issuance_jobs_claim_idx
  on issuance_jobs (status, next_attempt_at)
  where status in ('queued', 'processing');

create index issuance_jobs_credential_idx on issuance_jobs (credential_id);
create index issuance_jobs_created_idx on issuance_jobs (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- claim_issuance_jobs: atomically hand work to one worker.
--
-- SKIP LOCKED means several instances can poll concurrently without handing the
-- same job to two of them, and without blocking each other.
--
-- Rows stuck in 'processing' beyond the lease are reclaimed: that is a job whose
-- container died, not a job being worked on.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function claim_issuance_jobs(
  p_limit integer default 1,
  p_lease_seconds integer default 300
)
returns setof issuance_jobs
language plpgsql
security definer
as $$
begin
  return query
  update issuance_jobs j
  set status = 'processing',
      locked_at = now(),
      attempts = j.attempts + 1,
      updated_at = now()
  where j.id in (
    select c.id from issuance_jobs c
    where (
      (c.status = 'queued' and c.next_attempt_at <= now())
      or (c.status = 'processing' and c.locked_at < now() - make_interval(secs => p_lease_seconds))
    )
    order by c.created_at
    limit p_limit
    for update skip locked
  )
  returning j.*;
end;
$$;

-- Mark a job done and point it at the credential it produced.
create or replace function complete_issuance_job(
  p_job_id uuid,
  p_credential_id uuid
)
returns void
language sql
security definer
as $$
  update issuance_jobs
  set status = 'completed',
      credential_id = p_credential_id,
      last_error = null,
      locked_at = null,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id;
$$;

-- Push a failed job back with backoff. Kept 'queued' rather than 'failed' so a
-- transient outage (RPC down, wallet out of gas) is retried instead of dropped —
-- an issued certificate must never be abandoned unsealed.
create or replace function reschedule_issuance_job(
  p_job_id uuid,
  p_error text,
  p_delay_seconds integer
)
returns void
language sql
security definer
as $$
  update issuance_jobs
  set status = 'queued',
      last_error = p_error,
      locked_at = null,
      next_attempt_at = now() + make_interval(secs => p_delay_seconds),
      updated_at = now()
  where id = p_job_id;
$$;

-- Terminal failure: only for errors that will never succeed on retry (invalid
-- payload), never for infrastructure problems.
create or replace function fail_issuance_job(
  p_job_id uuid,
  p_error text
)
returns void
language sql
security definer
as $$
  update issuance_jobs
  set status = 'failed',
      last_error = p_error,
      locked_at = null,
      updated_at = now()
  where id = p_job_id;
$$;
