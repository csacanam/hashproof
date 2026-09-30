import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useDashboard } from "./useDashboard.js";
import { formatNumber } from "./format.js";
import BuyLink from "./components/BuyLink.jsx";
import BuyDialog from "./components/BuyDialog.jsx";

const NAV = [
  { to: "/app", key: "nav.overview", end: true },
  { to: "/app/issue", key: "nav.issue" },
  { to: "/app/credentials", key: "nav.credentials" },
  { to: "/app/templates", key: "nav.templates" },
  { to: "/app/billing", key: "nav.billing" },
  { to: "/app/developers", key: "nav.developers" },
  { to: "/app/team", key: "nav.team" },
];

/** Signed-in area with an organization: sidebar, top bar, and the page. */
export default function AppShell() {
  const { t, session, loadingMe, organizations, org, setOrgId, overview, user, signOut, buyOpen, closeBuy } = useDashboard();
  const location = useLocation();

  if (!session) return <Navigate to="/app/login" replace state={{ from: location.pathname }} />;
  if (loadingMe && !organizations.length) return <div className="dash-loading">{t("common.loading")}</div>;
  if (!organizations.length) return <Navigate to="/app/new" replace />;

  const unverified = org && !["individual_verified", "organization_verified"].includes(org.status);

  return (
    <div className="dash">
      <Helmet>
        <title>{`${org?.display_name ?? "HashProof"} · HashProof`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <aside className="dash-side">
        <Link to="/" className="dash-logo">
          <img src="/hashproof-logo.png" alt="HashProof" />
        </Link>

        <label className="dash-org">
          <span className="dash-label">{t("nav.organization")}</span>
          <select value={org?.id ?? ""} onChange={(e) => (e.target.value === "__new" ? null : setOrgId(e.target.value))}>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.display_name}
              </option>
            ))}
          </select>
          <Link to="/app/new" className="dash-org-new">
            {t("nav.newOrganization")}
          </Link>
        </label>

        <nav className="dash-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `dash-nav-link${isActive ? " is-active" : ""}`}>
              {t(n.key)}
            </NavLink>
          ))}
        </nav>

        <div className="dash-side-foot">
          <Link to="/app/billing" className="dash-balance">
            <span className="dash-label">{t("nav.balance")}</span>
            <strong>{overview ? formatNumber(overview.balance) : "—"}</strong>
            <span className="dash-muted">{t("nav.credits")}</span>
          </Link>
          <BuyLink className="dash-btn dash-btn--small" />
          <div className="dash-user">
            <span title={user?.email}>{user?.email}</span>
            <button type="button" className="dash-link" onClick={signOut}>
              {t("nav.signOut")}
            </button>
          </div>
        </div>
      </aside>

      <main className="dash-main">
        {unverified && (
          <div className="dash-banner" role="status">
            <strong>{t("banner.unverified.title")}</strong> {t("banner.unverified.body")}{" "}
            <Link to={`/entities/${org.id}`}>{t("banner.unverified.cta")}</Link>
          </div>
        )}
        {org?.status === "suspended" && (
          <div className="dash-banner dash-banner--danger" role="alert">
            {t("banner.suspended")}
          </div>
        )}
        <Outlet />
      </main>
      <BuyDialog open={buyOpen} onClose={closeBuy} />
    </div>
  );
}
