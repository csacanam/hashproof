import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatNumber, formatUnitUsd, formatUsd } from "../format.js";
import Modal from "./Modal.jsx";

const POLL_MS = 4000;

/**
 * Buy credits for the organization: by card (Stripe Checkout, in this tab) or
 * in crypto (Voulti's checkout in a new tab, while this dialog waits and credits
 * the balance as soon as Voulti reports the invoice paid).
 */
export default function BuyDialog({ open, onClose }) {
  const { t, orgPath, refreshOverview } = useDashboard();
  const [pricing, setPricing] = useState(null);
  const [method, setMethod] = useState("stripe");
  const [credits, setCredits] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // { purchase_id, url }
  const [done, setDone] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api("/pricing")
      .then((p) => {
        if (cancelled) return;
        setPricing(p);
        setMethod(p.stripe.available || !p.crypto.available ? "stripe" : "crypto");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [open]);

  function close() {
    clearInterval(pollRef.current);
    setPending(null);
    setDone(null);
    setError("");
    onClose();
  }

  if (!open) return null;
  if (!pricing) {
    return (
      <Modal open onClose={close} title={t("buy.title")}>
        <p className="dash-muted">{t("common.loading")}</p>
      </Modal>
    );
  }

  const p = method === "stripe" ? pricing.stripe : pricing.crypto;
  const n = Math.trunc(Number(credits) || 0);
  const valid = p.available && n >= p.min_credits && n <= pricing.max_credits_per_purchase;
  const total = Math.round(n * p.cents_per_credit);

  async function payCard() {
    setBusy(true);
    setError("");
    try {
      const out = await api(orgPath("/purchases/stripe"), {
        method: "POST",
        body: { credits: n, return_url: `${window.location.origin}/app/developers` },
      });
      window.location.assign(out.url);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function payCrypto() {
    setBusy(true);
    setError("");
    // Open the tab inside the click, before any await, so it isn't blocked.
    const tab = window.open("about:blank", "_blank");
    try {
      const out = await api(orgPath("/purchases/crypto"), { method: "POST", body: { credits: n } });
      if (tab) tab.location.href = out.url;
      setPending(out);
      pollRef.current = setInterval(async () => {
        try {
          const s = await api(orgPath(`/purchases/${out.purchase_id}`));
          if (s.status === "completed") {
            clearInterval(pollRef.current);
            setPending(null);
            setDone({ credits: s.credits, balance: s.balance });
            refreshOverview();
          } else if (["Expired", "Refunded", "mismatch"].includes(s.provider_status)) {
            clearInterval(pollRef.current);
            setPending(null);
            setError(t(`buy.crypto.${s.provider_status}`));
          }
        } catch {
          /* keep waiting: a network blip is not a failed payment */
        }
      }, POLL_MS);
    } catch (err) {
      tab?.close();
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={close} title={t("buy.title")}>
      {done ? (
        <>
          <p>{t("buy.done", { n: formatNumber(done.credits), balance: formatNumber(done.balance) })}</p>
          <button className="dash-btn" onClick={close}>
            {t("common.close")}
          </button>
        </>
      ) : pending ? (
        <div className="dash-form">
          <p>{t("buy.crypto.waiting")}</p>
          <p className="dash-muted">{t("buy.crypto.waitingHelp")}</p>
          <a className="dash-btn dash-btn--ghost" href={pending.url} target="_blank" rel="noreferrer">
            {t("buy.crypto.reopen")}
          </a>
        </div>
      ) : (
        <div className="dash-form">
          <p className="dash-muted">{t("buy.forOrg")}</p>
          <div className="dash-methods">
            {[
              ["stripe", pricing.stripe, t("buy.card")],
              ["crypto", pricing.crypto, t("buy.cryptoLabel")],
            ].map(([key, info, label]) => (
              <label key={key} className={`dash-method${method === key ? " is-active" : ""}${!info.available ? " is-disabled" : ""}`}>
                <input type="radio" name="method" disabled={!info.available} checked={method === key} onChange={() => setMethod(key)} />
                <strong>
                  {label}
                  {key === "crypto" && info.cents_per_credit < pricing.stripe.cents_per_credit && (
                    <span className="dash-discount">
                      −{Math.round((1 - info.cents_per_credit / pricing.stripe.cents_per_credit) * 100)}%
                    </span>
                  )}
                </strong>
                <span>{t("buy.perCredit", { price: formatUnitUsd(info.cents_per_credit) })}</span>
                <small className="dash-muted">{info.available ? t("buy.min", { n: info.min_credits }) : t("buy.soon")}</small>
              </label>
            ))}
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
          {p.available && !valid && (
            <p className="dash-error">{t("buy.range", { min: p.min_credits, max: formatNumber(pricing.max_credits_per_purchase) })}</p>
          )}
          {!pricing.stripe.available && !pricing.crypto.available && <p className="dash-note">{t("buy.noneAvailable")}</p>}
          {error && <p className="dash-error">{error}</p>}
          <button className="dash-btn" disabled={!valid || busy} onClick={method === "stripe" ? payCard : payCrypto}>
            {busy
              ? t("common.loading")
              : method === "stripe"
                ? t("buy.payCard", { total: formatUsd(total) })
                : t("buy.payCrypto", { total: formatUsd(total) })}
          </button>
          {method === "crypto" && <small className="dash-muted">{t("buy.cryptoHelp")}</small>}
        </div>
      )}
    </Modal>
  );
}
