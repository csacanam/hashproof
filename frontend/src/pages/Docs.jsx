import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
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
  { id: "custom-templates",    label: "Custom Templates" },
  { id: "entity-verification", label: "Entity Verification" },
  { id: "enterprise",          label: "Enterprise plans" },
  // { id: "issuer-auth",         label: "Issuer Authorizations" },
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
    "full_name": "Jane Doe"
  },
  "context": {
    "type": "course",
    "title": "Intro to Blockchain"
  },
  "credential_type": "completion",
  "title": "Certificate of Completion",
  "values": {
    "holder_name": "Jane Doe",
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
    issuer:          { display_name: "HashProof Demo", slug: "hashproof-demo" },
    platform:        { display_name: "HashProof Demo", slug: "hashproof-demo" },
    holder:          { full_name: process.env.YOUR_NAME },
    context:         { type: "certification", title: "HashProof API Quickstart" },
    credential_type: "completion",
    title:           "First Credential Issued",
    values: {
      holder_name: process.env.YOUR_NAME,
      details:     "For successfully issuing a verifiable credential\nusing the HashProof API.",
    },
  }),
});

const data = await res.json();
console.log(data.verification_url);`;
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
      <Helmet>
        <title>Verifiable Credentials API Documentation | HashProof</title>
        <meta
          name="description"
          content="Learn how to issue and verify blockchain-backed credentials using a simple API and pay-per-credential model."
        />
      </Helmet>
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
                <li>
                  <strong>Environment variables</strong> — <code>PRIVATE_KEY</code> (wallet) and <code>YOUR_NAME</code> (recipient name for the credential).
                </li>
              </ul>
            </SubSection>

            <SubSection id="quickstart-node" title="Issue your first credential">
              <CodeBlock lang="bash" label="terminal" code={`npm install thirdweb`} />
              <CodeTabs tabs={[
                { label: "Celo", lang: "js", code: nodeExample("celo") },
                { label: "Base", lang: "js", code: nodeExample("base") },
              ]} />
              <CodeBlock lang="bash" label="terminal" code={`PRIVATE_KEY=0x... YOUR_NAME="Jane Doe" node issue.mjs`} />
              <CodeBlock lang="bash" label="output" code={`https://hashproof.dev/verify/a1b2c3d4-...`} />
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
              <p className="docs-p">
                Pay with <strong>USDC</strong> on <strong>Base</strong> or <strong>Celo</strong> — $0.10 per credential, no gas fees on your end.
              </p>
            </SubSection>
          </Section>

          {/* issueCredential */}
          <Section id="issue-credential" title="POST /issueCredential">
            <div className="docs-endpoint">
              <span className="docs-method docs-method--post">POST</span>
              <code className="docs-path">{API_BASE}/issueCredential</code>
            </div>
            <p className="docs-p">
              Issues one verifiable credential. Paid — <strong>$0.10 USDC via x402</strong>.
              There is no API key by default. If you need to issue without crypto, see{" "}
              <button
                className="docs-link-btn"
                onClick={() => document.getElementById("enterprise")?.scrollIntoView({ behavior: "smooth" })}
              >
                Enterprise plans
              </button>
              .
            </p>
            <p className="docs-p">
              The minimal example below uses the default template. To use your own certificate design,
              see <button className="docs-link-btn" onClick={() => document.getElementById("custom-templates")?.scrollIntoView({ behavior: "smooth" })}>Custom Templates</button>.
            </p>
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
                ["template", "object", false, "Inline custom template (create once). See Custom Templates."],
                ["template_slug", "string", false, "Slug of an existing template. Omit for default design."],
                ["template_id", "UUID", false, "UUID of an existing template. Use only one of template, template_slug, or template_id."],
                ["background_url_override", "string", false, "With template_slug/template_id: use this URL as background for this credential only (layout unchanged)."],
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
                ["401", "", false, "Invalid API key (when using Authorization or X-API-Key)"],
                ["402", "", false, "Payment required — x402 challenge, or API key has no credits (insufficient_credits)"],
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
              Use this to check if an issuer or platform is verified before displaying credentials.
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

          {/* custom templates */}
          <Section id="custom-templates" title="Custom Templates">
            <p className="docs-p">
              <strong>What is a template?</strong> A template is the definition of <strong>how to paint the credential data onto the PDF canvas</strong>: page size, background image, and where and how each value from <code>values</code> is drawn (position, font, color, alignment, bold/italic, etc.). You send the data; the template defines how it is laid out.
            </p>
            <p className="docs-p">
              You can <strong>use an existing template</strong> (by <code>template_slug</code> or <code>template_id</code>) or <strong>create one inline</strong> the first time you issue; after that, use the slug to reuse it. Provide <strong>only one</strong> of <code>template</code>, <code>template_slug</code>, or <code>template_id</code> per request. With an existing template you can optionally pass <code>background_url_override</code> to use a different background image for that credential only (layout unchanged).
            </p>

            <SubSection id="ct-existing" title="Using an existing template">
              <p className="docs-p">
                When the template was already created (e.g. in a previous request with inline <code>template</code>), send only the template reference and the credential data. No <code>template</code> object — the layout is stored.
              </p>
              <CodeBlock code={`{
  "issuer":   { "display_name": "Acme Corp", "slug": "acme-corp" },
  "platform": { "display_name": "Acme Corp", "slug": "acme-corp" },
  "holder":   { "full_name": "Jane Doe" },
  "context":  { "type": "event", "title": "Expo 2026" },
  "credential_type": "attendance",
  "title": "Certificate of Attendance",
  "template_slug": "acme-certificate-v1",
  "values": {
    "holder_name": "Jane Doe",
    "details": "Attended the expo stand."
  }
}`} label="request body (template already created)" />
            </SubSection>

            <SubSection id="ct-inline" title="Creating a template inline (first time only)">
              <p className="docs-p">
                To define a new design, pass a <code>template</code> object in the request. The API creates the template and issues the credential. For every <strong>next</strong> credential with the same layout, use <code>template_slug</code> (as in the example above) instead of sending <code>template</code> again. Inline is <strong>create-only</strong>: if <code>template.slug</code> already exists, the request is rejected.
              </p>
              <p className="docs-p">
                QR: the verification QR is drawn near the bottom-right corner. Leave that area empty in your background. Required keys: <code>GET {API_BASE}/templates/:slug_or_uuid/requirements</code>.
              </p>
            </SubSection>

            <SubSection id="ct-fields" title="Template fields">
              <p className="docs-note">
                Dimensions are used <strong>as-is</strong> (no conversion). Use the same values as your design (e.g. pixels from your canvas): <code>page_width</code>, <code>page_height</code>, and field <code>x</code>, <code>y</code>, <code>width</code>, <code>height</code> in the same units. Defaults: 595×842 (A4 portrait).
              </p>
              <ParamTable rows={[
                ["template.slug",           "string", true, "Unique template slug (global). Used later with template_slug."],
                ["template.name",           "string", true, "Human-readable template name"],
                ["template.background_url", "string", true, "URL of your certificate background image (PNG or JPG)"],
                ["template.page_width",     "number", false, "Page width. Default: 595 (A4 portrait). Same units as your design."],
                ["template.page_height",    "number", false, "Page height. Default: 842 (A4 portrait). Same units as your design."],
                ["template.fields_json",    "array",  true, "Array of field objects defining text placement"],
                ["fields_json[].key",       "string", true, "Maps to a key in values{}"],
                ["fields_json[].x",         "number", true, "Horizontal position from left (same units as page)"],
                ["fields_json[].y",         "number", true, "Vertical position from top"],
                ["fields_json[].width",     "number", false, "Text box width"],
                ["fields_json[].height",    "number", false, "Optional. Height for layout"],
                ["fields_json[].font_size", "number", false, "Font size. Default: 12"],
                ["fields_json[].font_color","string", false, "Hex color. Default: #000000"],
                ["fields_json[].align",     "string", false, "left · center · right. Default: left"],
                ["fields_json[].required",  "boolean",false, "If true, issueCredential returns 400 when the key is missing from values"],
                ["fields_json[].bold",      "boolean", false, "If true, text in bold. Default: false"],
                ["fields_json[].italic",    "boolean", false, "If true, text in italic. Default: false"],
                ["fields_json[].underline","boolean", false, "If true, text underlined. Default: false"],
                ["fields_json[].strike",    "boolean", false, "If true, text struck through. Default: false"],
              ]} />
            </SubSection>

            <SubSection id="ct-example" title="Example: inline template (first issuance)">
              <CodeBlock code={`{
  "issuer":   { "display_name": "Acme Corp", "slug": "acme-corp" },
  "platform": { "display_name": "Acme Corp", "slug": "acme-corp" },
  "holder":   { "full_name": "Jane Doe" },
  "context":  { "type": "course", "title": "Intro to Blockchain" },
  "credential_type": "completion",
  "title": "Certificate of Completion",
  "template": {
    "slug": "acme-certificate-v1",
    "name": "Acme Certificate v1",
    "background_url": "https://your-cdn.com/certificate-bg.png",
    "page_width": 1123,
    "page_height": 794,
    "fields_json": [
      {
        "key": "holder_name",
        "x": 100, "y": 320,
        "width": 923,
        "font_size": 48,
        "font_color": "#1a1a2e",
        "align": "center",
        "required": true
      },
      {
        "key": "details",
        "x": 150, "y": 410,
        "width": 823,
        "font_size": 20,
        "font_color": "#555555",
        "align": "center"
      }
    ]
  },
  "values": {
    "holder_name": "Jane Doe",
    "details": "For completing Intro to Blockchain"
  }
}`} label="request body" />
              <p className="docs-p">
                The QR code is added automatically at the bottom-right corner — you don't need to define it as a field.
              </p>
            </SubSection>
          </Section>

          {/* entity verification */}
          <Section id="entity-verification" title="Entity Verification">
            <p className="docs-p">
              Organizations and individuals can verify their identity through HashProof.
              Verified issuers appear with a verified badge (✅) on every credential they issue.
            </p>

            <SubSection id="ev-how" title="How to request verification">
              <ol className="docs-ol">
                <li>Go to your entity page: <code>/entities/:slug</code></li>
                <li>Click <strong>Request verification</strong>.</li>
                <li>Fill the form (organization or individual) and pay $49 USDC.</li>
                <li>HashProof reviews your request and approves it manually.</li>
                <li>Once approved, your entity is marked as verified and your wallets are authorized.</li>
              </ol>
            </SubSection>

            <SubSection id="ev-wallets" title="Authorized wallets">
              <p className="docs-p">
                When you verify your entity, you declare which EVM wallets are authorized
                to issue credentials on your behalf. Only those wallets can call
                <code>POST /issueCredential</code> with your <code>issuer_entity_id</code>.
              </p>
            </SubSection>
          </Section>

          {/* enterprise */}
          <Section id="enterprise" title="Enterprise plans (API key, no crypto)">
            <p className="docs-p">
              By default, HashProof uses <strong>x402</strong>: each call to <code>POST /issueCredential</code> is paid with
              <strong> USDC</strong> and there is <strong>no API key</strong>.
            </p>
            <p className="docs-p">
              If your institution can’t or doesn’t want to handle crypto, HashProof offers <strong>enterprise plans</strong>:
              you purchase <strong>prepaid credits</strong>, and we issue an <strong>API key</strong> tied to your entity.
              One credit = one credential; HashProof assumes the on-chain costs.
            </p>
            <p className="docs-p">
              Contact <a href="mailto:hi@hashproof.dev">hi@hashproof.dev</a> to purchase credits and receive your API key.
            </p>
            <SubSection id="enterprise-auth" title="How API key auth works">
              <p className="docs-p">Send one of these headers:</p>
              <ul className="docs-ol">
                <li><code>Authorization: Bearer YOUR_API_KEY</code></li>
                <li><code>X-API-Key: YOUR_API_KEY</code></li>
              </ul>
              <p className="docs-p">
                The key is tied to a single issuer entity. Each successful issuance deducts <strong>1 credit</strong>.
                If you run out of credits, the API returns <code>402</code> with <code>code: "insufficient_credits"</code>.
              </p>
            </SubSection>
          </Section>

          {/* Issuer Authorizations — commented out for now
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
                <a href="mailto:hi@hashproof.dev">hi@hashproof.dev</a> with:
              </p>
              <ul className="docs-ol">
                <li>Your entity ID (issuer)</li>
                <li>The platform entity ID you want to authorize</li>
                <li>Whether you want to <strong>grant</strong> or <strong>revoke</strong> access</li>
              </ul>
            </SubSection>
          </Section>
          */}

        </main>
      </div>
    </div>
  );
}
