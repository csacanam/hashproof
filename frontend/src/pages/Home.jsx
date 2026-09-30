import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
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
// Issued by Peewah, to the person who runs it — so the sample on the front
// page is nobody else's data.
const DEMO_CREDENTIAL_ID = "e313fd8d-c964-4b9c-ad1a-d21ca920ae75";

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

  const steps = ["account", "design", "send"];

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
          // $0.10 per call through the API; $0.225 (crypto) to $0.25 (card) per
          // credit in the dashboard.
          offers: {
            "@type": "AggregateOffer",
            lowPrice: "0.10",
            highPrice: "0.25",
            priceCurrency: "USD",
            offerCount: 3,
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
        {/* One primary action. The audience is whoever runs the event or the
            course, not a developer: they need to know what they get, what it
            costs, and where to start. */}
        <section className="hero">
          <h1>{t("home.hero.title")}</h1>
          <p className="hero-lead">{t("home.hero.lead")}</p>

          <div className="hero-actions">
            <Link to="/app" className="btn btn-primary">
              {t("home.hero.cta.start")}
            </Link>
          </div>
          <p className="hero-secondary">
            <Link
              to={`/verify/${DEMO_CREDENTIAL_ID}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("home.hero.cta.credential")}
            </Link>
          </p>

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

        <section className="section">
          <h2>{t("home.how.title")}</h2>
          <ol className="home-steps">
            {steps.map((key, i) => (
              <li key={key} className="home-step">
                <span className="home-step-num" aria-hidden>{i + 1}</span>
                <div>
                  <p className="home-value-title">{t(`home.how.${key}.title`)}</p>
                  <p className="home-value-desc">{t(`home.how.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
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

        {/* The price first, plainly; the comparison — the strongest argument
            we have, and one nobody else publishes — right under it. */}
        <section className="section">
          <h2>{t("home.pricing.title")}</h2>
          <div className="home-plan">
            <p className="home-plan-price">
              {t("home.pricing.plan.price")}
              <span className="home-plan-unit">{t("home.pricing.plan.unit")}</span>
            </p>
            <p className="home-plan-alt">{t("home.pricing.plan.crypto")}</p>
            <ul className="home-plan-list">
              <li>{t("home.pricing.plan.noMinimum")}</li>
              <li>{t("home.pricing.plan.noFee")}</li>
              <li>{t("home.pricing.plan.included")}</li>
            </ul>
            <Link to="/app" className="btn btn-primary">
              {t("home.hero.cta.start")}
            </Link>
          </div>

          <h3 className="home-compare-title">{t("home.pricing.compareTitle")}</h3>
          <p className="section-p">{t("home.pricing.lead")}</p>

          <div className="pricing-scroll">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>{t("home.pricing.col.platform")}</th>
                  <th>{t("home.pricing.col.each")}</th>
                  <th>{t("home.pricing.v2000")}</th>
                  <th>{t("home.pricing.v10000")}</th>
                  <th>{t("home.pricing.v20000")}</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_ROWS.map((row) => (
                  <tr key={row.key} className={row.highlight ? "pricing-row--ours" : undefined}>
                    <td>
                      {COMPETITOR_SLUGS[row.key] ? (
                        <Link to={`/vs/${COMPETITOR_SLUGS[row.key]}`} className="verify-explorer-link">{row.name}</Link>
                      ) : row.nameKey ? t(row.nameKey) : row.name}
                    </td>
                    <td>{t(`home.pricing.${row.model}`)}</td>
                    {["v2000", "v10000", "v20000"].map((v) => (
                      <td key={v}>{label(row.costs[v])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="pricing-note">{t("home.pricing.note")}</p>
        </section>

        {/* Still the product, just no longer the pitch. */}
        <section className="section">
          <h2>{t("home.dev.title")}</h2>
          <p className="section-p">{t("home.dev.lead")}</p>
          <Link to="/docs" className="home-text-link">
            {t("home.dev.docs")}
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
