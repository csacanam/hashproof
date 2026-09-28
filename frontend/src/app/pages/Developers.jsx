import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ConnectButton, useActiveAccount, useFetchWithPayment } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { api, API_URL, getSession } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatDate, formatNumber, formatUsd } from "../format.js";
import Modal from "../components/Modal.jsx";
import { thirdwebClient } from "../../thirdweb.js";

const WALLETS = [createWallet("io.metamask"), createWallet("com.coinbase.wallet")];

export default function Developers() {
  const { t, org, orgPath, canManage, refreshOverview } = useDashboard();
  const [keys, setKeys] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [buying, setBuying] = useState(null); // key to buy for
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useSearchParams();

  const [tick, setTick] = useState(0);
  const load = () => setTick((n) => n + 1);

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    Promise.all([api(orgPath("/keys")), api(orgPath("/purchases"))])
      .then(([k, p]) => {
        if (cancelled) return;
        setKeys(k);
        setPurchases(p);
        // Arriving from a "Buy credits" link opens the purchase for the dashboard balance.
        if (window.location.hash === "#buy" && canManage) {
          const panel = k.find((x) => x.kind === "panel");
          if (panel) setBuying((b) => b ?? panel);
        }
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [org?.id, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api("/pricing").then(setPricing).catch(() => {});
  }, []);

  // Back from Stripe: the webhook credits the key, usually within seconds.
  const purchase = search.get("purchase");
  useEffect(() => {
    if (purchase !== "success") return;
    const timers = [1500, 4000, 9000].map((ms) =>
      setTimeout(() => {
        load();
        refreshOverview();
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [purchase]); // eslint-disable-line react-hooks/exhaustive-deps

  const panel = keys?.find((k) => k.kind === "panel");
  const apiKeys = keys?.filter((k) => k.kind === "api") ?? [];
  const activeKeys = apiKeys.filter((k) => !k.revoked_at);

  async function createKey(name) {
    const out = await api(orgPath("/keys"), { method: "POST", body: { name } });
    setNewKey(out);
    setCreating(false);
    load();
  }

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <h1>{t("dev.title")}</h1>
          <p className="dash-muted">
            {t("dev.subtitle")} <Link to="/docs">{t("dev.docs")}</Link> · <a href="/skill.md">skill.md</a>
          </p>
        </div>
      </header>

      {purchase === "success" && (
        <div className="dash-banner dash-banner--ok" role="status">
          {t("dev.purchaseSuccess")}{" "}
          <button className="dash-link" onClick={() => setSearch({})}>
            ×
          </button>
        </div>
      )}
      {purchase === "cancelled" && (
        <div className="dash-banner" role="status">
          {t("dev.purchaseCancelled")}
        </div>
      )}
      {error && <p className="dash-error">{error}</p>}

      <section className="dash-card">
        <div className="dash-card-head">
          <div>
            <h2>{t("dev.dashboardBalance")}</h2>
            <p className="dash-muted">{t("dev.dashboardBalanceHelp")}</p>
          </div>
          <div className="dash-balance-big">
            <strong>{panel ? formatNumber(panel.credits_balance) : "—"}</strong>
            <span className="dash-muted">{t("nav.credits")}</span>
          </div>
        </div>
        {canManage && panel && (
          <div className="dash-row">
            <button className="dash-btn" onClick={() => setBuying(panel)}>
              {t("nav.buyCredits")}
            </button>
            {activeKeys.length > 0 && (
              <button className="dash-btn dash-btn--ghost" onClick={() => setMoving(true)}>
                {t("dev.move")}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="dash-card">
        <div className="dash-card-head">
          <div>
            <h2>{t("dev.keys")}</h2>
            <p className="dash-muted">{t("dev.keysHelp")}</p>
          </div>
          {canManage && (
            <button className="dash-btn" onClick={() => setCreating(true)}>
              {t("dev.newKey")}
            </button>
          )}
        </div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>{t("dev.col.name")}</th>
                <th>{t("dev.col.balance")}</th>
                <th>{t("dev.col.used")}</th>
                <th>{t("dev.col.lastUsed")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys && apiKeys.length === 0 && (
                <tr>
                  <td colSpan={5} className="dash-muted">
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
                  <td>{formatNumber(k.credits_balance)}</td>
                  <td>{formatNumber(k.credits_used)}</td>
                  <td>{k.last_used_at ? formatDate(k.last_used_at, true) : "—"}</td>
                  <td className="dash-actions">
                    {canManage && !k.revoked_at && (
                      <>
                        <button className="dash-link" onClick={() => setBuying(k)}>
                          {t("dev.addCredits")}
                        </button>
                        <button className="dash-link dash-link--danger" onClick={() => setRevoking(k)}>
                          {t("dev.revokeKey")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
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
        <p className="dash-muted dash-small">{t("dev.x402Note", { price: pricing ? formatUsd(pricing.x402.cents_per_credit) : "$0.10" })}</p>
      </section>

      <section className="dash-card">
        <h2>{t("dev.purchases")}</h2>
        {purchases.length === 0 ? (
          <p className="dash-muted">{t("dev.noPurchases")}</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>{t("dev.col.date")}</th>
                  <th>{t("dev.col.key")}</th>
                  <th>{t("dev.col.method")}</th>
                  <th>{t("dev.col.credits")}</th>
                  <th>{t("dev.col.amount")}</th>
                  <th>{t("credentials.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.created_at, true)}</td>
                    <td>{keys?.find((k) => k.id === p.api_key_id)?.name ?? "—"}</td>
                    <td>{p.method === "stripe" ? t("buy.card") : "USDC (x402)"}</td>
                    <td>{formatNumber(p.credits)}</td>
                    <td>{formatUsd(p.amount_usd_cents)}</td>
                    <td>{t(`purchase.${p.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
      <BuyDialog
        keyRow={buying}
        pricing={pricing}
        onClose={() => {
          setBuying(null);
          if (window.location.hash === "#buy") window.history.replaceState(null, "", window.location.pathname);
        }}
        onDone={() => {
          load();
          refreshOverview();
        }}
      />
      <MoveDialog
        open={moving}
        keys={keys || []}
        onClose={() => setMoving(false)}
        onDone={() => {
          setMoving(false);
          load();
          refreshOverview();
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
      {keyRow?.credits_balance > 0 && <p className="dash-note">{t("dev.revokeCredits", { n: formatNumber(keyRow.credits_balance) })}</p>}
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

function MoveDialog({ open, keys, onClose, onDone }) {
  const { t, orgPath } = useDashboard();
  const usable = keys.filter((k) => !k.revoked_at);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const panel = usable.find((k) => k.kind === "panel");
    setFrom(panel?.id ?? "");
    setTo(usable.find((k) => k.kind === "api")?.id ?? "");
    setAmount("");
    setError("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (k) => (k.kind === "panel" ? t("dev.dashboardBalance") : k.name);
  return (
    <Modal open={open} onClose={onClose} title={t("dev.move")}>
      <form
        className="dash-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(orgPath("/keys/transfer"), { method: "POST", body: { from_key_id: from, to_key_id: to, amount: Number(amount) } });
            onDone();
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="dash-field">
          <span>{t("dev.from")}</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {usable.map((k) => (
              <option key={k.id} value={k.id}>
                {label(k)} ({formatNumber(k.credits_balance)})
              </option>
            ))}
          </select>
        </label>
        <label className="dash-field">
          <span>{t("dev.to")}</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {usable.filter((k) => k.id !== from).map((k) => (
              <option key={k.id} value={k.id}>
                {label(k)} ({formatNumber(k.credits_balance)})
              </option>
            ))}
          </select>
        </label>
        <label className="dash-field">
          <span>{t("dev.amount")}</span>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        {error && <p className="dash-error">{error}</p>}
        <button className="dash-btn" disabled={busy || !from || !to || !(Number(amount) > 0)}>
          {t("dev.moveConfirm")}
        </button>
      </form>
    </Modal>
  );
}

function BuyDialog({ keyRow, pricing, onClose, onDone }) {
  const { t, orgPath } = useDashboard();
  const [method, setMethod] = useState("stripe");
  const [credits, setCredits] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const account = useActiveAccount();
  const { fetchWithPayment } = useFetchWithPayment(thirdwebClient, {
    maxValue: BigInt(Math.round((Number(credits) || 0) * (pricing?.x402.cents_per_credit ?? 10) * 10_000)),
  });

  useEffect(() => {
    if (!keyRow) return;
    setError("");
    setDone(null);
    setMethod(pricing?.stripe.available === false ? "x402" : "stripe");
  }, [keyRow?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pricing) return null;
  const p = method === "stripe" ? pricing.stripe : pricing.x402;
  const n = Math.trunc(Number(credits) || 0);
  const valid = n >= p.min_credits && n <= pricing.max_credits_per_purchase;
  const total = n * p.cents_per_credit;
  const target = keyRow?.kind === "panel" ? t("dev.dashboardBalance") : keyRow?.name;

  async function payCard() {
    setBusy(true);
    setError("");
    try {
      const out = await api(orgPath(`/keys/${keyRow.id}/checkout`), {
        method: "POST",
        body: { credits: n, return_url: `${window.location.origin}/app/developers` },
      });
      window.location.assign(out.url);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function payUsdc() {
    setBusy(true);
    setError("");
    try {
      const out = await fetchWithPayment(`${API_URL}/app${orgPath(`/keys/${keyRow.id}/x402`)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getSession()?.access_token}` },
        body: JSON.stringify({ credits: n }),
      });
      setDone(out);
      onDone();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={Boolean(keyRow)} onClose={onClose} title={t("buy.title")}>
      {done ? (
        <>
          <p>{t("buy.done", { n: formatNumber(done.credits), balance: formatNumber(done.credits_balance) })}</p>
          <button className="dash-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </>
      ) : (
        <div className="dash-form">
          <p className="dash-muted">{t("buy.for", { target })}</p>
          <div className="dash-methods">
            <label className={`dash-method${method === "stripe" ? " is-active" : ""}${!pricing.stripe.available ? " is-disabled" : ""}`}>
              <input type="radio" name="method" disabled={!pricing.stripe.available} checked={method === "stripe"} onChange={() => setMethod("stripe")} />
              <strong>{t("buy.card")}</strong>
              <span>{t("buy.perCredit", { price: formatUsd(pricing.stripe.cents_per_credit) })}</span>
              <small className="dash-muted">
                {pricing.stripe.available ? t("buy.min", { n: pricing.stripe.min_credits }) : t("buy.cardSoon")}
              </small>
            </label>
            <label className={`dash-method${method === "x402" ? " is-active" : ""}`}>
              <input type="radio" name="method" checked={method === "x402"} onChange={() => setMethod("x402")} />
              <strong>USDC (x402)</strong>
              <span>{t("buy.perCredit", { price: formatUsd(pricing.x402.cents_per_credit) })}</span>
              <small className="dash-muted">{t("buy.min", { n: pricing.x402.min_credits })}</small>
            </label>
          </div>
          <label className="dash-field">
            <span>{t("buy.credits")}</span>
            <input type="number" min={p.min_credits} step={1} value={credits} onChange={(e) => setCredits(e.target.value)} />
            <div className="dash-row dash-presets">
              {[100, 500, 1000, 5000].map((v) => (
                <button key={v} type="button" className="dash-chip" onClick={() => setCredits(v)}>
                  {formatNumber(v)}
                </button>
              ))}
            </div>
          </label>
          <p className="dash-total">
            {t("buy.total")}: <strong>{formatUsd(total)}</strong>
          </p>
          {!valid && <p className="dash-error">{t("buy.range", { min: p.min_credits, max: formatNumber(pricing.max_credits_per_purchase) })}</p>}
          {error && <p className="dash-error">{error}</p>}
          {method === "stripe" ? (
            <button className="dash-btn" disabled={!valid || busy} onClick={payCard}>
              {busy ? t("common.loading") : t("buy.payCard", { total: formatUsd(total) })}
            </button>
          ) : !account ? (
            <ConnectButton client={thirdwebClient} wallets={WALLETS} connectButton={{ label: t("buy.connect"), className: "dash-btn" }} />
          ) : (
            <button className="dash-btn" disabled={!valid || busy} onClick={payUsdc}>
              {busy ? t("buy.signing") : t("buy.payUsdc", { total: formatUsd(total) })}
            </button>
          )}
          {method === "x402" && <small className="dash-muted">{t("buy.usdcHelp")}</small>}
        </div>
      )}
    </Modal>
  );
}
