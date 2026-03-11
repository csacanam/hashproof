# HashProof — Database

Schema overview: tables, relationships, and fields.

**VC compatibility:** See [project README](/README.md) for Verifiable Credentials Data Model v2.0 — relevant for backend, contracts, and frontend.

## Reading order and dependencies

```
entities ────┐
holders  ────┤
contexts ────┼──► credentials
templates ───┘
```

Base tables (entities, holders, contexts, templates) don't depend on each other. **credentials** ties them all together.

---

## 1. entities

Organizations that issue credentials or platforms that manage issuances.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | PK |
| display_name | text | Display name (e.g. "Universidad Icesi"). Unique at DB level (like slug). |
| slug | text | URL-safe identifier (e.g. "universidad-icesi"). Unique. |
| website | text | Website (optional) |
| logo_url | text | Logo URL (optional) |
| email_verified | boolean | Whether the entity's email has been verified |
| last_verified_at | timestamptz | When last verified |
| status | enum | `unverified`, `individual_verified`, `organization_verified`, `suspended` |
| created_at, updated_at | timestamptz | Audit timestamps |

**Status values:** `unverified` (default) → entity has not been reviewed yet. `individual_verified` / `organization_verified` → verification request was approved. `suspended` → entity has been suspended; credentials issued by it are flagged as invalid.

**Relations:** credentials → issuer_entity_id, platform_entity_id

**Note:** The same entity can act as both issuer and platform (e.g. Universidad Icesi with their own platform). Set `issuer_entity_id` and `platform_entity_id` to the same entity ID. Both are required.

---

## Permissions (Supabase)

If you see `permission denied for table X` when the backend calls the API, grant SELECT to the roles that Supabase uses. Run in **Supabase → SQL Editor**:

```sql
-- Schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- All tables (recommended to avoid recurring errors)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- Or grant per table if you prefer:
-- GRANT SELECT ON public.credentials TO anon, authenticated, service_role;
-- GRANT SELECT ON public.contexts TO anon, authenticated, service_role;
-- GRANT SELECT ON public.entities TO anon, authenticated, service_role;
-- GRANT SELECT ON public.holders TO anon, authenticated, service_role;
-- GRANT SELECT ON public.templates TO anon, authenticated, service_role;
```

The backend uses the **service_role** key for API calls; ensure these roles have SELECT on the tables they access.

---

## 2. holders

People who receive the credentials.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | PK |
| full_name | text | Full name |
| external_id | text | ID from client system (optional) |
| created_at, updated_at | timestamptz | Audit timestamps |

**Relations:** credentials → holder_id

---

## 3. contexts

Credential context: event, course, diploma, etc.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | PK |
| type | enum | `event`, `course`, `diploma`, `training`, `certification`, `membership`, `other` |
| title | text | Title (e.g. "Blockchain for Developers") |
| description | text | Description (optional) |
| external_id | text | ID from client system (optional) |
| starts_at, ends_at | timestamptz | Start/end (optional) |
| created_at, updated_at | timestamptz | Audit timestamps |

**Relations:** credentials → context_id

---

## 4. templates

How the PDF is rendered: background, size, field positions.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | PK |
| entity_id | uuid | Owner entity (template author) |
| name | text | Template name |
| slug | text | Unique identifier (globally unique) |
| visibility | text | `private` (issuer-only) or `public` (any issuer can use) |
| background_url | text | Background image URL |
| page_width, page_height | integer | PDF dimensions (px) |
| fields_json | jsonb | Array of field definitions (see below) |
| created_at, updated_at | timestamptz | Audit timestamps |

**Inline templates:** Issuance supports creating a template inline (create-only). If a template with the same `slug` already exists, issuance rejects it and the caller must reference the existing template via `template_slug` or `template_id`.

**Template design note:** The renderer always draws a verification QR near the bottom-right corner. See [`docs/TEMPLATES.md`](../../docs/TEMPLATES.md) for the exact placement logic and design guidance.

**fields_json** — Array of objects. Each object defines where and how to render a **text field**. The template creator defines the keys; at credential creation the issuer must provide values for required keys. Keys are flexible (e.g. holder_name, holder_document_type, holder_document_number, event_name, date). **QR:** The verification QR is placed in a fixed position on every credential (not defined in the template).

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| key | string | yes | Key to look up in credential_json. |
| x | number | yes | X position (px from left) |
| y | number | yes | Y position (px from top) |
| required | boolean | no | If true, issuer must provide this key at credential creation. Default: true for text. |
| width | number | no | Bounding box width |
| height | number | no | Bounding box height |
| font_size | number | no | Font size in pt. Default: 12 |
| font_color | string | no | Hex color for text (e.g. `#000000`). Default: black |
| align | string | no | `left`, `center`, `right` |

**Flow:** Template defines which keys render where (position, font, color). The credential assigns values to those keys at issuance (via `values` payload or defaults). The PDF renderer renders subject[key] at (x, y). QR is always rendered in a fixed position.

**Example:**
```json
[
  { "key": "holder_name", "x": 100, "y": 200, "required": true, "font_size": 24, "font_color": "#000000", "align": "center" },
  { "key": "details", "x": 100, "y": 280, "required": false, "font_size": 18 },
  { "key": "holder_document_type", "x": 100, "y": 320, "required": false },
  { "key": "holder_document_number", "x": 100, "y": 360, "required": false },
  { "key": "date", "x": 100, "y": 400, "required": true }
]
```

**Relations:** credentials → template_id

---

## 5. credentials

Central table: each row is one issued credential.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | PK (use in verification URLs) |
| issuer_entity_id | uuid | FK → entities (issuer) |
| platform_entity_id | uuid | FK → entities (platform) |
| holder_id | uuid | FK → holders |
| context_id | uuid | FK → contexts |
| template_id | uuid | FK → templates |
| credential_type | enum | Type of claim: `attendance`, `completion`, `achievement`, `participation`, `membership`, `certification` |
| expires_at | timestamptz | Expiration (optional; null = never expires) |
| revoked_at | timestamptz | Revocation timestamp (optional; null = not revoked) |
| credential_json | jsonb | Canonical credential JSON (source of truth; immutable after issuance) |
| chain_name | text | Blockchain (e.g. Celo) |
| chain_id | integer | Network ID |
| contract_address | text | Contract address |
| tx_hash | text | Transaction hash |
| ipfs_cid | text | IPFS CID (Pinata) for decentralized backup |
| created_at, updated_at | timestamptz | Audit timestamps |

**Note:** `credential_type` = kind of claim (attendance, completion, etc.). `context.type` = kind of context (event, course, etc.). A course (context) can have completion or participation credentials.

**Derived (not stored):** verification_url = base_url + id. PDF generated on demand (no pdf_url).

**Relations:** receives FKs from entities, holders, contexts, templates.

---

## Relations summary

| Table | Referenced by |
|-------|---------------|
| entities | credentials (issuer_entity_id, platform_entity_id) |
| holders | credentials (holder_id) |
| contexts | credentials (context_id) |
| templates | credentials (template_id) |

### Cardinality

| Relationship | Type | Description |
|--------------|------|-------------|
| entities → credentials (issuer) | 1 → 0..* | One entity issues many credentials; each credential has exactly one issuer |
| entities → credentials (platform) | 1 → 0..* | One entity as platform has many credentials; each credential has exactly one platform |
| holders → credentials | 1 → 0..* | One holder receives many credentials; each credential has exactly one holder |
| contexts → credentials | 1 → 0..* | One context has many credentials; each credential has exactly one context |
| templates → credentials | 1 → 0..* | One template is used by many credentials; each credential has exactly one template |
