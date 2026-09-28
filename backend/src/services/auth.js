/**
 * Sign-in for the dashboard, done through the backend so the browser needs no
 * Supabase configuration of its own.
 *
 * Each call gets its own client with session persistence off. The shared client
 * in supabase.js carries the service key for every query the API makes; letting
 * a sign-in store a user's session on it would make later queries run as that
 * user.
 */

import { createClient } from "@supabase/supabase-js";

function isolatedClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function sessionOut(session) {
  if (!session?.access_token) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: { id: session.user?.id, email: session.user?.email ?? null },
  };
}

/** Email a sign-in link (and code, if the template includes it). Creates the account on first use. */
export async function sendSignInEmail({ email, redirectTo }) {
  const clean = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("email must be a valid email address");
  const { error } = await isolatedClient().auth.signInWithOtp({
    email: clean,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  if (error) {
    const err = new Error(
      error.status === 429 ? "Too many sign-in emails. Wait a minute and try again." : "Could not send the sign-in email.",
    );
    err.status = error.status === 429 ? 429 : 502;
    err.code = error.status === 429 ? "rate_limited" : "email_failed";
    console.error("[auth] signInWithOtp failed:", error.status, error.message);
    throw err;
  }
}

/** Exchange the 6-digit code from the email for a session. */
export async function verifyEmailCode({ email, token }) {
  const { data, error } = await isolatedClient().auth.verifyOtp({
    email: String(email || "").trim().toLowerCase(),
    token: String(token || "").trim(),
    type: "email",
  });
  const out = sessionOut(data?.session);
  if (error || !out) {
    const err = new Error("That code is invalid or expired. Request a new one.");
    err.status = 401;
    err.code = "invalid_code";
    throw err;
  }
  return out;
}

export async function refreshSession(refreshToken) {
  const { data, error } = await isolatedClient().auth.refreshSession({ refresh_token: String(refreshToken || "") });
  const out = sessionOut(data?.session);
  if (error || !out) {
    const err = new Error("Your session expired. Sign in again.");
    err.status = 401;
    err.code = "unauthorized";
    throw err;
  }
  return out;
}
