-- Access issuance_jobs through functions instead of the table.
--
-- The API key has no direct grant on issuance_jobs (same as holders), so reading
-- or writing the table over PostgREST returns "permission denied". Every other
-- write path in this project already goes through a security-definer function —
-- prepare_credential, finalize_credential — so these follow the same shape
-- rather than opening the table up.
--
-- Apply after 001_issuance_jobs.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- create_issuance_job: enqueue, collapsing repeat requests onto one job.
--
-- Returns { job, created }. `created` is false when an existing job was reused,
-- which the API uses to avoid charging a second credit for the same certificate.
--
-- The insert is attempted directly and a unique violation is caught, rather than
-- checking first and then inserting: two simultaneous clicks would both pass a
-- prior check and create two certificates.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function create_issuance_job(
  p_payload jsonb,
  p_issuer_entity_id uuid default null,
  p_api_key_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_job issuance_jobs;
  v_created boolean := false;
begin
  if p_idempotency_key is not null then
    select * into v_job from issuance_jobs
    where idempotency_key = p_idempotency_key
      and issuer_entity_id is not distinct from p_issuer_entity_id
    limit 1;

    if found then
      return jsonb_build_object('job', to_jsonb(v_job), 'created', false);
    end if;
  end if;

  begin
    insert into issuance_jobs (payload, issuer_entity_id, api_key_id, idempotency_key)
    values (p_payload, p_issuer_entity_id, p_api_key_id, p_idempotency_key)
    returning * into v_job;
    v_created := true;
  exception when unique_violation then
    -- A concurrent request won the race; adopt its job so the caller still gets
    -- exactly one certificate.
    select * into v_job from issuance_jobs
    where idempotency_key = p_idempotency_key
      and issuer_entity_id is not distinct from p_issuer_entity_id
    limit 1;
  end;

  return jsonb_build_object('job', to_jsonb(v_job), 'created', v_created);
end;
$$;

-- Status for the polling endpoint. Only the fields a client needs.
create or replace function get_issuance_job(p_id uuid)
returns jsonb
language sql
security definer
as $$
  select to_jsonb(t) from (
    select id, status, credential_id, attempts, last_error, created_at, completed_at
    from issuance_jobs
    where id = p_id
  ) t;
$$;

-- Queue depth and the age of the oldest pending job, for stuck-queue alerting.
create or replace function get_issuance_queue_stats()
returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'queued', count(*) filter (where status = 'queued'),
    'processing', count(*) filter (where status = 'processing'),
    'oldest_pending_seconds',
      coalesce(round(extract(epoch from (now() - min(created_at))))::int, 0)
  )
  from issuance_jobs
  where status in ('queued', 'processing');
$$;
