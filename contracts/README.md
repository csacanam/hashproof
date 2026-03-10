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

After deploy, note the printed address and update `REGISTRY_CONTRACT_ADDRESS` in `backend/.env`.

## Verify on Celoscan

Go to the contract address on [Celoscan](https://celoscan.io), click **Verify and Publish**, select Solidity 0.8.19 with optimizer on, and paste the flattened `CredentialRegistry.sol`.

## Deployed contracts

| Network | Address |
|---------|---------|
| Celo mainnet | `0x7a1B759A602Aba72a70f99Dffd0a386d7504ce9B` |

## Usage from backend

Call `registry.register(credentialId, cid, issuedAt, validUntil)` with the owner wallet.
