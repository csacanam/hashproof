import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { api, API_URL } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatDate, formatNumber } from "../format.js";
import Modal from "../components/Modal.jsx";

export default function Developers() {
  const { t, org, orgPath, canManage, overview } = useDashboard();
  const [keys, setKeys] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [search] = useSearchParams();
  const load = () => setTick((n) => n + 1);

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    api(orgPath("/keys"))
      .then((k) => !cancelled && setKeys(k))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [org?.id, tick, overview?.balance]); // eslint-disable-line react-hooks/exhaustive-deps

  const apiKeys = keys?.filter((k) => k.kind === "api") ?? [];
  const panelKey = keys?.find((k) => k.kind === "panel");

  async function createKey(name) {
    const out = await api(orgPath("/keys"), { method: "POST", body: { name } });
    setNewKey(out);
    setCreating(false);
    load();
  }

  // Payments started before Billing existed still come back here.
  const purchase = search.get("purchase");
  if (purchase) return <Navigate to={`/app/billing?purchase=${encodeURIComponent(purchase)}`} replace />;

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <h1>{t("dev.title")}</h1>
          <p className="dash-muted">
            {t("dev.subtitle")} <Link to="/docs">{t("dev.docs")}</Link> · <a href="/skill.md">skill.md</a>
          </p>
        </div>
        {canManage && (
          <button className="dash-btn" onClick={() => setCreating(true)}>
            {t("dev.newKey")}
          </button>
        )}
      </header>

      {error && <p className="dash-error">{error}</p>}

      <section className="dash-card">
        <div className="dash-card-head">
          <div>
            <h2>{t("dev.keys")}</h2>
            <p className="dash-muted">
              {t("dev.keysHelp", { balance: formatNumber(overview?.balance ?? 0) })}{" "}
              <Link to="/app/billing">{t("dev.seeBilling")}</Link>
            </p>
          </div>
        </div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>{t("dev.col.name")}</th>
                <th>{t("dev.col.issued")}</th>
                <th>{t("dev.col.lastUsed")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys && apiKeys.length === 0 && (
                <tr>
                  <td colSpan={4} className="dash-muted">
                    {t("dev.noKeys")}
                  </td>
                </tr>
              )}
              {apiKeys.map((k) => (
                <tr key={k.id} className={k.revoked_at ? "is-revoked" : ""}>
                  <td>
                    {k.name}
                    {k.revoked_at && <span className="dash-pill dash-pill--revoked">{t("status.revoked")}</span>}
                    <div className="dash-muted dash-small">{t("dev.created", { date: formatDate(k.created_at) })}</div>
                  </td>
                  <td>{formatNumber(k.credits_used)}</td>
                  <td>{k.last_used_at ? formatDate(k.last_used_at, true) : "—"}</td>
                  <td className="dash-actions">
                    {canManage && !k.revoked_at && (
                      <button className="dash-link dash-link--danger" onClick={() => setRevoking(k)}>
                        {t("dev.revokeKey")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {panelKey && (
                <tr>
                  <td>
                    {t("dev.panelRow")}
                    <div className="dash-muted dash-small">{t("dev.panelRowHelp")}</div>
                  </td>
                  <td>{formatNumber(panelKey.credits_used)}</td>
                  <td>{panelKey.last_used_at ? formatDate(panelKey.last_used_at, true) : "—"}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <details className="dash-snippet">
          <summary>{t("dev.example")}</summary>
          <pre>{`curl -X POST ${API_URL}/issueCredential \\
  -H "Authorization: Bearer $HASHPROOF_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: attendee-42" \\
  -d '{
    "async": true,
    "issuer":   { "display_name": "${org?.display_name}", "slug": "${org?.slug}" },
    "platform": { "display_name": "${org?.display_name}", "slug": "${org?.slug}" },
    "holder":   { "full_name": "Jane Doe", "email": "jane@example.com" },
    "context":  { "type": "event", "title": "Expo 2026" },
    "credential_type": "attendance",
    "title": "Certificate of Attendance",
    "template_slug": "hashproof",
    "values": { "holder_name": "Jane Doe" }
  }'`}</pre>
        </details>
        <p className="dash-muted dash-small">{t("dev.x402Note")}</p>
      </section>

      <CreateKeyDialog open={creating} onClose={() => setCreating(false)} onCreate={createKey} />
      <NewKeyDialog created={newKey} onClose={() => setNewKey(null)} />
      <RevokeKeyDialog
        keyRow={revoking}
        onClose={() => setRevoking(null)}
        onDone={() => {
          setRevoking(null);
          load();
        }}
      />
    </div>
  );
}

function CreateKeyDialog({ open, onClose, onCreate }) {
  const { t } = useDashboard();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={t("dev.newKey")}>
      <form
        className="dash-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onCreate(name);
            setName("");
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="dash-field">
          <span>{t("dev.keyName")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("dev.keyNamePh")} autoFocus />
        </label>
        <p className="dash-muted">{t("dev.keyIssuesAs")}</p>
        {error && <p className="dash-error">{error}</p>}
        <button className="dash-btn" disabled={busy}>
          {busy ? t("common.creating") : t("dev.create")}
        </button>
      </form>
    </Modal>
  );
}

function NewKeyDialog({ created, onClose }) {
  const { t } = useDashboard();
  const [copied, setCopied] = useState(false);
  return (
    <Modal open={Boolean(created)} onClose={onClose} title={t("dev.keyCreated")}>
      <p className="dash-note dash-note--danger">{t("dev.showOnce")}</p>
      <div className="dash-secret">
        <code>{created?.api_key}</code>
        <button
          type="button"
          className="dash-btn dash-btn--small"
          onClick={() => {
            navigator.clipboard?.writeText(created.api_key);
            setCopied(true);
          }}
        >
          {copied ? t("common.copied") : t("common.copy")}
        </button>
      </div>
      <p className="dash-muted">{t("dev.keyNextStep")}</p>
      <button className="dash-btn" onClick={onClose}>
        {t("dev.stored")}
      </button>
    </Modal>
  );
}

function RevokeKeyDialog({ keyRow, onClose, onDone }) {
  const { t, orgPath } = useDashboard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal open={Boolean(keyRow)} onClose={onClose} title={t("dev.revokeKey")}>
      <p>{t("dev.revokeBody", { name: keyRow?.name ?? "" })}</p>
      <p className="dash-muted">{t("dev.revokeBalance")}</p>
      {error && <p className="dash-error">{error}</p>}
      <div className="dash-row">
        <button className="dash-btn dash-btn--ghost" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button
          className="dash-btn dash-btn--danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(orgPath(`/keys/${keyRow.id}/revoke`), { method: "POST" });
              onDone();
            } catch (err) {
              setError(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("dev.revokeKey")}
        </button>
      </div>
    </Modal>
  );
}

