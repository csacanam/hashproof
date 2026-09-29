# Card payments (Stripe) — activation checklist

The code for buying credits by card is already in place and deployed; it stays
switched off until the steps below are done. Until then the dashboard shows the
card option as "coming soon", and crypto (Voulti) keeps working.

## How it works

1. An owner or admin chooses a number of credits in the dashboard
   (`POST /app/organizations/:id/purchases/stripe`).
2. The backend creates a Stripe Checkout Session: $0.25 per credit, minimum 25
   credits, priced inline (no Stripe Product needed). It records a `pending` row
   in `credit_purchases` keyed by the session id.
3. The payer completes Checkout on Stripe and comes back to
   `/app/developers?purchase=success`. **Returning does not credit anything.**
4. Stripe calls `POST https://api.hashproof.dev/stripe/webhook`. The backend
   verifies the signature on the raw body and, for a paid session tagged as
   HashProof's, completes the purchase: the organization's balance goes up.

Credits land exactly once: `credit_purchases` is unique by `(method,
external_ref)` and `complete_credit_purchase()` only credits a `pending` row, so
a webhook delivered twice, or retried after a timeout, adds nothing the second
time.

## Sharing a Stripe account with other products

Every Checkout Session HashProof creates carries

```
metadata.product = "hashproof"
```

on the session **and** on its PaymentIntent (`payment_intent_data.metadata`),
along with `entity_id` and `credits`.

- **HashProof's webhook** ignores any event whose session is not tagged
  `hashproof`: it answers `200 { handled: false, ignored: "other_product" }`,
  credits nothing and logs nothing. Other products' checkouts on the same
  account pass straight through.
- **Other products' webhooks** on the same account will also receive HashProof's
  events if they subscribe to the same types (for example
  `payment_intent.succeeded`). Each of them should skip events that are not
  theirs, e.g.:

  ```js
  if (object.metadata?.product && object.metadata.product !== "<their-product>") return;
  ```

  Do this in the other products **before** turning on HashProof card payments.

## Steps to activate

1. **Keys.** In Stripe (live mode), use a secret or restricted key that can
   create Checkout Sessions. A restricted key needs *Checkout Sessions: write*;
   inline `price_data` works without *Products* permission.
2. **Webhook endpoint.** Dashboard → Developers → Webhooks → *Add endpoint*:
   - URL: `https://api.hashproof.dev/stripe/webhook`
   - Events: `checkout.session.completed` and
     `checkout.session.async_payment_succeeded` (only these two).

   Or from the command line:

   ```bash
   curl https://api.stripe.com/v1/webhook_endpoints \
     -u "$STRIPE_SECRET_KEY:" \
     -d url="https://api.hashproof.dev/stripe/webhook" \
     -d "enabled_events[]=checkout.session.completed" \
     -d "enabled_events[]=checkout.session.async_payment_succeeded"
   ```

   Copy the endpoint's signing secret (`whsec_…`).
3. **Environment** (backend, DigitalOcean App Platform → Settings → Environment
   Variables, marked *Encrypt*):
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `FRONTEND_URL=https://www.hashproof.dev` (where Checkout sends the payer
     back; any other origin is replaced by this one)

   Both Stripe variables must be set: with only one, card payments stay off.
4. **Deploy** (saving the variables redeploys the app).
5. **Check it is on:** `GET https://api.hashproof.dev/app/pricing` should report
   `"stripe": { …, "available": true }`, and the dashboard's purchase dialog
   should offer the card.

## Test with a real payment

Live keys do not accept Stripe's test cards, so the full path is verified with
one real purchase of the minimum (25 credits, $6.25):

1. Buy 25 credits by card from the dashboard.
2. Back on Developers, the balance should rise by 25 within seconds, and the
   purchase should show as *Completed*.
3. In Stripe → Developers → Webhooks → the endpoint → *Event deliveries*, the
   delivery should show `200` with `"credited": true`.
4. *Resend* that delivery from Stripe: it should return `200` with
   `"credited": false`, and the balance must not change.
5. Refund the payment from Stripe if it was only a test (see below: the credits
   are not taken back automatically yet).

## Not done yet: refunds

A refund made in Stripe does not remove the credits it paid for. Until that is
automated, after refunding a card purchase, take the credits back by hand in the
database (`entities.credits_balance` of that organization) and note it on the
`credit_purchases` row.

To automate it: subscribe the endpoint to `charge.refunded`, read the tagged
metadata from the PaymentIntent, and deduct `credits × amount_refunded /
amount` from the organization — never below zero, and alerting when the
balance cannot cover it because the credits were already spent.

## Where the code is

- `backend/src/services/payments.js` — prices, Checkout Session, webhook handling
- `backend/src/app.js` — `POST /stripe/webhook`, registered before the JSON body
  parser so the signature is checked against the raw bytes
- `backend/src/routes/app.js` — `POST /app/organizations/:id/purchases/stripe`
- `backend/database/migrations/008_accounts.sql`, `009_organization_balance.sql`
  — `credit_purchases` and `complete_credit_purchase()`
- `backend/src/services/payments.test.js` — signature, once-only crediting,
  amount check, other products' events ignored
