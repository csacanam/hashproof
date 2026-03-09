## HashProof – Next Steps Work Plan

### Recommended execution order

1. **1 – Deploy the smart contract**
2. **2 – End-to-end issuance tests (including on-chain)**
3. **6 – x402 integration with a Celo-compatible facilitator**
4. **3 – Deploy frontend to Vercel**
5. **4 / 4b – Entity verification flow (Organization / Individual)**
6. **8 / 8b / 8c – Auth for verified entities, issuer authorization, wallet checks**
7. **5 – Real verification pipeline on the Verify page**
8. **9 – Decide on verification levels (email / domain / KYB)**
9. **7 / 10 – Getting started + issuance documentation**
10. **11 – Refine the home page**
11. **12 – Publish to Karma and apply to Agents Hackathon**
12. **13 – Explore ERC-8004 integration**

### 1. Deploy the smart contract

- **Goal**: Deploy `CredentialRegistry` to Celo (testnet and mainnet, with identical behavior and config apart from network details).
- **Tasks**:
  - In the **contracts** project, configure RPC URL and deployer private key (e.g. via Foundry `.env` env var `DEPLOYER_PRIVATE_KEY`).
  - Run the deployment script with Foundry (`script/Deploy.s.sol`) and save the deployed address(es) for testnet and mainnet.
  - Then, in the **backend**, set `REGISTRY_CONTRACT_ADDRESS` and `CELO_RPC_URL` in `.env` to point to the deployed contract.
  - Update `contracts/README.md` (Deploy + Verify sections) and this doc with the final network and address mapping.

### 2. End-to-end issuance tests (including on-chain)

- **Goal**: Issue credentials end to end: DB → IPFS → `CredentialRegistry`.
- **Tasks**:
  - Configure `REGISTRY_PRIVATE_KEY` for a funded Celo account (testnet first).
  - Run a series of test issuances (happy path, expiration, intentional failures).
  - Verify for each test:
    - Credential row in `credentials` table.
    - JSON pinned in IPFS with filename `{credentialId}.json` and correct content.
    - Record stored in `CredentialRegistry` keyed by `credentialId`.
    - Verify page reflects correct status (valid / expired / revoked).

### 3. Deploy frontend to Vercel

- **Goal**: Public, stable URL for the verification UI.
- **Tasks**:
  - Create a Vercel project pointing to `frontend/`.
  - Configure `VITE_API_URL` to point to the deployed backend.
  - Set production `BASE_URL` in backend to the Vercel URL.
  - Smoke test `/` and `/verify/:id` on Vercel.

### 4. Entity verification flow (baseline)

- **Goal**: Define and implement how entities get verified (organization / individual).
- **Tasks**:
  - Decide minimal first step (manual review is OK initially).
  - Implement backend endpoints to submit verification requests for entities.
  - Add or reuse an admin view (even Supabase UI at first) to approve / reject.
  - Wire the results into:
    - Entity detail page badges.
    - Issuer / Platform badges on the verification page.

#### 4b. Simplified Entity Verification (Organization / Individual)

- **Concept**: Every entity is either:
  - **Unverified**
  - **Verified Organization** or **Verified Individual**

##### Organization verification

- **Form fields**:
  - Legal name  
  - Public name  
  - Website  
  - Domain  
  - Contact email  
  - Country  
  - Short description  
  - Proof of affiliation or authority (free text / link)  
  - Optional supporting document (file or URL)

- **Minimum acceptable evidence** (any reasonable subset):
  - Institutional email (e.g. `*@org.com`)
  - Official website where the entity appears
  - Simple document (PDF, letter, etc.)
  - LinkedIn company profile
  - Any reasonable proof that:
    - The organization exists
    - The requester represents it

- **Status label**:
  - Before approval: **Unverified**
  - After manual review: **Verified Organization**

##### Individual verification

- **Form fields**:
  - Full name  
  - Public profile or website (personal site, GitHub, LinkedIn, etc.)  
  - Contact email  
  - Country  
  - Short description  
  - Optional ID or professional profile (file or URL)

- **Status label**:
  - Before approval: **Unverified**
  - After manual review: **Verified Individual**

### 5. Real verification pipeline on the Verify page

- **Goal**: Make `/verify/:id` run a real verification pipeline, not just DB status.
- **Verification order**:
  1. **Smart contract**:
     - Check `CredentialRegistry` by `credentialId`.
     - Confirm `cid`, `issuedAt`, `validUntil`, `revokedAt` and derived status.
  2. **IPFS**:
     - Fetch JSON by CID.
     - Validate structure and hash; compare against DB `credential_json`.
  3. **Database**:
     - Use as a source of truth and/or fallback when IPFS or chain is unavailable.

- **Flows to define**:
  - Fully verified: contract + IPFS + DB all agree.
  - Contract only: chain available but IPFS/DB temporarily down (decide behavior).
  - IPFS + DB only: contract not reachable.
  - Invalid: inconsistencies between layers (e.g. different CID or altered JSON).

- **Tasks**:
  - Implement verification logic in backend (new service or extended `/verify/:id`).
  - Return a structured verification report to the frontend (what passed/failed).
  - Update the verify page to show contract/IPFS/DB checks instead of only status.

### 6. x402 integration with a Celo-compatible facilitator

- **Goal**: Use a production-ready x402 facilitator that supports Celo and is trustworthy.
- **Tasks**:
  - Evaluate facilitator options for Celo + x402.
  - Configure facilitator URL and credentials in backend `.env`.
  - Run test payments + issuance (small amounts) and record flows.
  - Document:
    - How to include x402 payment headers.
    - Error behavior when payment is missing or invalid.

### 7. “Getting started” / documentation section

