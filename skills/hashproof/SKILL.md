---
name: hashproof
description: Issue verifiable credentials for $0.10 USDC via x402. Each credential is registered on Celo, pinned to IPFS, and comes with a PDF with a QR code anyone can scan to verify for free.
metadata: {"api_base": "https://api.hashproof.dev", "payment": "x402", "currency": "USDC", "homepage": "https://hashproof.dev"}
---

# HashProof

Issue verifiable credentials with one API call. $0.10 USDC per credential via x402. No account, no API key. Each credential is registered on Celo, pinned to IPFS, and comes with a PDF with a QR code anyone can scan to verify for free.

**Base URL:** `https://api.hashproof.dev`
**Docs:** `https://hashproof.dev/docs`

**IMPORTANT:** Never invent, guess, or fabricate any data — names, slugs, dates, field values, template positions, or anything else. If the human hasn't provided it, ask. If an answer is ambiguous, ask a follow-up question. Do NOT fill in placeholders with made-up values.

---

## Two concepts you need to understand

### Template = layout definition

A template defines **where and how** text is drawn on the PDF: page size, field positions (x, y), font sizes, colors, alignment, bold/italic. Think of it as a form layout.

A template does NOT include the background image. The background is a separate parameter.

### Background = the image behind the text

The background is a PNG or JPG image URL that fills the entire PDF page. The template's fields are drawn on top of it. You can:
- Use the template's default background (set when the template was created)
- Override it per credential with `background_url_override`

### Preview before issuing

Before issuing real credentials, you or your human can preview how the certificate looks:

```
https://hashproof.dev/preview/:template_slug?background_url=URL&holder_name=John+Doe&details=Some+text
```

This generates a PDF with a "PREVIEW" watermark — no cost, no blockchain, no registration. Use it to check that the background image and field positions look correct.

When using preview: share the URL with your human and **wait for their approval** before issuing the real credential.

---

## Quick start

### Step 1 — Ask your human these questions

Before you do anything, ask your human ALL of these. Do not skip any. Do not assume defaults.

1. **Who is receiving this credential?** Exact full name to print on the certificate.
2. **What is it for?** Event name, course title, or reason for the credential.
3. **Who is issuing it?** Organization or person name and a URL-safe slug (e.g. "Acme Corp" → `acme-corp`). This appears as the issuer on the credential.
4. **What type of event/program is this?** Pick one: `event`, `course`, `diploma`, `training`, `certification`, `membership`, `other`.
5. **What type of credential?** Pick one: `attendance` (they showed up), `completion` (they finished), `achievement` (they accomplished something), `participation` (they took part), `membership` (they belong), `certification` (they are certified).
6. **How to pay?** Do they have a wallet with USDC on Base or Celo (x402), or an API key from HashProof?
7. **Do they want a custom design?** If yes, they need to provide a template slug or create one. If no, the default HashProof template is used.

### Step 2 — Call the API

```
POST https://api.hashproof.dev/issueCredential
Content-Type: application/json
```

Body (default template — replace ALL placeholders with real values from Step 1):

```json
{
  "issuer":   { "display_name": "ISSUER_NAME", "slug": "issuer-slug" },
  "platform": { "display_name": "ISSUER_NAME", "slug": "issuer-slug" },
  "holder":   { "full_name": "HOLDER_FULL_NAME" },
  "context":  { "type": "CONTEXT_TYPE", "title": "EVENT_OR_COURSE_TITLE" },
  "credential_type": "CREDENTIAL_TYPE",
  "title": "Certificate of CREDENTIAL_TYPE",
  "values": {
    "holder_name": "HOLDER_FULL_NAME",
    "details": "SHORT_DESCRIPTION_FROM_HUMAN"
  }
}
```

**About issuer vs platform:**
- `issuer` = the organization or person granting the credential (e.g. a university, a company).
- `platform` = the system that manages the issuance (e.g. an event platform, a learning management system).
- If your human is issuing directly (not through a third-party platform), set both to the same organization.
- If they are issuing through a platform (e.g. "Acme Corp issues through Peewah"), set `issuer` to "Acme Corp" and `platform` to "Peewah".

**About holder.full_name vs values.holder_name:**
- `holder.full_name` is stored in the credential metadata (used for verification and search).
- `values.holder_name` is what gets printed on the PDF certificate.
- They should almost always be the same value. Always set both.

### Step 3 — Share the result

The response includes `verification_url`. Send it to your human and explain:
- The credential is live and registered on the blockchain.
- Anyone can open that URL and verify it.
- The PDF can be downloaded from that same page.
- The QR code on the PDF points to that URL.

```json
{
  "id": "a1b2c3d4-...",
  "verification_url": "https://hashproof.dev/verify/a1b2c3d4-...",
  "tx_hash": "0xabc...",
  "ipfs_cid": "bafybeig...",
  "ipfs_uri": "https://gateway.pinata.cloud/ipfs/bafybeig..."
}
```

