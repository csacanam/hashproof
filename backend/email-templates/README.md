# Email templates (Supabase Auth)

Paste each file into Supabase → Authentication → Emails → Templates. The links
point to hashproof.dev/app/auth with a token_hash, which the dashboard exchanges
for a session (POST /app/auth/verify-link), so the link a person sees matches the
domain that emailed them.

| Template in Supabase | File | Subject |
|---|---|---|
| Magic Link | `magic-link.html` | Tu enlace para ingresar a HashProof |
| Confirm signup | `confirm-signup.html` | Confirma tu correo en HashProof |
| Invite user | `invite.html` | Te invitaron a HashProof |
