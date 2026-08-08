import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import CodeHighlight from "../components/CodeHighlight.jsx";
import { getPreferredLocale, createTranslator } from "../i18n.js";
import { docsMessages } from "../locales/docs.js";

const locale = getPreferredLocale();
const t = createTranslator(docsMessages, locale);

/**
 * Splices React nodes into a translated string at {token} placeholders, so a
 * sentence with inline <code> in it stays one translatable unit instead of
 * three fragments a translator has to reassemble in the right order.
 */
function fill(key, parts) {
  const re = new RegExp(
    "(" +
      Object.keys(parts)
        .map((k) => "\\{" + k + "\\}")
        .join("|") +
      ")",
  );
  return t(key)
    .split(re)
    .map((chunk, i) => {
      const token = chunk.replace(/^\{|\}$/g, "");
      return token in parts ? <span key={i}>{parts[token]}</span> : chunk;
    });
}

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
    <button
      className="docs-copy-btn"
      onClick={handle}
      aria-label={t("docs.copy")}
    >
      {copied ? t("docs.copied") : t("docs.copy")}
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
      <CodeHighlight
        code={current.code}
        lang={current.lang}
        className="docs-code"
      />
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
            <th>{t("docs.table.field")}</th>
            <th>{t("docs.table.type")}</th>
            <th>{t("docs.table.required")}</th>
            <th>{t("docs.table.description")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, type, req, desc]) => (
            <tr key={field}>
              <td>
                <code>{field}</code>
              </td>
              <td>
                <span className="docs-type">{type}</span>
              </td>
              <td>
                {req ? (
                  <span className="docs-req">{t("docs.table.yes")}</span>
                ) : (
                  <span className="docs-opt">{t("docs.table.no")}</span>
                )}
              </td>
              <td>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NAV = [
  { id: "quickstart", label: t("docs.nav.quickstart") },
  { id: "authentication", label: t("docs.nav.authentication") },
  { id: "issue-credential", label: "POST /issueCredential" },
  { id: "templates", label: t("docs.nav.templates") },
  { id: "template-preview", label: t("docs.nav.preview") },
  { id: "verify", label: "GET /verify/:id" },
  { id: "entities", label: "GET /entities/:id" },
  { id: "entity-verification", label: t("docs.nav.entityVerification") },
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
    issuer: {
      display_name: "HashProof Demo",
      slug: "hashproof-demo",
    },
    platform: {
      display_name: "HashProof Demo",
      slug: "hashproof-demo",
    },
    holder: {
      full_name: process.env.YOUR_NAME,
    },
    context: {
      type: "certification",
      title: "HashProof API Quickstart",
    },
    credential_type: "completion",
    title: "First Credential Issued",
    values: {
      holder_name: process.env.YOUR_NAME,
      details: "For successfully issuing a verifiable credential via the HashProof API.",
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
    "issuer": {
      "display_name": "Acme Corp",
      "slug": "acme-corp"
    },
    "platform": {
      "display_name": "Acme Corp",
      "slug": "acme-corp"
    },
    "holder": {
      "full_name": "Jane Doe"
    },
    "context": {
      "type": "certification",
      "title": "Intro to Blockchain"
    },
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
      { rootMargin: "-20% 0px -70% 0px" },
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
        <title>{t("docs.meta.title")}</title>
        <meta name="description" content={t("docs.meta.description")} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://hashproof.dev/docs" />
        <meta property="og:title" content={t("docs.meta.title")} />
        <meta property="og:description" content={t("docs.meta.description")} />
        <meta
          property="og:image"
          content="https://hashproof.dev/thumbnail.png"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://hashproof.dev/docs" />
        <meta name="twitter:title" content={t("docs.meta.title")} />
        <meta name="twitter:description" content={t("docs.meta.description")} />
        <meta
          name="twitter:image"
          content="https://hashproof.dev/thumbnail.png"
        />
      </Helmet>
      {/* Top bar */}
      <header className="docs-topbar">
        <Link to="/" className="docs-logo">
          HashProof
        </Link>
        <span className="docs-topbar-title">{t("docs.topbar.title")}</span>
        <button
          className="docs-menu-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t("docs.topbar.menu")}
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
          <Section id="quickstart" title={t("docs.qs.title")}>
            <p className="docs-p">
              {fill("docs.qs.lead", { price: <strong>$0.10 USDC</strong> })}
            </p>

            <SubSection id="quickstart-paths" title={t("docs.qs.paths")}>
              <div className="docs-callout-row">
                <div className="docs-callout">
                  <p className="docs-callout-title">
                    {t("docs.qs.crypto.title")}
                  </p>
                  <p className="docs-callout-desc">
                    {fill("docs.qs.crypto.body", {
                      link: (
                        <a
                          href="https://thirdweb.com/dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("docs.qs.crypto.link")}
                        </a>
                      ),
                    })}
                  </p>
                </div>
                <div className="docs-callout">
                  <p className="docs-callout-title">
                    {t("docs.qs.apikey.title")}
                  </p>
                  <p className="docs-callout-desc">
                    {fill("docs.qs.apikey.body", {
                      link: (
                        <a href="mailto:hi@hashproof.dev">hi@hashproof.dev</a>
                      ),
                    })}
                  </p>
                </div>
                <div className="docs-callout">
                  <p className="docs-callout-title">
                    {t("docs.qs.agent.title")}
                  </p>
                  <p className="docs-callout-desc">
                    {fill("docs.qs.agent.body", {
                      link: (
                        <a
                          href="https://hashproof.dev/skill.md"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          skill.md
                        </a>
                      ),
                    })}
                  </p>
                </div>
              </div>
            </SubSection>

            <SubSection id="quickstart-x402" title={t("docs.qs.x402.title")}>
              <p className="docs-p">{t("docs.qs.x402.prereq")}</p>
              <CodeBlock
                lang="bash"
                label={t("docs.label.terminal")}
                code={`npm install thirdweb`}
              />
              <CodeTabs
                tabs={[
                  { label: "Celo", lang: "js", code: x402Example("celo") },
                  { label: "Base", lang: "js", code: x402Example("base") },
                ]}
              />
              <CodeBlock
                lang="bash"
                label={t("docs.label.terminal")}
                code={`PRIVATE_KEY=0x... YOUR_NAME="Jane Doe" node issue.mjs`}
              />
              <CodeBlock
                lang="bash"
                label={t("docs.label.output")}
                code={`https://hashproof.dev/verify/a1b2c3d4-...`}
              />
            </SubSection>

            <SubSection
              id="quickstart-apikey"
              title={t("docs.qs.apikey2.title")}
            >
              <p className="docs-p">{t("docs.qs.apikey2.prereq")}</p>
              <CodeBlock
                lang="bash"
                label={t("docs.label.terminal")}
                code={apiKeyExample()}
              />
              <CodeBlock
                lang="bash"
                label={t("docs.label.output")}
                code={`https://hashproof.dev/verify/a1b2c3d4-...`}
              />
            </SubSection>

            <SubSection id="quickstart-agent" title={t("docs.qs.agent2.title")}>
              <p className="docs-p">
                {fill("docs.qs.agent2.body", {
                  link: (
                    <a
                      href="https://hashproof.dev/skill.md"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      hashproof.dev/skill.md
                    </a>
                  ),
                })}
              </p>
            </SubSection>
          </Section>

          {/* Authentication */}
          <Section id="authentication" title={t("docs.auth.title")}>
            <SubSection id="auth-x402" title={t("docs.auth.x402.title")}>
              <p className="docs-p">
                {fill("docs.auth.x402.body", {
                  code: <code>402 Payment Required</code>,
                  price: <strong>$0.10 USDC</strong>,
                })}
              </p>
            </SubSection>

            <SubSection id="auth-apikey" title={t("docs.auth.apikey.title")}>
              <p className="docs-p">
                {fill("docs.auth.apikey.body1", {
                  header1: <code>Authorization: Bearer YOUR_API_KEY</code>,
                  header2: <code>X-API-Key: YOUR_API_KEY</code>,
                })}{" "}
                {fill("docs.auth.apikey.body2", {
                  code: <code>402 code: &quot;insufficient_credits&quot;</code>,
                  email: <a href="mailto:hi@hashproof.dev">hi@hashproof.dev</a>,
                })}
              </p>
            </SubSection>
          </Section>

          {/* issueCredential */}
          <Section id="issue-credential" title="POST /issueCredential">
            <div className="docs-endpoint">
              <span className="docs-method docs-method--post">POST</span>
              <code className="docs-path">/issueCredential</code>
            </div>
            <p className="docs-p">{t("docs.issue.lead")}</p>

            <SubSection id="issue-body" title={t("docs.issue.body.title")}>
              <ParamTable
                rows={[
                  [
                    "issuer.display_name",
                    "string",
                    true,
                    t("docs.f.issuerName"),
                  ],
                  ["issuer.slug", "string", true, t("docs.f.issuerSlug")],
                  [
                    "platform.display_name",
                    "string",
                    true,
                    t("docs.f.platformName"),
                  ],
                  ["platform.slug", "string", true, t("docs.f.platformSlug")],
                  ["holder.full_name", "string", true, t("docs.f.holderName")],
                  ["holder.email", "string", false, t("docs.f.holderEmail")],
                  [
                    "context.type",
                    "enum",
                    true,
                    t("docs.f.contextType") +
                      ": event · course · diploma · training · certification · membership · other",
                  ],
                  ["context.title", "string", true, t("docs.f.contextTitle")],
                  [
                    "context.starts_at",
                    "ISO 8601",
                    false,
                    t("docs.f.startsAt"),
                  ],
                  ["context.ends_at", "ISO 8601", false, t("docs.f.endsAt")],
                  [
                    "credential_type",
                    "enum",
                    true,
                    t("docs.f.credentialType") +
                      ": attendance · completion · achievement · participation · membership · certification",
                  ],
                  ["title", "string", true, t("docs.f.title")],
                  [
                    "expires_at",
                    "ISO 8601 | null",
                    false,
                    t("docs.f.expiresAt"),
                  ],
                  ["values", "object", true, t("docs.f.values")],
                  ["template_slug", "string", false, t("docs.f.templateSlug")],
                  ["template_id", "UUID", false, t("docs.f.templateId")],
                  ["template", "object", false, t("docs.f.template")],
                  [
                    "background_url_override",
                    "string",
                    false,
                    t("docs.f.bgOverride"),
                  ],
                  ["issuer_entity_id", "UUID", false, t("docs.f.issuerEntity")],
                  [
                    "platform_entity_id",
                    "UUID",
                    false,
                    t("docs.f.platformEntity"),
                  ],
                ]}
              />
            </SubSection>

            <SubSection
              id="issue-example"
              title={t("docs.issue.example.title")}
            >
              <CodeBlock
                code={MINIMAL_EXAMPLE}
                label={t("docs.label.requestBody")}
              />
            </SubSection>

            <SubSection
              id="issue-response"
              title={t("docs.issue.response.title")}
            >
              <CodeBlock
                code={ISSUE_RESPONSE}
                label={t("docs.label.response")}
              />
              <p className="docs-p">
                {fill("docs.issue.response.note", {
                  field: <code>verification_url</code>,
                })}
              </p>
            </SubSection>

            <SubSection id="issue-errors" title={t("docs.issue.errors.title")}>
              <ParamTable
                rows={[
                  ["400", "", false, t("docs.e.400")],
                  ["401", "", false, t("docs.e.401")],
                  ["402", "", false, t("docs.e.402")],
                  ["403", "", false, t("docs.e.403")],
                  ["500", "", false, t("docs.e.500")],
                ]}
              />
            </SubSection>
          </Section>

          {/* Templates */}
          <Section id="templates" title={t("docs.tpl.title")}>
            <p className="docs-p">
              {fill("docs.tpl.lead", {
                bg: <strong>{t("docs.tpl.bgWord")}</strong>,
                tpl: <strong>{t("docs.tpl.tplWord")}</strong>,
              })}
            </p>

            <SubSection id="tpl-background" title={t("docs.tpl.bg.title")}>
              <p className="docs-p">{t("docs.tpl.bg.body1")}</p>
              <p className="docs-p">
                {fill("docs.tpl.bg.body2", {
                  code: <code>background_url_override</code>,
                })}
              </p>
            </SubSection>

            <SubSection id="tpl-template" title={t("docs.tpl.layout.title")}>
              <p className="docs-p">
                {fill("docs.tpl.layout.body", {
                  xy: (
                    <>
                      <code>x</code>, <code>y</code>
                    </>
                  ),
                })}
              </p>
              <p className="docs-note">
                {fill("docs.tpl.layout.note", {
                  code: (
                    <>
                      <code>page_width: 3508</code>,{" "}
                      <code>page_height: 2480</code>
                    </>
                  ),
                })}
              </p>
            </SubSection>

            <SubSection id="tpl-options" title={t("docs.tpl.options.title")}>
              <div className="docs-table-wrap">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>{t("docs.tpl.options.scenario")}</th>
                      <th>{t("docs.tpl.options.send")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>{t("docs.tpl.options.default")}</strong>
                      </td>
                      <td>{t("docs.tpl.options.defaultBody")}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>{t("docs.tpl.options.existing")}</strong>
                      </td>
                      <td>{t("docs.tpl.options.existingBody")}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>{t("docs.tpl.options.new")}</strong>
                      </td>
                      <td>{t("docs.tpl.options.newBody")}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>{t("docs.tpl.options.sameTpl")}</strong>
                      </td>
                      <td>{t("docs.tpl.options.sameTplBody")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="docs-p">{t("docs.tpl.options.note")}</p>
            </SubSection>

            <SubSection id="tpl-fields" title={t("docs.tpl.fields.title")}>
              <ParamTable
                rows={[
                  ["template.slug", "string", true, t("docs.t.slug")],
                  ["template.name", "string", true, t("docs.t.name")],
                  ["template.background_url", "string", true, t("docs.t.bg")],
                  ["template.page_width", "number", false, t("docs.t.pw")],
                  ["template.page_height", "number", false, t("docs.t.ph")],
                  ["template.fields_json", "array", true, t("docs.t.fields")],
                  ["fields_json[].key", "string", true, t("docs.t.key")],
                  ["fields_json[].x", "number", true, t("docs.t.x")],
                  ["fields_json[].y", "number", true, t("docs.t.y")],
                  ["fields_json[].width", "number", false, t("docs.t.width")],
                  [
                    "fields_json[].font_size",
                    "number",
                    false,
                    t("docs.t.fontSize"),
                  ],
                  [
                    "fields_json[].font_color",
                    "string",
                    false,
                    t("docs.t.fontColor"),
                  ],
                  ["fields_json[].align", "string", false, t("docs.t.align")],
                  [
                    "fields_json[].required",
                    "boolean",
                    false,
                    t("docs.t.required"),
                  ],
                  ["fields_json[].bold", "boolean", false, t("docs.t.bold")],
                  ["fields_json[].italic", "boolean", false, t("docs.t.bold")],
                  [
                    "fields_json[].underline",
                    "boolean",
                    false,
                    t("docs.t.bold"),
                  ],
                  ["fields_json[].strike", "boolean", false, t("docs.t.bold")],
                ]}
              />
            </SubSection>

            <SubSection id="tpl-requirements" title={t("docs.tpl.req.title")}>
              <div className="docs-endpoint">
                <span className="docs-method docs-method--get">GET</span>
                <code className="docs-path">
                  /templates/:slug_or_id/requirements
                </code>
              </div>
              <p className="docs-p">{t("docs.tpl.req.body")}</p>
            </SubSection>

            <SubSection id="tpl-inline" title={t("docs.tpl.inline.title")}>
              <p className="docs-p">{t("docs.tpl.inline.body")}</p>
              <CodeBlock
                code={`{
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
}`}
                label={t("docs.label.requestBody")}
              />
              <p className="docs-p">{t("docs.tpl.inline.qr")}</p>
            </SubSection>

            <SubSection id="tpl-reuse" title={t("docs.tpl.reuse.title")}>
              <CodeBlock
                code={`{
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
}`}
                label={t("docs.label.requestBodyReuse")}
              />
            </SubSection>
          </Section>

          {/* Template Preview */}
          <Section id="template-preview" title={t("docs.prev.title")}>
            <p className="docs-p">{t("docs.prev.lead")}</p>

            <SubSection id="preview-url" title={t("docs.prev.url.title")}>
              <p className="docs-p">{t("docs.prev.url.body")}</p>
              <CodeBlock
                lang="bash"
                label="URL"
                code={`https://hashproof.dev/preview/:slug?holder_name=Jane+Doe&details=Some+text&background_url=https://...`}
              />
              <p className="docs-p">{t("docs.prev.url.note")}</p>
            </SubSection>

            <SubSection id="preview-api" title={t("docs.prev.api.title")}>
              <div className="docs-endpoint">
                <span className="docs-method docs-method--post">POST</span>
                <code className="docs-path">/templates/:slug/preview</code>
              </div>
              <p className="docs-p">{t("docs.prev.api.noAuth")}</p>
              <CodeBlock
                code={`{
  "background_url": "https://your-cdn.com/certificate-bg.png",
  "fields": {
    "holder_name": "Jane Doe",
    "details": "For completing Intro to Blockchain"
  },
  "locale": "en"
}`}
                label={t("docs.label.requestBody")}
              />
              <ParamTable
                rows={[
                  ["background_url", "string", false, t("docs.p.bg")],
                  ["fields", "object", false, t("docs.p.fields")],
                  ["locale", "string", false, t("docs.p.locale")],
                ]}
              />
              <p className="docs-p">{t("docs.prev.api.note")}</p>
            </SubSection>
          </Section>

          {/* verify */}
          <Section id="verify" title="GET /verify/:id">
            <div className="docs-endpoint">
              <span className="docs-method docs-method--get">GET</span>
              <code className="docs-path">/verify/:id</code>
            </div>
            <p className="docs-p">{t("docs.verify.lead")}</p>

            <SubSection
              id="verify-response"
              title={t("docs.verify.response.title")}
            >
              <CodeBlock
                code={VERIFY_RESPONSE}
                label={t("docs.label.response")}
              />
            </SubSection>

            <SubSection
              id="verify-status"
              title={t("docs.verify.status.title")}
            >
              <ParamTable
                rows={[
                  ["active", "", false, t("docs.s.active")],
                  ["revoked", "", false, t("docs.s.revoked")],
                  ["expired", "", false, t("docs.s.expired")],
                  ["not_found", "", false, t("docs.s.notFound")],
                  ["unknown", "", false, t("docs.s.unknown")],
                ]}
              />
            </SubSection>

            <SubSection id="verify-other" title={t("docs.verify.other.title")}>
              <div className="docs-endpoint" style={{ marginBottom: "0.5rem" }}>
                <span className="docs-method docs-method--get">GET</span>
                <code className="docs-path">/verify/:id/contract</code>
                <span className="docs-endpoint-note">
                  {t("docs.verify.note.contract")}
                </span>
              </div>
              <div className="docs-endpoint" style={{ marginBottom: "0.5rem" }}>
                <span className="docs-method docs-method--get">GET</span>
                <code className="docs-path">/verify/:id/ipfs</code>
                <span className="docs-endpoint-note">
                  {t("docs.verify.note.ipfs")}
                </span>
              </div>
              <div className="docs-endpoint">
                <span className="docs-method docs-method--get">GET</span>
                <code className="docs-path">/verify/:id/pdf</code>
                <span className="docs-endpoint-note">
                  {t("docs.verify.note.pdf")}
                </span>
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
              {fill("docs.entities.lead", { id: <code>:id</code> })}
            </p>
            <CodeBlock
              code={ENTITY_RESPONSE}
              label={t("docs.label.response")}
            />

            <SubSection
              id="entities-status"
              title={t("docs.entities.status.title")}
            >
              <ParamTable
                rows={[
                  ["unverified", "", false, t("docs.es.unverified")],
                  ["individual_verified", "", false, t("docs.es.individual")],
                  [
                    "organization_verified",
                    "",
                    false,
                    t("docs.es.organization"),
                  ],
                  ["suspended", "", false, t("docs.es.suspended")],
                ]}
              />
            </SubSection>
          </Section>

          {/* entity verification */}
          <Section id="entity-verification" title={t("docs.ev.title")}>
            <p className="docs-p">{t("docs.ev.lead")}</p>

            <SubSection id="ev-how" title={t("docs.ev.how.title")}>
              <ol className="docs-ol">
                <li>
                  {fill("docs.ev.how.1", {
                    path: <code>/entities/:slug</code>,
                  })}
                </li>
                <li>
                  {fill("docs.ev.how.2", {
                    action: <strong>{t("docs.ev.how.action")}</strong>,
                  })}
                </li>
                <li>{t("docs.ev.how.3")}</li>
                <li>{t("docs.ev.how.4")}</li>
                <li>{t("docs.ev.how.5")}</li>
                <li>{t("docs.ev.how.6")}</li>
              </ol>
            </SubSection>

            <SubSection id="ev-wallets" title={t("docs.ev.wallets.title")}>
              <p className="docs-p">
                {fill("docs.ev.wallets.body", {
                  endpoint: <code>POST /issueCredential</code>,
                  field: <code>issuer_entity_id</code>,
                })}
              </p>
            </SubSection>
          </Section>
        </main>
      </div>
    </div>
  );
}
