# HashProof API Reference

Base URL: `https://api.hashproof.dev` (or `http://localhost:4022` for local dev)

Paid endpoints require an x402 payment header. See [`X402-PAYMENT-FLOW.md`](./X402-PAYMENT-FLOW.md) for how payments work.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | Service info |
| POST | `/issueCredential` | x402 $0.10 USDC | Issue one credential |
| GET | `/verify/:id` | — | Full verification (contract + IPFS + DB) |
| GET | `/verify/:id/contract` | — | Blockchain-only status |
| GET | `/verify/:id/ipfs` | — | IPFS vs DB integrity check |
| GET | `/verify/:id/pdf` | — | Download credential as PDF |
| GET | `/entities/:id` | — | Entity info and verification status |
| POST | `/entities/:id/verificationRequests` | x402 $0.10 USDC | Submit a verification request |
| POST | `/admin/entities/:id/verify` | `ADMIN_SECRET` header | Approve a pending verification request |

---

## POST /issueCredential

Issues one verifiable credential. Requires x402 payment.

If `issuer_entity_id` belongs to a **verified entity** (`individual_verified` or `organization_verified`), the wallet that paid must be in that entity's `authorized_wallets` list. If the entity is `suspended`, issuance is blocked entirely.

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
  "values":             { ... },
  "template_slug":      "hashproof"
}
```

#### issuer_entity_id / platform_entity_id `string (UUID)` — optional

Links the credential to a registered entity in HashProof.

- If the entity is `individual_verified` or `organization_verified`, the paying wallet is validated against the entity's `authorized_wallets`.
- If the entity is `suspended`, the request is rejected with `403`.
- If omitted or the entity is `unverified`, no wallet check is performed.

#### issuer `object` — required

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `display_name` | string | yes | Name of the issuing organization |
| `slug` | string | yes | URL-safe identifier, e.g. `universidad-icesi` |
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
| `email` | string | no | Email (used for delivery) |
| `phone` | string | no | Phone in E.164 format, e.g. `+573001234567` (for WhatsApp delivery) |
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

Selects or creates the template to use. If omitted, uses the default `hashproof` template.

**Option A — Use template by slug (existing template):**
```json
{ "template_slug": "my-template-slug" }
```

**Option B — Use template by ID:**
```json
{ "template_id": "uuid-of-existing-template" }
```

**Option C — Define inline (creates or updates on first use by slug):**
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

**fields_json item properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `key` | string | yes | Must match a key in `values` |
| `x` | number | yes | X position in pixels from left |
| `y` | number | yes | Y position in pixels from top |
| `required` | boolean | no | If true, `values[key]` must be provided. Default: `true` |
| `width` | number | no | Bounding box width in pixels |
| `height` | number | no | Bounding box height in pixels |
| `font_size` | number | no | Font size in pt. Default: `12` |
| `font_color` | string | no | Hex color. Default: `#000000` |
| `align` | string | no | `left`, `center`, or `right`. Default: `left` |

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
  "display_name": "Universidad Icesi",
  "slug": "universidad-icesi",
  "website": "https://icesi.edu.co",
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

## Error format

All errors return JSON with a single `error` field:

```json
{ "error": "Description of what went wrong" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing or invalid fields |
| 402 | Payment required — x402 challenge in `PAYMENT-REQUIRED` header |
| 403 | Forbidden — entity suspended or wallet not authorized |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Server error |
