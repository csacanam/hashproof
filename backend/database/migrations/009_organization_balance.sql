-- One balance per organization.
--
-- Until now each API key had its own credits. From here the balance belongs to
-- the entity: every key of an organization, and its dashboard, spend from the
-- same pool. Keys keep credits_used and last_used_at as usage statistics.
--
-- Compatibility
-- -------------
-- deduct_api_credit, refund_api_credit and add_api_credits keep their names,
-- parameters and return shapes, so the API calls them exactly as before; only
-- where the credit lives changes.
--
-- api_keys.credits_balance is no longer the balance. It is kept, and set here to
-- the organization's total, because the backend running while this migration is
-- applied still reads it as a quick "has credits?" check before charging. A
-- stale value there can only let a request through to deduct_api_credit, which
-- is the authority and answers insufficient_credits when the pool is empty.
--
-- Run it in one go; the lock keeps an issuance from landing between the sum and
-- the switch.

begin;

-- The move happens only the first time: running this file again must not add
-- the per-key copies (which then hold the total) to the total a second time.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'entities' and column_name = 'credits_balance'
  ) then
    alter table entities add column credits_balance int not null default 0;

    lock table api_keys in exclusive mode;

    update entities e
       set credits_balance = s.total
      from (select entity_id, sum(credits_balance)::int as total from api_keys group by entity_id) s
     where s.entity_id = e.id;

    update api_keys k
       set credits_balance = e.credits_balance
      from entities e
     where e.id = k.entity_id;
  end if;
end;
$$;

alter table entities drop constraint if exists entities_credits_balance_check;
alter table entities add constraint entities_credits_balance_check check (credits_balance >= 0);

-- ── Spending: same signatures, the pool is the key's organization ──────────
create or replace function deduct_api_credit(p_key_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_entity uuid;
  v_remaining int;
begin
  select entity_id into v_entity from api_keys where id = p_key_id;
  if not found then
    return jsonb_build_object('ok', false, 'remaining', 0, 'reason', 'not_found');
  end if;

  update entities
     set credits_balance = credits_balance - 1
   where id = v_entity
     and credits_balance >= 1
  returning credits_balance into v_remaining;

  if found then
    update api_keys
       set credits_used    = coalesce(credits_used, 0) + 1,
           last_used_at    = now(),
           credits_balance = v_remaining
     where id = p_key_id;
    return jsonb_build_object('ok', true, 'remaining', v_remaining, 'reason', null);
  end if;

  select credits_balance into v_remaining from entities where id = v_entity;
  return jsonb_build_object('ok', false, 'remaining', coalesce(v_remaining, 0), 'reason', 'insufficient_credits');
end;
$$;

create or replace function refund_api_credit(p_key_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_entity uuid;
  v_remaining int;
begin
  -- Organization row first, then the key: the same order deduct_api_credit
  -- takes them in, so a refund and a charge running together cannot deadlock.
  select entity_id into v_entity from api_keys where id = p_key_id;
  if not found then
    return jsonb_build_object('ok', false, 'remaining', 0);
  end if;

  update entities set credits_balance = credits_balance + 1
   where id = v_entity
  returning credits_balance into v_remaining;
  update api_keys
     set credits_used    = greatest(coalesce(credits_used, 0) - 1, 0),
         credits_balance = v_remaining
   where id = p_key_id;

  return jsonb_build_object('ok', true, 'remaining', v_remaining);
end;
$$;

-- Kept for /admin/api-keys: credits "for a key" go to its organization.
create or replace function add_api_credits(p_key_id uuid, p_amount int)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_entity uuid;
begin
  select entity_id into v_entity from api_keys where id = p_key_id;
  if not found then
    raise exception 'API key not found';
  end if;
  return add_entity_credits(v_entity, p_amount);
end;
$$;

create or replace function add_entity_credits(p_entity_id uuid, p_amount int)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_remaining int;
begin
  update entities
     set credits_balance = credits_balance + greatest(coalesce(p_amount, 0), 0)
   where id = p_entity_id
  returning credits_balance into v_remaining;
  if not found then
    raise exception 'Entity not found';
  end if;
  -- Keep the legacy per-key column in step (see the header).
  update api_keys set credits_balance = v_remaining where entity_id = p_entity_id;
  return jsonb_build_object('ok', true, 'remaining', v_remaining);
end;
$$;
revoke all on function add_entity_credits(uuid, int) from public, anon, authenticated;
grant execute on function add_entity_credits(uuid, int) to service_role;

-- ── Purchases credit the organization ──────────────────────────────────────
alter table credit_purchases alter column api_key_id drop not null;
alter table credit_purchases drop constraint if exists credit_purchases_method_check;
alter table credit_purchases add constraint credit_purchases_method_check
  check (method in ('stripe', 'x402', 'voulti'));

create or replace function complete_credit_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row credit_purchases%rowtype;
begin
  update credit_purchases
     set status = 'completed', completed_at = now()
   where id = p_purchase_id and status = 'pending'
  returning * into v_row;

  if not found then
    return jsonb_build_object('ok', true, 'credited', false);
  end if;

  perform add_entity_credits(v_row.entity_id, v_row.credits);
  return jsonb_build_object('ok', true, 'credited', true, 'credits', v_row.credits);
end;
$$;

-- Moving credits between keys no longer means anything.
drop function if exists move_api_credits(uuid, uuid, int);

commit;

-- Expect each organization's balance to equal what its keys held before.
select e.display_name, e.credits_balance from entities e where e.credits_balance > 0 order by 2 desc;
