-- Refunds of card purchases take the credits back.
--
-- Additive: new columns on credit_purchases and one function. A Stripe refund
-- reports the amount refunded so far (cumulative); the function turns that
-- into the credits that should be withdrawn in total, and withdraws only the
-- difference from what was already withdrawn — so a repeated event, or several
-- partial refunds, never take back more than they should.

alter table credit_purchases
  add column if not exists payment_ref text,
  add column if not exists refunded_credits int not null default 0,
  add column if not exists refunded_at timestamptz;

create index if not exists credit_purchases_payment_ref_idx on credit_purchases (method, payment_ref);

create or replace function refund_credit_purchase(p_purchase_id uuid, p_refunded_credits int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row credit_purchases%rowtype;
  v_target int;
  v_delta int;
  v_balance int;
  v_take int;
begin
  -- Purchase, then organization, then its keys: the order every other credit
  -- function takes them in.
  select * into v_row from credit_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_target := least(greatest(coalesce(p_refunded_credits, 0), 0), v_row.credits);
  v_delta := v_target - v_row.refunded_credits;
  if v_delta <= 0 then
    return jsonb_build_object('ok', true, 'taken', 0, 'shortfall', 0);
  end if;

  select credits_balance into v_balance from entities where id = v_row.entity_id for update;
  -- Never below zero: credits already spent cannot be taken back.
  v_take := least(v_delta, coalesce(v_balance, 0));

  update entities set credits_balance = credits_balance - v_take where id = v_row.entity_id;
  -- Keep the legacy per-key column in step (see 009).
  update api_keys set credits_balance = coalesce(v_balance, 0) - v_take where entity_id = v_row.entity_id;

  update credit_purchases
     set refunded_credits = v_target,
         refunded_at = now()
   where id = p_purchase_id;

  return jsonb_build_object(
    'ok', true,
    'taken', v_take,
    'shortfall', v_delta - v_take,
    'remaining', coalesce(v_balance, 0) - v_take
  );
end;
$$;
revoke all on function refund_credit_purchase(uuid, int) from public, anon, authenticated;
grant execute on function refund_credit_purchase(uuid, int) to service_role;
