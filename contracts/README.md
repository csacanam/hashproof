# HashProof Credential Registry

Smart contract to register credential hashes on Celo. Only the owner (HashProof) can write.

## Contract

- **CredentialRegistry**: Stores `bytes32` credential hashes. Call `register(credentialHash)` to store, `isRegistered(credentialHash)` to verify.
- The credential hash is the SHA256 of the credential JSON (64 hex chars = 32 bytes).

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

1. Hash the credential JSON: `SHA256(JSON.stringify(canonicalCredential))` → 64 char hex
2. Convert to bytes32: `0x` + hex string
3. Call `registry.register(bytes32(hash))` with the owner wallet
