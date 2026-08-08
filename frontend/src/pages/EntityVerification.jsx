import { Link } from "react-router-dom";
import { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import { getPreferredLocale, createTranslator } from "../i18n.js";
import { entityVerificationMessages } from "../locales/entityVerification.js";

const ENTITY_URL = "hashproof.dev/entities/your-slug";

export default function EntityVerification() {
  const locale = useMemo(() => getPreferredLocale(), []);
  const t = useMemo(
    () => createTranslator(entityVerificationMessages, locale),
    [locale],
  );

  // Six steps, each a title and a body — the list was worth flattening to data
  // once the copy stopped living in the markup.
  const steps = ["1", "2", "3", "4", "5", "6"];

  return (
    <div className="page ev-page">
      <Helmet>
        <title>{t("ev.meta.title")}</title>
        <meta name="description" content={t("ev.meta.description")} />
        <link
          rel="canonical"
          href="https://www.hashproof.dev/entity-verification"
        />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={t("ev.meta.title")} />
        <meta property="og:description" content={t("ev.meta.description")} />
        <meta
          property="og:url"
          content="https://www.hashproof.dev/entity-verification"
        />
      </Helmet>

      <SiteHeader />

      <main className="ev-main">
        {/* Hero */}
        <section className="ev-hero">
          <div className="ev-badge">{t("ev.badge")}</div>
          <h1 className="ev-h1">{t("ev.h1")}</h1>
          <p className="ev-lead">{t("ev.lead")}</p>
        </section>

        {/* Why it matters */}
        <section className="ev-section">
          <h2 className="ev-h2">{t("ev.why.title")}</h2>
          <div className="ev-cards">
            {[
              ["✅", "badge"],
              ["🔐", "wallets"],
              ["🤝", "trust"],
            ].map(([icon, key]) => (
              <div className="ev-card" key={key}>
                <span className="ev-card-icon">{icon}</span>
                <h3>{t(`ev.why.${key}.title`)}</h3>
                <p>{t(`ev.why.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Types */}
        <section className="ev-section">
          <h2 className="ev-h2">{t("ev.types.title")}</h2>
          <div className="ev-types">
            <div className="ev-type">
              <div className="ev-type-header">
                <span className="ev-type-label ev-type-label--individual">
                  {t("ev.types.individual")}
                </span>
              </div>
              <p className="ev-type-desc">{t("ev.types.individualDesc")}</p>
              <ul className="ev-type-list">
                {["name", "profile", "email", "country", "wallets"].map((k) => (
                  <li key={k}>{t(`ev.types.individual.${k}`)}</li>
                ))}
              </ul>
            </div>
            <div className="ev-type">
              <div className="ev-type-header">
                <span className="ev-type-label ev-type-label--org">
                  {t("ev.types.org")}
                </span>
              </div>
              <p className="ev-type-desc">{t("ev.types.orgDesc")}</p>
              <ul className="ev-type-list">
                {[
                  "name",
                  "website",
                  "contact",
                  "email",
                  "country",
                  "support",
                  "wallets",
                ].map((k) => (
                  <li key={k}>{t(`ev.types.org.${k}`)}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Process */}
        <section className="ev-section">
          <h2 className="ev-h2">{t("ev.how.title")}</h2>
          <ol className="ev-steps">
            {steps.map((n) => {
              const body = t(`ev.how.${n}.body`);
              const [before, after] = body.split("{url}");
              return (
                <li key={n}>
                  <span className="ev-step-num">{n}</span>
                  <div>
                    <strong>{t(`ev.how.${n}.title`)}</strong>
                    <p>
                      {after === undefined ? (
                        body
                      ) : (
                        <>
                          {before}
                          <code>{ENTITY_URL}</code>
                          {after}
                        </>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* CTA */}
        <section className="ev-cta-section">
          <h2 className="ev-h2">{t("ev.cta.title")}</h2>

          <div className="ev-cta-block">
            <div className="ev-cta-option">
              <p className="ev-cta-option-label">{t("ev.cta.existing")}</p>
              <p className="ev-cta-option-desc">
                {t("ev.cta.existingBody")
                  .split(/(\{url\}|\{action\})/)
                  .map((part, i) =>
                    part === "{url}" ? (
                      <code key={i}>{ENTITY_URL}</code>
                    ) : part === "{action}" ? (
                      <strong key={i}>{t("ev.cta.existingAction")}</strong>
                    ) : (
                      part
                    ),
                  )}
              </p>
            </div>
            <div className="ev-cta-option">
              <p className="ev-cta-option-label">{t("ev.cta.new")}</p>
              <p className="ev-cta-option-desc">{t("ev.cta.newBody")}</p>
              <Link
                to="/docs"
                className="btn btn-primary"
                style={{ marginTop: "0.75rem", display: "inline-block" }}
              >
                {t("ev.cta.newButton")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
