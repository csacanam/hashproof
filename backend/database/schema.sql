-- =========================================================
-- ENUMS
-- =========================================================

create type entity_status as enum (
  'unverified',
  'individual_verified',
  'organization_verified',
  'suspended'
);

create type context_type as enum (
  'event',
  'course',
  'diploma',
  'training',
  'certification',
  'membership',
  'other'
);

create type credential_type as enum (
  'attendance',
  'completion',
  'achievement',
  'participation',
  'membership',
  'certification'
);

-- =========================================================
-- HELPERS
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- ENTITIES
-- An entity can be issuer or platform.
-- =========================================================

create table entities (
  id uuid primary key default gen_random_uuid(),

  display_name text not null,
  slug text not null,

  website text,
  logo_url text,

  email_verified boolean not null default false,
  authorized_wallets text[] not null default '{}',
  last_verified_at timestamptz,

  status entity_status not null default 'unverified',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index entities_slug_unique_idx
  on entities (slug);

create index entities_status_idx
  on entities (status);

-- Prevents duplicate display names (same protection as slug, enforced at DB)
create unique index entities_display_name_unique_idx
  on entities (lower(trim(display_name)));

-- =========================================================
-- HOLDERS
-- People who receive the credential
-- =========================================================

create table holders (
  id uuid primary key default gen_random_uuid(),

  full_name text not null,

  external_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index holders_external_id_idx
  on holders (external_id);

-- =========================================================
-- CONTEXTS
-- Issuance context: event, course, diploma, etc.
-- =========================================================

create table contexts (
  id uuid primary key default gen_random_uuid(),

  type context_type not null,
  title text not null,
  description text,

  external_id text,

  starts_at timestamptz,
  ends_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contexts_type_idx
  on contexts (type);

create index contexts_external_id_idx
  on contexts (external_id);

-- =========================================================
-- TEMPLATES
-- How the PDF is rendered
-- entity_id null = base template (global); entity_id set = template belongs to that entity (issuer)
-- slug unique per entity; default template has slug 'hashproof'
-- =========================================================

create table templates (
  id uuid primary key default gen_random_uuid(),

  entity_id uuid not null references entities(id),

  name text not null,
  slug text not null,

  background_url text not null,

  page_width integer not null,
  page_height integer not null,

  fields_json jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index templates_entity_slug_unique_idx
  on templates (entity_id, slug);

-- =========================================================
-- CREDENTIALS
-- Main MVP table
-- =========================================================

create table credentials (
  id uuid primary key default gen_random_uuid(),

  issuer_entity_id uuid not null references entities(id),
  platform_entity_id uuid not null references entities(id),

  holder_id uuid not null references holders(id),
  context_id uuid not null references contexts(id),
  template_id uuid not null references templates(id),

  credential_type credential_type not null,

  -- Optional expiration timestamp (policy). Actual status comes from the contract.
  expires_at timestamptz,
  revoked_at timestamptz,

  -- Canonical JSON representing the actual credential
  credential_json jsonb not null,

  -- On-chain data
  chain_name text not null default 'celo',
  chain_id integer not null,
  contract_address text not null,
  tx_hash text not null unique,

  -- IPFS backup (Pinata) – CID for decentralized storage
  ipfs_cid text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint credentials_expires_after_create
    check (expires_at is null or expires_at > created_at)
);

create index credentials_issuer_entity_id_idx
  on credentials (issuer_entity_id);

create index credentials_platform_entity_id_idx
  on credentials (platform_entity_id);

create index credentials_holder_id_idx
  on credentials (holder_id);

create index credentials_context_id_idx
  on credentials (context_id);

create index credentials_template_id_idx
  on credentials (template_id);

create index credentials_chain_name_idx
  on credentials (chain_name);

-- =========================================================
-- ENTITY VERIFICATION REQUESTS
-- Manual verification requests for issuers/platforms
-- =========================================================

create table entity_verification_requests (
  id uuid primary key default gen_random_uuid(),

  entity_id uuid not null references entities(id),

  type text not null check (type in ('organization', 'individual')),

  payload jsonb not null,

  status text not null default 'pending',

  price_usd numeric(10,2),
  currency text not null default 'USDC',
  network text not null default 'celo',

  tx_hash text,
  tx_explorer_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration for existing databases:
-- alter table entity_verification_requests add column if not exists tx_hash text;
-- alter table entity_verification_requests add column if not exists tx_explorer_url text;

-- alter table entities add column if not exists authorized_wallets text[] not null default '{}';

-- Migration: entity_status enum + column cleanup (run in order):
-- alter type entity_status add value if not exists 'unverified';
-- alter type entity_status add value if not exists 'individual_verified';
-- alter type entity_status add value if not exists 'organization_verified';
-- update entities set status = 'unverified' where status = 'active';
-- alter table entities alter column status set default 'unverified';
-- alter table entities drop column if exists domain_verified;
-- alter table entities drop column if exists kyb_verified;
-- NOTE: 'active' and 'blocked' can be removed from the enum once all rows are migrated
--       (Postgres does not support removing enum values directly; requires a type recreation).

-- Migration: remove unused PII columns from holders:
-- alter table holders drop column if exists email;
-- alter table holders drop column if exists phone;
-- drop index if exists holders_email_idx;

create index entity_verification_requests_entity_id_idx
  on entity_verification_requests (entity_id);

create index entity_verification_requests_status_idx
  on entity_verification_requests (status);

-- =========================================================
-- UPDATED_AT trigger
-- =========================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger entities_set_updated_at
before update on entities
for each row execute function set_updated_at();

create trigger holders_set_updated_at
before update on holders
for each row execute function set_updated_at();

create trigger contexts_set_updated_at
before update on contexts
for each row execute function set_updated_at();

create trigger templates_set_updated_at
before update on templates
for each row execute function set_updated_at();

create trigger credentials_set_updated_at
before update on credentials
for each row execute function set_updated_at();

-- =========================================================
-- IMMUTABILITY: credential_json should never change after issuance
-- =========================================================

create or replace function prevent_credential_json_update()
returns trigger as $$
begin
  if new.credential_json is distinct from old.credential_json then
    raise exception 'credential_json is immutable after issuance';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger credentials_prevent_credential_json_update
before update on credentials
for each row execute function prevent_credential_json_update();

-- =========================================================
-- ISSUER AUTHORIZATIONS
-- Allows a verified platform to issue on behalf of a verified issuer.
-- Only enforced when issuer_entity_id != platform_entity_id AND issuer is verified.
-- =========================================================

create table issuer_authorizations (
  id uuid primary key default gen_random_uuid(),

  issuer_entity_id   uuid not null references entities(id) on delete cascade,
  platform_entity_id uuid not null references entities(id) on delete cascade,

  -- pending → approved → revoked
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'revoked')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (issuer_entity_id, platform_entity_id)
);

create index issuer_authorizations_issuer_idx
  on issuer_authorizations (issuer_entity_id);

create index issuer_authorizations_platform_idx
  on issuer_authorizations (platform_entity_id);

create trigger issuer_authorizations_set_updated_at
before update on issuer_authorizations
for each row execute function set_updated_at();

-- Migration (run on existing DB):
-- create table issuer_authorizations (
--   id uuid primary key default gen_random_uuid(),
--   issuer_entity_id   uuid not null references entities(id) on delete cascade,
--   platform_entity_id uuid not null references entities(id) on delete cascade,
--   status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now(),
--   unique (issuer_entity_id, platform_entity_id)
-- );
-- create index issuer_authorizations_issuer_idx on issuer_authorizations (issuer_entity_id);
-- create index issuer_authorizations_platform_idx on issuer_authorizations (platform_entity_id);

-- =========================================================
-- GRANTS
-- =========================================================

-- issuer_authorizations: service_role writes, anon reads
grant all on table issuer_authorizations to anon;
grant all on table issuer_authorizations to authenticated;
grant all on table issuer_authorizations to service_role;

alter table issuer_authorizations enable row level security;

create policy "service_role full access"
  on issuer_authorizations for all to service_role
  using (true) with check (true);

create policy "anon read"
  on issuer_authorizations for select to anon
  using (true);

-- entity_verification_requests: backend inserts via service role / anon key
grant all on table entity_verification_requests to anon;
grant all on table entity_verification_requests to authenticated;
grant all on table entity_verification_requests to service_role;

-- RLS policies for entity_verification_requests
alter table entity_verification_requests enable row level security;

create policy "service_role full access"
  on entity_verification_requests
  for all
  to service_role
  using (true)
  with check (true);

create policy "anon insert"
  on entity_verification_requests
  for insert
  to anon
  with check (true);
