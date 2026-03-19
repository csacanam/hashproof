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
  { id: "authentication",      label: "Authentication" },
  { id: "issue-credential",    label: "POST /issueCredential" },
  { id: "templates",           label: "Templates" },
  { id: "template-preview",    label: "Template Preview" },
  { id: "verify",              label: "GET /verify/:id" },
  { id: "entities",            label: "GET /entities/:id" },
  { id: "entity-verification", label: "Entity Verification" },
];

function x402Example(chain) {
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

const res = await fetchWithPayment("${API_BASE}/issueCredential", {
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
      details:     "For successfully issuing a verifiable credential\\nusing the HashProof API.",
    },
  }),
});

const data = await res.json();
console.log(data.verification_url);`;
}

function apiKeyExample() {
  return `curl -X POST ${API_BASE}/issueCredential \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "issuer":   { "display_name": "Acme Corp", "slug": "acme-corp" },
    "platform": { "display_name": "Acme Corp", "slug": "acme-corp" },
    "holder":   { "full_name": "Jane Doe" },
    "context":  { "type": "certification", "title": "Intro to Blockchain" },
    "credential_type": "completion",
    "title": "Certificate of Completion",
    "values": {
      "holder_name": "Jane Doe",
      "details": "For completing Intro to Blockchain"
    }
  }'`;
}

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
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hashproof.dev/docs" />
        <meta
          property="og:title"
          content="Verifiable Credentials API Documentation | HashProof"
        />
        <meta
          property="og:description"
          content="Learn how to issue and verify blockchain-backed credentials using a simple API and pay-per-credential model."
        />
        <meta property="og:image" content="https://hashproof.dev/thumbnail.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://hashproof.dev/docs" />
        <meta
          name="twitter:title"
          content="Verifiable Credentials API Documentation | HashProof"
        />
        <meta
          name="twitter:description"
          content="Learn how to issue and verify blockchain-backed credentials using a simple API and pay-per-credential model."
        />
        <meta name="twitter:image" content="https://hashproof.dev/thumbnail.png" />
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
              Each credential costs <strong>$0.10 USDC</strong>. Choose how you want to pay:
            </p>

            <SubSection id="quickstart-paths" title="Three ways to get started">
              <div className="docs-callout-row">
                <div className="docs-callout">
                  <p className="docs-callout-title">Pay with crypto</p>
                  <p className="docs-callout-desc">
                    No account, no API key. Pay $0.10 USDC per credential automatically from your wallet via x402.
                    You need a wallet with USDC on Base or Celo and a{" "}
                    <a href="https://thirdweb.com/dashboard" target="_blank" rel="noopener noreferrer">thirdweb Client ID</a> (free).
                  </p>
                </div>
                <div className="docs-callout">
                  <p className="docs-callout-title">Pay with API key</p>
                  <p className="docs-callout-desc">
                    No wallet needed. Purchase prepaid credits from HashProof, get an API key,
                    and use it like any standard REST API. Contact{" "}
                    <a href="mailto:hi@hashproof.dev">hi@hashproof.dev</a>.
                  </p>
                </div>
                <div className="docs-callout">
                  <p className="docs-callout-title">AI Agent</p>
                  <p className="docs-callout-desc">
                    Read <a href="https://hashproof.dev/skill.md" target="_blank" rel="noopener noreferrer">skill.md</a> and
                    follow the instructions. The skill file has everything: what to ask the human, how to pay, and how to use templates.
                  </p>
                </div>
              </div>
            </SubSection>

            <SubSection id="quickstart-x402" title="Quick start — Pay with crypto">
              <p className="docs-p">Prerequisites: Node.js 18+, a wallet with USDC on Base or Celo, and a thirdweb Client ID.</p>
              <CodeBlock lang="bash" label="terminal" code={`npm install thirdweb`} />
              <CodeTabs tabs={[
                { label: "Celo", lang: "js", code: x402Example("celo") },
                { label: "Base", lang: "js", code: x402Example("base") },
              ]} />
              <CodeBlock lang="bash" label="terminal" code={`PRIVATE_KEY=0x... YOUR_NAME="Jane Doe" node issue.mjs`} />
              <CodeBlock lang="bash" label="output" code={`https://hashproof.dev/verify/a1b2c3d4-...`} />
            </SubSection>

            <SubSection id="quickstart-apikey" title="Quick start — Pay with API key">
              <p className="docs-p">Prerequisites: an API key from HashProof with prepaid credits.</p>
              <CodeBlock lang="bash" label="terminal" code={apiKeyExample()} />
              <CodeBlock lang="bash" label="output" code={`https://hashproof.dev/verify/a1b2c3d4-...`} />
            </SubSection>

            <SubSection id="quickstart-agent" title="For AI agents">
              <p className="docs-p">
                If you're building an agent that issues credentials, read the agent skill file at{" "}
                <a href="https://hashproof.dev/skill.md" target="_blank" rel="noopener noreferrer">hashproof.dev/skill.md</a>.
                It contains step-by-step instructions for agents: what to ask the human, how to call the API, and how to handle templates and payments.
              </p>
            </SubSection>
          </Section>

          {/* Authentication */}
          <Section id="authentication" title="Authentication">
            <SubSection id="auth-x402" title="Pay with crypto (x402)">
              <p className="docs-p">
                No API key needed. When you call a paid endpoint, the API returns <code>402 Payment Required</code> with
                the amount and network. The thirdweb SDK signs a USDC transfer from your wallet and retries the request
                automatically. No gas on your side. <strong>$0.10 USDC per credential</strong> on Base or Celo.
              </p>
            </SubSection>

            <SubSection id="auth-apikey" title="Pay with API key">
              <p className="docs-p">
                Send <code>Authorization: Bearer YOUR_API_KEY</code> or <code>X-API-Key: YOUR_API_KEY</code>.
                Each issuance deducts 1 credit. The key is tied to a single issuer entity.
                If you run out of credits, the API returns <code>402</code> with <code>code: "insufficient_credits"</code>.
                Contact <a href="mailto:hi@hashproof.dev">hi@hashproof.dev</a> to purchase credits.
              </p>
            </SubSection>
          </Section>

          {/* issueCredential */}
          <Section id="issue-credential" title="POST /issueCredential">
            <div className="docs-endpoint">
              <span className="docs-method docs-method--post">POST</span>
              <code className="docs-path">/issueCredential</code>
            </div>
            <p className="docs-p">
              Issues one verifiable credential. Paid via x402 or API key.
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
                ["values", "object", true, "Key-value pairs for template fields (e.g. holder_name, details)"],
                ["template_slug", "string", false, "Slug of an existing template"],
                ["template_id", "UUID", false, "UUID of an existing template"],
                ["template", "object", false, "Inline template definition (create-only). See Templates."],
                ["background_url_override", "string", false, "Override background image for this credential only"],
                ["issuer_entity_id", "UUID", false, "Your verified entity ID (shows verified badge)"],
                ["platform_entity_id", "UUID", false, "Platform entity ID"],
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
                ["401", "", false, "Invalid API key"],
                ["402", "", false, "Payment required (x402 challenge) or no credits left"],
                ["403", "", false, "Entity suspended, or paying wallet not in authorized_wallets"],
                ["500", "", false, "IPFS, on-chain, or DB error"],
              ]} />
            </SubSection>
          </Section>

          {/* Templates */}
          <Section id="templates" title="Templates">
            <p className="docs-p">
              A credential PDF has two parts: the <strong>background</strong> (the image) and the <strong>template</strong> (the layout).
              Understanding the difference is key.
            </p>

            <SubSection id="tpl-background" title="Background = the image">
              <p className="docs-p">
                The background is a PNG or JPG image that fills the entire PDF page. It's the visual design of your certificate
                — borders, logos, colors, decorative elements. It does NOT contain any dynamic text.
              </p>
              <p className="docs-p">
                You can set a default background when creating the template, and override it per credential
                with <code>background_url_override</code> (same layout, different image).
              </p>
            </SubSection>

            <SubSection id="tpl-template" title="Template = the layout">
              <p className="docs-p">
                The template defines <strong>where and how</strong> each piece of text is drawn on top of the background:
                page dimensions, and for each field — position (<code>x</code>, <code>y</code>),
                size (<code>width</code>), font (<code>font_size</code>, <code>font_color</code>),
                alignment, bold/italic, and whether it's required.
              </p>
              <p className="docs-note">
                Dimensions are in the same units as your background image.
                If your image is 3508 x 2480 pixels, set <code>page_width: 3508</code> and <code>page_height: 2480</code>,
                and use pixel coordinates for field positions.
              </p>
            </SubSection>

            <SubSection id="tpl-options" title="Which option to use">
              <div className="docs-table-wrap">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>What to send</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Default certificate</strong> (quick start)</td>
                      <td>Omit all template fields. Use <code>values.holder_name</code> and optionally <code>values.details</code>.</td>
                    </tr>
                    <tr>
                      <td><strong>Existing template</strong></td>
                      <td><code>template_slug</code> or <code>template_id</code>. Provide <code>values</code> for each required field.</td>
                    </tr>
                    <tr>
                      <td><strong>New custom template</strong> (first time)</td>
                      <td><code>template</code> object with slug, name, background_url, page_width, page_height, fields_json. After this, reuse with <code>template_slug</code>.</td>
                    </tr>
                    <tr>
                      <td><strong>Same template, different background</strong></td>
                      <td><code>template_slug</code> + <code>background_url_override</code>. Layout stays the same; only the image changes.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="docs-p">
                Send <strong>only one</strong> of <code>template_slug</code>, <code>template_id</code>,
                or <code>template</code>. Sending more than one returns <code>400</code>.
              </p>
            </SubSection>

            <SubSection id="tpl-fields" title="Template field properties">
              <ParamTable rows={[
                ["template.slug",           "string", true, "Unique slug (global). Used later with template_slug."],
                ["template.name",           "string", true, "Human-readable name"],
                ["template.background_url", "string", true, "URL of the background image (PNG or JPG)"],
                ["template.page_width",     "number", false, "Page width in same units as image. Default: 595"],
                ["template.page_height",    "number", false, "Page height. Default: 842"],
                ["template.fields_json",    "array",  true, "Array of field definitions"],
                ["fields_json[].key",       "string", true, "Maps to a key in values{}"],
                ["fields_json[].x",         "number", true, "Horizontal position from left"],
                ["fields_json[].y",         "number", true, "Vertical position from top"],
                ["fields_json[].width",     "number", false, "Text box width"],
                ["fields_json[].font_size", "number", false, "Font size. Default: 12"],
                ["fields_json[].font_color","string", false, "Hex color. Default: #000000"],
                ["fields_json[].align",     "string", false, "left · center · right. Default: left"],
                ["fields_json[].required",  "boolean",false, "If true, issuance fails when key is missing from values"],
                ["fields_json[].bold",      "boolean", false, "Default: false"],
                ["fields_json[].italic",    "boolean", false, "Default: false"],
                ["fields_json[].underline", "boolean", false, "Default: false"],
                ["fields_json[].strike",    "boolean", false, "Default: false"],
              ]} />
            </SubSection>

            <SubSection id="tpl-requirements" title="Discover required fields">
              <div className="docs-endpoint">
                <span className="docs-method docs-method--get">GET</span>
                <code className="docs-path">/templates/:slug_or_id/requirements</code>
              </div>
              <p className="docs-p">
                No auth required. Returns <code>required_keys</code> and the full <code>fields_json</code> so you know
                exactly which values to send and where they'll appear.
              </p>
            </SubSection>

            <SubSection id="tpl-inline" title="Example: create a template inline">
              <p className="docs-p">
                Use this the first time you want a custom layout. After this, reuse with <code>template_slug</code>.
              </p>
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
                The QR code is added automatically in the top-right corner — leave that area empty in your background.
              </p>
            </SubSection>

            <SubSection id="tpl-reuse" title="Example: reuse an existing template">
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
          </Section>

          {/* Template Preview */}
          <Section id="template-preview" title="Template Preview">
            <p className="docs-p">
              Before issuing real credentials, preview how your certificate looks.
              No cost, no blockchain, no registration — just a PDF with a watermark.
            </p>

            <SubSection id="preview-url" title="Preview via URL">
              <p className="docs-p">
                Open a URL with the template slug and field values as query parameters:
              </p>
              <CodeBlock lang="bash" label="URL" code={`https://hashproof.dev/preview/:slug?holder_name=Jane+Doe&details=Some+text&background_url=https://...`} />
              <p className="docs-p">
                The page generates the PDF in real time with a "PREVIEW" watermark (or "VISTA PREVIA" in Spanish).
                You can download it, and the QR on the PDF points back to the same preview URL.
              </p>
            </SubSection>

            <SubSection id="preview-api" title="Preview via API">
              <div className="docs-endpoint">
                <span className="docs-method docs-method--post">POST</span>
                <code className="docs-path">/templates/:slug/preview</code>
              </div>
              <p className="docs-p">No auth required.</p>
              <CodeBlock code={`{
  "background_url": "https://your-cdn.com/certificate-bg.png",
  "fields": {
    "holder_name": "Jane Doe",
    "details": "For completing Intro to Blockchain"
  },
  "locale": "en"
}`} label="request body" />
              <ParamTable rows={[
                ["background_url", "string", false, "Override the template's default background"],
                ["fields", "object", false, "Key-value pairs for each template field"],
                ["locale", "string", false, "\"en\" or \"es\" — controls watermark language"],
              ]} />
              <p className="docs-p">Returns a PDF with the watermark. Use this to verify field positions before issuing.</p>
            </SubSection>
          </Section>

          {/* verify */}
          <Section id="verify" title="GET /verify/:id">
            <div className="docs-endpoint">
              <span className="docs-method docs-method--get">GET</span>
              <code className="docs-path">/verify/:id</code>
            </div>
            <p className="docs-p">
              Full 3-layer verification: blockchain contract, IPFS content hash, database.
              If any layer fails to match, the credential is flagged. Free, no auth.
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
              <code className="docs-path">/entities/:id</code>
            </div>
            <p className="docs-p">
              Returns entity info and verification status. <code>:id</code> can be a UUID or slug.
              Free, no auth.
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
              Verified issuers appear with a verified badge on every credential they issue.
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
                <code> POST /issueCredential</code> with your <code>issuer_entity_id</code>.
              </p>
            </SubSection>
          </Section>

        </main>
      </div>
    </div>
  );
}
