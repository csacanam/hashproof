import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL, setSession } from "../api.js";
import { useDashboard } from "../useDashboard.js";

/**
 * Where sign-in links land. Two shapes arrive here:
 *
 * - Our own email templates link to /app/auth?token_hash=…&type=…, so the link
 *   matches the domain that sent it. The hash is exchanged for a session by the
 *   backend.
 * - Links Supabase builds itself (invitations sent before the templates, or a
 *   template left at its default) come back with the session already in the
 *   fragment: #access_token=…&refresh_token=….
 *
 * Either way the token is read once and removed from the address bar first.
 */
function readLink() {
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  window.history.replaceState(null, "", window.location.pathname);

  const tokenHash = query.get("token_hash");
  if (tokenHash) return { tokenHash, type: query.get("type") || "email" };

  const access = fragment.get("access_token");
  const refresh = fragment.get("refresh_token");
  if (fragment.get("error_description") || !access || !refresh) {
    return { error: fragment.get("error_description") || true };
  }
  let email = null;
  let id = null;
  try {
    const payload = JSON.parse(atob(access.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    email = payload.email ?? null;
    id = payload.sub ?? null;
  } catch {
    /* the backend will say who it is */
  }
  return {
    session: {
      access_token: access,
      refresh_token: refresh,
      expires_at:
        Number(fragment.get("expires_at")) || Math.floor(Date.now() / 1000) + Number(fragment.get("expires_in") || 3600),
      user: { id, email },
    },
  };
}

export default function AuthCallback() {
  const { t, reloadMe } = useDashboard();
  const navigate = useNavigate();
  const [link] = useState(readLink);
  const [failure, setFailure] = useState(link.error ? (link.error === true ? t("callback.invalid") : link.error) : "");

  useEffect(() => {
    let cancelled = false;
    async function signIn(session) {
      setSession(session);
      await reloadMe();
      if (!cancelled) navigate("/app", { replace: true });
    }
    if (link.session) {
      signIn(link.session);
    } else if (link.tokenHash) {
      fetch(`${API_URL}/app/auth/verify-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: link.tokenHash, type: link.type }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || t("callback.invalid"));
          return signIn(data);
        })
        .catch((err) => !cancelled && setFailure(err.message));
    }
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="dash-auth">
      <div className="dash-card dash-auth-card">
        {failure ? (
          <>
            <h1>{t("callback.failed")}</h1>
            <p className="dash-error">{failure}</p>
            <Link to="/app/login" className="dash-btn">
              {t("callback.retry")}
            </Link>
          </>
        ) : (
          <p>{t("callback.signingIn")}</p>
        )}
      </div>
    </div>
  );
}
