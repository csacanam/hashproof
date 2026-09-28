/**
 * Dashboard sessions. The frontend signs people in with Supabase Auth (email
 * link) and sends the access token as a Bearer; we ask Supabase who it belongs
 * to rather than verifying the JWT ourselves, so a signed-out or deleted user
 * stops working immediately.
 *
 * Kept apart from API keys on purpose: dashboard routes accept only a session,
 * the public API accepts only keys and payments. A leaked API key cannot open
 * the dashboard, and a session cannot be used against /issueCredential.
 */

import { supabase } from "../supabase.js";

export function requireSession() {
  return async (req, res, next) => {
    const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return res.status(401).json({ error: "Sign in to continue.", code: "unauthorized" });
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return res.status(401).json({ error: "Your session expired. Sign in again.", code: "unauthorized" });
      }
      req.user = { id: data.user.id, email: data.user.email ?? null };
      next();
    } catch (err) {
      next(err);
    }
  };
}
