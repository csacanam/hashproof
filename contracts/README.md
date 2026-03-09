# HashProof Credential Registry

Smart contract to register credential records on Celo. Only the owner (HashProof) can write.

## Contract

- **CredentialRegistry**: Stores credential status keyed by `credentialId` (UUID string): `{ cid, issuedAt, validUntil, revokedAt }`.

## Deploy

```bash
# Build & test
forge build
forge test

# Deploy to Celo Alfajores (testnet)
DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
  --rpc-url https://alfajores-forno.celo-testnet.org \
  --broadcast

# Deploy to Celo mainnet
DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
  --rpc-url https://forno.celo.org \
  --broadcast

# Deploy using a .env file (recommended)
# .env (NOT committed to git):
# DEPLOYER_PRIVATE_KEY=0x...
forge script script/Deploy.s.sol \
  --rpc-url https://alfajores-forno.celo-testnet.org \
  --broadcast
```

After each deploy, note the address printed by the script:

- `CredentialRegistry deployed at: 0x...`
- `Owner: 0x...`

Use those addresses in the backend `.env` as `REGISTRY_CONTRACT_ADDRESS` and in docs.

## Verify the contract on Celoscan

You can verify the deployed contract in two ways:

1. **Using the Celoscan UI (recommended, works for testnet and mainnet)**  
   - Go to the contract address on Celoscan (Celo mainnet or Alfajores).  
   - Click **“Verify and Publish”**, select Solidity (0.8.19), optimizer on, and paste the flattened `CredentialRegistry.sol`.  
   - Confirm that the verified source matches the deployed bytecode.

2. **Using Foundry (forge verify-contract) – example for mainnet**  
   When Celoscan/Etherscan support Celo mainnet in the v2 API and you have a Celoscan API key:

```bash
export CELOSCAN_API_KEY=...

# Example for Celo mainnet (chain-id 42220, when supported)
forge verify-contract \
  --chain-id 42220 \
  --compiler-version v0.8.19+commit.7dd6d404 \
  <DEPLOYED_MAINNET_ADDRESS> \
  src/CredentialRegistry.sol:CredentialRegistry \
  --etherscan-api-key $CELOSCAN_API_KEY
```

Note: At the time of writing, verification for Alfajores via `forge verify-contract` may fail due to missing chain support in the Etherscan v2 API. In that case, use the Celoscan UI flow above.

## Usage from backend

Call `registry.register(credentialId, cid, issuedAt, validUntil)` with the owner wallet.
