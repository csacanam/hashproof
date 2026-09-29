# HashProof — Admin Guide

This document describes the operator workflows for reviewing and approving entity verification requests.

---

## Overview

When an entity submits a verification request through the HashProof UI, the flow is:

1. Entity fills the form (individual or organization) and pays $49 USDC via x402.
2. A row is inserted in `entity_verification_requests` with `status = 'pending'`.
3. **You review the request manually** (see below).
4. If approved, you call the admin endpoint — this sets the entity's status and authorized wallets.
5. The entity can now issue credentials using one of its authorized wallets.

---

## Setup

Add `ADMIN_SECRET` to your backend `.env`:

```
ADMIN_SECRET=your-long-random-secret
```

Keep this secret private. It is the only protection for all admin endpoints.

---

## Reviewing pending requests

Open your [Supabase dashboard](https://supabase.com/dashboard) → Table Editor → `entity_verification_requests`.

Filter by `status = 'pending'`. Each row contains:

| Column | Description |
|--------|-------------|
| `id` | Request UUID — needed for approval |
| `entity_id` | The entity this request is for |
| `type` | `individual` or `organization` |
| `payload` | Full form data submitted by the requester |
| `tx_hash` | On-chain transaction hash for the payment |
| `tx_explorer_url` | Direct link to the transaction in the block explorer |
| `created_at` | When the request was submitted |

Open `payload.form` to see the submitted details (name, website, contact email, wallets, supporting link, etc.).

---

## Review criteria

### Organization

| Field | What to check |
|-------|--------------|
| `website` | Must be a real, publicly accessible website that matches the organization name. |
| `contactEmail` | Must use the organization's own domain (e.g. `@icesi.edu.co`). Reject any generic provider (Gmail, Outlook, Yahoo, etc.). The UI warns the user if the email domain does not match the website domain, but you should confirm it too. |
| `supportLink` | This is your strongest evidence. It must show that `contactName` is associated with the organization. Accept: a profile page on the official website, a LinkedIn profile listing the org as current employer, an event or staff page where the person is listed. Reject if the link is broken, private, or unrelated. |
| `role` | Should be specific and credible (e.g. "Academic Registrar", "CTO", "Director of Partnerships"). Reject vague roles like "Employee" unless the supporting link makes the relationship clear. |
| `wallets` | These are the wallets that will be authorized to issue credentials. Confirm the requester understands that only these wallets will be able to issue. You do not need to verify wallet ownership. |

**Reject if:** email is from a generic provider, website does not exist or does not match the org name, supporting link is broken or does not mention the contact person, or fields are clearly copy-pasted and inconsistent.

### Individual

| Field | What to check |
|-------|--------------|
| `profile` | Must be a publicly accessible URL that confirms the person's identity (LinkedIn, GitHub, personal website, academic profile). Reject if the profile is private, does not exist, or the name does not match `fullName`. |
| `fullName` | Must match the name shown on the profile URL. |
| `email` | Generic providers (Gmail, etc.) are acceptable for individuals. Used for follow-up only. |
| `wallets` | Same as organizations — these will be the only wallets authorized to issue credentials as this individual. |

**Reject if:** the profile URL does not exist or is private, the name on the profile does not match the submitted name, or the profile is clearly unrelated to credentialing (e.g. a gaming profile with no professional context).

---

## Approving a request

Call the admin endpoint with the entity ID, verification type, and the request ID. The wallets are read automatically from the verification request payload — no need to copy them manually:

```bash
curl -X POST https://your-api-url/admin/entities/{entity_id}/verify \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "organization",
    "request_id": "uuid-of-the-request"
  }'
```

**Body parameters:**

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `"organization"` or `"individual"` |
| `request_id` | Yes* | UUID of the verification request. Wallets are read from its payload automatically and the request is marked as `approved`. |
| `wallets` | Yes* | Only needed if you want to override the wallets from the request. Array of EVM addresses. |

\* Either `request_id` or `wallets` must be provided (or both).

**What this does:**

- Sets `entities.status` to `individual_verified` or `organization_verified`
- Sets `entities.authorized_wallets` to the provided wallet addresses (lowercased)
- Sets `entities.email_verified = true`
- Sets `entities.last_verified_at` to now
- If `request_id` is provided, sets `entity_verification_requests.status = 'approved'`

**Example response:**

```json
{
  "entityId": "b1e2c3d4-...",
  "status": "organization_verified",
  "authorized_wallets": ["0xabc123..."]
}
```

---

## Rejecting a request

There is no dedicated rejection endpoint for MVP. To reject a request, update the row directly in Supabase:

```sql
update entity_verification_requests
set status = 'rejected', updated_at = now()
where id = 'uuid-of-the-request';
```

---

## Suspending an entity

To suspend an entity (e.g. due to abuse), update its status directly in Supabase:

```sql
update entities
set status = 'suspended', authorized_wallets = '{}', updated_at = now()
where id = 'uuid-of-the-entity';
```

Clearing `authorized_wallets` immediately prevents any further credential issuance from that entity.

---

## API keys (prepaid credits)

For institutions that don't use crypto, you can create **API keys** tied to an entity. Credits belong to the **entity**: all its keys and its dashboard spend from one balance, and each key only records how many it has used. They call `POST /issueCredential` with `Authorization: Bearer <api_key>` (or `X-API-Key`); each successful issuance deducts 1 credit from the entity. You assume the cost (USDC) on your side.

Organizations can also create keys and buy credits themselves in the dashboard (see below); these admin endpoints remain for setting one up by hand.

**Prerequisites:** The entity must exist in `entities`. Get its UUID from Supabase (Table Editor → `entities`).

### Create an API key

```bash
curl -X POST https://your-api-url/admin/api-keys \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "uuid-of-the-entity",
    "initial_credits": 100,
    "name": "Acme Corp production"
  }'
```

Response includes **`api_key`** — the secret. **Show it only once** to the institution; it cannot be retrieved again. They store it and send it as `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`.

### List API keys and balances

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" https://your-api-url/admin/api-keys
```

Returns id, entity_slug, entity_display_name, name, credits_balance (the entity's balance, the same on every key of it), credits_used, last_used_at (no secrets).

### Top up credits

Adds to the key's **entity** — every key of it sees the new balance.

```bash
curl -X PATCH https://your-api-url/admin/api-keys/{key_id} \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "add_credits": 50 }'
```

---

## Dashboard (/app)

Organizations sign in at `https://hashproof.dev/app`, create their organization (an `unverified` entity with them as owner), issue from the browser, and manage API keys and credits under Developers. The public API is unchanged; the dashboard uses its own routes under `/app` with a Supabase Auth session.

### One-time setup

1. **Migrations**, in order, in the Supabase SQL editor: `006_credential_revocation.sql`, `007_credential_holder_contacts.sql`, `008_accounts.sql`, `009_organization_balance.sql`. 009 moves balances from keys to their entity; apply it **before** deploying the backend that reads the entity balance.
2. **Supabase Auth** (Authentication → URL Configuration): Site URL `https://hashproof.dev`, and add `https://hashproof.dev/app/auth` to Redirect URLs.
3. **Email sending**: Supabase's built-in mailer allows only a few emails per hour — set up custom SMTP (Authentication → Emails → SMTP) before opening sign-ups. Optionally add `{{ .Token }}` to the Magic Link template so people can type a code instead of clicking the link.
4. **Stripe** (card purchases at $0.25/credit, minimum 25): set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the backend, and create a webhook endpoint `https://api.hashproof.dev/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Until both variables are set, the dashboard shows card payments as unavailable. The Stripe account can be shared with other products: every HashProof checkout carries `metadata.product = "hashproof"` (on the session and its payment intent), and the webhook ignores events without it — other products' webhooks should likewise filter on their own tag.
5. **Voulti** (crypto purchases at $0.22/credit, about 10% off the card price, minimum 10): set `VOULTI_COMMERCE_ID` (HashProof's commerce in Voulti) and `VOULTI_WEBHOOK_SECRET` (Receive Payments → Developers in Voulti), and point that commerce's confirmation URL to `https://api.hashproof.dev/voulti/webhook`. The webhook only names the invoice; the backend re-reads it from Voulti and checks the amount before crediting. Without `VOULTI_COMMERCE_ID` the dashboard shows crypto payments as unavailable.
6. `FRONTEND_URL=https://hashproof.dev` on the backend (Stripe return URLs and invitation links).

### Giving an existing entity dashboard access

Entities created before accounts existed have no members. Add one (they get an invitation email if they have no account yet):

```bash
curl -X POST https://your-api-url/admin/entities/{entity_id}/members \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "email": "owner@organization.com", "role": "owner" }'
```

This also creates the key the dashboard issues with (internal, its secret is never shown). The entity's existing API keys appear under Developers, and the dashboard spends from the same entity balance they do.

### What gets notified

Telegram receives each new organization and each credit purchase, so new sign-ups can be reviewed — names are self-asserted until verification.

---

## How wallet authorization works on issuance

When `POST /issueCredential` is called, the backend applies the following rules in order:

1. **Suspended issuer** → always `403`, no further checks.
2. **Unverified issuer** → no wallet check, any caller can issue.
3. **Verified issuer + self-issuance** (`issuer_entity_id == platform_entity_id`): paying wallet must be in `issuer.authorized_wallets`.
4. **Verified issuer + separate platform**: the paying wallet must come from either the platform's or the issuer's `authorized_wallets`, AND an approved `issuer_authorization` row must exist for that (issuer, platform) pair. The issuer's own wallets always work without needing an authorization row.

---

## Authorizing a platform to issue on behalf of an issuer

Use this when a platform (e.g. Peewah) issues credentials on behalf of a verified issuer (e.g. Acme University).

**Step 1 — The platform and the issuer should both be verified** (or at minimum the issuer must be verified for the check to apply).

**Step 2 — Create the authorization:**

```bash
curl -X POST https://your-api-url/admin/issuer-authorizations \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "issuer_entity_id":   "uuid-of-the-issuer",
    "platform_entity_id": "uuid-of-the-platform",
    "status": "approved"
  }'
```

**Step 3 — To revoke the authorization:**

```bash
curl -X POST https://your-api-url/admin/issuer-authorizations \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "issuer_entity_id":   "uuid-of-the-issuer",
    "platform_entity_id": "uuid-of-the-platform",
    "status": "revoked"
  }'
```

Revoking immediately prevents that platform from issuing new credentials for the issuer. Existing credentials are not affected.

**Alternatively, manage directly in Supabase:**

```sql
-- Approve
insert into issuer_authorizations (issuer_entity_id, platform_entity_id, status)
values ('issuer-uuid', 'platform-uuid', 'approved')
on conflict (issuer_entity_id, platform_entity_id) do update set status = 'approved', updated_at = now();

-- Revoke
update issuer_authorizations
set status = 'revoked', updated_at = now()
where issuer_entity_id = 'issuer-uuid' and platform_entity_id = 'platform-uuid';
```
