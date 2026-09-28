import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setSession } from "../api.js";
import { useDashboard } from "../useDashboard.js";

/**
 * Where the sign-in link lands. Supabase puts the session in the URL fragment
 * (#access_token=…&refresh_token=…); it is read here and removed from the
 * address bar before anything else runs.
 */
/** Read the session out of the fragment once, and clear it from the address bar. */
function readFragment() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  window.history.replaceState(null, "", window.location.pathname);
  const access = params.get("access_token");
  const refresh = params.get("refresh_token");
  if (params.get("error_description") || !access || !refresh) {
    return { error: params.get("error_description") || true };
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
      expires_at: Number(params.get("expires_at")) || Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || 3600),
      user: { id, email },
    },
  };
}

export default function AuthCallback() {
  const { t, reloadMe } = useDashboard();
  const navigate = useNavigate();
  const [result] = useState(readFragment);
  const error = result.error ? (result.error === true ? t("callback.invalid") : result.error) : "";

  useEffect(() => {
    if (!result.session) return;
    setSession(result.session);
    reloadMe().then(() => navigate("/app", { replace: true }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="dash-auth">
      <div className="dash-card dash-auth-card">
        {error ? (
          <>
            <h1>{t("callback.failed")}</h1>
            <p className="dash-error">{error}</p>
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
