import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatDate } from "../format.js";

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
        <img src={tpl.background_url} alt="" loading="lazy" />
      </div>
      <div className="dash-template-meta">
        <strong>{tpl.name}</strong>
        <code className="dash-small dash-ellipsis" title={tpl.slug}>
          {tpl.slug}
        </code>
        <span className="dash-muted dash-small">
          {tpl.fields_json.length} {t("templates.fields")} · {formatDate(tpl.created_at)}
        </span>
        <div className="dash-row">
          {editable ? (
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
