-- The holder's email, kept apart from the credential.
--
-- credential_json is hashed and pinned to IPFS, so anything in it is public and
-- permanent. An email must never go there. It lives here instead, one row per
-- credential, readable only by the backend (service_role): it is how a holder
-- will later sign in and find their credentials, and how a credential can be
-- sent to them. Deleting a row is how a holder's contact data is erased; the
-- credential itself is unaffected.

create table if not exists credential_holder_contacts (
  credential_id uuid primary key references credentials(id) on delete cascade,
  email text not null check (email = lower(email)),
  created_at timestamptz not null default now()
);

create index if not exists credential_holder_contacts_email_idx
  on credential_holder_contacts (email);

alter table credential_holder_contacts enable row level security;
revoke all on table credential_holder_contacts from anon, authenticated;
grant select, insert, delete on table credential_holder_contacts to service_role;
