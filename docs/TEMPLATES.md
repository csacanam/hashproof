# Templates

Templates define how a credential PDF looks: size, background image, and where each text field goes. HashProof supports several ways to choose or create a template so you can start simple and grow when you need custom layouts.

**Rule:** In each issuance request you may use **only one** of: `template_slug`, `template_id`, or `template`. If you send more than one, the API returns `400`.

---

## Template use cases at a glance

| Use case | What you send | When to use it |
|----------|----------------|----------------|
| **Default** | Nothing (omit template fields) | Quick start; standard HashProof certificate layout. |
| **Existing template by slug** | `template_slug`: `"my-template"` | You or someone else already created a template; you reference it by its unique slug. |
| **Existing template by ID** | `template_id`: `"uuid"` | Same as slug but using the template’s UUID (e.g. from an API or DB). |
| **Inline (create once)** | `template`: `{ "slug", "name", "background_url", "page_width", "page_height", "fields_json" }` | You define the full layout in the request; the template is created and used for that issuance. Next time use `template_slug` to reuse it. |
| **Same layout, different background** | `template_slug` or `template_id` **and** `background_url_override`: `"https://..."` | One template defines layout and fields; each issuance can use a different background image (e.g. per event). |

Details and examples for each case are below.

---

## 1. Default template (no template field)

If you **do not** send `template_slug`, `template_id`, or `template`, the API uses the built-in default template (slug: `hashproof`).

**Required `values` for the default template:** `holder_name`; `details` is optional.

Example: see [ISSUING-CREDENTIALS.md](./ISSUING-CREDENTIALS.md) “Quick curl test”.

---

## 2. Use an existing template (by slug or ID)

When a template already exists (created via inline issuance or in the database), reference it by **slug** or **id**.

- **`template_slug`** — string, e.g. `"eventos-camilo"`. Slugs are globally unique.
- **`template_id`** — UUID of the template. Useful when you get the ID from another API or the DB.

**Visibility:**

- **Public template:** any issuer can use it (e.g. catalog templates).
- **Private template:** only the entity that owns the template can use it. If another issuer sends a private template’s slug/id, the API returns an error.

You must supply `values` for every field in that template that has `required: true`. To know which keys are required, call `GET /templates/:slug_or_id/requirements` or read the template definition.

Example (by slug):

```json
{
  "issuer":   { "display_name": "Eventos Camilo", "slug": "eventos-camilo" },
  "platform": { "display_name": "Eventos Camilo", "slug": "eventos-camilo" },
  "holder":   { "full_name": "Maria Garcia" },
  "context":  { "type": "event", "title": "Meetup Web3" },
  "credential_type": "attendance",
  "title": "Certificate of Attendance",
  "template_slug": "eventos-camilo-cert",
  "values": { "holder_name": "Maria Garcia", "details": "Attended the event" }
}
```

---

## 3. Create a template inline (create-only)

You can define a full template **inside** the issuance request. The API creates the template (by slug) and uses it for that credential. After the first successful issuance, **reuse** the same template by sending only `template_slug` (or `template_id`); do not send the full `template` object again.

**Rules:**

- Send **only** `template` (no `template_slug` or `template_id`).
- Inline is **create-only**: if a template with the same `slug` already exists, the API rejects the request with a message like “Template already exists. Use template_slug or template_id.”

Minimal inline example:

```json
{
  "issuer":   { "display_name": "Acme Corp", "slug": "acme-corp" },
  "platform": { "display_name": "Acme Corp", "slug": "acme-corp" },
  "holder":   { "full_name": "Diana Prieto" },
  "context":  { "type": "event", "title": "Expo 2026" },
  "credential_type": "attendance",
  "title": "Certificado de Relacionamiento",
  "template": {
    "slug": "acme-expo-2026-v1",
    "name": "Acme Expo 2026 v1",
    "background_url": "https://your-cdn.com/template-bg.png",
    "page_width": 3508,
    "page_height": 2480,
    "fields_json": [
      { "key": "holder_name", "x": 248, "y": 1200, "width": 3012, "required": true, "font_size": 192, "font_color": "#111827", "align": "center", "bold": true },
      { "key": "details", "x": 716, "y": 1488, "width": 2077, "required": false, "font_size": 84, "font_color": "#111827", "align": "center" }
    ]
  },
  "values": {
    "holder_name": "Diana Prieto",
    "details": "Por habernos conocido en Expo..."
  }
}
```

