import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatDate, formatNumber } from "../format.js";
import StatusPill from "../components/StatusPill.jsx";
import Modal from "../components/Modal.jsx";

const PAGE = 50;

export default function Credentials() {
  const { t, org, orgPath, refreshOverview } = useDashboard();
  const [filters, setFilters] = useState({ q: "", context: "", status: "" });
  const [query, setQuery] = useState(filters);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState(null);

  // Debounce typing so every keystroke isn't a request.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(filters);
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [filters]);

  const [tick, setTick] = useState(0);
  const reload = () => setTick((n) => n + 1);

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
    api(orgPath(`/credentials?${params}`))
      .then((d) => {
        if (cancelled) return;
        setError("");
        setData(d);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [org?.id, query, offset, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = data?.total ?? 0;

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <h1>{t("credentials.title")}</h1>
          <p className="dash-muted">{data ? t("credentials.count", { n: formatNumber(total) }) : " "}</p>
        </div>
        <Link to="/app/issue" className="dash-btn">
          {t("overview.issue")}
        </Link>
      </header>

      <div className="dash-filters">
        <input
          type="search"
          placeholder={t("credentials.searchName")}
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <input
          type="search"
          placeholder={t("credentials.searchContext")}
          value={filters.context}
          onChange={(e) => setFilters({ ...filters, context: e.target.value })}
        />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">{t("credentials.allStatuses")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="revoked">{t("status.revoked")}</option>
          <option value="expired">{t("status.expired")}</option>
        </select>
      </div>

      {error && <p className="dash-error">{error}</p>}

      <div className="dash-card dash-card--flush">
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>{t("credentials.col.holder")}</th>
                <th>{t("credentials.col.context")}</th>
                <th>{t("credentials.col.issued")}</th>
                <th>{t("credentials.col.status")}</th>
                <th aria-label={t("credentials.col.actions")} />
              </tr>
            </thead>
            <tbody>
              {!data && (
                <tr>
                  <td colSpan={5} className="dash-muted">
                    {t("common.loading")}
                  </td>
                </tr>
              )}
              {data?.credentials.length === 0 && (
                <tr>
                  <td colSpan={5} className="dash-muted">
                    {t("credentials.empty")}
                  </td>
                </tr>
              )}
              {data?.credentials.map((c) => (
                <tr key={c.id}>
                  <td>
                    <a href={c.verification_url} target="_blank" rel="noreferrer">
                      {c.holder_name || "—"}
                    </a>
                  </td>
                  <td>{c.context_title}</td>
                  <td>{formatDate(c.issued_at)}</td>
                  <td>
                    <StatusPill status={c.status} />
                    {c.revocation_reason && (
                      <div className="dash-muted dash-small dash-reason" title={c.revocation_reason}>
                        {c.revocation_reason}
                      </div>
                    )}
                  </td>
                  <td className="dash-actions">
                    {c.status === "revoked" ? (
                      // Nothing to hand out any more; what is left to show is
                      // the proof that it was withdrawn.
                      c.revocation_tx_hash && (
                        <a href={`https://celoscan.io/tx/${c.revocation_tx_hash}`} target="_blank" rel="noreferrer" className="dash-link">
                          {t("credentials.revocationTx")}
                        </a>
                      )
                    ) : (
                      <>
                        <a href={`${c.verification_url}/pdf`} target="_blank" rel="noreferrer" className="dash-link">
                          PDF
                        </a>
                        <button type="button" className="dash-link dash-link--danger" onClick={() => setRevoking(c)}>
                          {t("credentials.revoke")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {total > PAGE && (
        <div className="dash-pager">
          <button type="button" className="dash-btn dash-btn--ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            {t("common.previous")}
          </button>
          <span className="dash-muted">
            {formatNumber(offset + 1)}–{formatNumber(Math.min(offset + PAGE, total))} / {formatNumber(total)}
          </span>
          <button type="button" className="dash-btn dash-btn--ghost" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
            {t("common.next")}
          </button>
        </div>
      )}

      <RevokeDialog
        credential={revoking}
        onClose={() => setRevoking(null)}
        onDone={() => {
          setRevoking(null);
          reload();
          refreshOverview();
        }}
      />
    </div>
  );
}

/** Revocation is permanent, so the name has to be typed, not just clicked through. */
function RevokeDialog({ credential, onClose, onDone }) {
  const { t, orgPath } = useDashboard();
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTyped("");
    setReason("");
    setError("");
  }, [credential?.id]);

  const expected = (credential?.holder_name || "").trim();
  const matches = typed.trim().toLowerCase() === expected.toLowerCase() && expected !== "";

  async function revoke() {
    setBusy(true);
    setError("");
    try {
      await api(orgPath(`/credentials/${credential.id}/revoke`), {
        method: "POST",
        body: { confirm: true, reason: reason || undefined },
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={Boolean(credential)} onClose={onClose} title={t("revoke.title")}>
      <p>{t("revoke.body", { name: expected, context: credential?.context_title ?? "" })}</p>
      <p className="dash-note dash-note--danger">{t("revoke.permanent")}</p>
      <div className="dash-form">
        <label>
          <span>{t("revoke.reason")}</span>
          <input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder={t("revoke.reasonPlaceholder")} />
        </label>
        <label>
          <span>{t("revoke.type", { name: expected })}</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
        {error && <p className="dash-error">{error}</p>}
        <div className="dash-row">
          <button type="button" className="dash-btn dash-btn--ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="button" className="dash-btn dash-btn--danger" disabled={!matches || busy} onClick={revoke}>
            {busy ? t("revoke.working") : t("revoke.confirm")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
