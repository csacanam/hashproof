# hashproof-mcp

MCP server for [HashProof](https://hashproof.dev) — issue verifiable credentials (diplomas, certificates, badges) from any AI agent for $0.10 USDC via x402 or an API key. Each credential is registered on-chain on Celo, pinned to IPFS, and comes with a PDF + QR anyone can verify for free.

## Install

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

## Configuration

| Env var | Required | Description |
|---|---|---|
| `HASHPROOF_API_KEY` | one of the two | Prepaid API key (contact hi@hashproof.dev). Takes precedence if both are set. |
| `HASHPROOF_WALLET_PRIVATE_KEY` | one of the two | EVM key of a wallet holding USDC — pays $0.10 per issuance via x402, gasless. Use a dedicated wallet with minimal funds. |
| `HASHPROOF_X402_NETWORK` | no | `base` (default) or `celo` — where your USDC lives. |
| `HASHPROOF_API_BASE` | no | Default `https://api.hashproof.dev`. |

The free tools (`get_template_requirements`, `preview_template`, `verify_credential`) work with **no configuration at all**.

## Tools

| Tool | Cost | What it does |
|---|---|---|
| `get_template_requirements` | free | Required fields + layout of an existing template |
| `preview_template` | free | Watermarked PDF from an **inline** template — iterate field positions without paying or storing anything; the PDF is saved locally so vision-capable agents can inspect and adjust |
| `issue_credential` | $0.10 | Issue one credential: registered on Celo, pinned to IPFS, returns `verification_url` |
| `verify_credential` | free | 3-layer verification (database, IPFS, blockchain) of any credential id |

## Typical flow

1. Human: "issue completion certificates for my workshop, with our branding".
2. Agent gets/generates a background image, measures it, proposes `fields_json`.
3. `preview_template` → agent inspects the PDF → adjusts → human approves the final preview.
4. `issue_credential` once per recipient (first call carries the inline `template`, the rest reuse `template_slug`).
5. Share each `verification_url` — the QR on the PDF points there.

Full guide (schema, templates, errors): [hashproof.dev/skill.md](https://hashproof.dev/skill.md)
