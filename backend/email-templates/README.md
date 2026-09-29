# Email templates (Supabase Auth)

Paste each file into Supabase → Authentication → Emails → Templates, the body from
`<name>.html` and the subject from `<name>.subject.txt`.

Language comes from the user's metadata (`locale`, "es" or "en"), stored by the
dashboard at sign-up and on each sign-in; anything else falls back to Spanish.
The comparison is `eq (printf "%v" .Data.locale) "en"` so a user with no locale
renders the Spanish branch instead of failing the template.

Links point to hashproof.dev/app/auth with a token_hash, which the dashboard
exchanges for a session (POST /app/auth/verify-link), so the link a person sees
matches the domain that emailed them.

| Template in Supabase | Files |
|---|---|
| Magic Link | `magic-link.html`, `magic-link.subject.txt` |
| Confirm signup | `confirm-signup.html`, `confirm-signup.subject.txt` |
| Invite user | `invite.html`, `invite.subject.txt` |
