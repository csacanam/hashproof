# Issuing Credentials

**Endpoint:** `POST /issueCredential` — paid, $0.10 USDC via x402.

This guide shows practical examples from basic to advanced. For the full field spec and all allowed values, see [`API-REFERENCE.md`](./API-REFERENCE.md).

---

## Quick curl test (local dev)

Set `SKIP_PAYMENT=true` in `backend/.env` and restart the server to bypass x402 during development.

```bash
curl -s -X POST http://localhost:4022/issueCredential \
  -H "Content-Type: application/json" \
  -d '{
    "issuer":   { "display_name": "Universidad Icesi", "slug": "universidad-icesi" },
    "platform": { "display_name": "Universidad Icesi", "slug": "universidad-icesi" },
    "holder":   { "full_name": "María García" },
    "context":  { "type": "event", "title": "Blockchain Summit 2025" },
    "credential_type": "attendance",
    "title": "Certificate of Attendance — Blockchain Summit 2025",
    "values": { "holder_name": "María García" }
  }' | jq .
```

> Remove `SKIP_PAYMENT=true` before deploying to production.

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
    "issuer":   { "display_name": "Universidad Icesi", "slug": "universidad-icesi" },
    "platform": { "display_name": "Universidad Icesi", "slug": "universidad-icesi" },
    "holder":   { "full_name": "María García" },
    "context":  { "type": "event", "title": "Blockchain Summit 2025" },
    "credential_type": "attendance",
    "title": "Certificate of Attendance — Blockchain Summit 2025",
    "values": { "holder_name": "María García" }
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

---

## Level 1 — Basic (default template)

Uses the pre-seeded `hashproof` template. Two fields: `holder_name` (required) and `details` (optional).

```json
{
  "issuer":   { "display_name": "Universidad Icesi", "slug": "universidad-icesi" },
  "platform": { "display_name": "Universidad Icesi", "slug": "universidad-icesi" },
  "holder":   { "full_name": "María García" },
  "context":  { "type": "event", "title": "Blockchain Summit 2025" },
  "credential_type": "attendance",
  "title": "Certificate of Attendance — Blockchain Summit 2025",
  "values": {
    "holder_name": "María García"
  }
}
```

`issuer` and `platform` can be the same entity (the organization issues and manages its own credentials).

---

## Level 2 — With details and optional fields

Add `details` to show extra info on the certificate. Add `holder.email` for delivery. Add `expires_at` if the credential expires.

```json
{
  "issuer":   { "display_name": "Universidad Icesi", "slug": "universidad-icesi", "website": "https://icesi.edu.co" },
  "platform": { "display_name": "Universidad Icesi", "slug": "universidad-icesi" },
  "holder":   { "full_name": "María García", "email": "maria@example.com" },
  "context":  { "type": "course", "title": "Introducción a Blockchain", "description": "40-hour online course" },
  "credential_type": "completion",
  "title": "Certificate of Completion — Introducción a Blockchain",
  "expires_at": "2027-12-31T00:00:00Z",
  "values": {
    "holder_name": "María García",
    "details": "Completed with honors · June 2025"
  }
}
```

---

## Level 3 — Separate issuer and platform

Use this when a third-party platform (e.g. Peewah) issues credentials on behalf of an organization.

```json
{
  "issuer":   { "display_name": "Universidad Icesi", "slug": "universidad-icesi" },
  "platform": { "display_name": "Peewah", "slug": "peewah", "website": "https://peewah.co" },
  "holder":   { "full_name": "Carlos López", "email": "carlos@example.com", "external_id": "USR-4892" },
  "context":  {
    "type": "course",
    "title": "Design Thinking",
    "external_id": "COURSE-DT-2025",
    "starts_at": "2025-03-01T00:00:00Z",
    "ends_at": "2025-05-30T00:00:00Z"
  },
  "credential_type": "completion",
  "title": "Certificate of Completion — Design Thinking",
  "values": {
    "holder_name": "Carlos López",
    "details": "Design Thinking · Universidad Icesi · 2025"
  }
}
```

`external_id` on holder and context lets you match records from your own system.

---

## Level 4 — Custom template (inline)

Define your own template in the payload. You control the background image, page size, and field positions.

```json
{
  "issuer":   { "display_name": "Universidad Icesi", "slug": "universidad-icesi" },
  "platform": { "display_name": "Universidad Icesi", "slug": "universidad-icesi" },
  "holder":   { "full_name": "Ana Torres" },
  "context":  { "type": "diploma", "title": "Ingeniería de Sistemas" },
  "credential_type": "achievement",
  "title": "Diploma — Ingeniería de Sistemas",
  "template": {
    "slug": "icesi-diploma-2025",
    "name": "Icesi Diploma",
    "background_url": "https://cdn.icesi.edu.co/diploma-bg.png",
    "page_width": 3508,
    "page_height": 2480,
    "fields_json": [
      { "key": "holder_name", "x": 500, "y": 1100, "width": 2500, "required": true,  "font_size": 180, "font_color": "#1a1a2e", "align": "center" },
      { "key": "program",     "x": 500, "y": 1350, "width": 2500, "required": true,  "font_size": 90,  "font_color": "#333333", "align": "center" },
      { "key": "date",        "x": 500, "y": 1550, "width": 2500, "required": false, "font_size": 72,  "font_color": "#666666", "align": "center" }
    ]
  },
  "values": {
    "holder_name": "Ana Torres",
    "program": "Ingeniería de Sistemas",
    "date": "Junio 2025"
  }
}
```

The template is created on first use and reused on subsequent calls with the same `slug`.

---

## Reference

### credential_type

| Value | Use case |
|-------|----------|
| `attendance` | Attended an event |
| `completion` | Completed a course or program |
| `achievement` | Academic degree, award |
| `participation` | Participated in a contest or activity |
| `membership` | Member of an organization |
| `certification` | Professional certification |

### context.type

| Value | Use case |
|-------|----------|
| `event` | Conference, summit, workshop |
| `course` | Online or in-person course |
| `diploma` | Academic degree |
| `training` | Training program |
| `certification` | Certification program |
| `membership` | Membership period |
| `other` | Anything else |

### template fields_json properties

| Property | Required | Description |
|----------|----------|-------------|
| `key` | yes | Must match a key in `values` |
| `x`, `y` | yes | Position in pixels from top-left |
| `required` | no | If true, `values[key]` must be provided (default: true) |
| `width`, `height` | no | Bounding box for the text |
| `font_size` | no | Font size in pt (default: 12) |
| `font_color` | no | Hex color, e.g. `#000000` (default: black) |
| `align` | no | `left`, `center`, or `right` |

---

## API response

```json
{
  "id": "a1b2c3d4-...",
  "verification_url": "https://hashproof.dev/verify/a1b2c3d4-...",
  "tx_hash": "0xabc...",
  "ipfs_cid": "bafybeig...",
  "ipfs_uri": "https://gateway.pinata.cloud/ipfs/bafybeig..."
}
```

Share `verification_url` with the credential holder. The QR code on the PDF points to that URL.
