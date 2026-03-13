---
name: hashproof
description: Issue and verify credentials via API. Pay 0.10 USDC per credential with x402 - no API key. Credentials are stored on IPFS and registered on Celo.
homepage: https://hashproof.dev
metadata: {"api_base": "https://api.hashproof.dev", "payment": "x402", "currency": "USDC"}
---

# HashProof

Issue verifiable credentials with one API call. Pay per credential via x402 (USDC); no account or API key. Credentials are backed by IPFS and a public blockchain registry on Celo.

For full, human‑oriented documentation (examples, screenshots, and explanations), see `https://hashproof.dev/docs`.

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

**Enterprise plans (no crypto):** Some institutions use a prepaid API key instead of x402. If your human says they have an API key from HashProof, you do not need a wallet or x402.

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

## Questions to ask your human

Before issuing a credential, always ask your human to confirm at least:

- **Purpose and type**
  - What is this credential for? (e.g. course, event, membership, certification)
  - Which `credential_type` should we use? (attendance, completion, achievement, participation, membership, certification)
- **Holder details**
  - Exact full name to print on the certificate.
  - Optional: email (for delivery) and preferred language if relevant.
- **Template choice**
  - Do you want to use the **default certificate** (standard layout),
    an **existing template** (provide `template_slug` or `template_id`),
    or **create a new template inline**?
  - If using an existing template: provide the template slug/ID and, if unsure about required fields, allow the agent to call  
    `GET https://api.hashproof.dev/templates/:slug_or_id/requirements` to discover required keys.
  - If creating a template inline: the human must provide `background_url`, `page_width`, `page_height`, and a list of fields (`fields_json`) with positions and sizes. The agent should not invent a layout without explicit instructions.
- **Values to print**
  - For each field that will appear on the PDF (name, role, event name, dates, etc.), confirm the exact text.
  - If a template has required keys, confirm a value for each required key.
- **Payment / authentication**
  - Will we pay with **x402** (wallet with USDC on Base or Celo) or use an **API key** with prepaid credits?
  - If x402: confirm the network (Base or Celo) and that the wallet has at least **0.10 USDC** per credential.
  - If API key: confirm the key value and that it is allowed to issue on behalf of the intended issuer/entity.
- **Issuer / platform identity**
  - Which issuer and platform should appear on the credential (`issuer.display_name`, `issuer.slug`, `platform.display_name`, `platform.slug`)?
  - If the issuer is a verified entity on HashProof, ensure the paying wallet or API key is authorized for that entity.

If any of these answers are missing or ambiguous, ask follow‑up questions instead of guessing or fabricating data.

---

## Quick start

