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
| A | Simplify entity verification model: new `status` enum (`unverified`, `individual_verified`, `organization_verified`, `suspended`), remove `domain_verified` / `kyb_verified`, update backend + frontend + docs |
| B | Auth for verified entities: x402 paying wallet validated against `entity.authorized_wallets` on issuance; admin approval endpoint populates wallets from verification request payload |
| D | Authorized wallet check on issuance: extract `from` from X-PAYMENT header and reject with 403 if not in entity's authorized wallets |
| C | Issuer authorization between entities: `issuer_authorizations` table; verified platform must have an approved row to issue for a verified issuer; admin endpoint `POST /admin/issuer-authorizations` to manage; issuer's own wallets always bypass the check |

---

## 🔲 Pending

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

### H. Test custom templates

- Issue credentials with custom templates and verify they render correctly on the verify page.
- Document any layout or styling issues and fix them.

### I. Agent compatibility (2026)

- **Done:** Public `skill.md` at `https://hashproof.dev/skill.md`, “I’m an agent” block on home.
- **Optional:** Backend `GET /skill.md`; OpenAPI spec linked from skill; refine copy for agent-only audiences.
