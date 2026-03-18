# Issuing Credentials

**Endpoint:** `POST /issueCredential` — paid, $0.10 USDC via x402 (or API key for enterprise plans).

**Enterprise plans (no crypto):** Contact [hi@hashproof.dev](mailto:hi@hashproof.dev) to purchase prepaid credits and receive an API key tied to your entity.

This doc is intentionally short. For the full field spec and allowed values, see [API-REFERENCE.md](./API-REFERENCE.md). For **template use cases** (default, existing template by slug/id, inline template, same layout with different background), see [TEMPLATES.md](./TEMPLATES.md).

---

## Quick curl test (local dev)

Set `SKIP_PAYMENT=true` in `backend/.env` and restart the server to bypass x402 during development.

```bash
curl -s -X POST http://localhost:4022/issueCredential \
  -H "Content-Type: application/json" \
  -d '{
    "issuer":   { "display_name": "Acme University", "slug": "acme-university" },
    "platform": { "display_name": "Acme University", "slug": "acme-university" },
    "holder":   { "full_name": "Jane Doe" },
    "context":  { "type": "event", "title": "Blockchain Summit 2026" },
    "credential_type": "attendance",
    "title": "Certificate of Attendance — Blockchain Summit 2026",
    "values": { "holder_name": "Jane Doe" }
  }' | jq .
```

> Remove `SKIP_PAYMENT=true` before deploying to production.

---

## Issue with API key (no crypto)

If you have a prepaid API key from HashProof, use it as a Bearer token. No wallet, no x402, no crypto setup needed.

```bash
curl -s -X POST https://api.hashproof.dev/issueCredential \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "issuer":   { "display_name": "Acme University", "slug": "acme-university" },
    "platform": { "display_name": "Acme University", "slug": "acme-university" },
    "holder":   { "full_name": "Jane Doe" },
    "context":  { "type": "event", "title": "Blockchain Summit 2026" },
    "credential_type": "attendance",
    "title": "Certificate of Attendance — Blockchain Summit 2026",
    "values": { "holder_name": "Jane Doe" }
  }' | jq .
```

Each successful issuance deducts 1 credit from your balance. Contact [hi@hashproof.dev](mailto:hi@hashproof.dev) to purchase credits.

---

## Verified entity issuance

If the issuer is a verified entity (`individual_verified` or `organization_verified`), include `issuer_entity_id` in the request. The paying wallet must be in that entity's `authorized_wallets` list — otherwise the request is rejected with `403`.

```bash
# Build X-PAYMENT header: base64 of {"payload":{"authorization":{"from":"0xYOUR_WALLET"}}}
PAYMENT_HEADER=$(echo -n '{"payload":{"authorization":{"from":"0xyour_wallet_lowercase"}}}' | base64)

curl -s -X POST http://localhost:4022/issueCredential \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: $PAYMENT_HEADER" \
  -d '{
    "issuer_entity_id":   "uuid-of-verified-entity",
    "platform_entity_id": "uuid-of-verified-entity",
    "issuer":   { "display_name": "Acme University", "slug": "acme-university" },
    "platform": { "display_name": "Acme University", "slug": "acme-university" },
    "holder":   { "full_name": "Jane Doe" },
    "context":  { "type": "event", "title": "Blockchain Summit 2026" },
    "credential_type": "attendance",
    "title": "Certificate of Attendance — Blockchain Summit 2026",
    "values": { "holder_name": "Jane Doe" }
  }' | jq .
```

Note: In production with x402 enabled, the `X-PAYMENT` header is set automatically by the thirdweb client after payment. The wallet check uses the `from` address in that header.

---

## Minimum required fields

Every issuance request must include:

| Field | Description |
|-------|-------------|
| `issuer.display_name` + `issuer.slug` | Who issues the credential |
| `platform.display_name` + `platform.slug` | Platform managing the issuance (can be the same as issuer) |
| `holder.full_name` | Person receiving the credential |
| `context.type` + `context.title` | What the credential is about |
| `credential_type` | Kind of claim |
| `title` | Title printed on the credential |
| `values.holder_name` | Value for the name field in the default template |

**Template options:** You can omit template fields (default layout), use `template_slug` or `template_id` (existing template), send `template` inline (create once, then reuse by slug), or use `template_slug`/`template_id` with `background_url_override` for the same layout with a different background per credential. One option per request. See [TEMPLATES.md](./TEMPLATES.md) for each case.

---

## Fixed layout, variable background

When you use the same template layout for many credentials but want a different background image per event or batch, use `background_url_override` with `template_slug` or `template_id`. One template defines the layout; each issuance can set its own background URL.

```bash
curl -s -X POST http://localhost:4022/issueCredential \
  -H "Content-Type: application/json" \
  -d '{
    "issuer":   { "display_name": "My Org", "slug": "my-org" },
    "platform": { "display_name": "My Org", "slug": "my-org" },
    "holder":   { "full_name": "Jane Doe" },
    "context":  { "type": "event", "title": "Summit 2026" },
    "credential_type": "attendance",
    "title": "Certificate of Attendance",
    "template_slug": "event-layout-generic",
    "background_url_override": "https://cdn.example.com/events/summit-2026-bg.png",
    "values": { "holder_name": "Jane Doe" }
  }' | jq .
```

---

## What to read next

- Need every field, allowed values, and errors: [`API-REFERENCE.md`](./API-REFERENCE.md)
- Need template rules (public/private, QR placement, required keys): [`TEMPLATES.md`](./TEMPLATES.md)
