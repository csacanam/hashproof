# ERC-8004 registration runbook

HashProof already publishes an ERC-8004-style descriptor at `https://hashproof.dev/metadata.json`, but it is **not registered on-chain**, so no explorer (8004scan, Aigora) indexes it. This runbook registers the agent identity on the canonical Identity Registry.

## Registry

`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` — same vanity address on Celo, Base, Ethereum, Optimism, Arbitrum, Polygon and others. We register on **Celo mainnet** (where the CredentialRegistry lives). Registering on Base too is optional later; the metadata's `registrations` array supports multiple chains.

The wallet that sends `register` becomes the **owner of the identity** (an ERC-721; only the owner can update the URI later). Use the payTo/ops wallet `0x0a25C91209a158D0a4922837cdd590aCe0D13f0d` or whichever wallet should permanently own the HashProof identity. Cost: pennies of CELO gas.

## Steps

**1. Deploy first** — `frontend/public/metadata.json` (already upgraded to the full registration-v1 profile) must be live at `https://hashproof.dev/metadata.json` before registering, since the URI points there.

**2. Register:**

```bash
cast send 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 \
  "register(string)" "https://hashproof.dev/metadata.json" \
  --private-key $OWNER_PRIVATE_KEY \
  --rpc-url https://forno.celo.org
```

**3. Get the assigned agentId** from the tx receipt (the `Transfer` event's tokenId), or:

```bash
cast call 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 \
  "balanceOf(address)(uint256)" $OWNER_ADDRESS --rpc-url https://forno.celo.org
```

**4. Close the circular verification** — add to `frontend/public/metadata.json`:

```json
"registrations": [
  { "agentId": <ID>, "agentRegistry": "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" }
]
```

and create `frontend/public/.well-known/agent-registration.json`:

```json
{
  "registrations": [
    { "agentId": <ID>, "agentRegistry": "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" }
  ]
}
```

**5. Redeploy the frontend.** Because the on-chain `agentURI` is the URL (not inline data), every future metadata change is just an edit + redeploy — no new transaction needed. Only run `setAgentURI(uint256,string)` if the URL itself ever changes.

**6. Verify:** the profile should appear at `https://www.8004scan.io/agents/celo/<ID>` with capabilities, x402 flag and circular verification.
