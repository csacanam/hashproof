-- Accounts: people sign in (Supabase Auth, email link) and act for the
-- organizations they belong to.
--
-- Everything here is additive. The API keeps authenticating keys exactly as
-- before; a key's balance is still the key's own. What changes is who can
-- create keys and top them up: an organization's members, from the dashboard,
-- instead of only us through /admin.

-- ── Membership ──────────────────────────────────────────────────────────────
create table if not exists entity_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_id uuid not null references entities(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'issuer')),
  created_at timestamptz not null default now(),
  primary key (user_id, entity_id)
);
create index if not exists entity_members_entity_id_idx on entity_members (entity_id);

alter table entity_members enable row level security;
revoke all on table entity_members from anon, authenticated;
grant select, insert, update, delete on table entity_members to service_role;

-- ── API keys: kind, soft revocation, who created it ─────────────────────────
-- 'panel' is the key the dashboard issues with. Its secret is never shown to
-- anyone: the dashboard spends from it server-side, so an organization that
-- never touches the API still has a balance.
--
-- A revoked key keeps its row (jobs and purchases point at it) but its hash is
-- replaced, so the old secret stops matching. That is why revoking needs no
-- change to how keys are looked up.
alter table api_keys add column if not exists kind text not null default 'api';
alter table api_keys drop constraint if exists api_keys_kind_check;
alter table api_keys add constraint api_keys_kind_check check (kind in ('api', 'panel'));
alter table api_keys add column if not exists revoked_at timestamptz;
alter table api_keys add column if not exists created_by uuid references auth.users(id) on delete set null;

create unique index if not exists api_keys_one_panel_per_entity
  on api_keys (entity_id) where kind = 'panel';

-- ── Credit purchases ────────────────────────────────────────────────────────
-- One row per paid top-up. external_ref is the Stripe Checkout session id or
-- the x402 settlement tx hash; unique, so a webhook delivered twice or a
-- replayed payment credits once.
create table if not exists credit_purchases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id),
  api_key_id uuid not null references api_keys(id),
  user_id uuid references auth.users(id) on delete set null,
  method text not null check (method in ('stripe', 'x402')),
  credits int not null check (credits > 0),
  amount_usd_cents int not null check (amount_usd_cents >= 0),
  external_ref text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists credit_purchases_external_ref_idx on credit_purchases (method, external_ref);
create index if not exists credit_purchases_entity_id_idx on credit_purchases (entity_id, created_at desc);

alter table credit_purchases enable row level security;
revoke all on table credit_purchases from anon, authenticated;
grant select, insert, update on table credit_purchases to service_role;

-- Credits a purchase exactly once: flips pending → completed and adds the
-- credits in the same transaction. A second call for the same purchase finds
-- it completed and adds nothing.
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

  update api_keys set credits_balance = credits_balance + v_row.credits
   where id = v_row.api_key_id;

  return jsonb_build_object('ok', true, 'credited', true, 'credits', v_row.credits);
end;
$$;
revoke all on function complete_credit_purchase(uuid) from public, anon, authenticated;
grant execute on function complete_credit_purchase(uuid) to service_role;

-- Move credits between two keys in one transaction. The source row is locked
-- and checked first, so a concurrent issuance spending the same credits cannot
-- make the balance negative or create credits out of nothing.
create or replace function move_api_credits(p_from uuid, p_to uuid, p_amount int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from int;
  v_to int;
begin
  if p_amount is null or p_amount < 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  update api_keys set credits_balance = credits_balance - p_amount
   where id = p_from and credits_balance >= p_amount
  returning credits_balance into v_from;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_credits');
  end if;

  update api_keys set credits_balance = credits_balance + p_amount
   where id = p_to
  returning credits_balance into v_to;

  if not found then
    raise exception 'destination key not found';
  end if;

  return jsonb_build_object('ok', true, 'from_balance', v_from, 'to_balance', v_to);
end;
$$;
revoke all on function move_api_credits(uuid, uuid, int) from public, anon, authenticated;
grant execute on function move_api_credits(uuid, uuid, int) to service_role;

-- ── Grants the dashboard needs on existing tables ───────────────────────────
grant select, insert, update on table api_keys to service_role;
grant select, insert, update on table templates to service_role;
grant select on table contexts to service_role;

-- ── Background images uploaded from the dashboard ───────────────────────────
-- Public: the renderer fetches the background by URL at issuance, like any
-- other background_url.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backgrounds', 'backgrounds', true, 8388608, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;
