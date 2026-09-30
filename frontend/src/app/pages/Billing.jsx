import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, downloadFile } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatDate, formatNumber, formatUnitUsd, formatUsd } from "../format.js";
import BuyLink from "../components/BuyLink.jsx";

/** Balance, prices, and every purchase with its receipt. */
export default function Billing() {
  const { t, org, orgPath, locale, overview, refreshOverview } = useDashboard();
  const [purchases, setPurchases] = useState(null);
  const [used, setUsed] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(null);
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useSearchParams();
  const purchase = search.get("purchase");

  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    Promise.all([api(orgPath("/purchases")), api(orgPath("/keys")), api("/pricing")])
      .then(([p, k, pr]) => {
        if (cancelled) return;
        setPurchases(p);
        setUsed(k.reduce((sum, key) => sum + (key.credits_used || 0), 0));
        setPricing(pr);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [org?.id, tick, overview?.balance]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from paying: the webhook credits the organization, usually within seconds.
  useEffect(() => {
    if (purchase !== "success" && purchase !== "crypto") return;
    const timers = [1500, 4000, 9000].map((ms) =>
      setTimeout(() => {
        setTick((n) => n + 1);
        refreshOverview();
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [purchase]); // eslint-disable-line react-hooks/exhaustive-deps

  const completed = (purchases ?? []).filter((p) => p.status === "completed");
  const paidCents = completed.reduce(
    (sum, p) => sum + p.amount_usd_cents - Math.round((p.amount_usd_cents * (p.refunded_credits || 0)) / p.credits),
    0,
  );
  const bought = completed.reduce((sum, p) => sum + p.credits - (p.refunded_credits || 0), 0);

  async function download(p, kind) {
    setDownloading(`${p.id}:${kind}`);
    setError("");
    try {
      await downloadFile(orgPath(`/purchases/${p.id}/${kind}?lang=${locale}`), `HashProof-${documentNumber(kind, p.id)}.pdf`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <h1>{t("billing.title")}</h1>
          <p className="dash-muted">{t("billing.subtitle")}</p>
        </div>
        <BuyLink className="dash-btn" />
      </header>

      {purchase === "success" && (
        <div className="dash-banner dash-banner--ok" role="status">
          {t("dev.purchaseSuccess")}{" "}
          <button className="dash-link" onClick={() => setSearch({})}>
            ×
          </button>
        </div>
      )}
      {purchase === "crypto" && (
        <div className="dash-banner dash-banner--ok" role="status">
          {t("dev.cryptoReturn")}{" "}
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

      <section className="dash-stats">
        <div className="dash-stat">
          <span className="dash-label">{t("overview.balance")}</span>
          <strong>{overview ? formatNumber(overview.balance) : "—"}</strong>
          <span className="dash-muted dash-small">{t("billing.balanceHelp")}</span>
        </div>
        <div className="dash-stat">
          <span className="dash-label">{t("billing.used")}</span>
          <strong>{used === null ? "—" : formatNumber(used)}</strong>
        </div>
        <div className="dash-stat">
          <span className="dash-label">{t("billing.bought")}</span>
          <strong>{purchases ? formatNumber(bought) : "—"}</strong>
        </div>
        <div className="dash-stat">
          <span className="dash-label">{t("billing.paid")}</span>
          <strong>{purchases ? formatUsd(paidCents) : "—"}</strong>
        </div>
      </section>

      {pricing && (
        <section className="dash-card">
          <h2>{t("billing.prices")}</h2>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>{t("dev.col.method")}</th>
                  <th>{t("billing.perCredit")}</th>
                  <th>{t("billing.minimum")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t("buy.card")}</td>
                  <td>{formatUnitUsd(pricing.stripe.cents_per_credit)}</td>
                  <td>{t("billing.minCredits", { n: formatNumber(pricing.stripe.min_credits) })}</td>
                </tr>
                <tr>
                  <td>{t("buy.cryptoLabel")}</td>
                  <td>{formatUnitUsd(pricing.crypto.cents_per_credit)}</td>
                  <td>{t("billing.minCredits", { n: formatNumber(pricing.crypto.min_credits) })}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="dash-muted dash-small">{t("billing.pricesHelp")}</p>
        </section>
      )}

      <section className="dash-card">
        <h2>{t("dev.purchases")}</h2>
        {purchases && purchases.length === 0 ? (
          <p className="dash-muted">{t("dev.noPurchases")}</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>{t("dev.col.date")}</th>
                  <th>{t("billing.col.invoice")}</th>
                  <th>{t("dev.col.method")}</th>
                  <th>{t("dev.col.credits")}</th>
                  <th>{t("dev.col.amount")}</th>
                  <th>{t("credentials.col.status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(purchases ?? []).map((p) => {
                  const status = purchaseStatus(p);
                  return (
                    <tr key={p.id}>
                      <td>{formatDate(p.completed_at || p.created_at, true)}</td>
                      <td>
                        <code>{p.status === "completed" ? documentNumber("invoice", p.id) : "—"}</code>
                      </td>
                      <td>{t(`buy.method.${p.method}`)}</td>
                      <td>
                        {formatNumber(p.credits)}
                        {p.refunded_credits > 0 && (
                          <div className="dash-muted dash-small">
                            {t("billing.withdrawn", { n: formatNumber(p.refunded_credits) })}
                          </div>
                        )}
                      </td>
                      <td>{formatUsd(p.amount_usd_cents)}</td>
                      <td>
                        <span className={`dash-pill dash-pill--${PILL[status]}`}>{t(`purchase.${status}`)}</span>
                      </td>
                      <td className="dash-actions">
                        {p.status === "completed" &&
                          ["invoice", "receipt"].map((kind) => (
                            <button
                              key={kind}
                              className="dash-link"
                              disabled={downloading === `${p.id}:${kind}`}
                              onClick={() => download(p, kind)}
                            >
                              {downloading === `${p.id}:${kind}` ? t("common.loading") : t(`billing.download.${kind}`)}
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const PILL = { completed: "active", pending: "expired", unpaid: "expired", refunded: "revoked", partiallyRefunded: "revoked" };
// Payment links expire within the hour; a purchase still pending after that was never paid.
const UNPAID_AFTER_MS = 2 * 60 * 60 * 1000;

function purchaseStatus(p) {
  if (p.status !== "completed") {
    return Date.now() - new Date(p.created_at).getTime() > UNPAID_AFTER_MS ? "unpaid" : p.status;
  }
  if (p.refunded_credits >= p.credits) return "refunded";
  if (p.refunded_credits > 0) return "partiallyRefunded";
  return "completed";
}

/** Same numbers the backend prints on the documents. */
function documentNumber(kind, id) {
  return `${kind === "invoice" ? "INV" : "RCT"}-${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
