import { Link } from "react-router-dom";

export default function SiteHeader({ plain } = {}) {
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
          <a
            href="https://github.com/csacanam/hashproof"
            target="_blank"
            rel="noopener noreferrer"
            className="home-nav-link"
          >
            GitHub
          </a>
          <Link to="/docs" className="home-nav-link">Docs</Link>
        </nav>
      )}
    </header>
  );
}
