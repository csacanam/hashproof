import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import ResponsiveCode from "../components/ResponsiveCode.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import { getPreferredLocale, createTranslator } from "../i18n.js";
import { homeMessages, PRICING_ROWS } from "../locales/home.js";

/** Rows that have a head-to-head page behind them. */
const COMPETITOR_SLUGS = {
  pok: "pok",
  certifier: "certifier",
  sertifier: "sertifier",
  accredible: "accredible",
  credly: "credly",
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";
const DEMO_CREDENTIAL_ID = "e32183ea-5833-438c-9aae-a2432bcbb53d";
const CONTACT_EMAIL = "hi@hashproof.dev";

const ISSUE_EXAMPLE = `curl -X POST https://api.hashproof.dev/issueCredential \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "issuer":   { "display_name": "Your Org", "slug": "your-org" },
    "platform": { "display_name": "Your Org", "slug": "your-org" },
    "holder":   { "full_name": "Ada Lovelace" },
    "context":  { "type": "event", "title": "Annual Conference 2026" },
    "credential_type": "attendance",
    "title": "Certificate of Attendance"
  }'`;

export default function Home() {
  const locale = useMemo(() => getPreferredLocale(), []);
  const t = useMemo(() => createTranslator(homeMessages, locale), [locale]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  // Figures come through verbatim; anything else is a translation key.
  const label = (v) => (/^[$~]/.test(v) ? v : t(`home.pricing.${v}`));

  const value = [
    { key: "share", icon: "↗" },
    { key: "verify", icon: "✓" },
    { key: "issuer", icon: "◈" },
    { key: "durable", icon: "∞" },
  ];

  return (
    <div className="page">
      <Helmet>
        <title>{t("home.meta.title")}</title>
        {/* The price as data, not prose, so anything summarising the page can
            state it without inferring it from a sentence. */}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "HashProof",
          description: t("home.meta.description"),
          url: "https://www.hashproof.dev/",
          brand: { "@type": "Brand", name: "HashProof" },
          offers: {
            "@type": "Offer",
            price: "0.10",
            priceCurrency: "USD",
            url: "https://www.hashproof.dev/",
            availability: "https://schema.org/InStock",
            eligibleQuantity: { "@type": "QuantitativeValue", unitText: "credential" },
          },
        })}</script>
        <meta name="description" content={t("home.meta.description")} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.hashproof.dev/" />
        <meta property="og:title" content={t("home.meta.title")} />
        <meta property="og:description" content={t("home.meta.description")} />
        <meta property="og:image" content="https://www.hashproof.dev/thumbnail.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={t("home.meta.title")} />
        <meta name="twitter:description" content={t("home.meta.description")} />
        <meta name="twitter:image" content="https://www.hashproof.dev/thumbnail.png" />
      </Helmet>

      <SiteHeader />

      <main>
        {/* Opens with what it is and what it costs. It used to open with "one
            API call" — the how — for an audience that never arrived. */}
        <section className="hero">
          <h1>{t("home.hero.title")}</h1>
          <p className="hero-lead">{t("home.hero.lead")}</p>

          <div className="hero-actions">
            <Link
              to={`/verify/${DEMO_CREDENTIAL_ID}`}
              className="btn btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("home.hero.cta.credential")}
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-secondary">
              {t("home.hero.cta.contact")}
            </a>
          </div>

          {stats && (
            <div className="hero-stats">
              <span className="hero-stats-since">{t("home.hero.since")}</span>
              <div className="hero-stats-row">
                <div className="hero-stat">
                  <span className="hero-stat-num">{stats.total_credentials.toLocaleString()}</span>
                  <span className="hero-stat-label">{t("home.hero.stat.credentials")}</span>
                </div>
                <div className="hero-stat-sep" />
                <div className="hero-stat">
                  <span className="hero-stat-num">{stats.verified_entities.toLocaleString()}</span>
                  <span className="hero-stat-label">{t("home.hero.stat.entities")}</span>
                </div>
              </div>
              <a
                className="hero-stat-explorer"
                href="https://celoscan.io/address/0x7a1B759A602Aba72a70f99Dffd0a386d7504ce9B#readContract#F8"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("home.hero.onchain")}
              </a>
            </div>
          )}
        </section>

        {/* The strongest argument we have, and one nobody else publishes —
            Accredible does not even quote a price. */}
        <section className="section">
          <h2>{t("home.pricing.title")}</h2>
          <p className="section-p">{t("home.pricing.lead")}</p>

          <div className="pricing-scroll">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>{t("home.pricing.col.platform")}</th>
                  <th>{t("home.pricing.col.each")}</th>
                  <th>{t("home.pricing.col.price")}</th>
                  <th>{t("home.pricing.col.year")}</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_ROWS.map((row) => (
                  <tr key={row.key} className={row.highlight ? "pricing-row--ours" : undefined}>
                    <td>
                      {COMPETITOR_SLUGS[row.key] ? (
                        <Link to={`/vs/${COMPETITOR_SLUGS[row.key]}`} className="verify-explorer-link">{row.name}</Link>
                      ) : row.name}
                    </td>
                    <td>{t(`home.pricing.${row.model}`)}</td>
                    <td>{label(row.price)}</td>
                    <td>{label(row.year)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="pricing-note">{t("home.pricing.note")}</p>
        </section>

        <section className="section">
          <h2>{t("home.value.title")}</h2>
          <div className="home-value">
            {value.map(({ key, icon }) => (
              <div key={key} className="home-value-item">
                <span className="home-value-icon" aria-hidden>{icon}</span>
                <div>
                  <p className="home-value-title">{t(`home.value.${key}.title`)}</p>
                  <p className="home-value-desc">{t(`home.value.${key}.body`)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Still the product, just no longer the pitch. */}
        <section className="section">
          <h2>{t("home.dev.title")}</h2>
          <p className="section-p">{t("home.dev.lead")}</p>
          <ResponsiveCode code={ISSUE_EXAMPLE} />
          <p className="section-p">{t("home.dev.mcp")}</p>
          <div className="hero-actions">
            <Link to="/docs" className="btn btn-secondary">
              {t("home.dev.docs")}
            </Link>
          </div>
        </section>

        <section className="section">
          <h2>{t("home.contact.title")}</h2>
          <p className="section-p">{t("home.contact.body")}</p>
          <div className="hero-actions">
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-primary">
              {CONTACT_EMAIL}
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
