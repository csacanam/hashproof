import { Link } from "react-router-dom";

const DEMO_CREDENTIAL_ID = "4c9f7420-0d1e-4340-9edb-e612df2ecea6";
const DEMO_ENTITY_SLUG = "hashproof";

const PAYLOAD_EXAMPLE = `{
  "issuer":   { "display_name": "Acme Corp", "slug": "acme-corp" },
  "platform": { "display_name": "Acme Corp", "slug": "acme-corp" },
  "holder":   { "full_name": "María García" },
  "context":  { "type": "course", "title": "Intro to Blockchain" },
  "credential_type": "completion",
  "title": "Certificate of Completion",
  "values":   { "holder_name": "María García" }
}`;

const FEATURES = [
  {
    icon: "⛓️",
    title: "On-chain registry",
    desc: "Every credential is registered on Celo. Status checks go to the blockchain — not a centralized database.",
  },
  {
    icon: "📦",
    title: "IPFS backup",
    desc: "Credential data is pinned to IPFS via Pinata. Verifiable even if HashProof goes offline.",
  },
  {
    icon: "⚡",
    title: "x402 payments",
    desc: "No accounts, no billing dashboards. Pay per call in USDC. AI agents can call the API autonomously.",
  },
  {
    icon: "🏛️",
    title: "Entity verification",
    desc: "Organizations and individuals can verify their identity. Credentials show whether the issuer is verified.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Call the API",
    desc: "Send credential data to POST /issueCredential. Pay $0.10 USDC via x402 — no API key, no signup.",
  },
  {
    n: "2",
    title: "Credential is created",
    desc: "HashProof stores the credential in its database, pins the JSON to IPFS, and registers it on Celo.",
  },
  {
    n: "3",
    title: "Share and verify",
    desc: "You receive a unique verification URL. Anyone can verify the credential — blockchain, IPFS, and DB all match.",
  },
];

export default function Home() {
  return (
    <div className="page">
      <header className="header">
        <Link to="/" className="logo">HashProof</Link>
        <nav className="home-nav">
          <a
            href="https://github.com/csacanam/hashproof"
            target="_blank"
            rel="noopener noreferrer"
            className="home-nav-link"
          >
            GitHub
          </a>
          <a
            href="https://github.com/csacanam/hashproof/blob/main/docs/API-REFERENCE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="home-nav-link"
          >
            Docs
          </a>
        </nav>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="hero">
          <h1>Issue verifiable credentials with one API call</h1>
          <p className="hero-lead">
            HashProof lets developers, platforms, and AI agents issue digital credentials
            that anyone can verify — backed by IPFS and a public blockchain registry.
          </p>
          <div className="hero-actions">
            <a
              href="https://github.com/csacanam/hashproof/blob/main/docs/ISSUING-CREDENTIALS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Read the docs
            </a>
            <Link
              to={`/verify/${DEMO_CREDENTIAL_ID}`}
              className="btn btn-secondary"
            >
              See a live credential →
            </Link>
          </div>
        </section>

        {/* ── Code snippet ── */}
        <section className="section">
          <div className="home-code-header">
            <span className="home-code-label">POST /issueCredential</span>
            <span className="home-code-price">$0.10 USDC · x402</span>
          </div>
          <pre className="home-code">{PAYLOAD_EXAMPLE}</pre>
          <p className="home-code-note">
            The API returns a <code>verification_url</code> you can share with the credential holder.
            No account required — pay directly when calling.
          </p>
        </section>

        {/* ── Features ── */}
        <section className="section">
          <h2>Built for trust at the infrastructure layer</h2>
          <div className="home-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="home-feature-card">
                <span className="home-feature-icon">{f.icon}</span>
                <div>
                  <p className="home-feature-title">{f.title}</p>
                  <p className="home-feature-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="section">
          <h2>How it works</h2>
          <div className="home-steps">
            {STEPS.map((s) => (
              <div key={s.n} className="home-step">
                <span className="home-step-n">{s.n}</span>
                <div>
                  <p className="home-step-title">{s.title}</p>
                  <p className="home-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── For agents ── */}
        <section className="section">
          <h2>Designed for AI agents</h2>
          <p className="section-p">
            HashProof uses the <strong>x402 protocol</strong> — a standard for HTTP-native
            micropayments. AI agents can discover, call, and pay for the API without
            human intervention. No accounts, no OAuth, no billing setup.
          </p>
          <p className="section-p">
            An agent sends a POST request, receives a 402 Payment Required response with
            a USDC payment request, pays on-chain, and retries — all programmatically.
          </p>
          <div className="home-pill-row">
            <span className="home-pill">No API keys</span>
            <span className="home-pill">No rate-limit dashboards</span>
            <span className="home-pill">Pay per use</span>
            <span className="home-pill">Base + Celo</span>
          </div>
        </section>

        {/* ── Entity verification ── */}
        <section className="section">
          <h2>Entity verification</h2>
          <p className="section-p">
            Organizations and individuals can verify their identity through HashProof.
            Verified issuers are marked on every credential they issue — so verifiers
            know whether the issuer has been reviewed by the platform.
          </p>
          <p className="section-p">
            Each verified entity has a public profile and an authorized set of wallets
            that can issue credentials on its behalf.
          </p>
          <Link to={`/entities/${DEMO_ENTITY_SLUG}`} className="home-entity-link">
            View the HashProof entity page →
          </Link>
        </section>
      </main>

      <footer className="footer">
        <p>
          HashProof is open infrastructure for issuing and verifying digital credentials.
        </p>
        <p className="footer-copy">
          © HashProof 2026 · Built by{" "}
          <a href="https://x.com/camilosaka" target="_blank" rel="noopener noreferrer">
            @camilosaka
          </a>
        </p>
      </footer>
    </div>
  );
}
