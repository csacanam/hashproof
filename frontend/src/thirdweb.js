/**
 * Thirdweb client singleton.
 * Used by useFetchWithPayment (x402 payments) and wallet connection in Entity.jsx.
 * Requires VITE_THIRDWEB_CLIENT_ID — get one at https://thirdweb.com/dashboard
 */

import { createThirdwebClient } from "thirdweb";

const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;

if (!clientId) {
  console.warn(
    "[Thirdweb] VITE_THIRDWEB_CLIENT_ID is not set. x402 payments may fail. " +
      "Get a client ID at https://thirdweb.com/dashboard"
  );
}

export const thirdwebClient = createThirdwebClient({
  clientId: clientId || "",
});
