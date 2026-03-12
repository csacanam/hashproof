# HashProof — Documentation

## If you want to use the API

| Read | Why |
|------|-----|
| [API-REFERENCE.md](./API-REFERENCE.md) | All endpoints, allowed values, request and response schemas |
| [ISSUING-CREDENTIALS.md](./ISSUING-CREDENTIALS.md) | Minimal, copy-paste issuance examples |
| [TEMPLATES.md](./TEMPLATES.md) | Template use cases (default, by slug/id, inline, background override), field definitions, QR placement |
| [X402-PAYMENT-FLOW.md](./X402-PAYMENT-FLOW.md) | How x402 works (useful for agents and integrations) |
| [API key / Enterprise plans](./API-REFERENCE.md#api-key-prepaid-credits) | Prepaid credits + API key (no crypto) for institutions (enterprise agreements) |

## If you operate the platform

| Read | Why |
|------|-----|
| [ADMIN-GUIDE.md](./ADMIN-GUIDE.md) | How to review and approve entity verification requests, suspend entities, and manage authorized wallets |

## Engineering notes (optional)

| Read | Why |
|------|-----|
| [X402-LESSONS-LEARNED.md](./X402-LESSONS-LEARNED.md) | Implementation gotchas integrating x402 + Thirdweb (not needed to use the API) |

## If you want to run or modify the project

Start with the README in each folder:

| Folder | README |
|--------|--------|
| Root | [README.md](../README.md) — project overview |
| Backend | [backend/README.md](../backend/README.md) — setup, endpoints, key files |
| Frontend | [frontend/README.md](../frontend/README.md) — setup, env vars, routes |
| Contracts | [contracts/README.md](../contracts/README.md) — deploy and verify |
| Database | [backend/database/README.md](../backend/database/README.md) — schema and table reference |
