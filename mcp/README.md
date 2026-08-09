# hashproof-mcp

MCP server for [HashProof](https://hashproof.dev) — issue verifiable credentials (diplomas, certificates, badges) from any AI agent for $0.10 USDC via x402 or an API key. Each credential is registered on-chain on Celo, pinned to IPFS, and comes with a PDF + QR anyone can verify for free.

## Two ways to connect

| | **Local (stdio)** — this package | **Remote (HTTP)** — `https://api.hashproof.dev/mcp` |
|---|---|---|
| Install | `npx -y hashproof-mcp` | nothing to install |
| Paying for `issue_credential` | your own wallet, $0.10 USDC via x402 — or an API key | **API key only** |
| `preview_template` output | PDF written to a local file | PDF returned inline (base64, max 800 KB) |

The remote server has no wallet and cannot pay on your behalf, so it can't do x402. Use the local server if you want to pay per credential with USDC; use the remote one if you have a prepaid API key and don't want to run anything.

Both send MCP `instructions` on connect, so a client learns how payment and issuer identity work before it composes anything.

**An API key issues as its own entity.** The key is tied to one entity and every credential is issued as that entity: `issuer.slug` must match it, or the call is rejected with `403`. Paying with x402 leaves `issuer` as free-text metadata unless the wallet is authorized by a registered entity. Neither route lets you issue in another organization's name — that requires that organization to register and authorize you. See [hashproof.dev/skill.md](https://hashproof.dev/skill.md).

## Install — local (stdio)

**Claude Code:**

```bash
claude mcp add hashproof -- npx -y hashproof-mcp
```

**Cursor / any MCP client** (`.mcp.json` / `mcp.json`):

```json
{
  "mcpServers": {
    "hashproof": {
      "command": "npx",
      "args": ["-y", "hashproof-mcp"],
      "env": {
        "HASHPROOF_WALLET_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Install — remote (Streamable HTTP)

**Claude Code:**

```bash
claude mcp add --transport http hashproof https://api.hashproof.dev/mcp
```

**Any MCP client**, with an API key so `issue_credential` works:

```json
{
  "mcpServers": {
    "hashproof": {
      "type": "http",
      "url": "https://api.hashproof.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Without that header the three free tools still work; `issue_credential` returns an error explaining how to authenticate.

## Configuration

| Env var | Required | Description |
|---|---|---|
| `HASHPROOF_API_KEY` | one of the two | Prepaid API key (contact hi@hashproof.dev). Takes precedence if both are set. |
| `HASHPROOF_WALLET_PRIVATE_KEY` | one of the two | EVM key of a wallet holding USDC — pays $0.10 per issuance via x402, gasless. Use a dedicated wallet with minimal funds. |
| `HASHPROOF_X402_NETWORK` | no | `base` (default) or `celo` — where your USDC lives. |
| `HASHPROOF_API_BASE` | no | Default `https://api.hashproof.dev`. |

These env vars apply to the local (stdio) server. The remote server is configured through HTTP headers instead — send `Authorization: Bearer <api-key>`.

The free tools (`get_template_requirements`, `preview_template`, `verify_credential`) work with **no configuration at all**.

**No wallet yet?** Generate a dedicated EVM wallet for the agent (never reuse your main wallet), put its private key in `HASHPROOF_WALLET_PRIVATE_KEY`, and fund the address with a few USDC on Base or Celo ($0.10 per credential, gasless). Never paste the private key into a chat — write it straight into the config file. Agents: if `issue_credential` fails with "No payment method configured", walk the human through exactly this.

## Tools

| Tool | Cost | What it does |
|---|---|---|
| `get_template_requirements` | free | Required fields + layout of an existing template |
| `preview_template` | free | Watermarked PDF from an **inline** template — iterate field positions without paying or storing anything; saved locally (stdio) or returned inline as base64 (remote) so vision-capable agents can inspect and adjust |
| `issue_credential` | $0.10 | Issue one credential: registered on Celo, pinned to IPFS, returns `verification_url` |
| `verify_credential` | free | 3-layer verification (database, IPFS, blockchain) of any credential id |

## Typical flow

1. Human: "issue completion certificates for my workshop, with our branding".
2. Agent gets/generates a background image, gets it hosted at a **public URL** (there is no upload endpoint — own site, GitHub raw, S3/R2...; warn the human about this upfront), measures it, proposes `fields_json`.
3. `preview_template` → agent inspects the PDF → adjusts → human approves the final preview.
4. `issue_credential` once per recipient (first call carries the inline `template`, the rest reuse `template_slug`).
5. Share each `verification_url` — the QR on the PDF points there.

Full guide (schema, templates, errors): [hashproof.dev/skill.md](https://hashproof.dev/skill.md)
