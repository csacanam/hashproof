# HashProof

Verifiable credentials with IPFS backup, on-chain registry, and pay-per-call API via x402.

## What it is

HashProof is a credential issuance API. Organizations and Individuals (entities) issue verifiable credentials to people. Each credential is:

- Stored as a JSON in the database and backed up on IPFS (Pinata)
- Registered on-chain in the `CredentialRegistry` contract on Celo
- Verifiable via a public URL: `https://hashproof.dev/verify/:id`

Two ways to pay: micropayment in USDC via x402 (Base or Celo) — no API keys, no subscriptions — or a prepaid API key for enterprise clients (no crypto needed). AI agents can call the API directly using a funded wallet.

## Project structure

```
backend/       Express API — credential issuance, verification, payments
frontend/      React app — landing page, credential verification, entity pages
contracts/     CredentialRegistry smart contract (Celo)
docs/          Architecture and flow documentation
```

## Deployed contracts

| Network      | Contract           | Address                                      |
| ------------ | ------------------ | -------------------------------------------- |
| Celo mainnet | CredentialRegistry | `0x7a1B759A602Aba72a70f99Dffd0a386d7504ce9B` |

## Paid API endpoints

| Endpoint                                  | Price      | Description                     |
| ----------------------------------------- | ---------- | ------------------------------- |
| `POST /issueCredential`                   | $0.10 USDC | Issue one verifiable credential |
| `POST /entities/:id/verificationRequests` | $49 USDC | Submit a verification request   |

Payment is in USDC on Base or Celo via x402. The client signs an off-chain authorization — no gas required.

## Free endpoints

| Endpoint                             | Description                                    |
| ------------------------------------ | ---------------------------------------------- |
| `GET /verify/:id`                    | Full 3-layer verification                      |
| `GET /templates/:ref/requirements`   | Get required fields for a template             |
| `POST /templates/:ref/preview`       | Generate a preview PDF with watermark (no cost) |
| `GET /stats`                         | On-chain credential counters                   |

## Quick start

See `backend/README.md` and `frontend/README.md` for setup instructions.
See [`docs/README.md`](./docs/README.md) for the full documentation index.
See `frontend/public/skill.md` for the AI agent skill definition.
