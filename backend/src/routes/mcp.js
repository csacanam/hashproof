/**
 * Remote MCP server — Streamable HTTP transport at POST /mcp.
 *
 * Same four tools as the stdio package (hashproof-mcp on npm), with two
 * differences forced by running server-side instead of on the caller's machine:
 *
 *   - Payment: the stdio server signs x402 with the caller's own wallet key from
 *     its env. A hosted server has no such key, so issue_credential forwards the
 *     caller's `Authorization: Bearer <api-key>` header instead. Agents that want
 *     to pay per-call with USDC keep using the stdio server or POST /issueCredential
 *     directly with x402.
 *   - preview_template returns the PDF inline (base64) instead of writing it to
 *     disk, since the caller has no access to this filesystem.
 *
 * Stateless: a fresh McpServer + transport per request, so the endpoint survives
 * horizontal scaling with no shared session state.
 */

import { Router } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { Buffer } from "node:buffer";

// Loopback so tool calls don't leave the box and re-enter through the CDN.
const SELF_BASE =
  process.env.MCP_SELF_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4022}`;

// A preview PDF is base64'd straight into the response, which lands in the
// caller's context window. Anything bigger than this is a background image
// problem, not a layout problem.
const MAX_INLINE_PREVIEW_BYTES = 800_000;

// Loaded into the client's context when it connects, so the agent knows how
// payment and issuer identity work *before* it composes a body — otherwise it
// only ever sees four tool descriptions and improvises the rest.
const INSTRUCTIONS = `HashProof issues verifiable credentials: each one is registered on Celo, pinned to IPFS, and gets a public verification URL plus a PDF with a QR code.

Settle three things with your human before composing an issuance body:

1. How they pay. This remote server has no wallet, so issuing here needs a HashProof API key sent as \`Authorization: Bearer <key>\` in your MCP client's HTTP headers. To pay $0.10 USDC per credential from their own wallet instead, they use the stdio server (\`npx -y hashproof-mcp\`), which is a different install — you cannot switch to it from here. For prepaid credits without crypto, hi@hashproof.dev issues a key.

2. Who the issuer is. \`issuer\` is the organization granting the credential, \`platform\` is the system managing the issuance; set both to the same organization when there is no third party in between. An API key always issues as its own entity: \`issuer.slug\` must match that entity or the call is rejected. Issuing in the name of another organization is not something a key or an extra field unlocks — say so plainly instead of looking for a way around it.

3. Whether they want their own design. The default template needs no setup. For a custom one, iterate field positions with \`preview_template\` (free, nothing stored) and show the final PDF for approval before issuing. Backgrounds must already be hosted at a public image URL — there is no upload endpoint.

Issuing costs money and writes to a blockchain: get explicit approval for the final body first. A credential can be revoked afterwards, never edited.

Issuer names are self-asserted metadata. Verification reports \`issuer_verification_level\` — \`verified\` only when the issuing entity itself is verified, \`none\` otherwise. The contents are always tamper-evident; the issuer's identity is only as good as that level.

Full reference: https://hashproof.dev/skill.md`;

const NO_API_KEY_MESSAGE =
  "No API key on this request, and this remote server has no wallet — it cannot pay on your behalf. " +
  "Three ways forward, pick by what your human already has:\n\n" +
  "1. They have a HashProof API key: they add it as `Authorization: Bearer <key>` in their MCP client's HTTP " +
  "headers (on claude.ai, in the connector's settings), then you retry. The key issues as its own entity, so " +
  "`issuer.slug` in your body must match it.\n" +
  "2. They would rather pay per credential from their own wallet ($0.10 USDC on Base or Celo, no account): that " +
  "needs the stdio server — `npx -y hashproof-mcp` with HASHPROOF_WALLET_PRIVATE_KEY — or a direct POST to " +
  "https://api.hashproof.dev/issueCredential with an x402 client. If they have no wallet yet, generate a " +
  "dedicated one (never their main wallet), write the private key straight into the MCP config — NEVER show it " +
  "in chat — share only the address, and ask them to fund it with at least 0.10 USDC.\n" +
  "3. They want prepaid credits without touching crypto: hi@hashproof.dev issues a key tied to their entity.\n\n" +
  "See https://hashproof.dev/skill.md";

function text(t) {
  return { content: [{ type: "text", text: typeof t === "string" ? t : JSON.stringify(t, null, 2) }] };
}