---

## Authentication

There are two ways to pay. Ask your human which one they use.

### Option A — API key (simplest for agents)

For organizations that purchase prepaid credits. One header, no wallet, no SDK.

```bash
curl -X POST https://api.hashproof.dev/issueCredential \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{ ... }'
```

Each issuance deducts 1 credit. Contact `hi@hashproof.dev` to get an API key.

### Option B — Pay with crypto (x402)

The API returns `402 Payment Required` with payment requirements. An x402-compatible client signs a USDC authorization (no gas on your side) and retries automatically.

Requirements:
- A wallet with at least **0.10 USDC** on **Base** or **Celo**
- An x402-compatible SDK (see examples below)

#### How x402 works (protocol level)

1. You POST to the API without any payment header.
2. The API responds `402` with a `PAYMENT-REQUIRED` header (base64-encoded JSON). This contains `accepts[]` — one entry per supported network with: `network`, `asset` (USDC address), `maxAmountRequired`, `payTo`, and `extra` (EIP-3009 signing params).
3. Your client picks a network it has USDC on, signs a `TransferWithAuthorization` (EIP-3009) for the required amount, and retries the same POST with the signed payload in an `X-PAYMENT` header.
4. The server verifies and settles the payment on-chain, then returns the credential.

Any SDK that implements this flow will work. Here are two known options:

#### Example A: Thirdweb SDK

```bash
npm install thirdweb
```

```js
import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { privateKeyToAccount } from "thirdweb/wallets";
import { celo } from "thirdweb/chains"; // or: import { base } from "thirdweb/chains"

const client  = createThirdwebClient({ clientId: "YOUR_THIRDWEB_CLIENT_ID" });
const account = privateKeyToAccount({ client, privateKey: process.env.PRIVATE_KEY });

let currentChain = celo;
const wallet = {
  getAccount:  () => account,
  getChain:    () => currentChain,
  switchChain: async (chain) => { currentChain = chain; },
};

const fetchWithPayment = wrapFetchWithPayment(fetch, client, wallet);

const res = await fetchWithPayment("https://api.hashproof.dev/issueCredential", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const data = await res.json();
console.log(data.verification_url);
```

Requires a free Thirdweb client ID from https://thirdweb.com/dashboard.

#### Example B: @x402/fetch + @x402/evm

```bash
npm install @x402/fetch @x402/evm viem
```

```js
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:42220", // Celo. Use "eip155:8453" for Base
      client: new ExactEvmScheme(account),
    },
  ],
});

const res = await fetchWithPayment("https://api.hashproof.dev/issueCredential", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const data = await res.json();
console.log(data.verification_url);
```

Both SDKs handle the 402 → sign → retry flow automatically. You do NOT need to handle 402 responses manually.

**If neither SDK works**, implement the protocol manually: parse the base64 `PAYMENT-REQUIRED` header, sign a `TransferWithAuthorization` (EIP-3009) using the params in `accepts[].extra`, and resend with the `X-PAYMENT` header. See https://www.x402.org for the full spec.

### Rate limits

- Requests **with valid payment** (x402 or API key): **60 requests/minute**
- Requests **without payment** (e.g. failed x402, missing API key): **10 requests/minute**

For bulk issuance, add a **2-second delay** between calls to stay well within limits.

---

## Templates

### Which option to use

| Scenario | What to send |
|----------|-------------|
| **Default certificate** (quick start) | Omit template fields. Use `values.holder_name` and optionally `values.details`. |
| **Existing template** | `"template_slug": "my-template"`. Provide `values` for each required field. |
| **New custom template** (first time) | `"template": { slug, name, background_url, page_width, page_height, fields_json }`. After this, reuse with `template_slug`. |
| **Same template, different background** | `"template_slug": "my-template"` + `"background_url_override": "https://..."` |

Send **only one** of `template_slug`, `template_id`, or `template`. Sending more than one returns `400`.

### Using an existing template

If your human says "use the template I already have" or gives you a template slug, **always call the requirements endpoint first**:

```
GET https://api.hashproof.dev/templates/:slug/requirements
```

This tells you exactly which `values` keys are required. Never guess the required fields — always check.

### Discover required fields

```
GET https://api.hashproof.dev/templates/:slug_or_id/requirements
```

No auth required. Returns `required_keys` and `fields_json` with positions, sizes, and styles. **Always call this** when using an existing template so you know exactly which `values` keys to provide.

### Creating a template inline