Next time, use: `"template_slug": "acme-expo-2026-v1"` with the same `values` shape.

---

## 4. Same layout, different background (override)

When you use **one** template for many credentials (same size and field positions) but want a **different background image per issuance** (e.g. per event or batch), keep using `template_slug` or `template_id` and add **`background_url_override`**.

- The template defines: page size, field positions, and a default `background_url`.
- For that credential only, the PDF renderer uses `background_url_override` instead of the template’s `background_url`. Layout is unchanged.
- `background_url_override` is stored in the database only; it is **not** part of the credential JSON or IPFS.

Example: [ISSUING-CREDENTIALS.md](./ISSUING-CREDENTIALS.md) — “Fixed layout, variable background”.

---

## What a template controls

A template defines:

- **PDF size** — `page_width`, `page_height` (in pixels).
- **Background image** — `background_url` (optional; can be overridden per credential with `background_url_override` when using `template_slug` or `template_id`).
- **Text fields** — `fields_json`: array of field definitions (key, position, size, font, alignment, required, and optional style flags).

At issuance time you provide `values` (key-value pairs). The renderer maps each key to the corresponding field and draws the text in the right place.

---

## Field definition (fields_json)

Each item in `fields_json` describes one text field. Common properties:

| Property | Type | Description |
|----------|------|-------------|
| `key` | string | Key in `values` to use for this field (e.g. `holder_name`, `details`). |
| `x`, `y` | number | Position (pixels from top-left). |
| `width` | number | Max width for the text area. |
| `height` | number | Optional; used for layout. |
| `required` | boolean | If `true`, issuance must include this key in `values`. |
| `font_size` | number | Font size in points. |
| `font_color` | string | Hex color (e.g. `#000000`). |
| `align` | string | `left`, `center`, or `right`. |

Optional style flags (all default `false`):

| Property | Description |
|----------|-------------|
| `bold` | Render in bold (Helvetica-Bold). |
| `italic` | Render in italic (Helvetica-Oblique). |
| `underline` | Underline the text. |
| `strike` | Strike through the text. |

You can combine `bold` and `italic`. Example: `{ "key": "holder_name", "x": 80, "y": 260, "font_size": 40, "bold": true }`.

---

## QR placement (design guideline)

The **verification QR code** is not defined in `fields_json`. The PDF renderer always draws it near the **bottom-right** corner. Your background art should leave that area free so the QR is readable.

Current logic (scaled by page width):

- Reference: 360px QR at 3508px page width; min 96px, max 360px.
- Margin from edges scales with QR size (about 40% of QR size).
- Reserved rectangle: bottom-right square; size and position scale with page dimensions.

For a high-res template (e.g. 3508×2480): the reserved area is roughly the last ~360px + margin in both x and y. For smaller pages the QR and margin scale down. Keep the bottom-right corner visually quiet and with enough contrast for a black QR.

---

## Summary table (what to send)

| Goal | Send |
|------|------|
| Use default certificate | Omit `template_slug`, `template_id`, and `template`. |
| Use existing template | `template_slug`: `"slug"` **or** `template_id`: `"uuid"`. |
| Create and use new template | `template`: `{ "slug", "name", "background_url", "page_width", "page_height", "fields_json" }`. |
| Same template, different background | `template_slug` or `template_id` **and** `background_url_override`: `"https://..."`. |

For full request/response schemas and errors, see [API-REFERENCE.md](./API-REFERENCE.md). For copy-paste issuance examples, see [ISSUING-CREDENTIALS.md](./ISSUING-CREDENTIALS.md).