- **Goal**: Clear, concise docs for new users.
- **Tasks**:
  - Add a **Getting Started** doc (e.g. `docs/GETTING-STARTED.md`) covering:
    - How to issue a minimal credential (required fields only).
    - How to add context and extra fields.
    - How to use templates and custom layouts.
    - How IPFS and on-chain registration fit into the flow.
  - Link it from:
    - Root `README.md`
    - Frontend home page.

### 8. Auth for verified entities (authenticated API calls)

- **Goal**: Only a verified entity can issue credentials “as itself” or for authorized issuers.
- **Tasks**:
  - Decide auth mechanism:
    - API keys bound to an entity, or
    - Signed JWTs / wallet signatures.
  - Bind auth credentials to a specific `entity.id`.
  - Enforce in issuance:
    - If no auth → only public, limited usage (or disallow).
    - If auth present → restrict issuer/platform fields to what that entity is allowed to use.
  - Document the process for an entity to obtain and manage its credentials.

#### 8b. Issuer Authorization Between Entities

- **Goal**: Control who can issue credentials on behalf of whom.

- **Concept**:
  - Default: an entity can only issue credentials under its **own** name.
  - To allow a platform or partner to issue “as” another entity, define an explicit **Issuer Authorization Verified** relationship:
    - `issuer_entity_id` – the brand shown on the credential.
    - `authorized_entity_id` – the caller/platform actually making the API request.
    - `status` – `pending` / `approved` / `revoked`.

- **Tasks**:
  - Add `issuer_authorizations` table:
    - `id`, `issuer_entity_id`, `authorized_entity_id`, `status`,
      `created_at`, `approved_at`, `revoked_at`, `notes`.
  - Define approval flow:
    - Owner of `issuer_entity_id` (Verified Organization/Individual) must approve `authorized_entity_id`.
  - Enforce in backend:
    - If authenticated caller’s entity is not the same as `issuer_entity_id`,
      require an `issuer_authorizations` row with `status = 'approved'`.
    - Otherwise, reject with a clear error (“Not authorized to issue on behalf of this issuer”).
  - UI:
    - On entity detail: show which entities are authorized to issue as this entity.
    - Optionally, show on the credential verify page that it was issued via an authorized platform.

#### 8c. Validating that a verified entity is not being impersonated

- **Goal**: Ensure that when a verified entity issues a credential, it is really coming from them (and not an impersonator).

- **Short answer / flow** (example with Peewah issuing for Icesi):
  1. Peewah completes **entity verification** (as an Organization).
  2. Peewah registers one or more **authorized wallets** in HashProof (e.g. `issuing_wallet` on Celo).
  3. For every paid call with x402, the backend receives the **paying wallet address** from the facilitator.
  4. The backend compares this paying wallet with the set of authorized wallets for that entity.
  5. If it matches, Peewah is allowed to issue.
  6. Additionally, the backend checks there is an **Issuer Authorization** from Icesi → Peewah (step 8b).
  7. Only then is Peewah allowed to issue a credential **on behalf of Icesi**.

- **Tasks**:
  - Extend the entity model to store authorized issuing wallets (per network).
  - Integrate with x402/facilitator to reliably read the wallet that paid for the request.
  - Enforce, in the issuance path, that:
    - The authenticated entity is verified.
    - The paying wallet is in that entity’s authorized wallet list.
    - If issuing “as” another entity, an approved Issuer Authorization exists.

### 9. Decide on verification levels (email / domain / KYB)

- **Goal**: Clarify which verification levels we support and how they affect trust.
- **Tasks**:
  - Decide whether to support email + domain + KYB, or start with a subset.
  - Map each level to UI:
    - Verified Organization / Verified Individual badges.
    - Per-level flags or a single combined “verification strength”.
  - Update docs and UI so “verified” has a clear, consistent meaning.

### 10. Documentation: from minimal to advanced issuance

- **Goal**: Step-by-step guide from simplest to advanced credential issuance.
- **Tasks**:
  - Document:
    - Minimal JSON payload for a basic credential.
    - Adding context, extra fields, and templates.
    - Using IPFS + on-chain, and when each is required vs optional.
  - Provide concrete examples (curl, JS snippets) for each scenario.

### 11. Refine the home page

- **Goal**: Home page that clearly explains what HashProof does and how to use it.
- **Tasks**:
  - Update copy to reflect:
    - On-chain registry.
    - IPFS backup.
    - Entity verification.
    - x402 payments.
  - Add links to:
    - Getting Started / docs.
    - Example credential verify URL.
    - Example entity URL.
  - Ensure design is consistent with verify and entity pages.

### 12. Publish to Karma and apply to Agents Hackathon

- **Goal**: Make HashProof visible and apply to the Agents Hackathon.
- **Tasks**:
  - Prepare materials:
    - Short project description.
    - Repo link and live demo link.
    - Screenshots or GIFs of issuance and verification.
  - Publish the project on Karma.
  - Complete the Hackathon application, highlighting:
    - IPFS backup, on-chain registry, entity verification.
    - How agents and automated systems can issue and verify credentials.

### 13. Explore ERC-8004 integration

- **Goal**: Align HashProof with emerging on-chain credential standards, specifically ERC‑8004.
- **Tasks**:
  - Study ERC‑8004 semantics and data model to understand how our current `CredentialRegistry` and credential JSON map to the standard.
  - Decide whether to:
    - Wrap existing registry behavior in an ERC‑8004‑compatible contract, or
    - Extend / refactor the contract to fully implement ERC‑8004.
  - Prototype an ERC‑8004‑compatible deployment on testnet and document:
    - How a HashProof credential corresponds to an ERC‑8004 credential.
    - How verifiers can use existing ERC‑8004 tooling to read and validate HashProof credentials on-chain.
  - Update the verification flow doc to include an “ERC‑8004 compatible” pathway once the integration strategy is confirmed.

