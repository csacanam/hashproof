-- Atomic prepaid-credit accounting for api_keys.
--
-- Credits used to be spent with a read-then-write pair: SELECT the balance,
-- subtract one in JavaScript, UPDATE with the result. Between the balance check
-- in the payment middleware and that UPDATE sat the entire issuance, on-chain
-- wait included, so concurrent requests all read the same balance and each got
-- a credential. One credit bought as many certificates as the caller was
-- willing to fire in parallel.
--
-- Every function here does its arithmetic inside a single statement, in the
-- database, so the row lock Postgres takes for the UPDATE is what serializes
-- concurrent spenders. `where credits_balance >= 1` is evaluated against the
-- locked row, which is why the second request through sees the decremented
-- value and is refused instead of matching a stale one.
--
-- security definer to match the rest of this project's write paths
-- (prepare_credential, create_issuance_job): the API role has no direct write
-- grant on the table.
--
-- Apply after 002_issuance_jobs_rpc.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- deduct_api_credit: spend one credit, or report that there was none to spend.
--
-- Returns { ok, remaining, reason }. ok=false with reason='insufficient_credits'
-- is the authoritative "no" — the middleware's balance check is only a fast
-- rejection for keys that were already empty when the request arrived.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function deduct_api_credit(p_key_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_remaining int;
begin
  update api_keys
     set credits_balance = credits_balance - 1,
         credits_used    = coalesce(credits_used, 0) + 1,
         last_used_at    = now()
   where id = p_key_id
     and credits_balance >= 1
  returning credits_balance into v_remaining;

  if found then
    return jsonb_build_object('ok', true, 'remaining', v_remaining, 'reason', null);
  end if;

  -- Nothing updated: either the key is gone or it is out of credits. The caller
  -- gets different errors for those, so tell them apart.
  select credits_balance into v_remaining from api_keys where id = p_key_id;

  if not found then
    return jsonb_build_object('ok', false, 'remaining', 0, 'reason', 'not_found');
  end if;

  return jsonb_build_object('ok', false, 'remaining', v_remaining, 'reason', 'insufficient_credits');
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- refund_api_credit: give back a credit that paid for work which never happened.
--
-- Charging up front means a failed issuance has already taken the credit. This
-- is the compensating write. credits_used floors at zero so a double refund
-- cannot drive the lifetime counter negative.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function refund_api_credit(p_key_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_remaining int;
begin
  update api_keys
     set credits_balance = credits_balance + 1,
         credits_used    = greatest(coalesce(credits_used, 0) - 1, 0)
   where id = p_key_id
  returning credits_balance into v_remaining;

  if not found then
    return jsonb_build_object('ok', false, 'remaining', 0);
  end if;

  return jsonb_build_object('ok', true, 'remaining', v_remaining);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- add_api_credits: admin top-up.
--
-- Same read-then-write problem as the deduction, with a smaller blast radius
-- (admin-only, and the failure mode is a lost top-up rather than free
-- credentials). Fixed here so the table has one consistent access pattern.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function add_api_credits(p_key_id uuid, p_amount int)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_remaining int;
begin
  if coalesce(p_amount, 0) <= 0 then
    select credits_balance into v_remaining from api_keys where id = p_key_id;
    if not found then
      raise exception 'API key not found';
    end if;
    return jsonb_build_object('ok', true, 'remaining', v_remaining);
  end if;

  update api_keys
     set credits_balance = credits_balance + p_amount
   where id = p_key_id
  returning credits_balance into v_remaining;

  if not found then
    raise exception 'API key not found';
  end if;

  return jsonb_build_object('ok', true, 'remaining', v_remaining);
end;
$$;
