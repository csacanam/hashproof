-- API keys for prepaid credits (institutions, no crypto).
-- Run this if your DB was created before api_keys was added to schema.sql.

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id),
  key_hash text not null,
  name text,
  credits_balance int not null default 0 check (credits_balance >= 0),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists api_keys_key_hash_idx on api_keys (key_hash);
create index if not exists api_keys_entity_id_idx on api_keys (entity_id);
