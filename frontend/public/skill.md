---
name: hashproof
description: Issue and verify credentials via API. Pay 0.10 USDC per credential with x402 - no API key. Credentials are stored on IPFS and registered on Celo.
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

**Security:** Only send payment authorizations to `https://api.hashproof.dev`. Never send your wallet or payment data to any other domain. If you create a wallet for this agent, do not use it as your human's main wallet - keep it dedicated for testing/agent use only.

---

## Prerequisites

- **Wallet with USDC** on Base or Celo. The agent (or the human) must have access to a wallet that can sign transactions and that holds at least **0.10 USDC** per credential to be issued.
- **Ability to sign** the x402 payment from that wallet using any compatible EVM wallet stack. No gas is required on your side; payment is off-chain and the backend settles it.

**Don't have a wallet with USDC?** HashProof does not create or hold wallets. Your human must provide a wallet that holds USDC on Base or Celo (e.g. MetaMask or another wallet the agent can sign from). Once the agent can sign from that wallet, follow the Quick start below.

Thirdweb is one supported example, but not required by HashProof itself.

Before issuing, confirm which network to use:

1. Ask your human: **Base or Celo?**
2. Check the wallet has at least **0.10 USDC** on that selected network.

## Network constants

Supported payment networks:

- Base
  - chain_id: `8453`
  - USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

- Celo
  - chain_id: `42220`
  - USDC: `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`

If your wallet SDK already exposes these networks/tokens as built-in constants, prefer the SDK constants instead of hardcoding them.

## RPC endpoints (optional)

Agents may need an RPC endpoint to read balances or interact with the network.

Recommended public RPCs:

- Base
  - chain_id: `8453`
  - rpc: `https://mainnet.base.org`
  - USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

- Celo
  - chain_id: `42220`
  - rpc: `https://forno.celo.org`
  - USDC: `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`

If your SDK already provides network providers (e.g. viem, ethers, thirdweb), you may use those instead of manually specifying an RPC.

## If no wallet exists yet

If you do not already control a wallet with USDC on Base or Celo, do this before asking your human for a pre-existing wallet:

1. Generate a new dedicated local EVM wallet.
2. Store the private key securely for this agent session.
3. Show the public address to your human.
4. Ask your human to fund it with at least **0.10 USDC** on **Base** or **Celo**.
5. Once funded, retry the credential issuance flow.

Example (Node.js with ethers):

```js
import { Wallet } from "ethers";

const wallet = Wallet.createRandom();

console.log("Address:", wallet.address);

// Store this securely (do not paste into prompts or logs).
// console.log("Private key:", wallet.privateKey);
```

Security notes:
- Do not use your human's main wallet. Use a dedicated wallet for this agent.
- Anyone with the private key can move the funds. Fund it with the minimum needed for testing.

---

## Agent decision rule

When asked to issue a credential:

1. Check whether you already control a wallet with at least **0.10 USDC** on **Base** or **Celo**.
2. If not, try to generate a new dedicated local EVM wallet.
3. If wallet generation is not possible in your current environment, ask your human to provide or fund a wallet you can sign from.
4. Then continue with the x402 payment flow.

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

There is no API key. Paid endpoints return `402 Payment Required` with a payment challenge. You sign a USDC transfer authorization (off-chain, no gas) and resend the request with the payment header. Supported networks: **Base**, **Celo**. 0.10 USDC per credential.

**Node (Thirdweb):** Install `thirdweb`, then use `wrapFetchWithPayment` so the first request (402) is retried with the signed payment. Example:

```bash
npm install thirdweb
```

