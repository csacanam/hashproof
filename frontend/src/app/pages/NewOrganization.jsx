import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { api } from "../api.js";
import { useDashboard } from "../useDashboard.js";

function toSlug(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function NewOrganization() {
  const { t, session, organizations, reloadMe, setOrgId, signOut } = useDashboard();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!session) return <Navigate to="/app/login" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const org = await api("/organizations", {
        method: "POST",
        body: { display_name: name, slug: slug || toSlug(name), website: website || undefined },
      });
      await reloadMe();
      setOrgId(org.id);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const effectiveSlug = slugTouched ? slug : toSlug(name);

  return (
    <div className="dash-auth">
      <Helmet>
        <title>{t("org.new.title")} · HashProof</title>
      </Helmet>
      <Link to="/" className="dash-auth-logo">
        <img src="/hashproof-logo.png" alt="HashProof" />
      </Link>
      <div className="dash-card dash-auth-card dash-auth-card--wide">
        <h1>{t("org.new.title")}</h1>
        <p className="dash-muted">{t("org.new.subtitle")}</p>
        <form onSubmit={submit} className="dash-form">
          <label>
            <span>{t("org.new.name")}</span>
            <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Universidad Ejemplo" />
            {error?.body?.field === "display_name" && <small className="dash-error">{error.message}</small>}
          </label>
          <label>
            <span>{t("org.new.slug")}</span>
            <input
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(toSlug(e.target.value));
              }}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              minLength={3}
            />
            <small className="dash-muted">{t("org.new.slugHelp", { slug: effectiveSlug || "…" })}</small>
            {error?.body?.field === "slug" && <small className="dash-error">{error.message}</small>}
          </label>
          <label>
            <span>{t("org.new.website")}</span>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://ejemplo.edu" />
            <small className="dash-muted">{t("org.new.websiteHelp")}</small>
          </label>
          <p className="dash-note">{t("org.new.verificationNote")}</p>
          <button className="dash-btn" disabled={busy}>
            {busy ? t("common.creating") : t("org.new.create")}
          </button>
          {error && !error.body?.field && <p className="dash-error">{error.message}</p>}
        </form>
      </div>
      <p className="dash-auth-foot">
        {organizations.length > 0 ? (
          <Link to="/app">{t("common.back")}</Link>
        ) : (
          <button type="button" className="dash-link" onClick={signOut}>
            {t("nav.signOut")}
          </button>
        )}
      </p>
    </div>
  );
}
