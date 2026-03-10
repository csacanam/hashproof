# x402 + Thirdweb — Lessons Learned

This document captures the real problems we hit integrating x402 payments and how we solved them. Not in the official docs anywhere.

---

## Context

We wanted paid API endpoints: a client pays $0.10 USDC per call, no API key, no subscription. The x402 protocol does this — the server returns `402 Payment Required`, the client signs an off-chain authorization, resends, and gets access.

We used Thirdweb as the x402 stack because it has both a server-side SDK (`thirdweb/x402`) and a React hook (`useFetchWithPayment`) that handles the full flow in the browser.

---

## Problem 1 — Thirdweb's facilitator requires billing on mainnet

**What happened:**  
We set up Thirdweb's facilitator (their hosted service that settles payments on your behalf). It worked on testnet. On mainnet it threw:

```
Mainnets not enabled for this account, please enable billing
```

**Why:**  
Thirdweb's facilitator uses Account Abstraction (ERC-4337 bundler + paymaster) to submit transactions. That infrastructure requires a paid plan on mainnet.

**How we solved it:**  
We stopped using the Thirdweb facilitator for settlement entirely. Instead we wrote `settleEOA.js` — a plain EOA wallet (`SETTLER_PRIVATE_KEY`) that calls `USDC.transferWithAuthorization()` directly using ethers.js. Same result, no billing required. The client is still gasless (they only sign off-chain). We only kept Thirdweb for *formatting* the `402` challenge header, which is free.

**Key insight:**  
Thirdweb is two separate things: (1) a format/spec for the 402 challenge, and (2) an optional hosted settlement service. You can use (1) without (2).

---

## Problem 2 — Frontend: "402 response has no usable x402 payment requirements"

**What happened:**  
`useFetchWithPayment` on the frontend kept throwing this error even though the server was returning a valid 402 response with a `PAYMENT-REQUIRED` header.

**Root cause — two separate bugs:**

### Bug A: CORS was blocking the custom header

The browser couldn't read the `PAYMENT-REQUIRED` header because it wasn't listed in `Access-Control-Expose-Headers`. The hook received the 402 but couldn't read the header, so it fell back to parsing the JSON body, which was empty.

**Fix:** Added to Express CORS config:
```js
app.use(cors({
  origin: true,
  exposedHeaders: ["PAYMENT-REQUIRED", "payment-required", "X-PAYMENT-RESPONSE"],
}));
```

As a safety net, we also include the full x402 structure in the JSON body of the 402 response so the hook can parse it even if headers are blocked.

### Bug B: Checksummed asset address

Thirdweb's `settlePayment()` returns the USDC address in checksummed format (mixed case, e.g. `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`). The `useFetchWithPayment` hook on the client expected it in **lowercase**. This mismatch caused the hook to reject the payment requirement silently.

**Fix:** After decoding the `PAYMENT-REQUIRED` header, we lowercase the `asset` field before re-encoding:
```js
if (typeof acc.asset === "string") acc.asset = acc.asset.toLowerCase();
```

**Key insight:**  
When `useFetchWithPayment` says "no usable x402 payment requirements", it doesn't mean the 402 response is missing — it means it couldn't parse it. Always check: (1) is the header exposed via CORS? (2) is the asset address lowercase?

---

## Problem 3 — `@x402/fetch` and Thirdweb's `wrapFetchWithPayment` are incompatible

**What happened:**  
We tried to test payments from a Node.js script. We first used `@x402/fetch` (the CDP/coinbase library), which threw:

```
Cannot convert undefined to a BigInt
```

**Why:**  
`@x402/fetch` (from `@x402/evm`) expects `extra.chainId` and `extra.verifyingContract` inside the `accepts[]` entry. Thirdweb's `settlePayment` formats those fields differently — they live inside the EIP-712 domain, not in `extra`. The two implementations are incompatible.

**Fix:**  
Use `wrapFetchWithPayment` from `thirdweb/x402` for Node.js clients. If your server uses the Thirdweb format, your clients must also use the Thirdweb format.

---

## Problem 4 — `wrapFetchWithPayment` expects a wallet object, not an account

**What happened:**  
`wrapFetchWithPayment(fetch, client, account)` threw:

```
wallet.getAccount is not a function
wallet.getChain is not a function
```

**Why:**  
`privateKeyToAccount()` returns an `account` (signer). But `wrapFetchWithPayment` expects a `wallet` object with `getAccount()`, `getChain()`, and `switchChain()` methods — a different abstraction.

**Fix:**  
Wrap the account in a wallet-like object:
```js
const account = privateKeyToAccount({ client, privateKey });
let currentChain = base;
const wallet = {
  getAccount: () => account,
  getChain: () => currentChain,
  switchChain: async (chain) => { currentChain = chain; },
};
const fetchWithPayment = wrapFetchWithPayment(fetch, client, wallet);
```

---

## Final architecture

```
CLIENT                          SERVER                        BLOCKCHAIN
useFetchWithPayment             thirdwebPayment.js            USDC contract (Base/Celo)
(Thirdweb React hook)           (Express middleware)

  │                                │
  │── POST /endpoint ──────────────►│
  │                                │ settlePayment(null)
  │                                │ ← format challenge only, no tx
  │◄─ 402 PAYMENT-REQUIRED ────────│
  │   (CORS-exposed header)        │
  │   (also in JSON body)          │
  │                                │
  │ signs EIP-3009 off-chain       │
  │ (no gas)                       │
  │                                │
  │── POST + X-PAYMENT ────────────►│
  │                                │ settleEOA.js
  │                                │── transferWithAuthorization() ──► USDC
  │                                │   SETTLER_PRIVATE_KEY pays gas    contract
  │                                │◄── tx confirmed ─────────────────│
  │◄─ 200/201 ─────────────────────│
```

**Thirdweb is only used for:**
- Formatting the `PAYMENT-REQUIRED` challenge header (server)
- `useFetchWithPayment` hook (browser client)
- `wrapFetchWithPayment` (Node.js client / agent)

**Thirdweb is NOT used for:**
- Settlement (we use our own EOA via ethers.js)
- Bundler / paymaster / Account Abstraction (requires billing)

---

## Summary of fixes

| Problem | Fix |
|---------|-----|
| Thirdweb facilitator requires billing on mainnet | Replaced with custom EOA settler (`settleEOA.js`) using ethers.js |
| `useFetchWithPayment` can't read the 402 header | Added `PAYMENT-REQUIRED` to `Access-Control-Expose-Headers` in CORS config |
| Hook silently rejects the payment requirement | Lowercase the `asset` address in the `PAYMENT-REQUIRED` header before sending |
| `@x402/fetch` incompatible with Thirdweb format | Use `wrapFetchWithPayment` from `thirdweb/x402` for Node.js clients |
| `privateKeyToAccount` is not a wallet object | Wrap account in a wallet-like object with `getAccount`, `getChain`, `switchChain` |
