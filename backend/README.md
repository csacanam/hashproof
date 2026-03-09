# HashProof Backend

API for issuing verifiable credentials via x402 payment on Celo.

## Setup

1. Copy `.env.example` to `.env` and fill required vars:
   - `PAY_TO`: Celo address receiving x402 payments (optional if `SKIP_PAYMENT=true`)
   - `SUPABASE_URL`: Supabase project URL (e.g. `https://xxx.supabase.co`)
   - `SUPABASE_SECRET_KEY`: Service role key (Settings → API in Supabase)
2. In Supabase SQL Editor, run in order: `database/schema.sql`, `database/seed.sql` (defines base template), `database/functions/issue_credential.sql` (defines `prepare_credential` + `finalize_credential`).
3. Set `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` for Coinbase facilitator (or `SKIP_PAYMENT=true` for local dev without x402)
4. (Optional) Set `PINATA_JWT` to upload credential JSON to IPFS via Pinata as decentralized backup. Without it, credentials are stored only in the DB.
5. `npm start` or `npm run dev`

## Endpoints

- **GET /** – Service info
- **POST /issueCredential** – Paid (x402). Issue one credential. Requires full payload in body.
- **GET /verify/:id** – Fetch credential JSON for verification page.
- **GET /verify/:id/pdf** – Download credential as PDF.

### POST /issueCredential payload

```json
{
  "issuer": { "display_name": "...", "slug": "...", "website": "?", "logo_url": "?" },
  "platform": { "display_name": "...", "slug": "...", "website": "?", "logo_url": "?" },
  "holder": { "full_name": "...", "email": "?", "phone": "?", "external_id": "?" },
  "context": { "type": "event|course|diploma|training|certification|membership|other", "title": "...", "description": "?", "external_id": "?", "starts_at": "?", "ends_at": "?" },
  "template": { "slug": "...", "name": "...", "background_url": "...", "page_width": 595, "page_height": 842, "fields_json": [...] },
  "credential_type": "attendance|completion|achievement|participation|membership|certification",
  "title": "Credential title",
  "expires_at": null,
  "values": { "holder_name": "...", "event_name": "...", "date": "..." }
}
```

**Template:** optional. When omitted, uses default template from seed (`hashproof`). Default fields: `holder_name`, `details` (default from holder, context, issuer when not in `values`). Logos belong in each issuer's custom template background.
