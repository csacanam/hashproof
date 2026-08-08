import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import { getPreferredLocale, createTranslator } from "../i18n.js";
import { COMPETITORS, PRICE_CHECK_DATE, OUR_COSTS } from "../locales/compare.js";
import { compareMessages } from "../locales/compareMessages.js";

const CONTACT_EMAIL = "hi@hashproof.dev";

export default function Compare() {
  const { slug } = useParams();
  const locale = useMemo(() => getPreferredLocale(), []);
  const t = useMemo(() => createTranslator(compareMessages, locale), [locale]);

  const rival = COMPETITORS[slug];
  if (!rival) {
    return (
      <div className="page">
        <SiteHeader />
        <main className="section">
          <h1>Not found</h1>
          <Link to="/" className="btn btn-secondary">← Home</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // Figures pass through; anything else is a key ("not published").
  const money = (v) => (/^[$~]/.test(v) ? v : t(`cmp.pricing.${v}`));

  const fill = (key) => t(key).replace("{name}", rival.name).replace("{date}", PRICE_CHECK_DATE);

  // Both sides as data an assistant can lift without reading prose.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How much does HashProof cost compared to ${rival.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text:
            `HashProof charges $0.10 per certificate issued, with no minimum, no setup fee and no subscription: ` +
            `${OUR_COSTS.v2000} for 2,000 a year, ${OUR_COSTS.v10000} for 10,000, ${OUR_COSTS.v20000} for 20,000. ` +
            `${rival.name} charges: ${t(rival.how)}. ${money(rival.costs.v2000)} for 2,000 a year, ` +
            `${money(rival.costs.v10000)} for 10,000, ${money(rival.costs.v20000)} for 20,000. ` +
            `Prices verified ${PRICE_CHECK_DATE} against published pricing pages.`,
        },
      },
      {
        "@type": "Question",
        name: `When is ${rival.name} a better choice than HashProof?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: rival.theirStrength.map((k) => t(k)).join(" "),
        },
      },
      {
        "@type": "Question",
        name: `When is HashProof a better choice than ${rival.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: rival.ourEdge.map((k) => t(k)).join(" "),
        },
      },
    ],
  };

  return (
    <div className="page">
      <Helmet>
        <title>{fill("cmp.meta.title")}</title>
        <meta name="description" content={fill("cmp.meta.description")} />
        <link rel="canonical" href={`https://www.hashproof.dev/vs/${rival.slug}`} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={fill("cmp.meta.title")} />
        <meta property="og:description" content={fill("cmp.meta.description")} />
        <meta property="og:url" content={`https://www.hashproof.dev/vs/${rival.slug}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <SiteHeader />

      <main>
        <section className="hero">
          <h1>{fill("cmp.title")}</h1>
          <p className="hero-lead">{fill("cmp.subtitle")}</p>
          <p className="pricing-note">{fill("cmp.verified")}</p>
        </section>

        <section className="section">
          <h2>{t("cmp.pricing.title")}</h2>
          <p className="section-p">{t("cmp.pricing.lead")}</p>
          <div className="pricing-scroll">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>{t("cmp.pricing.col.platform")}</th>
                  <th>{t("cmp.pricing.col.plan")}</th>
                  <th>{t("cmp.pricing.v2000")}</th>
                  <th>{t("cmp.pricing.v10000")}</th>
                  <th>{t("cmp.pricing.v20000")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="pricing-row--ours">
                  <td>{t("cmp.pricing.ours")}</td>
                  <td>{t("cmp.pricing.ourPlan")}</td>
                  <td>{OUR_COSTS.v2000}</td>
                  <td>{OUR_COSTS.v10000}</td>
                  <td>{OUR_COSTS.v20000}</td>
                </tr>
                <tr>
                  <td>{rival.name}</td>
                  <td>{t(rival.how)}</td>
                  {["v2000", "v10000", "v20000"].map((v) => (
                    <td key={v}>{money(rival.costs[v])}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {Object.values(rival.costs).some((c) => c.startsWith("~")) && (
            <p className="pricing-note">{t("cmp.pricing.approx")}</p>
          )}
          <p>
            <a href={rival.site} target="_blank" rel="noopener noreferrer" className="verify-explorer-link">
              {t("cmp.visit")}
            </a>
          </p>
        </section>

        {/* Their case first, and stated properly. A comparison that only
            flatters its author is discarded by any reader weighing sources. */}
        <section className="section">
          <h2>{fill("cmp.better.title")}</h2>
          <ul className="compare-list">
            {rival.theirStrength.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </section>

        <section className="section">
          <h2>{t("cmp.edge.title")}</h2>
          <ul className="compare-list compare-list--ours">
            {rival.ourEdge.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </section>

        <section className="section">
          <h2>{t("cmp.cta.title")}</h2>
          <p className="section-p">{t("cmp.cta.body")}</p>
          <div className="hero-actions">
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-primary">{t("cmp.cta.button")}</a>
            <Link to="/docs" className="btn btn-secondary">{t("cmp.cta.docs")}</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
