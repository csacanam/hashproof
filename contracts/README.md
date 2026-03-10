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
| Celo mainnet | `0xFD899A0BbdB5378Cb676305e91Ef01939E3B01ba` |

## Usage from backend

Call `registry.register(credentialId, cid, issuedAt, validUntil)` with the owner wallet.
