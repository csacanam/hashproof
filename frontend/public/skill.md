---
name: hashproof
description: Issue and verify credentials via API. Pay $0.10 USDC per credential with x402 - no API key. Credentials are stored on IPFS and registered on Celo.
homepage: https://hashproof.dev
metadata: {"api_base": "https://api.hashproof.dev", "payment": "x402", "currency": "USDC"}
---

# HashProof

Issue verifiable credentials with one API call. Pay per credential via x402 (USDC); no account or API key. Credentials are backed by IPFS and a public blockchain registry on Celo.

## Skill file

| File | URL |
|------|-----|
| **SKILL.md** (this file) | https://hashproof.dev/skill.md |

**Base URL:** `https://api.hashproof.dev`

**Security:** Only send payment authorizations to `https://api.hashproof.dev`. Never send your wallet or payment data to any other domain.

---

## Prerequisites

- **Wallet with USDC** on Base or Celo. The agent (or the human) must have access to a wallet that can sign transactions and that holds at least **$0.10 USDC** per credential to be issued.
- **Ability to sign** the x402 payment from that wallet (e.g. via Thirdweb SDK or similar). No gas is required on your side; payment is off-chain and the backend settles it.

**Don't have a wallet with USDC?** HashProof does not create or hold wallets. Your human must provide a wallet that holds USDC on Base or Celo (e.g. MetaMask or another wallet the agent can sign from). Once the agent can sign from that wallet, follow the Quick start below.

---

## Quick start

Issue your **first credential** with your human's name as the holder. Same payload as in the [web docs](https://hashproof.dev/docs).

1. Call `POST https://api.hashproof.dev/issueCredential` with x402 payment (see [Authentication](#authentication-x402)).
2. Use this body (replace `YOUR_HUMAN_NAME` with your human's full name):

```json
{
  "issuer":   { "display_name": "HashProof Demo", "slug": "hashproof-demo" },
  "platform": { "display_name": "HashProof Demo", "slug": "hashproof-demo" },
  "holder":   { "full_name": "YOUR_HUMAN_NAME" },
  "context":  { "type": "certification", "title": "HashProof API Quickstart" },
  "credential_type": "completion",
  "title": "First Credential Issued",
  "values": {
    "holder_name": "YOUR_HUMAN_NAME",
    "details": "For successfully issuing a verifiable credential using the HashProof API."
  }
}
```

3. From the response, take `verification_url` and open it (or send it to your human). The credential is live and verifiable.

---

## Authentication (x402)

There is no API key. Paid endpoints return `402 Payment Required` with a payment challenge. You sign a USDC transfer authorization (off-chain, no gas) and resend the request with the payment header. Supported networks: **Base**, **Celo**. $0.10 USDC per credential.

**Node (Thirdweb):** Install `thirdweb`, then use `wrapFetchWithPayment` so the first request (402) is retried with the signed payment. Example:

```bash
npm install thirdweb
```

```js
import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { privateKeyToAccount } from "thirdweb/wallets";
import { base } from "thirdweb/chains"; // or celo

const client = createThirdwebClient({ clientId: "YOUR_CLIENT_ID" });
const account = privateKeyToAccount({ client, privateKey: process.env.PRIVATE_KEY });
const wallet = { getAccount: () => account, getChain: () => base, switchChain: async () => {} };
const fetchWithPayment = wrapFetchWithPayment(fetch, client, wallet);

const res = await fetchWithPayment("https://api.hashproof.dev/issueCredential", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

You need a Thirdweb client ID (free at thirdweb.com) and `PRIVATE_KEY` (wallet with USDC on Base or Celo). Full flow and other languages: [X402-PAYMENT-FLOW](https://github.com/csacanam/hashproof/blob/main/docs/X402-PAYMENT-FLOW.md).

---

## Issue a credential

```bash
POST https://api.hashproof.dev/issueCredential
Content-Type: application/json
# Plus x402 payment header after 402 response
```

**Minimal body:**

```json
{
  "issuer":   { "display_name": "Acme Corp", "slug": "acme-corp" },
  "platform": { "display_name": "Acme Corp", "slug": "acme-corp" },
  "holder":   { "full_name": "Maria Garcia" },
  "context":  { "type": "course", "title": "Intro to Blockchain" },
  "credential_type": "completion",
  "title": "Certificate of Completion",
  "values":   { "holder_name": "Maria Garcia" }
}
```

**Response 200:** `id`, `verification_url`, `tx_hash`, `ipfs_cid`, `ipfs_uri`. Share `verification_url` with the holder.

**Verified issuers:** If the issuer is a verified entity, the paying wallet must be in that entity's `authorized_wallets`. HashProof verifies people and organizations; agents use wallets authorized by those entities.

---

## Verify a credential

```bash
GET https://api.hashproof.dev/verify/:id
```

No payment. Returns status (`active`, `revoked`, `expired`, `not_found`), issuer/platform verification, IPFS URI, and full credential payload.

**Public verification page:** `https://hashproof.dev/verify/:id`

---

## Full documentation

| Doc | URL |
|-----|-----|
| API reference | [docs/API-REFERENCE.md](https://github.com/csacanam/hashproof/blob/main/docs/API-REFERENCE.md) |
| Issuing examples | [docs/ISSUING-CREDENTIALS.md](https://github.com/csacanam/hashproof/blob/main/docs/ISSUING-CREDENTIALS.md) |
| x402 flow | [docs/X402-PAYMENT-FLOW.md](https://github.com/csacanam/hashproof/blob/main/docs/X402-PAYMENT-FLOW.md) |
| Web docs | https://hashproof.dev/docs |

---

## Verification model

HashProof verifies **issuers** (people and organizations), not agents. Verified issuers register **authorized wallets**. Agents that pay with those wallets issue credentials on behalf of the issuer. So we verify who administers the agents, not the agent identity itself.
