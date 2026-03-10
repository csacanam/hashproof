---
name: docs
description: Work with HashProof documentation. Use when updating docs, testing custom templates, or when the user asks about documentation structure, WORK-PLAN, API reference, or issuing credentials.
---

# HashProof Docs

## Docs structure

| File | Purpose |
|------|---------|
| `docs/README.md` | Index — who reads what |
| `docs/WORK-PLAN.md` | Done / pending tasks |
| `docs/API-REFERENCE.md` | Endpoints, schemas, responses |
| `docs/ISSUING-CREDENTIALS.md` | Examples from basic to custom templates |
| `docs/ADMIN-GUIDE.md` | Entity verification, admin operations |
| `contracts/README.md` | Deploy, verify, after-deploy checklist |

## Testing custom templates

When verifying that custom templates render correctly (see WORK-PLAN task H):

1. **Issue** a credential with a custom template (Level 4 in ISSUING-CREDENTIALS.md): inline `template` with `fields_json`, `background_url`, `page_width`, `page_height`.
2. **Open** the `verification_url` in the browser.
3. **Check** layout: field positions, font sizes, alignment, colors. Ensure PDF download matches.
4. **Document** any layout or styling issues; fix in `frontend/src/pages/Verify.jsx` or the credential rendering logic.

## Updating docs

- Keep WORK-PLAN in sync when tasks are done or added.
- API changes → update API-REFERENCE.md and ISSUING-CREDENTIALS.md.
- Contract deploy → update contracts/README.md and root README.md addresses.
