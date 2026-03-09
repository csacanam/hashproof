# HashProof Credential Registry

Smart contract to register credential records on Celo. Only the owner (HashProof) can write.

## Contract

- **CredentialRegistry**: Stores credential status keyed by `credentialId` (UUID string): `{ cid, issuedAt, validUntil, revokedAt }`.

## Commands

```bash
# Build
forge build

# Test
forge test

# Deploy to Celo Alfajores (testnet)
PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url celo-alfajores --broadcast

# Deploy to Celo mainnet
PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url celo --broadcast
```

## Usage from backend

Call `registry.register(credentialId, cid, issuedAt, validUntil)` with the owner wallet.
