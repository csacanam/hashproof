#!/usr/bin/env node
/**
 * HashProof MCP server — issue verifiable credentials from any MCP client.
 *
 * Tools:
 *   - get_template_requirements  (free)   → required fields for a template
 *   - preview_template           (free)   → watermarked PDF from an INLINE template (iterate positions)
 *   - issue_credential           (paid)   → $0.10 USDC via x402, or 1 credit via API key
 *   - verify_credential          (free)   → 3-layer verification of an issued credential
 *
 * Config (env):
 *   HASHPROOF_API_BASE            default https://api.hashproof.dev
 *   HASHPROOF_API_KEY             prepaid API key (preferred if set)
 *   HASHPROOF_WALLET_PRIVATE_KEY  EVM key with USDC for x402 (never logged)
 *   HASHPROOF_X402_NETWORK        "base" (default) or "celo"
 */

import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.HASHPROOF_API_BASE || "https://api.hashproof.dev";

// ---------------------------------------------------------------- payment
let paidFetch = null;

async function getPaidFetch() {
  if (paidFetch) return paidFetch;

  const apiKey = process.env.HASHPROOF_API_KEY;
  if (apiKey) {
    paidFetch = (url, init = {}) =>
      fetch(url, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${apiKey}` },
      });
    return paidFetch;
  }

  const pk = process.env.HASHPROOF_WALLET_PRIVATE_KEY;
  if (pk) {
    const { wrapFetchWithPaymentFromConfig } = await import("@x402/fetch");
    const { ExactEvmScheme } = await import("@x402/evm");
    const { privateKeyToAccount } = await import("viem/accounts");
    const network =
      (process.env.HASHPROOF_X402_NETWORK || "base").toLowerCase() === "celo"
        ? "eip155:42220"
        : "eip155:8453";
    const account = privateKeyToAccount(
      pk.startsWith("0x") ? pk : `0x${pk}`,
    );
    paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
      schemes: [{ network, client: new ExactEvmScheme(account) }],
    });
    return paidFetch;
  }

  throw new Error(
    "No payment method configured. Set HASHPROOF_API_KEY (prepaid credits) or HASHPROOF_WALLET_PRIVATE_KEY (USDC on Base or Celo, x402).",
  );
}

// ---------------------------------------------------------------- helpers
function text(t) {
  return { content: [{ type: "text", text: typeof t === "string" ? t : JSON.stringify(t, null, 2) }] };
}

function errorText(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

// ---------------------------------------------------------------- server
const server = new McpServer({ name: "hashproof", version: "0.1.1" });

server.tool(
  "get_template_requirements",
  "Get the required field keys and layout definition of an existing HashProof template. Free, no auth. Always call this before issuing with a template_slug you didn't create in this session.",
  { template_ref: z.string().describe("Template slug or UUID") },
  async ({ template_ref }) => {
    const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(template_ref)}/requirements`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return errorText(`HTTP ${res.status}: ${body.error || "request failed"}`);
    return text(body);
  },
);

server.tool(
  "preview_template",
  "Render a watermarked preview PDF from an INLINE template definition — free, nothing stored, no payment. Use this to iterate field positions (x, y, width, font_size) until the layout is right, then show the final PDF to the human for approval before issuing. page_width/page_height MUST match the background image's pixel dimensions. The PDF is written to a local file; if you can read PDFs, inspect it and adjust yourself.",
  {
    background_url: z.string().url().optional().describe("Public URL of the background image (PNG/JPG)"),
    page_width: z.number().describe("Page width in px — must match the background image"),
    page_height: z.number().describe("Page height in px — must match the background image"),
    fields_json: z
      .array(z.record(z.any()))
      .describe('Field definitions, e.g. [{"key":"holder_name","x":248,"y":1200,"width":3012,"font_size":192,"align":"center"}]'),
    values: z.record(z.string()).describe('Sample values, e.g. {"holder_name":"Jane Doe"}'),
    locale: z.enum(["en", "es"]).optional(),
    output_path: z.string().optional().describe("Where to save the PDF (default: temp file)"),
  },
  async ({ output_path, ...body }) => {
    const res = await fetch(`${API_BASE}/template-previews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return errorText(`HTTP ${res.status}: ${err.error || "preview failed"}`);
    }
    const pdf = Buffer.from(await res.arrayBuffer());
    const path = output_path || join(tmpdir(), `hashproof-preview-${Date.now()}.pdf`);
    await writeFile(path, pdf);
    return text(
      `Preview PDF saved to: ${path} (${pdf.length} bytes)\n` +
        `Inspect it (read the file if you have vision) and adjust fields_json until the layout is right. ` +
        `Show the final version to your human before issuing.`,
    );
  },
);

server.tool(
  "issue_credential",
  "Issue a verifiable credential — COSTS $0.10 USDC (x402) or 1 API-key credit per call. Get explicit human approval before calling. The body follows the HashProof issueCredential schema: issuer{display_name,slug}, platform{display_name,slug}, holder{full_name}, context{type,title}, credential_type, title, values{...}, and optionally template_slug OR an inline template{...} (send only one). Returns id, verification_url, tx_hash and ipfs_cid. Full reference: https://hashproof.dev/skill.md",
  {
    body: z
      .record(z.any())
      .describe("Full issueCredential request body (see https://hashproof.dev/skill.md for the schema)"),
  },
  async ({ body }) => {
    let doFetch;
    try {
      doFetch = await getPaidFetch();
    } catch (e) {
      return errorText(e.message);
    }
    const res = await doFetch(`${API_BASE}/issueCredential`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return errorText(`HTTP ${res.status}: ${out.error || "issuance failed"}`);
    return text(out);
  },
);

server.tool(
  "verify_credential",
  "Verify an issued credential against three independent sources (database, IPFS, blockchain). Free, no auth. Returns status (active/revoked/expired/not_found), issuer verification and the credential data.",
  { id: z.string().describe("Credential id (UUID) from issuance or from a verification URL") },
  async ({ id }) => {
    const res = await fetch(`${API_BASE}/verify/${encodeURIComponent(id)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404) return errorText(`HTTP ${res.status}: ${body.error || "request failed"}`);
    return text(body);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
