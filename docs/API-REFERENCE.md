# HashProof API Reference

Base URL: `https://api.hashproof.dev` (or `http://localhost:4022` for local dev)

By default, HashProof uses **x402** (USDC) and there is **no API key**. For enterprise plans, HashProof can provide a **prepaid API key** for `POST /issueCredential`. See [API key (prepaid)](#api-key-prepaid-credits) and [`X402-PAYMENT-FLOW.md`](./X402-PAYMENT-FLOW.md).

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | Service info |
| POST | `/issueCredential` | x402 $0.10 USDC **or** API key (prepaid) | Issue one credential |
| GET | `/verify/:id` | — | Full verification (contract + IPFS + DB) |
| GET | `/verify/:id/contract` | — | Blockchain-only status |
| GET | `/verify/:id/ipfs` | — | IPFS vs DB integrity check |
| GET | `/verify/:id/pdf` | — | Download credential as PDF |
| GET | `/entities/:id` | — | Entity info and verification status |
| POST | `/entities/:id/verificationRequests` | x402 $49 USDC | Submit a verification request |
| POST | `/admin/entities/:id/verify` | `ADMIN_SECRET` header | Approve a pending verification request |
| POST | `/admin/issuer-authorizations` | `ADMIN_SECRET` header | Grant or revoke a platform's right to issue on behalf of an issuer |
| POST | `/admin/api-keys` | `ADMIN_SECRET` header | Create an API key for an entity (prepaid credits) |
| GET | `/admin/api-keys` | `ADMIN_SECRET` header | List API keys and balances |
| PATCH | `/admin/api-keys/:id` | `ADMIN_SECRET` header | Add credits to an API key |

---

## POST /issueCredential

Issues one verifiable credential. Requires **x402 payment** (USDC) **or** a valid **API key** with prepaid credits.

### API key (prepaid credits)

**Enterprise plans:** To issue without x402 or crypto, contact [hi@hashproof.dev](mailto:hi@hashproof.dev) to purchase prepaid credits and receive an API key tied to your entity.

For institutions that don't use crypto, HashProof can issue an **API key** tied to an entity and a **prepaid credit balance**. One credit = one credential; HashProof assumes the cost.

- **Header:** `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`
- The key is bound to a single **entity** (issuer). The request's `issuer` must match that entity (by `issuer.slug` or omit `issuer` and it is filled from the key's entity).
- Each successful issuance deducts **1 credit**. If balance is 0, the API returns `402` with `code: "insufficient_credits"`.
- Admin: create keys and top up credits via `POST /admin/api-keys`, `GET /admin/api-keys`, `PATCH /admin/api-keys/:id` (see [Admin API keys](#admin-api-keys)).

### x402 payment

If no API key is sent, the client must pay **$0.10 USDC** via the x402 protocol (see [`X402-PAYMENT-FLOW.md`](./X402-PAYMENT-FLOW.md)).

### Authorization rules

| Scenario | Condition | Rule |
|----------|-----------|------|
| Self-issuance | `issuer_entity_id == platform_entity_id` (or no platform) | Paying wallet must be in `issuer.authorized_wallets` (only if issuer is verified) |
| Platform issues for issuer | `issuer_entity_id != platform_entity_id`, issuer **unverified** | No wallet restriction |
| Platform issues for issuer | `issuer_entity_id != platform_entity_id`, issuer **verified** | Paying wallet must be in `platform.authorized_wallets` AND an approved `issuer_authorization` row must exist for (issuer, platform) |
| Issuer's own wallet used | Any scenario, issuer verified | Wallet in `issuer.authorized_wallets` always works, no authorization row needed |
| Issuer is `suspended` | Any | Always `403` |

For practical examples with curl, see [`ISSUING-CREDENTIALS.md`](./ISSUING-CREDENTIALS.md).

### Request body

```json
{
  "issuer_entity_id":   "uuid",
  "platform_entity_id": "uuid",
  "issuer":             { ... },
  "platform":           { ... },
  "holder":             { ... },
  "context":            { ... },
  "credential_type":    "completion",
  "title":              "Certificate of Completion",
  "expires_at":         null,
  "values":                    { ... },
  "template_slug":             "hashproof",
  "background_url_override":   "https://..."
}
```

#### background_url_override `string` — optional

When using `template_slug` or `template_id`, you can override the template's background image for this credential only. Layout (size, field positions) comes from the template; the PDF uses this URL as the background. If omitted, the template's `background_url` is used. Not added to the credential JSON or IPFS.

#### issuer_entity_id / platform_entity_id `string (UUID)` — optional

Links the credential to a registered entity in HashProof.

- If the entity is `individual_verified` or `organization_verified`, the paying wallet is validated against the entity's `authorized_wallets`.
- If the entity is `suspended`, the request is rejected with `403`.
- If omitted or the entity is `unverified`, no wallet check is performed.

#### issuer `object` — required

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `display_name` | string | yes | Name of the issuing organization |
| `slug` | string | yes | URL-safe identifier, e.g. `acme-university` |
| `website` | string | no | Website URL |
| `logo_url` | string | no | Logo image URL |

#### platform `object` — required

Same fields as `issuer`. Can be the same entity as the issuer (set both to the same `slug`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `display_name` | string | yes | Name of the platform managing the issuance |
| `slug` | string | yes | URL-safe identifier |
| `website` | string | no | Website URL |
| `logo_url` | string | no | Logo image URL |

#### holder `object` — required

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `full_name` | string | yes | Full name of the credential recipient |
| `external_id` | string | no | ID from your own system |

#### context `object` — required

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | enum | yes | See allowed values below |
| `title` | string | yes | Name of the event, course, program, etc. |
| `description` | string | no | Optional description |
| `external_id` | string | no | ID from your own system |
| `starts_at` | ISO 8601 | no | Start date/time |
| `ends_at` | ISO 8601 | no | End date/time |

**`context.type` allowed values:**

| Value | Use case |
|-------|----------|
| `event` | Conference, summit, workshop |
| `course` | Online or in-person course |
| `diploma` | Academic degree |
| `training` | Training program |
| `certification` | Certification program |
| `membership` | Membership period |
| `other` | Anything else |

#### credential_type `string` — required

| Value | Use case |
|-------|----------|
| `attendance` | Attended an event |
| `completion` | Completed a course or program |
| `achievement` | Academic degree, award |
| `participation` | Participated in a contest or activity |
| `membership` | Member of an organization |
| `certification` | Professional certification |

#### title `string` — required

Title printed on the credential PDF and stored in the credential JSON.

#### expires_at `ISO 8601 | null` — optional

Expiration date/time. `null` means the credential never expires.

#### values `object` — required

Key-value pairs for the template fields. Must include values for all `required: true` fields in the template.

Default template required keys:
- `holder_name` — name rendered on the certificate
- `details` — optional subtitle (e.g. score, program name)

#### template — optional

A **template** is the definition of how to paint the credential data onto the PDF canvas: page size, background, and where each value from `values` is drawn (position, font, style). If omitted, the default `hashproof` template is used.

You can **use an existing template** (by slug or ID) or **create one inline** on first issuance; after that, use the slug to reuse it. Provide **only one** of `template_slug`, `template_id`, or `template` per request (otherwise `400`).

Full guide and examples: [TEMPLATES.md](./TEMPLATES.md).

**Option A — Use an existing template (by slug):**

Send `template_slug` and the usual issuance fields; no `template` object. The layout is already stored.

```json
{
  "issuer":   { "display_name": "Acme Corp", "slug": "acme-corp" },
  "platform": { "display_name": "Acme Corp", "slug": "acme-corp" },
  "holder":   { "full_name": "Jane Doe" },
  "context":  { "type": "event", "title": "Expo 2026" },
  "credential_type": "attendance",
  "title": "Certificate of Attendance",
  "template_slug": "acme-expo-2026-v1",
  "values": { "holder_name": "Jane Doe", "details": "Attended the event booth." }
}
```

**Option B — Use an existing template (by ID):**
```json
{ "template_id": "uuid-of-existing-template" }
```

**Option C — Define inline (creates on first use by slug):**

Dimensions are used as-is (no conversion). Use the **same values as your design canvas** (e.g. pixels from your image editor): `page_width`, `page_height`, and field `x`, `y`, `width`, `height` in the same units so the layout matches. Defaults if omitted: 595×842 (A4 portrait).

```json
{
  "template": {
    "slug": "my-template",
    "name": "My Template",
    "background_url": "https://cdn.example.com/bg.png",
    "page_width": 3508,
    "page_height": 2480,
    "fields_json": [
      {
        "key": "holder_name",
        "x": 500, "y": 1100,
        "width": 2500,
        "required": true,
        "font_size": 180,
        "font_color": "#1a1a2e",
        "align": "center"
      }
    ]
  }
}
```

Inline templates are **create-only**. If a template with the same `slug` already exists, the request is rejected with:

- `Template already exists. Use template_slug or template_id.`

### GET /templates/:ref/requirements

Fetch template field requirements for an agent or integration.

`ref` can be either:
- a template `slug`, or
- a template UUID `id`

```bash
GET /templates/:ref/requirements
```

**Authorization:**
- No auth required (templates are readable by anyone).

For template design (PDF size, background, QR placement), see [`TEMPLATES.md`](./TEMPLATES.md).

**fields_json item properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `key` | string | yes | Must match a key in `values` |
| `x` | number | yes | X position from left (same units as page; use design canvas values 1:1) |
| `y` | number | yes | Y position from top |
| `required` | boolean | no | If true, `values[key]` must be provided. Default: `true` |
| `width` | number | no | Bounding box width (same units as page) |
| `height` | number | no | Bounding box height (same units as page) |
| `font_size` | number | no | Font size in pt. Default: `12` |
| `font_color` | string | no | Hex color. Default: `#000000` |
| `align` | string | no | `left`, `center`, or `right`. Default: `left` |
| `bold` | boolean | no | If `true`, text is rendered in bold. Default: `false` |
| `italic` | boolean | no | If `true`, text is rendered in italic. Default: `false` |
| `underline` | boolean | no | If `true`, text is underlined. Default: `false` |
| `strike` | boolean | no | If `true`, text is struck through. Default: `false` |

### Response `200 OK`

```json
{
  "id": "a1b2c3d4-...",
  "verification_url": "https://hashproof.dev/verify/a1b2c3d4-...",
  "tx_hash": "0xabc...",
  "ipfs_cid": "bafybeig...",
  "ipfs_uri": "https://gateway.pinata.cloud/ipfs/bafybeig..."
}
```

### Errors

| Status | Cause |
|--------|-------|
| 400 | Missing required field or invalid value |
| 402 | Payment required (x402 challenge) |
| 403 | Entity is suspended, or paying wallet is not in `authorized_wallets` |
| 500 | IPFS pin failed, on-chain registration failed, or DB error |

---

## GET /verify/:id

Full 3-layer verification: blockchain → IPFS → database.

### Response `200 OK`

```json
{
  "id": "a1b2c3d4-...",
  "status": "active",
  "status_source": "contract",
  "credential": { ... },
  "verification_report": {
    "contract": { "status": "active", "issuedAt": 1234567890, "revokedAt": 0 },
    "ipfs": { "available": true, "matchesDatabaseJson": true },
    "db": { "found": true }
  },
  "title": "Certificate of Completion",
  "credential_type": "completion",
  "created_at": "2025-06-01T00:00:00Z",
  "expires_at": null,
  "revoked_at": null,
  "tx_hash": "0xabc...",
  "ipfs_uri": "https://gateway.pinata.cloud/ipfs/bafybeig...",
  "issuer_verified": true,
  "issuer_status": "organization_verified",
  "platform_verified": true,
  "platform_status": "organization_verified"
}
```

**`status` allowed values:**

| Value | Meaning |
|-------|---------|
| `active` | Valid, not revoked, not expired |
| `revoked` | Explicitly revoked on-chain |
| `expired` | Past `expires_at` |
| `not_found` | Not registered on-chain |
| `unknown` | Contract unreachable |

**`issuer_status` / `platform_status` allowed values:**

| Value | Meaning |
|-------|---------|
| `unverified` | Entity exists but has not been verified by HashProof |
| `individual_verified` | Verified as an individual (person) |
| `organization_verified` | Verified as an organization |
| `suspended` | Previously verified but suspended by HashProof |

---

## GET /verify/:id/contract

Blockchain-only check. Does not query the database.

### Response `200 OK`

```json
{
  "contract": {
    "status": "active",
    "cid": "bafybeig...",
    "issuedAt": 1234567890,
    "validUntil": 0,
    "revokedAt": 0
  }
}
```

---

## GET /verify/:id/ipfs

Fetches IPFS content and compares its hash with the database record.

### Response `200 OK`

```json
{
  "contract": { "status": "active", "cid": "bafybeig..." },
  "ipfs": {
    "available": true,
    "matchesDatabaseJson": true,
    "json": { ... }
  }
}
```

---

## GET /verify/:id/pdf

Downloads the credential as a PDF.

### Query parameters

| Param | Value | Description |
|-------|-------|-------------|
| `inline` | `1` | Display in browser instead of downloading |

### Response

`Content-Type: application/pdf`

---

## GET /entities/:id

Returns entity info and verification status. `:id` can be a UUID or a slug.

### Response `200 OK`

```json
{
  "id": "uuid",
  "display_name": "Acme University",
  "slug": "acme-university",
  "website": "https://acme.example",
  "logo_url": null,
  "status": "organization_verified",
  "is_verified": true,
  "email_verified": true,
  "last_verified_at": "2025-06-01T00:00:00Z",
  "created_at": "2025-01-01T00:00:00Z"
}
```

**`status` allowed values:**

| Value | Meaning |
|-------|---------|
| `unverified` | Registered but not yet verified |
| `individual_verified` | Verified as an individual (person) |
| `organization_verified` | Verified as an organization |
| `suspended` | Previously verified but suspended by HashProof |

---

## POST /entities/:id/verificationRequests

Submits a verification request for an entity. Requires x402 payment.

### Request body

```json
{
  "type": "organization",
  "form": { ... }
}
```

**`type` allowed values:** `organization`, `individual`

#### form fields for type `organization`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orgName` | string | yes | Organization name |
| `website` | string | yes | Official website |
| `contactName` | string | yes | Full name of the requester |
| `contactEmail` | string | yes | Organizational email (not Gmail/Outlook) |
| `country` | string | yes | Country where the organization operates |
| `role` | string | yes | Requester's role in the organization |
| `supportLink` | string | yes | Link proving the relationship (profile, event page, etc.) |
| `wallets` | string[] | yes | EVM addresses authorized to issue on behalf of this entity |

#### form fields for type `individual`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fullName` | string | yes | Full name as it will appear as issuer |
| `profile` | string | yes | Public profile or website URL |
| `email` | string | yes | Contact email |
| `country` | string | yes | Country where they operate |
| `wallets` | string[] | yes | EVM addresses authorized to issue on behalf of this individual |

### Response `201 Created`

```json
{
  "request": {
    "id": "uuid",
    "entity_id": "uuid",
    "type": "organization",
    "status": "pending",
    "created_at": "2025-06-01T00:00:00Z"
  }
}
```

---

## POST /admin/issuer-authorizations

Grants or revokes a platform's permission to issue credentials on behalf of a verified issuer.

Only relevant when `issuer_entity_id != platform_entity_id` and the issuer is verified. See [`ADMIN-GUIDE.md`](./ADMIN-GUIDE.md) for the full workflow.

### Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <ADMIN_SECRET>` |

### Request body

```json
{
  "issuer_entity_id":   "uuid-of-the-issuer",
  "platform_entity_id": "uuid-of-the-platform",
  "status":             "approved"
}
```

**`status` allowed values:** `pending`, `approved`, `revoked`

### Response `200 OK`

```json
{
  "id": "uuid",
  "issuer_entity_id": "uuid",
  "platform_entity_id": "uuid",
  "status": "approved",
  "created_at": "2025-06-01T00:00:00Z"
}
```

### Errors

| Status | Cause |
|--------|-------|
| 401 | Missing or invalid `Authorization` header |
| 400 | Missing required fields or invalid status value |
| 500 | DB error |

---

## POST /admin/entities/:id/verify

Approves a pending verification request and updates the entity's status. Protected by `ADMIN_SECRET`.

See [`ADMIN-GUIDE.md`](./ADMIN-GUIDE.md) for the full review and approval process.

### Headers

| Header | Value |
|--------|-------|
| `x-admin-secret` | Value of `ADMIN_SECRET` env var |

### Request body

```json
{
  "request_id": "uuid-of-verification-request",
  "status": "individual_verified"
}
```

**`status` allowed values:** `individual_verified`, `organization_verified`

`authorized_wallets` are read automatically from the verification request's form payload (`form.wallets`). No need to pass them manually.

### Response `200 OK`

```json
{ "ok": true }
```

### Errors

| Status | Cause |
|--------|-------|
| 401 | Missing or invalid `x-admin-secret` |
| 400 | Missing `request_id` or `status` |
| 404 | Entity or verification request not found |

---

## Admin API keys

Prepaid credits for institutions (no crypto). **Auth:** `Authorization: Bearer <ADMIN_SECRET>`.

### POST /admin/api-keys — Create key

**Body:** `{ "entity_id": "uuid", "initial_credits": 100, "name": "Acme Corp production" }`

**Response 201:** `{ "id", "entity_id", "name", "credits_balance", "api_key", "message": "Store the api_key securely. It is shown only once." }` — the `api_key` value is the secret and is returned only on create.

### GET /admin/api-keys — List keys

**Response 200:** Array of `{ id, entity_id, entity_slug, entity_display_name, name, credits_balance, created_at, last_used_at }` (no secrets).

### PATCH /admin/api-keys/:id — Add credits

**Body:** `{ "add_credits": 50 }`

**Response 200:** `{ "id", "credits_balance" }`

---

## Error format

All errors return JSON with a single `error` field:

```json
{ "error": "Description of what went wrong" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing or invalid fields |
| 402 | Payment required — x402 challenge, or API key has no credits (`code: "insufficient_credits"`) |
| 403 | Forbidden — entity suspended or wallet not authorized |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Server error |
