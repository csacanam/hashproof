# Credential Creation and Verification Flow – Current State

## 1. Creation (POST /issueCredential)

### 1.1 Input
- **Payload**: issuer, platform, holder, context, template (optional), credential_type, title, values
- **Payment**: x402 (or `SKIP_PAYMENT=true` in dev)

### 1.2 Process (`issue_credential` function)
1. Validates payload
2. Get/create issuer → `entities`
3. Get/create platform → `entities`
4. Get/create holder → `holders`
5. Get/create context → `contexts`
6. Get/create template → `templates` (or uses default `hashproof`)
7. Validates that `values` satisfy required template fields
8. Builds `credential_json` (self-contained):
   - `@context`, `type`, `issuer`, `platform`, `name`, `context`, `credentialSubject`, `issuanceDate`, `expirationDate` (optional)
9. SHA256 hash of JSON (before proof) → `credential_hash`
10. **⚠️ tx_hash**: mock (`gen_random_bytes`) – no real on-chain transaction
11. Adds `proof`: `{ type, txHash, contractAddress, credentialHash }`
12. Inserts into `credentials`

### 1.3 Output
- `id`, `verification_url`, `tx_hash`, `credential_hash`

### Status
| Aspect              | Status | Notes                                              |
|----------------------|--------|----------------------------------------------------|
| Self-contained cred  | ✅     | Includes issuer, platform, name, context, subject  |
| Proof / credentialHash | ✅   | SHA256 hash of JSON                                |
| tx_hash              | ⚠️ Mock | No real on-chain registration                     |
| On-chain registration | ❌ Pending | TODO in SQL                                     |

---

## 2. Verification (GET /verify/:id)

### 2.1 API
1. `getCredentialById(id)` → `credentials` + join `entities` (platform) + `templates` + `contexts`
2. Fallback if platform join fails: query `entities` by `platform_entity_id`
3. Response:
   - `credential` (full JSON)
   - `status` (from DB: active/revoked)
   - `title`, `context_title`, `platform_name` (from JSON or DB for legacy credentials)
   - `id`, `verification_url`, `page_width`, `page_height`, etc.

### 2.2 Frontend
1. Fetch `GET /verify/:id` → data
2. Fetch `GET /verify/:id/pdf` → PDF blob
3. Display data (priority: credential JSON):
   - Recipient: `credentialSubject.holder_name` / `full_name`
   - Credential: `cred.name` / `data.title`
   - Activity: `cred.context?.title` / `data.context_title`
   - Issued by: `cred.issuer.display_name`
   - Issued through: `cred.platform?.display_name` / `data.platform_name`
   - Issued date: `cred.issuanceDate`
   - Credential ID: `id` from URL
   - Status: `data.status`
   - Blockchain Record: link to Celoscan with `proof.txHash`

### Status
| Aspect              | Status | Notes                                            |
|----------------------|--------|--------------------------------------------------|
| Self-contained data  | ✅     | New credentials use JSON only                    |
| Legacy credential fallback | ✅ | API/DB when JSON lacks fields               |
| PDF                  | ✅     | Generated from template + credential_json        |
| Blockchain Record link | ⚠️   | Points to Celoscan; tx_hash is mock, returns 404 |

---

## 3. Central Dependencies

| Resource       | Use                                   | Decentralizable?     |
|----------------|---------------------------------------|----------------------|
| Database       | Resolve id → credential, status, PDF  | No (for now)         |
| credential_json| Source of truth for display claims    | Yes (self-contained) |
| tx_hash        | On-chain proof                        | No (mock)            |

---

## 4. Pending for VC Standard Compliance

1. **Real on-chain registration**
   - Register `credential_hash` on Celo
   - Replace `gen_random_bytes` with actual tx_hash

2. **Verification without DB (optional)**
   - Endpoint that accepts credential JSON (or JWT) and verifies using proof only
   - Status/revocation via revocation list or on-chain check

3. **“View transaction” link**
   - If tx_hash is mock: hide or show “Not available”
   - If real registration: keep link to Celoscan
