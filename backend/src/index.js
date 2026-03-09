/**
 * HashProof API
 *
 * Issue verifiable credentials via x402 payment on Celo.
 * Single paid endpoint: POST /issueCredential
 */

import "dotenv/config";
import { createApp } from "./app.js";

const PORT = process.env.PORT || 4022;
const SKIP_PAYMENT = process.env.SKIP_PAYMENT === "true";

if (!SKIP_PAYMENT && !process.env.PAY_TO) {
  console.error(
    "Missing required env: PAY_TO (Celo address for x402 payments)",
  );
  process.exit(1);
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