function errorText(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Build a server instance for one request. `apiKey` is whatever the caller sent
 * on the HTTP request; null means the paid tool will refuse with instructions.
 */
function buildServer(apiKey) {
  const server = new McpServer(
    { name: "hashproof", version: "0.1.3" },
    { instructions: INSTRUCTIONS },
  );

  server.tool(
    "get_template_requirements",
    "Get the required field keys and layout definition of an existing HashProof template. Free, no auth. Always call this before issuing with a template_slug you didn't create in this session.",
    { template_ref: z.string().describe("Template slug or UUID") },
    async ({ template_ref }) => {
      const res = await fetch(`${SELF_BASE}/templates/${encodeURIComponent(template_ref)}/requirements`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return errorText(`HTTP ${res.status}: ${body.error || "request failed"}`);
      return text(body);
    },
  );

  server.tool(
    "preview_template",
    "Render a watermarked preview PDF from an INLINE template definition — free, nothing stored, no payment. Use this to iterate field positions (x, y, width, font_size) until the layout is right, then show the final PDF to the human for approval before issuing. page_width/page_height MUST match the background image's pixel dimensions. The PDF comes back inline as a base64 application/pdf resource.",
    {
      background_url: z
        .string()
        .url()
        .optional()
        .describe(
          "Public URL of the background image (PNG/JPG). There is no upload endpoint — the image must already be hosted (own site/CDN, GitHub raw URL, S3/R2, Cloudinary...). Tell the human this upfront. Share links (Google Drive/Dropbox) don't work; the URL must return the raw image.",
        ),
      page_width: z.number().describe("Page width in px — must match the background image"),
      page_height: z.number().describe("Page height in px — must match the background image"),
      fields_json: z
        .array(z.record(z.any()))
        .describe('Field definitions, e.g. [{"key":"holder_name","x":248,"y":1200,"width":3012,"font_size":192,"align":"center"}]'),
      values: z.record(z.string()).describe('Sample values, e.g. {"holder_name":"Jane Doe"}'),
      locale: z.enum(["en", "es"]).optional(),
    },
    async (body) => {
      const res = await fetch(`${SELF_BASE}/template-previews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return errorText(`HTTP ${res.status}: ${err.error || "preview failed"}`);
      }
      const pdf = Buffer.from(await res.arrayBuffer());
      if (pdf.length > MAX_INLINE_PREVIEW_BYTES) {
        return errorText(
          `Preview is ${pdf.length} bytes, over the ${MAX_INLINE_PREVIEW_BYTES}-byte inline limit. ` +
            "Use a smaller/more compressed background image, or run the stdio server (`npx -y hashproof-mcp`), " +
            "which writes the PDF to a local file instead.",
        );
      }
      return {
        content: [
          {
            type: "text",
            text:
              `Preview PDF (${pdf.length} bytes) attached below. Inspect it and adjust fields_json ` +
              "until the layout is right. Show the final version to your human before issuing.",
          },
          {
            type: "resource",
            resource: {
              uri: "hashproof://template-preview.pdf",
              mimeType: "application/pdf",
              blob: pdf.toString("base64"),
            },
          },
        ],
      };
    },
  );

  server.tool(
    "issue_credential",
    "Issue a verifiable credential — COSTS 1 API-key credit per call. Get explicit human approval before calling. This remote server requires a HashProof API key sent as `Authorization: Bearer <key>` in your MCP client's HTTP headers; it cannot pay with x402 on your behalf. The key issues as its own entity: `issuer.slug` must match that entity or the call is rejected, so you cannot issue on behalf of another organization. The body follows the HashProof issueCredential schema: issuer{display_name,slug}, platform{display_name,slug}, holder{full_name}, context{type,title}, credential_type, title, values{...}, and optionally template_slug OR an inline template{...} (send only one). Returns id, verification_url, tx_hash and ipfs_cid. Full reference: https://hashproof.dev/skill.md",
    {
      body: z
        .record(z.any())
        .describe("Full issueCredential request body (see https://hashproof.dev/skill.md for the schema)"),
    },
    async ({ body }) => {
      if (!apiKey) return errorText(NO_API_KEY_MESSAGE);
      const res = await fetch(`${SELF_BASE}/issueCredential`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
      const res = await fetch(`${SELF_BASE}/verify/${encodeURIComponent(id)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) return errorText(`HTTP ${res.status}: ${body.error || "request failed"}`);
      return text(body);
    },
  );

  return server;
}

function readApiKey(req) {
  const auth = req.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return req.get("x-api-key")?.trim() || null;
}

function methodNotAllowed(_req, res) {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "This MCP endpoint is stateless: use POST /mcp." },
    id: null,
  });
}

export function createMcpRouter() {
  const router = Router();

  router.post("/", async (req, res) => {
    const server = buildServer(readApiKey(req));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[mcp] request failed:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // No server-initiated streams and no sessions to terminate in stateless mode.
  router.get("/", methodNotAllowed);
  router.delete("/", methodNotAllowed);

  return router;
}
