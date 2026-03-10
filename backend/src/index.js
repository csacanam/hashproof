/**
 * HashProof API — server entry point.
 *
 * Validates required env vars, then starts the Express app.
 * Paid endpoints (x402): POST /issueCredential, POST /entities/:id/verificationRequests
 */

import "dotenv/config";
import { createApp } from "./app.js";

const PORT = process.env.PORT || 4022;
const SKIP_PAYMENT = process.env.SKIP_PAYMENT === "true";

if (!SKIP_PAYMENT) {
  if (!process.env.PAY_TO) {
    console.error("Missing required env: PAY_TO (address that receives USDC payments)");
    process.exit(1);
  }
  if (!process.env.THIRDWEB_SECRET_KEY) {
    console.error("Missing required env: THIRDWEB_SECRET_KEY (from thirdweb.com/dashboard)");
    process.exit(1);
  }
  if (!process.env.SETTLER_PRIVATE_KEY) {
    console.error("Missing required env: SETTLER_PRIVATE_KEY (EOA that executes transferWithAuthorization; needs native gas on each supported network)");
    process.exit(1);
  }
}
if (
  !process.env.SUPABASE_URL ||
  (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY)
) {
  console.error("Missing required env: SUPABASE_URL and SUPABASE_SECRET_KEY");
  process.exit(1);
}

if (SKIP_PAYMENT) {
  console.warn(
    "[dev] SKIP_PAYMENT=true: x402 is disabled, POST /issueCredential accepts requests without payment",
  );
}

const app = createApp({ skipPayment: SKIP_PAYMENT });
app.listen(PORT, () => {
  console.log(`HashProof API listening at http://localhost:${PORT}`);
});
