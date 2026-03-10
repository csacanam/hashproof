# HashProof

Verifiable credentials with IPFS backup, on-chain registry, and pay-per-call API via x402.

## What it is

HashProof is a credential issuance API. Organizations and Individuals (entities) issue verifiable credentials to people. Each credential is:

- Stored as a JSON in the database and backed up on IPFS (Pinata)
- Registered on-chain in the `CredentialRegistry` contract on Celo
- Verifiable via a public URL: `https://hashproof.dev/verify/:id`

Calling the API requires a micropayment in USDC via the x402 protocol — no API keys, no subscriptions. AI agents can call the API directly using a funded wallet.

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
| Celo mainnet | CredentialRegistry | `0xFD899A0BbdB5378Cb676305e91Ef01939E3B01ba` |

## Paid API endpoints

| Endpoint                                  | Price      | Description                     |
| ----------------------------------------- | ---------- | ------------------------------- |
| `POST /issueCredential`                   | $0.10 USDC | Issue one verifiable credential |
| `POST /entities/:id/verificationRequests` | $0.10 USDC | Submit a verification request   |

Payment is in USDC on Base (configurable). The client signs an off-chain authorization — no gas required.

## Quick start

See `backend/README.md` and `frontend/README.md` for setup instructions.
See [`docs/README.md`](./docs/README.md) for the full documentation index.
