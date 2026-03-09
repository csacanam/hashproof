# HashProof Frontend

Landing page and credential verification UI.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set `VITE_API_URL` to your backend base URL (default: `http://localhost:4022`).

## Development

```bash
npm run dev
```

Runs at `http://localhost:5173` (or next available port).

## Build

```bash
npm run build
```

Output in `dist/`.

## Routes

- `/` — Home (product overview, docs copy)
- `/verify/:id` — Credential verification page (fetches from API, displays credential, offers PDF download)
