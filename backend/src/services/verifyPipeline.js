/**
 * Verification pipeline.
 *
 * Three independent layers checked in sequence:
 *   1. Blockchain (CredentialRegistry contract) — source of truth for status
 *   2. IPFS (Pinata) — immutable credential JSON backup
 *   3. Database (Supabase) — display metadata (recipient, template, issuer)
 */

import { Contract } from "ethers";
import { getCeloProvider } from "../utils/celoProvider.js";

const REGISTRY_READ_ABI = [
  "function getRecord(string credentialId) view returns (string cid, uint256 issuedAt, uint256 validUntil, uint256 revokedAt)",
];

// In-memory cache for contract reads. Credential state rarely changes (only
// revocation), and at 5-min TTL even a fresh revoke is reflected quickly.
// Dramatically reduces RPC calls for high-traffic /verify/:id endpoint.
const CONTRACT_CACHE_TTL_MS = 5 * 60 * 1000;
const CONTRACT_CACHE_MAX_SIZE = 10000;
const contractCache = new Map();

function getCachedContractRecord(credentialId) {
  const entry = contractCache.get(credentialId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    contractCache.delete(credentialId);
    return null;
  }
  return entry.value;
}

function setCachedContractRecord(credentialId, value) {
  if (contractCache.size >= CONTRACT_CACHE_MAX_SIZE) {
    const firstKey = contractCache.keys().next().value;
    if (firstKey) contractCache.delete(firstKey);
  }
  contractCache.set(credentialId, { value, expiresAt: Date.now() + CONTRACT_CACHE_TTL_MS });
}

export function invalidateContractCache(credentialId) {
  contractCache.delete(credentialId);
}

function deriveStatusFromTimestamps({ issuedAt, validUntil, revokedAt, nowSeconds }) {
  if (!issuedAt || issuedAt === 0) return "unregistered";
  if (revokedAt && revokedAt > 0) return "revoked";
  if (validUntil && validUntil > 0 && nowSeconds > validUntil) return "expired";
  return "active";
}

function normalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }
  if (value && typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    const result = {};
    for (const key of sortedKeys) {
      result[key] = normalizeJson(value[key]);
    }
    return result;
  }
  return value;
}

/**
 * Run the multi-layer verification pipeline for a credential.
 * - Contract (CredentialRegistry)
 * - IPFS (JSON by CID)
 * - Database (credentials row)
 *
 * Returns:
 * - effectiveStatus: "active" | "revoked" | "expired" | "unregistered" | "unknown"
 * - statusSource: "contract" | "database" | "unknown"
 * - report: detailed per-layer information
 */
async function checkContractLayer({ credentialId, nowSeconds }) {
  const result = {
    available: false,
    status: "unknown",
    cid: null,
    issuedAt: null,
    validUntil: null,
    revokedAt: null,
    error: null,
  };

  const contractAddress = process.env.REGISTRY_CONTRACT_ADDRESS;

  if (contractAddress && credentialId) {
    const cached = getCachedContractRecord(credentialId);
    let cid, issuedAt, validUntil, revokedAt;

    if (cached) {
      ({ cid, issuedAt, validUntil, revokedAt } = cached);
    } else {
      try {
        const provider = getCeloProvider();
        const registry = new Contract(contractAddress, REGISTRY_READ_ABI, provider);
        const [c, issuedAtBn, validUntilBn, revokedAtBn] = await registry.getRecord(credentialId);
        cid = c;
        issuedAt = Number(issuedAtBn);
        validUntil = Number(validUntilBn);
        revokedAt = Number(revokedAtBn);
        setCachedContractRecord(credentialId, { cid, issuedAt, validUntil, revokedAt });
      } catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
        return result;
      }
    }

    const status = deriveStatusFromTimestamps({ issuedAt, validUntil, revokedAt, nowSeconds });
    return { available: true, status, cid, issuedAt, validUntil, revokedAt, error: null };
  }

  return result;
}

async function checkIpfsLayer({ cid, dbCredential }) {
  const result = {
    available: false,
    cid: cid ?? dbCredential?.ipfs_cid ?? null,
    status: "unknown",
    matchesDatabaseJson: null,
    json: null,
    error: null,
  };

  const effectiveCid = result.cid;
  if (effectiveCid && typeof fetch === "function") {
    try {
      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${effectiveCid}`);
      if (!res.ok) {
        throw new Error(`IPFS HTTP ${res.status}`);
      }
      const ipfsJson = await res.json();
      result.available = true;
      result.json = ipfsJson;

      if (dbCredential?.credential_json) {
        const dbNorm = normalizeJson(dbCredential.credential_json);
        const ipfsNorm = normalizeJson(ipfsJson);
        const matches = JSON.stringify(dbNorm) === JSON.stringify(ipfsNorm);
        result.matchesDatabaseJson = matches;
        result.status = matches ? "ok" : "mismatch";
      } else {
        result.matchesDatabaseJson = null;
        result.status = "unknown";
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }
  }

  return result;
}

export async function runVerificationPipeline({ credentialId, dbCredential }) {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const report = {
    contract: {
      available: false,
      status: "unknown",
      cid: null,
      issuedAt: null,
      validUntil: null,
      revokedAt: null,
      error: null,
    },
    ipfs: {
      available: false,
      cid: dbCredential?.ipfs_cid ?? null,
      status: "unknown",
      matchesDatabaseJson: null,
      error: null,
    },
    database: {
      available: !!dbCredential,
      status: "unknown",
    },
  };

  // 2) Contract layer (CredentialRegistry)
  report.contract = await checkContractLayer({ credentialId, nowSeconds });

  // 3) IPFS layer – compare JSON from CID with DB credential_json
  const cidForIpfs = report.contract.cid || dbCredential?.ipfs_cid || null;
  report.ipfs = await checkIpfsLayer({ cid: cidForIpfs, dbCredential });

  // Decide effective status and source
  // Contract is the only source of truth for status.
  let effectiveStatus = "unknown";
  let statusSource = "unknown";

  if (report.contract.available && report.contract.status !== "unknown") {
    effectiveStatus = report.contract.status;
    statusSource = "contract";
  }

  return { effectiveStatus, statusSource, report };
}

export async function verifyContractOnly({ credentialId }) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const contract = await checkContractLayer({ credentialId, nowSeconds });
  return { contract };
}

export async function verifyIpfsOnly({ credentialId, dbCredential }) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const contract = await checkContractLayer({ credentialId, nowSeconds });
  const cidForIpfs = contract.cid || dbCredential?.ipfs_cid || null;
  const ipfs = await checkIpfsLayer({ cid: cidForIpfs, dbCredential });
  return { contract, ipfs };
}