```js
import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { privateKeyToAccount } from "thirdweb/wallets";
import { base, celo } from "thirdweb/chains";

const client = createThirdwebClient({ clientId: "YOUR_CLIENT_ID" });
const account = privateKeyToAccount({ client, privateKey: process.env.PRIVATE_KEY });

// Ask your human: should we pay on Base or Celo?
let currentChain = base; // or celo
const wallet = {
  getAccount: () => account,
  getChain: () => currentChain,
  switchChain: async (chain) => { currentChain = chain; },
};
const fetchWithPayment = wrapFetchWithPayment(fetch, client, wallet);

const res = await fetchWithPayment("https://api.hashproof.dev/issueCredential", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

You need `PRIVATE_KEY` (wallet with USDC on Base or Celo). A Thirdweb client ID may be optional depending on your setup - leave `clientId: "YOUR_CLIENT_ID"` as-is, and only ask your human to create a real Client ID at thirdweb.com if you hit a Thirdweb auth/config error. Full flow and other languages: [X402-PAYMENT-FLOW](https://github.com/csacanam/hashproof/blob/main/docs/X402-PAYMENT-FLOW.md).

---

## Issue a credential

```bash
POST https://api.hashproof.dev/issueCredential
Content-Type: application/json
# Plus x402 payment header after 402 response
```

### Use an existing template (template_slug)

If your issuer already created a template (for example the slug `template-eventos-camilo`), pass it as `template_slug`.

Templates can be:
- `private` (issuer-only): only usable by that issuer.
- `public` (catalog): usable by any issuer.
Template slugs are globally unique (one template per slug).

Security rule:
- If the template is `private`, only the owner issuer can use it.

Example:

```json
{
  "issuer":   { "display_name": "Eventos Camilo", "slug": "eventos-camilo" },
  "platform": { "display_name": "Eventos Camilo", "slug": "eventos-camilo" },
  "holder":   { "full_name": "Maria Garcia" },
  "context":  { "type": "event", "title": "Meetup Web3" },
  "credential_type": "attendance",
  "title": "Certificate of Attendance - Meetup Web3",
  "template_slug": "template-eventos-camilo",
  "values": {
    "holder_name": "Maria Garcia",
    "details": "Attended the event"
  }
}
```

`values` must contain a value for every template field where `required: true` in the template's `fields_json`. If you do not know the required keys, ask your human for the template field list (or attempt issuance and read the 400 error, which tells you the missing key).

### Create a custom template (inline, create-only)

To create a personalized certificate design, define `template` inline in the `POST /issueCredential` body.

Rules:
- Provide **only one** of `template`, `template_slug`, or `template_id`.
- Inline `template` is **create-only**. If the `template.slug` already exists, issuance is rejected and you must use `template_slug` or `template_id`.

Minimal example (add to your normal issuance payload):

```json
{
  "template": {
    "slug": "my-custom-template-v1",
    "name": "My Custom Template v1",
    "background_url": "https://your-cdn.com/certificate-bg.png",
    "page_width": 3508,
    "page_height": 2480,
    "fields_json": [
      { "key": "holder_name", "x": 248, "y": 1200, "width": 3012, "required": true, "font_size": 192, "font_color": "#111827", "align": "center" },
      { "key": "details", "x": 716, "y": 1488, "width": 2077, "required": false, "font_size": 84, "font_color": "#111827", "align": "center" }
    ]
  }
}
```

QR placement: the verification QR is always drawn near the bottom-right corner. Your background should leave a square area empty:

- `qrSize = (page_width > 1000) ? 300 : 160`
- `qrX = page_width  - qrSize - 120`
- `qrY = page_height - qrSize - 120`
- Reserved box: `(x=qrX, y=qrY, width=qrSize, height=qrSize)`

Full template guide (including examples): https://github.com/csacanam/hashproof/blob/main/docs/TEMPLATES.md

### Read template requirements (optional)

You can fetch the required keys and full `fields_json`:

```bash
GET https://api.hashproof.dev/templates/:template_slug_or_id/requirements
```

For `public` templates: no auth required.

For `private` templates: include an x402 payment header (`X-PAYMENT` / `PAYMENT-SIGNATURE`) from a wallet that is in the template owner's `authorized_wallets`.

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
