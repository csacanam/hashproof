-- Sets the website on record for the two entities we control, and grants the
-- writes that `entities` was missing.
--
-- Why the website matters now
-- ---------------------------
-- A domain proof only says "whoever controls this domain published a token tied
-- to this entity". Left open, anyone could hang a domain *they* control off
-- someone else's issuer page, where it would read as that issuer's own.
--
-- So the open, no-credentials path is narrowed to confirming the domain the
-- entity already asserts — which is this column. Proving any other domain
-- requires that entity's own API key.
--
-- Why the grants
-- --------------
-- schema.sql grants issuer_authorizations and entity_verification_requests to
-- the API roles but never did the same for entities, so SELECT works and UPDATE
-- is denied. Anything that writes to the table hits this — including
-- approveEntity, behind POST /admin/entities/:id/verify.

grant select, insert, update on table entities to service_role;
grant select on table entities to anon;
grant select on table entities to authenticated;

update entities set website = 'https://peewah.co',    updated_at = now()
 where id = '4acaf733-ea85-40c6-9d4b-63522bd8b207' and (website is null or website = '');

update entities set website = 'https://hashproof.dev', updated_at = now()
 where id = '4f94ea78-c629-431e-93e5-5a798fa0f2e3' and (website is null or website = '');

-- Expect two rows with the websites set.
select id, display_name, website from entities
 where id in ('4acaf733-ea85-40c6-9d4b-63522bd8b207', '4f94ea78-c629-431e-93e5-5a798fa0f2e3');
