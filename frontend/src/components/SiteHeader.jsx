import { Link } from "react-router-dom";
import { getPreferredLocale } from "../i18n.js";

// Read directly rather than through the dashboard's session module, so the
// public pages don't load the dashboard code just to label a link.
function hasSession() {
  try {
    return Boolean(localStorage.getItem("hp.session"));
  } catch {
    return false;
  }
}

export default function SiteHeader({ plain } = {}) {
  const es = getPreferredLocale() === "es";
  return (
    <header className="header">
      <Link to="/" className="logo">
        <img
          src="/hashproof-logo.png"
          alt="HashProof"
          className="logo-img"
        />
      </Link>
      {!plain && (
        <nav className="home-nav">
          <Link to="/docs" className="home-nav-link">Docs</Link>
          {hasSession() ? (
            <Link to="/app" className="home-nav-btn">{es ? "Panel" : "Dashboard"}</Link>
          ) : (
            <>
              <Link to="/app" className="home-nav-link">{es ? "Ingresar" : "Sign in"}</Link>
              <Link to="/app" className="home-nav-btn">{es ? "Crear cuenta" : "Create account"}</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
