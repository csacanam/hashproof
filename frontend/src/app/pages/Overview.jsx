import { Link } from "react-router-dom";
import { useDashboard } from "../useDashboard.js";
import { formatDate, formatNumber } from "../format.js";
import StatusPill from "../components/StatusPill.jsx";

export default function Overview() {
  const { t, org, overview } = useDashboard();
  const c = overview?.credentials;

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <h1>{org?.display_name}</h1>
          <p className="dash-muted">
            <code>{org?.slug}</code> · <Link to={`/entities/${org?.id}`}>{t("overview.publicProfile")}</Link>
          </p>
        </div>
        <Link to="/app/issue" className="dash-btn">
          {t("overview.issue")}
        </Link>
      </header>

      <section className="dash-stats">
        <div className="dash-stat">
          <span className="dash-label">{t("overview.balance")}</span>
          <strong>{overview ? formatNumber(overview.balance) : "—"}</strong>
          <Link to="/app/developers#buy">{t("nav.buyCredits")}</Link>
        </div>
        <div className="dash-stat">
          <span className="dash-label">{t("overview.issued")}</span>
          <strong>{c ? formatNumber(c.total) : "—"}</strong>
          <Link to="/app/credentials">{t("overview.seeAll")}</Link>
        </div>
        <div className="dash-stat">
          <span className="dash-label">{t("overview.revoked")}</span>
          <strong>{c ? formatNumber(c.revoked) : "—"}</strong>
        </div>
        <div className="dash-stat">
          <span className="dash-label">{t("overview.apiBalance")}</span>
          <strong>{overview ? formatNumber(overview.api_keys_balance) : "—"}</strong>
          <Link to="/app/developers">{t("nav.developers")}</Link>
        </div>
      </section>

      {overview && overview.balance === 0 && c?.total === 0 && (
        <section className="dash-card dash-steps">
          <h2>{t("overview.start.title")}</h2>
          <ol>
            <li>
              <Link to="/app/developers#buy">{t("overview.start.buy")}</Link> — {t("overview.start.buyBody")}
            </li>
            <li>
              <Link to="/app/templates">{t("overview.start.template")}</Link> — {t("overview.start.templateBody")}
            </li>
            <li>
              <Link to="/app/issue">{t("overview.start.issue")}</Link> — {t("overview.start.issueBody")}
            </li>
          </ol>
          <p className="dash-muted">
            {t("overview.start.api")} <Link to="/app/developers">{t("nav.developers")}</Link>.
          </p>
        </section>
      )}

      <section className="dash-card">
        <div className="dash-card-head">
          <h2>{t("overview.recent")}</h2>
          <Link to="/app/credentials">{t("overview.seeAll")}</Link>
        </div>
        {!c ? (
          <p className="dash-muted">{t("common.loading")}</p>
        ) : c.recent.length === 0 ? (
          <p className="dash-muted">{t("overview.none")}</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>{t("credentials.col.holder")}</th>
                  <th>{t("credentials.col.context")}</th>
                  <th>{t("credentials.col.issued")}</th>
                  <th>{t("credentials.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {c.recent.map((cr) => (
                  <tr key={cr.id}>
                    <td>
                      <a href={cr.verification_url} target="_blank" rel="noreferrer">
                        {cr.holder_name}
                      </a>
                    </td>
                    <td>{cr.context_title}</td>
                    <td>{formatDate(cr.issued_at)}</td>
                    <td>
                      <StatusPill status={cr.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
