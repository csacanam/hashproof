# HashProof Frontend

Landing page, credential verification UI, and entity pages.

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # runs at http://localhost:5173
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | yes | Backend base URL (default: `http://localhost:4022`) |
| `VITE_THIRDWEB_CLIENT_ID` | yes | Thirdweb client ID for wallet connect and payments |
| `VITE_X402_NETWORKS` | yes | Comma-separated payment networks — must match backend `X402_NETWORKS` |

## Routes

| Path | Description |
|------|-------------|
| `/` | Home page |
| `/verify/:id` | Credential verification — fetches from API, shows credential, offers PDF download |
| `/entities/:id` | Entity page — shows verification status, allows submitting a verification request (paid) |

## Build

```bash
npm run build   # output in dist/
```
