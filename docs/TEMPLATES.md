# Templates

This doc explains how HashProof templates work and how to design backgrounds safely.

## Quickstart: create a custom template (inline)

You can create a personalized certificate design by defining a template inline in `POST /issueCredential`.

Rules:
- Provide **only one** of `template`, `template_slug`, or `template_id`.
- Inline `template` is **create-only**. If `template.slug` already exists, issuance is rejected and you must use `template_slug` or `template_id`.

Minimal example:

```json
{
  "issuer":   { "display_name": "Acme Corp", "slug": "acme-corp" },
  "platform": { "display_name": "Acme Corp", "slug": "acme-corp" },
  "holder":   { "full_name": "Diana Prieto" },
  "context":  { "type": "event", "title": "ExpoMICE 2026" },
  "credential_type": "attendance",
  "title": "Certificado de Relacionamiento",
  "template": {
    "slug": "acme-expo-2026-v1",
    "name": "Acme Expo 2026 v1",
    "background_url": "https://your-cdn.com/template-bg.png",
    "page_width": 3508,
    "page_height": 2480,
    "fields_json": [
      { "key": "holder_name", "x": 248, "y": 1200, "width": 3012, "required": true, "font_size": 192, "font_color": "#111827", "align": "center" },
      { "key": "details", "x": 716, "y": 1488, "width": 2077, "required": false, "font_size": 84, "font_color": "#111827", "align": "center" }
    ]
  },
  "values": {
    "holder_name": "Diana Prieto",
    "details": "Por habernos conocido en Expo MICE..."
  }
}
```

After the first successful issuance, you can reuse the template by referencing it:

```json
{ "template_slug": "acme-expo-2026-v1" }
```

## What a template controls

A template defines:
- PDF size (`page_width`, `page_height`)
- Background image (`background_url`)
- Text fields placement and styling (`fields_json`)

At issuance time, the caller provides `values` and the renderer writes `credentialSubject[valuesKey]` into each field position.

## QR placement (important for design)

The verification QR is **not** defined in `fields_json`. The PDF renderer always draws a QR code for the verification URL near the **bottom-right** corner of the page. Template backgrounds should leave that area empty to avoid overlap with artwork or text.

Current renderer logic:
- `qrSize = (page_width > 1000) ? 300 : 160`
- `qrX = page_width  - qrSize - 120`
- `qrY = page_height - qrSize - 120`

Reserved area (leave this box empty in your background):
- Rectangle: `(x = qrX, y = qrY, width = qrSize, height = qrSize)`

Examples:
- For a common high-res A4 template (`page_width=3508`, `page_height=2480`):
  - `qrSize = 300`
  - `qrX = 3508 - 300 - 120 = 3088`
  - `qrY = 2480 - 300 - 120 = 2060`
  - Reserved box: `x=[3088..3388]`, `y=[2060..2360]`
- For a small/point-based A4 template (`page_width=595`, `page_height=842`):
  - `qrSize = 160`
  - `qrX = 595 - 160 - 120 = 315`
  - `qrY = 842 - 160 - 120 = 562`
  - Reserved box: `x=[315..475]`, `y=[562..722]`

Practical guidance:
- Keep the bottom-right corner visually quiet.
- Ensure the background has enough contrast for a black QR.
- If you place any design elements there, they may be covered by the QR.

## Using templates in issuance

In `POST /issueCredential`, choose exactly one:
- `template_slug` (existing template)
- `template_id` (existing template)
- `template` (inline) — create-only; if the slug already exists, the request is rejected.

Templates can be:
- `public`: any issuer can use it
- `private`: only the owner issuer can use it

