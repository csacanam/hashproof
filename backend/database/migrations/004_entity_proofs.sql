-- Entity proofs: domain ownership an outsider can check without us.
--
-- Why this exists
-- ---------------
-- "Verified issuer" is currently a status column in this database. Anyone
-- reading a credential has to take our word for it, and the credential itself
-- carries the issuer as a plain string — nothing stops a different pin from
-- claiming the same display_name.
--
-- A TXT record fixes that without a contract or an intermediary. The issuer
-- publishes a token on a domain only they control; anyone can resolve it with
-- `dig` and reach the same conclusion we do. It also fails on its own: lose the
-- domain or drop the record and the proof stops passing, with nobody to notify.
--
-- The token is derived, not stored, precisely so a third party can recompute it:
--
--     sha256("<entity_id>:<fqdn>")
--
-- It does not need to be secret. Knowing it buys nothing, because publishing it
-- requires controlling the domain — which is the whole claim being made.
--
-- Rows are kept rather than deleted when a proof stops passing: the history of
-- what an issuer once claimed is worth more than a tidy table.

create table if not exists entity_proofs (
  id uuid primary key default gen_random_uuid(),

  entity_id uuid not null references entities(id) on delete cascade,

  -- Only DNS today. LinkedIn and other platforms follow the same shape:
  -- publish a token somewhere only the claimant controls, then check it live.
  platform text not null default 'dns' check (platform in ('dns')),
  method   text not null default 'txt' check (method in ('txt')),

  -- The fully-qualified domain, lowercased, no scheme and no trailing dot.
  resource text not null,

  active boolean not null default true,

  -- Last outcome, for display and for spotting proofs that silently lapsed.
  last_checked_at timestamptz,
  last_result text check (last_result in ('verified', 'missing', 'error')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (entity_id, platform, resource)
);

create index if not exists entity_proofs_entity_id_idx on entity_proofs (entity_id);
create index if not exists entity_proofs_active_idx on entity_proofs (entity_id, active);

create trigger entity_proofs_set_updated_at
before update on entity_proofs
for each row execute function set_updated_at();

-- Backend uses the service role, which bypasses RLS. Reads are public because
-- the point of a proof is that anyone can check it.
alter table entity_proofs enable row level security;

grant all on table entity_proofs to anon;
grant all on table entity_proofs to authenticated;
grant all on table entity_proofs to service_role;

create policy "service_role full access"
  on entity_proofs for all to service_role
  using (true) with check (true);

create policy "anon read"
  on entity_proofs for select to anon
  using (true);
