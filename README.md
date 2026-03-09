# HashProof

Verifiable credentials issued via x402 on Celo.

## Networks

- **Celo mainnet**  
  - `CredentialRegistry` address: `0xFD899A0BbdB5378Cb676305e91Ef01939E3B01ba`

## Project layout

- `backend/` — Credential issuance API
- `frontend/` — Landing page and verification UI

## Frontend: credential format and endpoints

When displaying or verifying credentials:

- **`credentialId`** — canonical identifier (DB `credentials.id`, UUID v4). Used in `/verify/{credentialId}`, IPFS filename `{credentialId}.json`, and as the key in the `CredentialRegistry` contract.
- **`issuer.id`** is a URI, not a raw UUID: `{BASE_URL}/entities/{entity_id}`. Example: `https://hashproof.example.com/entities/bc309e8c-1d70-4b63-ab82-03acb90f7390`. Use this URI for links or lookups.
- **`issuer.display_name`** — human-readable issuer name.
- **`credentialSubject`** — does not include `id` (bearer credential).
- **`proof`** — type `HashProofBlockchain` with `txHash`, `contractAddress`.

**Endpoints:**
- `GET {BASE_URL}/verify/:id` — fetch credential JSON for the verification page.
- `GET {BASE_URL}/verify/:id/pdf` — download credential as PDF (trigger download after issuance).