When your human provides a background image and field positions, include the `template` object inside the full request body:

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
    "background_url": "https://cdn.example.com/certificate-bg.png",
    "page_width": 3508,
    "page_height": 2480,
    "fields_json": [
      { "key": "holder_name", "x": 248, "y": 1200, "width": 3012, "required": true, "font_size": 192, "font_color": "#1a1a2e", "align": "center" },
      { "key": "details", "x": 716, "y": 1488, "width": 2077, "font_size": 84, "font_color": "#555555", "align": "center" }
    ]
  },
  "values": {
    "holder_name": "Jane Doe",
    "details": "For attending Expo 2026."
  }
}
```

Important:
- `page_width` and `page_height` must match the background image dimensions (in pixels).
- `x`, `y`, `width` use the same units as the page.
- The QR code is drawn automatically in the top-right corner. Leave that area empty in the background.
- Do NOT invent field positions — always ask your human for the exact coordinates or use the preview to verify.

**If the human wants a custom template:** They MUST provide the background image URL AND the field coordinates (x, y, width, font_size for each field). You cannot calculate or estimate these values — they depend entirely on the visual design of the background image. If they don't know the coordinates, suggest they use the preview page to test different positions.

### Preview a template

Before issuing, generate a preview to check the layout:

```
https://hashproof.dev/preview/:slug?background_url=URL&holder_name=John+Doe
```

Or call the API directly:

```
POST https://api.hashproof.dev/templates/:slug/preview
Content-Type: application/json

{
  "background_url": "https://cdn.example.com/bg.png",
  "fields": { "holder_name": "John Doe", "details": "Test text" },
  "locale": "en"
}
```

Returns a PDF with a watermark. No cost, nothing is registered. Share the preview URL with your human and wait for confirmation before issuing the real credential.

---

## Request body reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `issuer.display_name` | string | yes | Name of the issuing organization |
| `issuer.slug` | string | yes | URL-safe identifier (e.g. `acme-corp`). Lowercase, hyphens, no spaces. |
| `platform.display_name` | string | yes | Name of the platform managing issuance |
| `platform.slug` | string | yes | URL-safe identifier |
| `holder.full_name` | string | yes | Full name of the credential recipient |
| `context.type` | enum | yes | `event`, `course`, `diploma`, `training`, `certification`, `membership`, `other` |
| `context.title` | string | yes | Name of the event, course, or program |
| `credential_type` | enum | yes | `attendance`, `completion`, `achievement`, `participation`, `membership`, `certification` |
| `title` | string | yes | Title printed on the credential |
| `values` | object | yes | Key-value pairs for template fields (e.g. `holder_name`, `details`) |
| `template_slug` | string | no | Slug of an existing template |
| `template_id` | UUID | no | UUID of an existing template |
| `template` | object | no | Inline template definition (create-only) |
| `background_url_override` | string | no | Override background for this credential only |
| `issuer_entity_id` | UUID | no | Verified entity ID (shows verified badge) |
| `platform_entity_id` | UUID | no | Platform entity ID |
| `expires_at` | ISO 8601 | no | Expiration date. `null` = never expires |

---

## Verify a credential

```
GET https://api.hashproof.dev/verify/:id
```

Free. No auth. Returns `status` (`active`, `revoked`, `expired`, `not_found`), issuer/platform verification, IPFS URI, and full credential data.

**Public page:** `https://hashproof.dev/verify/:id`

---

## Handling errors

| Code | Meaning | What to do |
|------|---------|------------|
| `400` | Missing or invalid field | Read the error message — it tells you which field is wrong. Fix and retry. |
| `401` | Invalid API key | Ask your human to check their API key. |
| `402` | Payment required or no credits left | If using x402: the SDK handles this automatically. If using API key: the key has no credits left — tell your human to purchase more. |
| `403` | Entity suspended or wallet not authorized | The issuer entity is suspended, or the wallet paying is not in the entity's authorized wallets. Tell your human to check their entity status. |
| `500` | Server error | Something went wrong on HashProof's side. Wait a moment and retry once. If it persists, report it. |

---

## Wallet setup (only if paying with x402)

If your human doesn't have a wallet yet:

1. Generate a new dedicated EVM wallet (do NOT use your human's main wallet).
2. **NEVER display the private key in chat.** Write it directly to a `.env` file.
3. Show only the **address** to your human.
4. Ask them to fund it with at least **0.10 USDC** on **Base** or **Celo**.
5. Once funded, proceed with x402.

Supported networks:

| Network | Chain ID | USDC address |
|---------|----------|-------------|
| Base | `8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Celo | `42220` | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |

Public RPCs: Base `https://mainnet.base.org` / Celo `https://forno.celo.org`

Security: Only send payment authorizations to `https://api.hashproof.dev`. Never reuse your human's main wallet. Fund with the minimum needed.

---

## Verification model

HashProof verifies **issuers** (people and organizations), not agents. Verified issuers register **authorized wallets**. Agents that pay with those wallets issue credentials on behalf of the issuer.

Entity verification costs **$49 USDC** (one-time). The human requests it at `https://hashproof.dev/entities/:slug`.
