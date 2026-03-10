import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import JsonHighlight from "../components/JsonHighlight.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";

const DEMO_CREDENTIAL_ID = "4c9f7420-0d1e-4340-9edb-e612df2ecea6";
const DEMO_ENTITY_SLUG = "hashproof";

const PAYLOAD_EXAMPLE = `{
  "issuer": {
    "display_name": "Acme Corp",
    "slug": "acme-corp"
  },
  "platform": {
    "display_name": "HashProof",
    "slug": "hashproof"
  },
  "holder": {
    "full_name": "María García"
  },
  "context": {
    "type": "course",
    "title": "Intro to Blockchain"
  },
  "credential_type": "completion",
  "title": "Certificate of Completion",
  "values": {
    "holder_name": "María García",
    "details": "For completing Intro to Blockchain\nAcme Corp · June 2026"
  }
}`;


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
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  return (
    <div className="page">
      <SiteHeader />

      <main>
        {/* ── Hero ── */}
        <section className="hero">
          <h1>Issue verifiable credentials with one API call</h1>
          <p className="hero-lead">
            HashProof lets developers, platforms, and AI agents issue digital credentials
            that anyone can verify — backed by IPFS and a public blockchain registry.
          </p>
          <div className="hero-actions">
            <Link to="/docs" className="btn btn-primary">
              Read the docs
            </Link>
            <Link
              to={`/verify/${DEMO_CREDENTIAL_ID}`}
              className="btn btn-secondary"
            >
              See a live credential →
            </Link>
          </div>
          {stats && (
            <div className="hero-stats">
              <span className="hero-stats-since">Since March 10, 2026</span>
              <div className="hero-stats-row">
                <div className="hero-stat">
                  <span className="hero-stat-num">{stats.total_credentials.toLocaleString()}</span>
                  <span className="hero-stat-label">Credentials Issued</span>
                </div>
                <div className="hero-stat-sep" />
                <div className="hero-stat">
                  <span className="hero-stat-num">{stats.verified_entities.toLocaleString()}</span>
                  <span className="hero-stat-label">Verified Entities</span>
                </div>
              </div>
              <a
                className="hero-stat-explorer"
                href="https://celoscan.io/address/0x7a1B759A602Aba72a70f99Dffd0a386d7504ce9B#readContract#F8"
                target="_blank"
                rel="noopener noreferrer"
              >
                Verify onchain ↗
              </a>
            </div>
          )}
        </section>

        {/* ── Code snippet ── */}
        <section className="section">
          <div className="home-code-block">
            <div className="home-code-header">
              <span className="home-code-label">POST api.hashproof.dev/issueCredential</span>
              <span className="home-code-price">$0.10 USDC · x402 · Base or Celo</span>
            </div>
            <JsonHighlight code={PAYLOAD_EXAMPLE} />
          </div>
          <p className="home-code-note">
            Returns a <code>verification_url</code> to share with the credential holder.
            Payment is handled automatically via the{" "}
            <a
              href="https://github.com/csacanam/hashproof/blob/main/docs/X402-PAYMENT-FLOW.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              x402 protocol
            </a>{" "}
            — no API key or account required.
          </p>
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

        {/* ── Trust pipeline ── */}
        <section className="section">
          <h2>Built for trust</h2>
          <p className="section-p">
            Every credential is verified across three independent layers.
            If any layer fails to match, the credential is flagged — no exceptions.
          </p>
          <div className="home-pipeline">
            <div className="home-pipeline-item">
              <div className="home-pipeline-icon">⛓️</div>
              <div className="home-pipeline-body">
                <p className="home-pipeline-title">Blockchain contract</p>
                <p className="home-pipeline-desc">
                  The credential hash is registered on Celo mainnet at issuance.
                  Verification checks the contract first — it's the most authoritative source.
                </p>
              </div>
            </div>
            <div className="home-pipeline-connector">↓</div>
            <div className="home-pipeline-item">
              <div className="home-pipeline-icon">📦</div>
              <div className="home-pipeline-body">
                <p className="home-pipeline-title">IPFS content hash</p>
                <p className="home-pipeline-desc">
                  The credential JSON is pinned to IPFS. Any modification to the data
                  produces a different hash — making tampering immediately detectable.
                </p>
              </div>
            </div>
            <div className="home-pipeline-connector">↓</div>
            <div className="home-pipeline-item">
              <div className="home-pipeline-icon">🏛️</div>
              <div className="home-pipeline-body">
                <p className="home-pipeline-title">Entity verification</p>
                <p className="home-pipeline-desc">
                  The issuer's identity is checked against HashProof's verified entity registry.
                  Credentials show whether the issuer has been reviewed and approved.
                </p>
              </div>
            </div>
            <div className="home-pipeline-connector">↓</div>
            <div className="home-pipeline-item">
              <div className="home-pipeline-icon">📄</div>
              <div className="home-pipeline-body">
                <p className="home-pipeline-title">W3C Verifiable Credentials v2</p>
                <p className="home-pipeline-desc">
                  Every credential follows the W3C VC Data Model v2 standard —
                  interoperable with any system that understands the spec.
                </p>
              </div>
            </div>
          </div>
          <p className="home-pipeline-note">
            Even if HashProof goes offline, the blockchain and IPFS records remain
            independently verifiable by anyone.
          </p>
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
          <Link to="/entity-verification" className="home-entity-link">
            Learn how entity verification works →
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
