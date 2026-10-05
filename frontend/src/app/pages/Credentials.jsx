import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatDate, formatNumber } from "../format.js";
import StatusPill from "../components/StatusPill.jsx";
import Modal from "../components/Modal.jsx";
import BuyLink from "../components/BuyLink.jsx";
import { waitForJob } from "../jobs.js";

const PAGE = 50;

export default function Credentials() {
  const { t, org, orgPath, refreshOverview } = useDashboard();
  const [filters, setFilters] = useState({ q: "", context: "", status: "" });
  const [query, setQuery] = useState(filters);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState(null);
  const [sending, setSending] = useState(null);
  const [reissuing, setReissuing] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");

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
                <th>{t("credentials.col.email")}</th>
                <th aria-label={t("credentials.col.actions")} />
              </tr>
            </thead>
            <tbody>
              {!data && (
                <tr>
                  <td colSpan={6} className="dash-muted">
                    {t("common.loading")}
                  </td>
                </tr>
              )}
              {data?.credentials.length === 0 && (
                <tr>
                  <td colSpan={6} className="dash-muted">
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
                  <td>
                    <EmailStatus credential={c} />
                  </td>
                  <td className="dash-actions">
                    <button type="button" className="dash-link" onClick={() => setReissuing(c)}>
                      {t("credentials.reissue")}
                    </button>
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
                        <button type="button" className="dash-link" onClick={() => setSending(c)}>
                          {c.email_status ? t("credentials.resend") : t("credentials.send")}
                        </button>
                        <button
                          type="button"
                          className="dash-link dash-link--danger"
                          onClick={() => {
                            setRevokeReason("");
                            setRevoking(c);
                          }}
                        >
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

      <SendDialog
        credential={sending}
        onClose={() => setSending(null)}
        onDone={() => {
          setSending(null);
          reload();
        }}
      />

      {reissuing && (
        <ReissueDialog
          key={reissuing.id}
          credential={reissuing}
          onClose={() => setReissuing(null)}
          onIssued={() => {
            reload();
            refreshOverview();
          }}
          onRevokeOriginal={(original, copy) => {
            setReissuing(null);
            setRevokeReason(t("reissue.revokeReason", { url: copy.verification_url }));
            setRevoking(original);
          }}
        />
      )}

      <RevokeDialog
        credential={revoking}
        initialReason={revokeReason}
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

const EMAIL_TONE = {
  delivered: "ok",
  sent: "muted",
  deferred: "muted",
  bounced: "bad",
  dropped: "bad",
  spam: "bad",
  failed: "bad",
};

/** Whether the credential's email reached its holder, with SendGrid's reason on hover. */
function EmailStatus({ credential: c }) {
  const { t } = useDashboard();
  if (!c.holder_email) return <span className="dash-muted">—</span>;
  const status = c.email_status || "not_sent";
  const tone = EMAIL_TONE[status] || "muted";
  const when = c.email_updated_at || c.email_sent_at;
  return (
    <div className="dash-email" title={[c.holder_email, c.email_detail].filter(Boolean).join(" · ")}>
      <span className={`dash-email-status dash-email-status--${tone}`}>{t(`email.${status}`)}</span>
      <span className="dash-muted dash-small">{when ? formatDate(when, true) : c.holder_email}</span>
    </div>
  );
}

/** Send the credential to its holder again, or for the first time; the address can be corrected. */
function SendDialog({ credential, onClose, onDone }) {
  const { t, locale, orgPath } = useDashboard();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEmail(credential?.holder_email || "");
    setError("");
  }, [credential?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(orgPath(`/credentials/${credential.id}/notify`), { method: "POST", body: { email, locale } });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const bad = ["bounced", "dropped", "spam", "failed"].includes(credential?.email_status);
  return (
    <Modal open={Boolean(credential)} onClose={onClose} title={credential?.email_status ? t("send.titleAgain") : t("send.title")}>
      <form className="dash-form" onSubmit={send}>
        <p>{t("send.body", { name: credential?.holder_name || "" })}</p>
        {bad && (
          <p className="dash-note dash-note--danger">
            {t(`email.${credential.email_status}`)}
            {credential.email_detail ? ` — ${credential.email_detail}` : ""}. {t("send.checkAddress")}
          </p>
        )}
        <label className="dash-field">
          <span>{t("login.email")}</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <small className="dash-muted">{t("send.help")}</small>
        </label>
        {error && <p className="dash-error">{error}</p>}
        <div className="dash-row">
          <button type="button" className="dash-btn dash-btn--ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="dash-btn" disabled={busy}>
            {busy ? t("common.sending") : t("send.confirm")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Revocation is permanent, so the name has to be typed, not just clicked through. */
function RevokeDialog({ credential, initialReason = "", onClose, onDone }) {
  const { t, orgPath } = useDashboard();
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTyped("");
    setReason(initialReason);
    setError("");
  }, [credential?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

/**
 * Issue a new credential copied from this one: same template, background,
 * event, title and values. The values can be corrected first; the design
 * cannot change. Revoking the original is offered afterwards, never implied.
 */
function ReissueDialog({ credential, onClose, onIssued, onRevokeOriginal }) {
  const { t, orgPath } = useDashboard();
  const [source, setSource] = useState(null);
  const [name, setName] = useState("");
  const [values, setValues] = useState({});
  const [state, setState] = useState(null); // {phase, job, error, code}
  // One key per dialog: a double click or a retry yields one credential. The
  // dialog is mounted per credential, so a new one starts with a new key.
  const keyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    let cancelled = false;
    api(orgPath(`/credentials/${credential.id}/reissue`))
      .then((d) => {
        if (cancelled) return;
        setSource(d);
        setName(d.holder_name);
        setValues(d.values);
      })
      .catch((err) => !cancelled && setState({ phase: "failed", error: err.message }));
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    setState({ phase: "queueing" });
    try {
      const out = await api(orgPath(`/credentials/${credential.id}/reissue`), {
        method: "POST",
        body: { holder_name: name, values, idempotency_key: keyRef.current },
      });
      setState({ phase: "waiting" });
      const job = await waitForJob(out.job_id);
      setState({ phase: job?.status === "completed" ? "done" : "failed", job });
      onIssued();
    } catch (err) {
      setState({ phase: "failed", error: err.message, code: err.code });
    }
  }

  // holder_name follows the recipient's name unless the original set it apart.
  const fields = source
    ? Object.keys(source.values).filter((k) => !(k === "holder_name" && source.name_follows_holder))
    : [];
  const busy = state?.phase === "queueing" || state?.phase === "waiting";
  const copy = state?.phase === "done" ? state.job.credential : null;

  return (
    <Modal open onClose={onClose} title={t("reissue.title")}>
      {copy ? (
        <div className="dash-form">
          <p>{t("reissue.done", { name })}</p>
          <div className="dash-row">
            <a href={copy.verification_url} target="_blank" rel="noreferrer" className="dash-btn">
              {t("issue.done.view")}
            </a>
            <a href={copy.pdf_url} target="_blank" rel="noreferrer" className="dash-btn dash-btn--ghost">
              PDF
            </a>
          </div>
          {credential.status !== "revoked" && (
            <>
              <p className="dash-note">{t("reissue.originalStillActive")}</p>
              <div className="dash-row">
                <button type="button" className="dash-btn dash-btn--ghost" onClick={onClose}>
                  {t("reissue.keepOriginal")}
                </button>
                <button type="button" className="dash-btn dash-btn--danger" onClick={() => onRevokeOriginal(credential, copy)}>
                  {t("reissue.revokeOriginal")}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <form className="dash-form" onSubmit={submit}>
          <p>{t("reissue.body", { context: credential?.context_title ?? "" })}</p>
          {!source && !state && <p className="dash-muted">{t("common.loading")}</p>}
          {source?.expired && <p className="dash-note dash-note--danger">{t("reissue.expired")}</p>}
          {source && !source.expired && (
            <>
              <label className="dash-field">
                <span>{t("issue.holderName")}</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              {fields.map((k) => (
                <label className="dash-field" key={k}>
                  <span>{t("issue.map.field", { field: k })}</span>
                  <input value={values[k] ?? ""} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
                </label>
              ))}
              <p className="dash-muted">{t("issue.costOne")}</p>
            </>
          )}
          {state?.phase === "failed" && (
            <p className="dash-error">
              {state.error || state.job?.error || t("issue.failed")}{" "}
              {state.code === "insufficient_credits" && <BuyLink />}
            </p>
          )}
          <div className="dash-row">
            <button type="button" className="dash-btn dash-btn--ghost" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </button>
            <button className="dash-btn" disabled={!source || source.expired || !name.trim() || busy}>
              {state?.phase === "waiting" ? t("issue.waiting") : busy ? t("common.sending") : t("reissue.confirm")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
