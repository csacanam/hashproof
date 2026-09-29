-- Whether the email carrying a credential reached its holder.
--
-- Additive: new nullable columns on the private contacts table. The status is
-- set when HashProof hands the email to SendGrid, then moved forward by
-- SendGrid's signed Event Webhook (delivered, bounced, dropped, deferred, spam).

alter table credential_holder_contacts
  add column if not exists notify_status text,
  add column if not exists notify_message_id text,
  add column if not exists notified_at timestamptz,
  add column if not exists notify_updated_at timestamptz,
  add column if not exists notify_detail text;

alter table credential_holder_contacts drop constraint if exists credential_holder_contacts_notify_status_check;
alter table credential_holder_contacts add constraint credential_holder_contacts_notify_status_check
  check (notify_status in ('sent', 'deferred', 'delivered', 'bounced', 'dropped', 'spam', 'failed'));

-- Resending may correct the address, and statuses move over time.
grant update on table credential_holder_contacts to service_role;
