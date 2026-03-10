import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import CodeHighlight from "../components/CodeHighlight.jsx";

const API_BASE = "https://api.hashproof.dev";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="docs-copy-btn" onClick={handle} aria-label="Copy">
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, lang = "json", label }) {
  return (
    <div className="docs-code-block">
      {label && (
        <div className="docs-code-top">
          <span className="docs-code-lang">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      {!label && <CopyButton text={code} />}
      <CodeHighlight code={code} lang={lang} className="docs-code" />
    </div>
  );
}

function CodeTabs({ tabs }) {
  const [active, setActive] = useState(tabs[0].label);
  const current = tabs.find((t) => t.label === active);
  return (
    <div className="docs-code-block">
      <div className="docs-code-top">
        <div className="docs-tabs">
          {tabs.map((t) => (
            <button
              key={t.label}
              className={`docs-tab ${active === t.label ? "docs-tab--active" : ""}`}
              onClick={() => setActive(t.label)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CopyButton text={current.code} />
      </div>
      <CodeHighlight code={current.code} lang={current.lang} className="docs-code" />
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section className="docs-section" id={id}>
      <h2 className="docs-h2">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ id, title, children }) {
  return (
    <div className="docs-subsection" id={id}>
      <h3 className="docs-h3">{title}</h3>
      {children}
    </div>
  );
}

function ParamTable({ rows }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, type, req, desc]) => (
            <tr key={field}>
              <td><code>{field}</code></td>
              <td><span className="docs-type">{type}</span></td>
              <td>{req ? <span className="docs-req">yes</span> : <span className="docs-opt">no</span>}</td>
              <td>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NAV = [
  { id: "quickstart",          label: "Quick Start" },
  { id: "x402",                label: "x402 Payments" },
  { id: "issue-credential",    label: "POST /issueCredential" },
  { id: "verify",              label: "GET /verify/:id" },
  { id: "entities",            label: "GET /entities/:id" },
  { id: "entity-verification", label: "Entity Verification" },
  { id: "issuer-auth",         label: "Issuer Authorizations" },
];

const MINIMAL_EXAMPLE = `{
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
    "details": "For completing Intro to Blockchain\\nAcme Corp · June 2026"
  }
}`;

function nodeExample(chain) {
  return `import { createThirdwebClient } from "thirdweb";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { privateKeyToAccount } from "thirdweb/wallets";
import { ${chain} } from "thirdweb/chains";

const client  = createThirdwebClient({ clientId: "YOUR_CLIENT_ID" });
const account = privateKeyToAccount({ client, privateKey: process.env.PRIVATE_KEY });

let currentChain = ${chain};
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
    issuer:          { display_name: "HashProof", slug: "hashproof" },
    platform:        { display_name: "HashProof", slug: "hashproof" },
    holder:          { full_name: "Your Name" },
    context:         { type: "certification", title: "HashProof API Quickstart" },
    credential_type: "completion",
    title:           "First Credential Issued",
    values: {
      holder_name: "Your Name",
      details:     "For successfully issuing a verifiable credential using the HashProof API.",
    },
  }),
});

const { verification_url } = await res.json();
console.log(verification_url);`;
}


const ISSUE_RESPONSE = `{
  "id": "a1b2c3d4-...",
  "verification_url": "https://hashproof.dev/verify/a1b2c3d4-...",
  "tx_hash": "0xabc...",
  "ipfs_cid": "bafybeig...",
  "ipfs_uri": "https://gateway.pinata.cloud/ipfs/bafybeig..."
}`;

const VERIFY_RESPONSE = `{
  "id": "a1b2c3d4-...",
  "status": "active",
  "status_source": "contract",
  "title": "Certificate of Completion",
  "credential_type": "completion",
  "created_at": "2026-01-01T00:00:00Z",
  "expires_at": null,
  "revoked_at": null,
  "tx_hash": "0xabc...",
  "ipfs_uri": "https://gateway.pinata.cloud/ipfs/bafybeig...",
  "issuer_verified": true,
  "issuer_status": "organization_verified",
  "platform_verified": true,
  "platform_status": "organization_verified"
}`;

const ENTITY_RESPONSE = `{
  "id": "uuid",
  "display_name": "Acme Corp",
  "slug": "acme-corp",
  "website": "https://acme.com",
  "status": "organization_verified",
  "is_verified": true,
  "email_verified": true,
  "last_verified_at": "2026-01-01T00:00:00Z"
}`;

export default function Docs() {
  const [active, setActive] = useState("quickstart");
  const [menuOpen, setMenuOpen] = useState(false);
  const observer = useRef(null);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.current.observe(el);
    });
    return () => observer.current?.disconnect();
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <div className="docs-page">
      {/* Top bar */}
      <header className="docs-topbar">
        <Link to="/" className="docs-logo">HashProof</Link>
        <span className="docs-topbar-title">Documentation</span>
        <button
          className="docs-menu-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </header>

      <div className="docs-layout">
        {/* Sidebar */}
        <nav className={`docs-sidebar ${menuOpen ? "docs-sidebar--open" : ""}`}>
          <ul className="docs-nav">
            {NAV.map(({ id, label }) => (
              <li key={id}>
                <button
                  className={`docs-nav-item ${active === id ? "docs-nav-item--active" : ""}`}
                  onClick={() => scrollTo(id)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <main className="docs-content">

          {/* Quick Start */}
          <Section id="quickstart" title="Quick Start">
            <p className="docs-p">
              Issue a verifiable credential with a single API call.
              No account, no API key — each credential costs <strong>$0.10 USDC</strong>, paid
              on-chain automatically via x402.
            </p>

            <SubSection id="quickstart-prereqs" title="Before you start">
              <ul className="docs-ol">
                <li>
                  <strong>Node.js 18+</strong>
                </li>
                <li>
                  <strong>A wallet with USDC</strong> on Base or Celo — at least $0.10 per credential.
                </li>
                <li>
                  <strong>thirdweb Client ID</strong> — free at{" "}
                  <a href="https://thirdweb.com/dashboard" target="_blank" rel="noopener noreferrer">thirdweb.com/dashboard</a>.
                  Create a project and copy the Client ID.
                </li>
              </ul>
            </SubSection>

            <SubSection id="quickstart-node" title="Issue your first credential">
              <CodeBlock lang="bash" label="terminal" code={`npm install thirdweb`} />
              <CodeTabs tabs={[
                { label: "Celo", lang: "js", code: nodeExample("celo") },
                { label: "Base", lang: "js", code: nodeExample("base") },
              ]} />
              <CodeBlock lang="bash" label="terminal" code={`PRIVATE_KEY=0x... node issue.mjs`} />
            </SubSection>

            <SubSection id="quickstart-response" title="What you get back">
              <CodeBlock code={ISSUE_RESPONSE} label="response" />
              <p className="docs-p">
                Share <code>verification_url</code> with the credential holder — it renders the
                certificate and QR code. The same URL is printed on the downloadable PDF.
              </p>
            </SubSection>
          </Section>

          {/* x402 */}
          <Section id="x402" title="x402 Payments">
            <p className="docs-p">
              HashProof charges <strong>$0.10 USDC per credential</strong>, paid on-chain using the{" "}
              <strong>x402 protocol</strong>. There is no subscription, no billing dashboard, and no
              API key to manage. You pay only for what you issue.
            </p>

            <SubSection id="x402-flow" title="What happens under the hood">
              <ol className="docs-ol">
                <li>Your client calls <code>POST /issueCredential</code>.</li>
                <li>The API responds <code>402 Payment Required</code> with the amount and network.</li>
                <li>The thirdweb SDK signs a USDC transfer authorization from your wallet.</li>
                <li>The SDK retries the request with the payment header — no manual steps needed.</li>
                <li>HashProof settles the payment on-chain and returns the issued credential.</li>
              </ol>
            </SubSection>

            <SubSection id="x402-networks" title="Supported networks">
              <div className="docs-badge-row">
                <span className="docs-badge">Base</span>
                <span className="docs-badge">Celo</span>
                <span className="docs-badge">USDC</span>
                <span className="docs-badge">$0.10 per credential</span>
              </div>
              <p className="docs-p" style={{ marginTop: "0.75rem" }}>
                You choose which network to pay on. Both settle in USDC with no gas fees on your end.
              </p>
            </SubSection>
          </Section>

          {/* issueCredential */}
          <Section id="issue-credential" title="POST /issueCredential">
            <div className="docs-endpoint">
              <span className="docs-method docs-method--post">POST</span>
              <code className="docs-path">{API_BASE}/issueCredential</code>
            </div>
            <p className="docs-p">Issues one verifiable credential. Paid — $0.10 USDC via x402.</p>

            <SubSection id="issue-body" title="Request body">
              <ParamTable rows={[
                ["issuer.display_name", "string", true, "Name of the issuing organization"],
                ["issuer.slug", "string", true, "URL-safe identifier, e.g. acme-corp"],
                ["platform.display_name", "string", true, "Name of the platform managing issuance"],
                ["platform.slug", "string", true, "URL-safe identifier"],
                ["holder.full_name", "string", true, "Full name of the credential recipient"],
                ["holder.email", "string", false, "Email for delivery"],
                ["context.type", "enum", true, "event · course · diploma · training · certification · membership · other"],
                ["context.title", "string", true, "Name of the event, course, or program"],
                ["context.starts_at", "ISO 8601", false, "Start date"],
                ["context.ends_at", "ISO 8601", false, "End date"],
                ["credential_type", "enum", true, "attendance · completion · achievement · participation · membership · certification"],
                ["title", "string", true, "Title printed on the credential PDF"],
                ["expires_at", "ISO 8601 | null", false, "Expiration date. null = never expires"],
                ["values.holder_name", "string", true, "Name rendered on the certificate (default template)"],
                ["values.details", "string", false, "Optional subtitle on the certificate"],
                ["template_slug", "string", false, "Slug of an existing template. Defaults to hashproof"],
                ["issuer_entity_id", "UUID", false, "Your entity ID from hashproof.dev/entities. Credentials will show your verified badge if your entity is verified"],
                ["platform_entity_id", "UUID", false, "The platform entity issuing on your behalf. Can be the same as issuer for self-issuance"],
              ]} />
            </SubSection>

            <SubSection id="issue-example" title="Minimal example">
              <CodeBlock code={MINIMAL_EXAMPLE} label="request body" />
            </SubSection>

            <SubSection id="issue-response" title="Response 200">
              <CodeBlock code={ISSUE_RESPONSE} label="response" />
              <p className="docs-p">
                Share <code>verification_url</code> with the credential holder.
                The QR code on the PDF points to that URL.
              </p>
            </SubSection>

            <SubSection id="issue-errors" title="Errors">
              <ParamTable rows={[
                ["400", "", false, "Missing required field or invalid value"],
                ["402", "", false, "Payment required — x402 challenge in PAYMENT-REQUIRED header"],
                ["403", "", false, "Entity suspended, or paying wallet not in authorized_wallets"],
                ["500", "", false, "IPFS, on-chain, or DB error"],
              ]} />
            </SubSection>
          </Section>

          {/* verify */}
          <Section id="verify" title="GET /verify/:id">
            <div className="docs-endpoint">
              <span className="docs-method docs-method--get">GET</span>
              <code className="docs-path">{API_BASE}/verify/:id</code>
            </div>
            <p className="docs-p">
              Full 3-layer verification: blockchain contract → IPFS content hash → database.
              If any layer fails to match, the credential is flagged.
            </p>

            <SubSection id="verify-response" title="Response 200">
              <CodeBlock code={VERIFY_RESPONSE} label="response" />
            </SubSection>

            <SubSection id="verify-status" title="status values">
              <ParamTable rows={[
                ["active", "", false, "Valid, not revoked, not expired"],
                ["revoked", "", false, "Explicitly revoked on-chain"],
                ["expired", "", false, "Past expires_at"],
                ["not_found", "", false, "Not registered on-chain"],
                ["unknown", "", false, "Contract unreachable"],
              ]} />
            </SubSection>

            <SubSection id="verify-other" title="Other endpoints">
              <div className="docs-endpoint" style={{ marginBottom: "0.5rem" }}>
                <span className="docs-method docs-method--get">GET</span>
                <code className="docs-path">/verify/:id/contract</code>
                <span className="docs-endpoint-note">Blockchain only</span>
              </div>
              <div className="docs-endpoint" style={{ marginBottom: "0.5rem" }}>
                <span className="docs-method docs-method--get">GET</span>
                <code className="docs-path">/verify/:id/ipfs</code>
                <span className="docs-endpoint-note">IPFS integrity check</span>
              </div>
              <div className="docs-endpoint">
                <span className="docs-method docs-method--get">GET</span>
                <code className="docs-path">/verify/:id/pdf</code>
                <span className="docs-endpoint-note">Download PDF. Add ?inline=1 to preview</span>
              </div>
            </SubSection>
          </Section>

          {/* entities */}
          <Section id="entities" title="GET /entities/:id">
            <div className="docs-endpoint">
              <span className="docs-method docs-method--get">GET</span>
              <code className="docs-path">{API_BASE}/entities/:id</code>
            </div>
            <p className="docs-p">
              Returns entity info and verification status. <code>:id</code> can be a UUID or slug.
            </p>
            <CodeBlock code={ENTITY_RESPONSE} label="response" />

            <SubSection id="entities-status" title="status values">
              <ParamTable rows={[
                ["unverified", "", false, "Registered but not yet verified"],
                ["individual_verified", "", false, "Verified as a person"],
                ["organization_verified", "", false, "Verified as an organization"],
                ["suspended", "", false, "Suspended by HashProof"],
              ]} />
            </SubSection>
          </Section>

          {/* entity verification */}
          <Section id="entity-verification" title="Entity Verification">
            <p className="docs-p">
              Organizations and individuals can verify their identity through HashProof.
              Verified issuers appear with a ✅ badge on every credential they issue.
            </p>

            <SubSection id="ev-how" title="How to request verification">
              <ol className="docs-ol">
                <li>Go to your entity page: <code>/entities/:slug</code></li>
                <li>Click <strong>Request verification</strong>.</li>
                <li>Fill the form (organization or individual) and pay $0.10 USDC.</li>
                <li>HashProof reviews your request and approves it manually.</li>
                <li>Once approved, your entity is marked as verified and your wallets are authorized.</li>
              </ol>
            </SubSection>

            <SubSection id="ev-wallets" title="Authorized wallets">
              <p className="docs-p">
                When you verify your entity, you declare which EVM wallets are authorized
                to issue credentials on your behalf. Only those wallets can call
                <code> POST /issueCredential</code> with your <code>issuer_entity_id</code>.
              </p>
            </SubSection>
          </Section>

          {/* issuer auth */}
          <Section id="issuer-auth" title="Issuer Authorizations">
            <p className="docs-p">
              If a <strong>platform</strong> (e.g. HashProof) wants to issue credentials on behalf
              of a <strong>verified issuer</strong> (e.g. Acme Corp), the issuer must explicitly
              authorize the platform.
            </p>

            <SubSection id="ia-rules" title="Authorization rules">
              <ParamTable rows={[
                ["issuer == platform", "", false, "No restriction. Wallet must be in issuer.authorized_wallets"],
                ["issuer unverified", "", false, "No restriction. Any wallet can issue"],
                ["issuer verified + platform different", "", false, "Platform must have an approved authorization row AND wallet in platform.authorized_wallets"],
                ["issuer suspended", "", false, "Always 403 — cannot issue"],
              ]} />
            </SubSection>

            <SubSection id="ia-request" title="How to request authorization">
              <p className="docs-p">
                Authorizations are managed by HashProof. To grant a platform permission to issue
                on your behalf — or to revoke an existing authorization — contact us at{" "}
                <a href="mailto:hello@hashproof.dev">hello@hashproof.dev</a> with:
              </p>
              <ul className="docs-ol">
                <li>Your entity ID (issuer)</li>
                <li>The platform entity ID you want to authorize</li>
                <li>Whether you want to <strong>grant</strong> or <strong>revoke</strong> access</li>
              </ul>
            </SubSection>
          </Section>

        </main>
      </div>
    </div>
  );
}
