import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatDate } from "../format.js";
import TemplateLayout from "../components/TemplateLayout.jsx";

export default function Templates() {
  const { t, org, orgPath, canManage } = useDashboard();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!org) return;
    api(orgPath("/templates"))
      .then(setList)
      .catch((err) => setError(err.message));
  }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const own = list?.filter((x) => x.own) ?? [];
  const catalog = list?.filter((x) => !x.own) ?? [];

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <h1>{t("templates.title")}</h1>
          <p className="dash-muted">{t("templates.subtitle")}</p>
        </div>
        {canManage && (
          <Link to="/app/templates/new" className="dash-btn">
            {t("templates.new")}
          </Link>
        )}
      </header>
      {error && <p className="dash-error">{error}</p>}

      <Explainer sample={own[0] ?? catalog[0]} />

      <h2 className="dash-section-title">{t("templates.yours")}</h2>
      {list && own.length === 0 && <p className="dash-muted">{t("templates.noneYet")}</p>}
      <div className="dash-template-grid">
        {own.map((x) => (
          <TemplateCard key={x.id} tpl={x} editable={canManage} canManage={canManage} />
        ))}
      </div>

      <h2 className="dash-section-title">{t("templates.catalog")}</h2>
      <div className="dash-template-grid">
        {catalog.map((x) => (
          <TemplateCard key={x.id} tpl={x} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ tpl, editable, canManage }) {
  const { t } = useDashboard();
  return (
    <div className="dash-template-card">
      {/* Same frame for every card, whatever the page's proportions: the
          design sits inside it, whole, so the grid stays even. */}
      <div className="dash-template-thumb">
        <TemplateLayout template={tpl} />
        {tpl.in_use && (
          <span className="dash-badge dash-badge--corner" title={t("templates.inUseHelp")}>
            {t("templates.inUse")}
          </span>
        )}
      </div>
      <div className="dash-template-meta">
        <strong title={tpl.name}>{tpl.name}</strong>
        <code className="dash-small dash-ellipsis" title={tpl.slug}>
          {tpl.slug}
        </code>
        <div className="dash-template-fields" title={t("templates.fieldsHelp")}>
          {tpl.fields_json.map((f, i) => (
            <code key={`${f.key}-${i}`}>{f.key === "holder_name" ? t("layout.holder") : typeof f.text === "string" ? t("templates.textZone") : f.key}</code>
          ))}
        </div>
        <span className="dash-muted dash-small">{formatDate(tpl.created_at)}</span>
        <div className="dash-row">
          {editable && !tpl.in_use ? (
            <Link to={`/app/templates/${tpl.id}`} className="dash-link">
              {t("common.edit")}
            </Link>
          ) : null}
          {canManage && (
            <Link to={`/app/templates/new?from=${tpl.id}`} className="dash-link">
              {t("templates.duplicate")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * What a template is, shown rather than told: the same fields over the
 * template's background and over another one.
 */
function Explainer({ sample }) {
  const { t } = useDashboard();
  return (
    <section className="dash-card dash-explainer">
      <div>
        <h2>{t("templates.what.title")}</h2>
        <ol className="dash-muted">
          <li>
            <strong>{t("templates.what.fields")}</strong> {t("templates.what.fieldsBody")}
          </li>
          <li>
            <strong>{t("templates.what.background")}</strong> {t("templates.what.backgroundBody")}
          </li>
          <li>
            <strong>{t("templates.what.new")}</strong> {t("templates.what.newBody")}
          </li>
        </ol>
      </div>
      {sample && (
        <div className="dash-explainer-demo">
          <figure>
            <TemplateLayout template={sample} />
            <figcaption>{t("templates.what.demoTemplate")}</figcaption>
          </figure>
          <figure>
            <TemplateLayout template={sample} plain />
            <figcaption>{t("templates.what.demoEvent")}</figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
