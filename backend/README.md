# HashProof Backend

Express API for issuing verifiable credentials and handling entity verification requests, with x402 payments in USDC on Base.

## Setup

1. Copy `.env.example` to `.env` and fill required vars (see comments inside the file).
2. In Supabase SQL Editor, run in this order:
   - `database/schema.sql` — table definitions
   - `database/seed.sql` — default HashProof entity and template
   - `database/functions/issue_credential.sql` — `prepare_credential` + `finalize_credential` RPCs
3. For x402 payments, set:
   - `THIRDWEB_SECRET_KEY` — from [thirdweb.com/dashboard](https://thirdweb.com/dashboard) (used to generate the 402 challenge format)
   - `PAY_TO` — address that receives USDC payments
   - `SETTLER_PRIVATE_KEY` — EOA private key that executes `transferWithAuthorization` on-chain; must hold native gas tokens on each configured network (ETH on Base, CELO on Celo, etc.)
   - Or set `SKIP_PAYMENT=true` to bypass x402 for local development.
4. (Optional) Set `PINATA_JWT` to upload credential JSON to IPFS via Pinata as a decentralized backup. Without it, credentials are stored only in the database.
5. `npm start`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | Service info |
| POST | `/issueCredential` | x402 ($0.10 USDC) | Issue one credential |
| GET | `/verify/:id` | — | Full verification (contract + IPFS + DB) |
| GET | `/verify/:id/contract` | — | Blockchain-only status check |
| GET | `/verify/:id/ipfs` | — | IPFS data check |
| GET | `/verify/:id/pdf` | — | Download credential PDF |
| GET | `/entities/:id` | — | Entity info and verification status |
| POST | `/entities/:id/verificationRequests` | x402 ($49 USDC) | Submit a verification request |

For the full API spec with all allowed values, request/response schemas, and error codes, see [`docs/API-REFERENCE.md`](../docs/API-REFERENCE.md).

## Key files

| File | Role |
|------|------|
| `src/utils/chains.js` | Single source of truth for network config (USDC addresses, RPC URLs) |
| `src/middleware/thirdwebPayment.js` | x402 middleware: generates 402 challenge, validates and settles payments |
| `src/services/settleEOA.js` | Executes `transferWithAuthorization` on-chain via EOA |
| `src/services/issueCredential.js` | Issuance pipeline (prepare → IPFS → on-chain → finalize) |
| `src/services/verifyPipeline.js` | Three-layer verification (contract → IPFS → DB) |
| `src/services/createVerificationRequest.js` | Inserts entity verification requests |
| `src/utils/constants.js` | Pricing and shared constants |
| `database/functions/issue_credential.sql` | `prepare_credential` + `finalize_credential` Supabase RPCs |

## Payment architecture

x402 payments use EIP-3009 (`TransferWithAuthorization`). The client signs off-chain (gasless). The backend's `SETTLER_PRIVATE_KEY` wallet submits the on-chain transaction, paying a small amount of gas (~$0.001 on Base). Thirdweb is used only to format the 402 challenge header — not for settlement.

## Credential format

| Field | Value |
|-------|-------|
| `credentialId` | UUID v4 — used in verify URLs, IPFS filename, and contract key |
| `issuer.id` | URI: `{BASE_URL}/entities/{entity_id}` |
| `proof.type` | `HashProofBlockchain` with `txHash`, `contractAddress` |

## POST /issueCredential payload

For a full guide with examples from basic to custom templates, see [`docs/ISSUING-CREDENTIALS.md`](../docs/ISSUING-CREDENTIALS.md).

```json
{
  "issuer":   { "display_name": "...", "slug": "...", "website": "?", "logo_url": "?" },
  "platform": { "display_name": "...", "slug": "...", "website": "?", "logo_url": "?" },
  "holder":   { "full_name": "...", "email": "?", "phone": "?", "external_id": "?" },
  "context":  { "type": "event|course|diploma|training|certification|membership|other", "title": "...", "description": "?", "external_id": "?", "starts_at": "?", "ends_at": "?" },
  "template": { "slug": "...", "name": "...", "background_url": "...", "page_width": 595, "page_height": 842, "fields_json": [...] },
  "credential_type": "attendance|completion|achievement|participation|membership|certification",
  "title": "Credential title",
  "expires_at": null,
  "values": { "holder_name": "...", "event_name": "...", "date": "..." }
}
```

`template` is optional — when omitted, uses the default `hashproof` template from seed. Default template fields: `holder_name`, `details`.
