# HashProof — Work Plan

## ✅ Done

| # | Item |
|---|------|
| 1 | Deploy `CredentialRegistry` to Celo mainnet (`0xFD899A0BbdB5378Cb676305e91Ef01939E3B01ba`) |
| 2 | End-to-end issuance: DB → IPFS (Pinata) → on-chain (Celo) |
| 3 | Deploy frontend to Vercel; SPA routing fix |
| 4 | Entity verification request: form (org / individual), x402 payment, DB insert |
| 5 | Three-layer verification pipeline: contract → IPFS → DB |
| 6 | x402 payments with EOA settler (no Thirdweb billing required) |
| 7 | API and issuance documentation (`API-REFERENCE.md`, `ISSUING-CREDENTIALS.md`, `docs/README.md`) |

---

## 🔲 Pending

### A. Simplify entity verification model in DB

The verification form was simplified to two types: `individual` and `organization`. The current DB still has three separate boolean columns (`email_verified`, `domain_verified`, `kyb_verified`) and a `status` enum (`active`, `suspended`, `blocked`) that no longer maps to this model.

- Decide what `status` should represent now (e.g. `unverified`, `individual_verified`, `organization_verified`, `suspended`)
- Remove or repurpose `email_verified`, `domain_verified`, `kyb_verified` columns
- Update `GET /entities/:id` response and frontend entity page to reflect the new model
- Update `database/README.md` to match

### B. Auth for verified entities (authenticated API calls)

- **Goal**: Only a verified entity can issue credentials "as itself".
- Decide auth mechanism (API keys or wallet signatures bound to `entity.id`).
- Restrict issuance: if auth present, enforce issuer/platform matches the authenticated entity.

### C. Issuer authorization between entities

- **Goal**: Allow one entity (e.g. a platform) to issue on behalf of another.
- Add `issuer_authorizations` table: `issuer_entity_id`, `authorized_entity_id`, `status`.
- Enforce in issuance: if issuer ≠ caller, require approved authorization row.

### D. Verify authorized wallet on issuance

- **Goal**: Confirm the entity issuing a credential is actually who they claim.
- Store authorized wallets per entity (already collected in the verification request form).
- On issuance, compare the x402 paying wallet against the entity's authorized wallets.
- Depends on (B) and (C).

### E. Publish to Karma / Hackathon

- Short description, repo, live demo, screenshots.
- Apply to Agents Hackathon highlighting: IPFS, on-chain registry, entity verification, x402 for agents.

### F. Refine home page

- Update copy to reflect on-chain registry, IPFS, entity verification, and x402.
- Fix the example payload shown (current one is outdated).
- Add links to a live demo credential and entity page.

### G. Explore ERC-8004 integration

- Study ERC-8004 semantics and decide if/how to align `CredentialRegistry` with the standard.
- Prototype on testnet.
