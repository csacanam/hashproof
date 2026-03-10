# HashProof Credential Registry

Smart contract that stores credential records on Celo. Only the owner (HashProof) can write.

## Contract

**CredentialRegistry** — stores credential status keyed by `credentialId` (UUID string): `{ cid, issuedAt, validUntil, revokedAt }`.

## Build & test

```bash
forge build
forge test
```

## Deploy

Set `DEPLOYER_PRIVATE_KEY` (wallet that pays gas and becomes contract owner). Either inline or in a `.env` file in `contracts/` — Foundry loads it automatically.

```bash
# Testnet (Celo Alfajores)
DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
  --rpc-url https://alfajores-forno.celo-testnet.org \
  --broadcast

# Mainnet (Celo)
DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
  --rpc-url https://forno.celo.org \
  --broadcast
```

## After deploying a new contract

1. **Verify on Celoscan** (see below).
2. **Backend** — set `REGISTRY_CONTRACT_ADDRESS` to the new address:
   - Local: `backend/.env`
   - Production (DigitalOcean): App → Settings → Environment Variables → add or update `REGISTRY_CONTRACT_ADDRESS` → redeploy.
3. **Frontend** — update the Celoscan link in `frontend/src/pages/Home.jsx` (hero stats "Verify onchain ↗") if the contract address changed. Redeploy (Vercel auto-deploys on push).

## Verify on Celoscan

```bash
CELOSCAN_API_KEY=your_key forge verify-contract <CONTRACT_ADDRESS> src/CredentialRegistry.sol:CredentialRegistry --chain celo --watch
```

Get an API key at [celoscan.io/myapikey](https://celoscan.io/myapikey).

## Deployed contracts

| Network | Address |
|---------|---------|
| Celo mainnet | `0x7a1B759A602Aba72a70f99Dffd0a386d7504ce9B` |

## Usage from backend

Call `registry.register(credentialId, cid, issuedAt, validUntil)` with the owner wallet.