Issue your **first credential** after confirming details with your human. Same payload shape as in the [web docs](https://hashproof.dev/docs).

1. Ask your human:
   - **Holder name**: exact full name to print on the certificate.
   - **Subtitle/details**: short line to show under the name (or confirm they want to leave it empty).
   - **Template choice**:
     - Use the **default certificate** (standard layout), or
     - Use an **existing template** (provide `template_slug` or `template_id`), or
     - **Create a new template inline** (provide `background_url`, `page_width`, `page_height`, and `fields_json` for each field).
2. Confirm which network to pay on (**Base** or **Celo**) and that you have either:
   - A wallet with at least **0.10 USDC** on that network (for x402), or
   - An **API key** with prepaid credits from HashProof.
3. Call `POST https://api.hashproof.dev/issueCredential` with x402 payment or API key (see [Authentication](#authentication-x402-or-api-key)).
4. For the **default template** (no `template`, `template_slug`, or `template_id`), use a body like this (replace placeholders with the values you just confirmed):

```json
{
  "issuer":   { "display_name": "HashProof Demo", "slug": "hashproof-demo" },
  "platform": { "display_name": "HashProof Demo", "slug": "hashproof-demo" },
  "holder":   { "full_name": "HOLDER_FULL_NAME" },
  "context":  { "type": "certification", "title": "HashProof API Quickstart" },
  "credential_type": "completion",
  "title": "First Credential Issued",
  "values": {
    "holder_name": "HOLDER_FULL_NAME",
    "details": "ONE_SHORT_SENTENCE_ABOUT_WHY_THIS_WAS_ISSUED"
  }
}
```

5. From the response, take `verification_url` and open it (or send it to your human). The credential is live and verifiable.

---

## Authentication (x402 or API key)

**Most users:** No API key. Paid endpoints return `402 Payment Required` with a payment challenge.

**Institutions with prepaid agreement:** HashProof may provide an **API key** and prepaid credits (1 credit = 1 credential). Send `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`; no x402 or wallet needed. If the human says they have an API key from HashProof, use that instead of x402. **For enterprise plans (no crypto):** the human should contact HashProof (e.g. hi@hashproof.dev) to purchase prepaid credits and receive an API key tied to their entity.

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

### What a template is

A template is the **definition of how to paint the credential data onto a canvas**: canvas size, background image, and where and how each value (from `values`) is drawn — position, font, color, alignment, bold/italic, etc. You send the data; the template defines how it is laid out on the PDF.

### Templates — which option to use

**Rule:** Send **only one** of `template_slug`, `template_id`, or `template` per request. Sending more than one returns `400`.

| If you want… | Send |
|--------------|------|
| **Default certificate** (quick start, standard layout) | Omit all template fields. Use `values.holder_name` and optionally `values.details`. |
| **Use an existing template** (already created) | `template_slug`: `"slug"` or `template_id`: `"uuid"`. No `template` object — the layout is stored; you only send credential data and reference the template. Provide `values` for every field with `required: true`. |
| **Create a new template and use it** (first time only) | `template`: `{ "slug", "name", "background_url", "page_width", "page_height", "fields_json" }`. Inline is **create-only**. After the first issuance, reuse with `template_slug` for all following credentials. |
| **Same template, different background per credential** | `template_slug` or `template_id` **plus** `background_url_override`: `"https://..."`. Layout from template; PDF uses the override URL as background for that issuance only. |

To discover required keys, call:

```bash
GET https://api.hashproof.dev/templates/:slug_or_id/requirements
```

(no auth). Full guide: [docs/TEMPLATES.md](https://github.com/csacanam/hashproof/blob/main/docs/TEMPLATES.md).

### Example: issue with an existing template (reuse)

Use this when the template was already created (e.g. in a previous request with inline `template`). You only send the template reference and the data; no `template` object.

```json
{
  "issuer":   { "display_name": "Acme Corp", "slug": "acme-corp" },
  "platform": { "display_name": "Acme Corp", "slug": "acme-corp" },
  "holder":   { "full_name": "Jane Doe" },
  "context":  { "type": "event", "title": "Expo 2026" },
  "credential_type": "attendance",
  "title": "Certificate of Attendance",
  "template_slug": "acme-expo-2026-v1",
  "values": {
    "holder_name": "Jane Doe",
    "details": "Attended the expo stand."
  }
}
```

### Example: create a template inline (first time only)

Use this the **first time** you want a custom layout. The API creates the template and issues the credential. For every **next** credential with the same layout, use `template_slug` (as in the example above) instead of sending `template` again.

```json
{
  "issuer":   { "display_name": "Acme Corp", "slug": "acme-corp" },
  "platform": { "display_name": "Acme Corp", "slug": "acme-corp" },
  "holder":   { "full_name": "Jane Doe" },
  "context":  { "type": "event", "title": "Expo 2026" },
  "credential_type": "attendance",
  "title": "Certificate of Attendance",
  "template": {
    "slug": "acme-expo-2026-v1",
    "name": "Acme Expo 2026 v1",
    "background_url": "https://your-cdn.com/certificate-bg.png",
    "page_width": 3508,
    "page_height": 2480,
    "fields_json": [
      { "key": "holder_name", "x": 248, "y": 1200, "width": 3012, "required": true, "font_size": 192, "font_color": "#111827", "align": "center" },
      { "key": "details", "x": 716, "y": 1488, "width": 2077, "required": false, "font_size": 84, "font_color": "#111827", "align": "center" }
    ]
  },
  "values": {
    "holder_name": "Jane Doe",
    "details": "For attending Expo 2026."
  }
}
```

QR code: the verification QR is always drawn near the top-right corner. Leave that area empty in your background. [TEMPLATES.md](https://github.com/csacanam/hashproof/blob/main/docs/TEMPLATES.md#qr-placement-design-guideline).

### Read template requirements (optional)

You can fetch the required keys and full `fields_json`:

```bash
GET https://api.hashproof.dev/templates/:template_slug_or_id/requirements
```

For `public` templates: no auth required.

For `private` templates: no auth required (requirements are public).

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

**Errors:** `400` (missing/invalid field, or e.g. template slug already exists), `401` (invalid API key), `402` (payment required — retry with x402, or API key has no credits: `code: "insufficient_credits"`), `403` (entity suspended or wallet not authorized), `500` (server error).

**Verified issuers:** If the issuer is a verified entity, the paying wallet must be in that entity's `authorized_wallets`. HashProof verifies people and organizations; agents use wallets authorized by those entities. To request verification, the human goes to https://hashproof.dev and their entity page (e.g. `/entities/your-slug`). Entity verification costs **$49 USDC** (one-time, via x402).

---

## Verify a credential

```bash
GET https://api.hashproof.dev/verify/:id
```

No payment. Returns status (`active`, `revoked`, `expired`, `not_found`), issuer/platform verification, IPFS URI, and full credential payload. Use the `id` from the issuance response (or from `verification_url`).

**Public verification page:** `https://hashproof.dev/verify/:id`

**Entity status (optional):** `GET https://api.hashproof.dev/entities/:id` — no payment. Returns `status`, `is_verified`, etc. Use `:id` or slug to check if an issuer/platform is verified.

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
