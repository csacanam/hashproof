/**
 * Issue credential service.
 * Synchronous issuance (option B):
 * - Prepare credential JSON in Postgres (no insert yet)
 * - Pin JSON to IPFS (Pinata)
 * - Register on-chain (wait for mined tx)
 * - Finalize insert into credentials with ipfs_cid + tx_hash
 */

import { supabase } from "../supabase.js";
import { pinJsonToIpfs, unpinCid } from "./pinata.js";
import crypto from "node:crypto";
import { Contract, JsonRpcProvider, Wallet } from "ethers";

const REGISTRY_ABI = [
  "function register(string credentialId, string cid, uint256 issuedAt, uint256 validUntil) external",
];

async function registerOnChain({ credentialId, cid, issuedAt, validUntil }) {
  if (process.env.SKIP_CHAIN === "true") {
    return `0x${crypto.randomBytes(32).toString("hex")}`;
  }

  const rpcUrl = process.env.CELO_RPC_URL;
  const contractAddress = process.env.REGISTRY_CONTRACT_ADDRESS;
  const pk = process.env.REGISTRY_PRIVATE_KEY;

  if (!rpcUrl) throw new Error("CELO_RPC_URL missing");
  if (!contractAddress) throw new Error("REGISTRY_CONTRACT_ADDRESS missing");
  if (!pk) throw new Error("REGISTRY_PRIVATE_KEY missing");

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(pk, provider);
  const registry = new Contract(contractAddress, REGISTRY_ABI, wallet);

  const tx = await registry.register(credentialId, cid, issuedAt, validUntil);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error("On-chain transaction reverted");
  }
  return tx.hash;
}

/**
 * Validate that values satisfy template required keys.
 * Kept for unit tests; actual validation happens in Postgres.
 */
export function validateTemplateValues(fieldsJson, values) {
  const fields = Array.isArray(fieldsJson) ? fieldsJson : [];
  for (const f of fields) {
    if (f.key && f.required === true) {
      const v = values[f.key];
      if (v === undefined || v === null || String(v).trim() === "") {
        throw new Error(`Missing required template value for key: ${f.key}`);
      }
    }
  }
}

/**
 * Execute issuance via Supabase RPC.
 * @param {object} payload - Full issuance payload
 */
export async function executeIssueCredential(payload) {
  const {
    issuer,
    platform,
    holder,
    context,
    template,
    template_id,
    template_slug,
    background_url_override,
    credential_type,
    title,
    expires_at,
    values = {},
  } = payload;

  if (!issuer?.display_name || !issuer?.slug) throw new Error("issuer.display_name and issuer.slug required");
  if (!platform?.display_name || !platform?.slug) throw new Error("platform.display_name and platform.slug required");
  if (!holder?.full_name) throw new Error("holder.full_name required");
  if (!context?.type || !context?.title) throw new Error("context.type and context.title required");
  if (!credential_type || !title) throw new Error("credential_type and title required");

  const hasTemplateId = typeof template_id === "string" && template_id.trim() !== "";
  const hasTemplateSlug = typeof template_slug === "string" && template_slug.trim() !== "";
  const hasInlineTemplate =
    template &&
    typeof template === "object" &&
    typeof template.slug === "string" &&
    template.slug.trim() !== "" &&
    typeof template.name === "string" &&
    template.name.trim() !== "" &&
    typeof template.background_url === "string" &&
    template.background_url.trim() !== "" &&
    Number.isFinite(Number(template.page_width)) &&
    Number.isFinite(Number(template.page_height)) &&
    template.fields_json !== undefined &&
    template.fields_json !== null;

  const templateSelectors = [
    hasTemplateId ? "template_id" : null,
    hasTemplateSlug ? "template_slug" : null,
    hasInlineTemplate ? "template" : null,
  ].filter(Boolean);
  if (templateSelectors.length > 1) {
    throw new Error("Provide only one of template_id, template_slug, template.");
  }

  // Template optional: base template used when none passed

  const baseUrl = process.env.BASE_URL || "https://hashproof.example.com";
  const contractAddressEnv = process.env.REGISTRY_CONTRACT_ADDRESS || undefined;

  const { data, error } = await supabase.rpc("prepare_credential", {
    p_payload: {
      issuer,
      platform,
      holder,
      context,
      template: template || null,
      template_id: template_id || null,
      template_slug: template_slug || null,
      background_url_override: background_url_override || null,
      credential_type,
      title,
      expires_at: expires_at || null,
      values,
    },
    p_base_url: baseUrl,
    ...(contractAddressEnv && { p_contract_address: contractAddressEnv }),
  });

  if (error) {
    throw new Error(error.message);
  }

  const prepared = data?.prepared;
  const credentialId = prepared?.id || data?.id;
  if (!prepared || !credentialId || !prepared.credential_json) {
    throw new Error("prepare_credential returned invalid payload");
  }

  // Enrich proof with chain info at the edge (not hardcoded in SQL)
  const chainId = prepared.chain_id;
  const chainName = prepared.chain_name;
  const contractAddress = process.env.REGISTRY_CONTRACT_ADDRESS || prepared.contract_address;

  const credentialJsonWithProof = {
    ...prepared.credential_json,
    proof: {
      ...(prepared.credential_json.proof || {}),
      type: "HashProofBlockchain",
      contractAddress,
      ...(chainId && { chainId }),
      ...(chainName && { chainName }),
    },
  };

  const cid = await pinJsonToIpfs(credentialJsonWithProof, `${credentialId}.json`);
  if (!cid) {
    throw new Error("IPFS pin failed or PINATA_JWT not configured");
  }

  const issuedAtUnix = Math.floor(Date.now() / 1000);
  const validUntilUnix = prepared.expires_at ? Math.floor(new Date(prepared.expires_at).getTime() / 1000) : 0;

  let txHash;
  try {
    txHash = await registerOnChain({
      credentialId,
      cid,
      issuedAt: issuedAtUnix,
      validUntil: validUntilUnix,
    });
  } catch (chainErr) {
    // Best-effort cleanup: unpin if chain fails so we don't leave orphaned pins
    try {
      await unpinCid(cid);
    } catch (unpinErr) {
      console.warn("[issueCredential] IPFS unpin failed after chain error:", unpinErr.message);
    }
    throw chainErr;
  }

  // Persist only after IPFS + chain succeeded
  const finalPrepared = {
    ...prepared,
    contract_address: contractAddress,
    credential_json: credentialJsonWithProof,
  };

  const { data: finalized, error: finalizeErr } = await supabase.rpc("finalize_credential", {
    p_prepared: finalPrepared,
    p_ipfs_cid: cid,
    p_tx_hash: txHash,
  });

  if (finalizeErr) {
    // If DB insert fails, unpin to avoid leaving content behind without a credential row
    try {
      await unpinCid(cid);
    } catch (unpinErr) {
      console.warn("[issueCredential] IPFS unpin failed after DB error:", unpinErr.message);
    }
    throw new Error(finalizeErr.message);
  }

  return {
    id: credentialId,
    verification_url: `${baseUrl}/verify/${credentialId}`,
    tx_hash: txHash,
    ipfs_cid: cid,
    ipfs_uri: `https://gateway.pinata.cloud/ipfs/${cid}`,
    ...(finalized || {}),
  };
}
