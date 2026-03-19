import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import ResponsiveCode from "../components/ResponsiveCode.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";

const DEMO_CREDENTIAL_ID = "e32183ea-5833-438c-9aae-a2432bcbb53d";

const CRYPTO_EXAMPLE = `import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { privateKeyToAccount } from "thirdweb/wallets";
import { base } from "thirdweb/chains";

const client  = createThirdwebClient({ clientId: "YOUR_CLIENT_ID" });
const account = privateKeyToAccount({ client, privateKey: process.env.PRIVATE_KEY });

let currentChain = base;
const wallet = {
  getAccount:  () => account,
  getChain:    () => currentChain,
  switchChain: async (chain) => { currentChain = chain; },
};

const fetchWithPayment = wrapFetchWithPayment(fetch, client, wallet);

const res = await fetchWithPayment("https://api.hashproof.dev/issueCredential", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    issuer:          { display_name: "HashProof Demo", slug: "hashproof-demo" },
    holder:          { full_name: "YOUR_NAME" },
    context:         { type: "certification", title: "HashProof API Quickstart" },
    credential_type: "completion",
    title:           "First Credential Issued",
    values: {
      holder_name: "YOUR_NAME",
      details:     "For successfully issuing a verifiable credential\\nusing the HashProof API.",
    },
  }),
});

const data = await res.json();
console.log(data.verification_url);`;

const APIKEY_EXAMPLE = `curl -X POST https://api.hashproof.dev/issueCredential \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "issuer":          { "display_name": "HashProof Demo", "slug": "hashproof-demo" },
    "holder":          { "full_name": "YOUR_NAME" },
    "context":         { "type": "certification", "title": "HashProof API Quickstart" },
    "credential_type": "completion",
    "title":           "First Credential Issued",
    "values": {
      "holder_name": "YOUR_NAME",
      "details":     "For successfully issuing a verifiable credential\\nusing the HashProof API."
    }
  }'`;


const STEPS = [
  {
    n: "1",
    title: "Call the API",
    desc: "Send credential data to POST /issueCredential. Pay per call with crypto (x402) or use a prepaid API key.",
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
  const [audience, setAudience] = useState("human"); // "human" | "agent"

  useEffect(() => {
    fetch(`${API_URL}/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  return (
    <div className="page">
      <Helmet>
        <title>Issue Verifiable Credentials with One API Call | HashProof</title>
        <meta
          name="description"
          content="HashProof lets developers and platforms create certificates anyone can verify."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hashproof.dev/" />
        <meta
          property="og:title"
          content="Issue Verifiable Credentials with One API Call | HashProof"
        />
        <meta
          property="og:description"
          content="HashProof lets developers and platforms create certificates anyone can verify."
        />
        <meta property="og:image" content="https://hashproof.dev/thumbnail.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://hashproof.dev/" />
        <meta
          name="twitter:title"
          content="Issue Verifiable Credentials with One API Call | HashProof"
        />
        <meta
          name="twitter:description"
          content="HashProof lets developers and platforms create certificates anyone can verify."
        />
        <meta name="twitter:image" content="https://hashproof.dev/thumbnail.png" />
      </Helmet>
      <SiteHeader />

      <main>
        {/* ── Hero ── */}
        <section className="hero">
          <h1>Issue verifiable credentials with one API call</h1>
          <p className="hero-lead">
            HashProof lets developers, platforms, and AI agents issue digital credentials that anyone can verify.
          </p>
          <div className="hero-actions">
            <Link to="/docs" className="btn btn-primary">
              Read the docs
            </Link>
            <Link
              to={`/verify/${DEMO_CREDENTIAL_ID}`}
              className="btn btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
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

        {/* ── 3 paths: Developers / Enterprises / Agents ── */}
        <section className="section home-audience-section">
          <div className="home-audience-tabs">
            <button
              type="button"
              className={`home-audience-tab ${audience === "human" ? "home-audience-tab--active" : ""}`}
              onClick={() => setAudience("human")}
            >
              Pay with crypto
            </button>
            <button
              type="button"
              className={`home-audience-tab ${audience === "enterprise" ? "home-audience-tab--active" : ""}`}
              onClick={() => setAudience("enterprise")}
            >
              Pay with API key
            </button>
            <button
              type="button"
              className={`home-audience-tab ${audience === "agent" ? "home-audience-tab--active" : ""}`}
              onClick={() => setAudience("agent")}
            >
              For Agents
            </button>
          </div>

          {audience === "human" && (
            <>
              <div className="home-code-block">
                <div className="home-code-header">
                  <span className="home-code-label">POST api.hashproof.dev/issueCredential</span>
                  <span className="home-code-price">$0.10 USDC · x402 · Base or Celo</span>
                </div>
                <ResponsiveCode code={CRYPTO_EXAMPLE} />
              </div>
              <p className="home-code-replace">
                No API key, no signup. Your wallet pays $0.10 USDC per credential via{" "}
                <a href="https://www.x402.org/" target="_blank" rel="noopener noreferrer">x402</a>.
              </p>
              <p className="home-code-note">
                Returns a <code>verification_url</code> to share with the credential holder.
              </p>
              <Link to="/docs#quickstart-x402" className="btn btn-secondary" style={{ marginTop: "1rem", display: "inline-block" }}>
                See the full x402 quick start →
              </Link>
            </>
          )}

          {audience === "enterprise" && (
            <>
              <div className="home-code-block">
                <div className="home-code-header">
                  <span className="home-code-label">POST api.hashproof.dev/issueCredential</span>
                  <span className="home-code-price">1 credit per credential · no wallet needed</span>
                </div>
                <ResponsiveCode code={APIKEY_EXAMPLE} />
              </div>
              <p className="home-code-replace">
                Same API, no crypto. Each call deducts 1 prepaid credit.
              </p>
              <p className="home-code-note">
                Returns a <code>verification_url</code> to share with the credential holder.
              </p>
              <div className="home-agent-cta" style={{ marginTop: "1.5rem" }}>
                <p className="home-agent-title">How to get your API key</p>
                <ol className="home-agent-steps">
                  <li>Contact <a href="mailto:hi@hashproof.dev">hi@hashproof.dev</a> to purchase prepaid credits.</li>
                  <li>Receive your API key tied to your organization.</li>
                  <li>Replace <code>YOUR_API_KEY</code> in the example above and start issuing.</li>
                </ol>
              </div>
              <Link to="/docs#quickstart-apikey" className="btn btn-secondary" style={{ marginTop: "1rem", display: "inline-block" }}>
                See the API key quick start →
              </Link>
            </>
          )}

          {audience === "agent" && (
            <div className="home-agent-cta">
              <p className="home-agent-title">3 steps. That&apos;s it.</p>
              <ol className="home-agent-steps">
                <li>Read <a href="https://hashproof.dev/skill.md" target="_blank" rel="noopener noreferrer"><code>hashproof.dev/skill.md</code></a></li>
                <li>Follow the <strong>Quick start</strong>: ask your human&apos;s name, call the API, pay $0.10 USDC.</li>
                <li>Send the <code>verification_url</code> to your human. Done.</li>
              </ol>
              <p className="home-agent-desc">
                The skill file has everything: what to ask, how to pay, how to use templates, and how to preview certificates before issuing.
              </p>
            </div>
          )}
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
