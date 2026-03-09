# HashProof

Verifiable credentials issued via x402 on Celo.

## Project layout

- `backend/` — Credential issuance API
- `frontend/` — Landing page and verification UI

## Frontend: credential format and endpoints

When displaying or verifying credentials:

- **`issuer.id`** is a URI, not a raw UUID: `{BASE_URL}/entities/{entity_id}`. Example: `https://hashproof.example.com/entities/bc309e8c-1d70-4b63-ab82-03acb90f7390`. Use this URI for links or lookups.
- **`issuer.display_name`** — human-readable issuer name.
- **`credentialSubject`** — does not include `id` (bearer credential).
- **`proof`** — type `HashProofBlockchain` with `txHash`, `credentialHash`, `contractAddress`.

**Endpoints:**
- `GET {BASE_URL}/verify/:id` — fetch credential JSON for the verification page.
- `GET {BASE_URL}/verify/:id/pdf` — download credential as PDF (trigger download after issuance).
