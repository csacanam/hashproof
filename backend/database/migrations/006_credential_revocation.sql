-- Revocation through the API (POST /credentials/:id/revoke).
--
-- revoked_at already existed and is what verification reads; these record how
-- it got there. The tx hash lets anyone check the revocation on-chain without
-- trusting our database, and the reason is what the issuer sees later when
-- someone asks why a certificate stopped verifying.

alter table credentials add column if not exists revocation_tx_hash text;
alter table credentials add column if not exists revocation_reason text;

-- Revocation claims the row before touching the chain (so two simultaneous
-- revokes cannot both send a tx) and gives it back if the tx fails.
grant select, update on table credentials to service_role;
