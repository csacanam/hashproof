/**
 * Verification pipeline.
 *
 * Three independent layers checked in sequence:
 *   1. Blockchain (CredentialRegistry contract) — source of truth for status
 *   2. IPFS (Pinata) — immutable credential JSON backup
 *   3. Database (Supabase) — display metadata (recipient, template, issuer)
 */

import { Contract, JsonRpcProvider } from "ethers";

const REGISTRY_READ_ABI = [
  "function getRecord(string credentialId) view returns (string cid, uint256 issuedAt, uint256 validUntil, uint256 revokedAt)",
];

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

  const rpcUrl = process.env.CELO_RPC_URL;
  const contractAddress = process.env.REGISTRY_CONTRACT_ADDRESS;

  if (rpcUrl && contractAddress && credentialId) {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const registry = new Contract(contractAddress, REGISTRY_READ_ABI, provider);
      const [cid, issuedAtBn, validUntilBn, revokedAtBn] = await registry.getRecord(credentialId);

      const issuedAt = Number(issuedAtBn);
      const validUntil = Number(validUntilBn);
      const revokedAt = Number(revokedAtBn);

      const status = deriveStatusFromTimestamps({
        issuedAt,
        validUntil,
        revokedAt,
        nowSeconds,
      });

      return {
        available: true,
        status,
        cid,
        issuedAt,
        validUntil,
        revokedAt,
        error: null,
      };
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }
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

