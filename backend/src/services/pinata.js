/**
 * Pinata (IPFS) service for uploading credential JSON.
 * Provides decentralized backup so credentials remain accessible if HashProof is unavailable.
 */

const PINATA_API = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PINATA_UNPIN_API = "https://api.pinata.cloud/pinning/unpin";

/**
 * Upload JSON to IPFS via Pinata.
 * @param {object} json - The JSON object to pin (e.g. credential_json)
 * @param {string} [metadataName] - Optional name for Pinata metadata (e.g. credential id + .json)
 * @returns {Promise<string|null>} The IPFS CID, or null if Pinata is not configured
 */
export async function pinJsonToIpfs(json, metadataName) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt || !jwt.trim()) {
    return null;
  }

  const body = {
    pinataContent: json,
    pinataMetadata: { name: metadataName || "hashproof-credential.json" },
    pinataOptions: { cidVersion: 1 },
  };

  const res = await fetch(PINATA_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pinata upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.IpfsHash ?? null;
}

/**
 * Unpin a CID from Pinata (best-effort cleanup).
 * @param {string} cid
 * @returns {Promise<boolean>} true if unpinned, false if not configured
 */
export async function unpinCid(cid) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt || !jwt.trim()) {
    return false;
  }
  if (!cid) return true;

  const res = await fetch(`${PINATA_UNPIN_API}/${cid}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pinata unpin failed (${res.status}): ${errText}`);
  }

  return true;
}
