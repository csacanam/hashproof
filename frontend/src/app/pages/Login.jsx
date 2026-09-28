import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { API_URL, setSession } from "../api.js";
import { useDashboard } from "../useDashboard.js";

/** Sign in or sign up — the same form: the first sign-in creates the account. */
export default function Login() {
  const { t, session, reloadMe } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");


  if (session) return <Navigate to={location.state?.from || "/app"} replace />;

  async function sendEmail(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/app/auth/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        // Supabase allows one email per address per minute. The last one is
        // still valid, so move on to the code step instead of a dead end.
        setStep("sent");
        setError(t("login.rateLimited"));
        return;
      }
      if (!res.ok) throw new Error(data.error || t("login.error"));
      setStep("sent");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/app/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("login.error"));
      setSession(data);
      await reloadMe();
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dash-auth">
      <Helmet>
        <title>{t("login.title")} · HashProof</title>
      </Helmet>
      <Link to="/" className="dash-auth-logo">
        <img src="/hashproof-logo.png" alt="HashProof" />
      </Link>
      <div className="dash-card dash-auth-card">
        <h1>{t("login.title")}</h1>
        <p className="dash-muted">{t("login.subtitle")}</p>

        {step === "email" && (
          <form onSubmit={sendEmail} className="dash-form">
            <label>
              <span>{t("login.email")}</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organization.com"
              />
            </label>
            <button className="dash-btn" disabled={busy}>
              {busy ? t("common.sending") : t("login.send")}
            </button>
          </form>
        )}

        {step === "sent" && (
          <form onSubmit={verifyCode} className="dash-form">
            <p>{t("login.sent", { email })}</p>
            <label>
              <span>{t("login.code")}</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
            </label>
            <button className="dash-btn" disabled={busy || code.length < 6}>
              {busy ? t("common.verifying") : t("login.verify")}
            </button>
            <button type="button" className="dash-link" onClick={() => { setError(""); setStep("email"); }}>
              {t("login.otherEmail")}
            </button>
          </form>
        )}

        {error && <p className="dash-error">{error}</p>}
      </div>
      <p className="dash-muted dash-auth-foot">{t("login.developers")} <Link to="/docs">{t("login.docs")}</Link></p>
    </div>
  );
}
