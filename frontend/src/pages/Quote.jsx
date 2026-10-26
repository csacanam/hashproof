import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import { getPreferredLocale, createTranslator } from "../i18n.js";
import { quoteMessages, QUOTE_SAMPLES } from "../locales/quote.js";
import "./quote.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";
const DEMO_CREDENTIAL_ID = "e313fd8d-c964-4b9c-ad1a-d21ca920ae75";
const QUICK_QUANTITIES = [100, 400, 1000, 5000];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function formatDate(iso, locale) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale === "en" ? "en-US" : "es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function post(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.code = res.status === 429 ? "rate_limited" : data?.code;
    throw err;
  }
  return res;
}

export default function Quote() {
  const [params, setParams] = useSearchParams();
  const [locale, setLocale] = useState(() => {
    const l = params.get("lang");
    return l === "en" || l === "es" ? l : getPreferredLocale();
  });
  const [currency, setCurrency] = useState(() => {
    const c = (params.get("currency") || "").toUpperCase();
    if (c === "USD" || c === "COP") return c;
    return getPreferredLocale() === "es" ? "COP" : "USD";
  });
  const [quantity, setQuantity] = useState(() => {
    const n = Number(params.get("qty"));
    return Number.isInteger(n) && n > 0 ? n : 400;
  });
  const [verification, setVerification] = useState(true);
  const [managed, setManaged] = useState(false);
  const [client, setClient] = useState({ name: "", company: "", email: "", event: "" });
  const [quote, setQuote] = useState(null);
  const [priceError, setPriceError] = useState("");
  const [action, setAction] = useState(null); // {kind, phase, error, email}

  const t = useMemo(() => createTranslator(quoteMessages, locale), [locale]);
  const samples = QUOTE_SAMPLES[locale] ?? QUOTE_SAMPLES.en;

  // Keep the link shareable: language, currency and quantity live in the URL.
  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("lang", locale);
    next.set("currency", currency);
    next.set("qty", String(quantity || ""));
    setParams(next, { replace: true });
  }, [locale, currency, quantity]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = { locale, currency, quantity: Number(quantity), verification, managed };

  useEffect(() => {
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) return;
    let cancelled = false;
    const id = setTimeout(() => {
      post("/quotes/price", body)
        .then((r) => r.json())
        .then((q) => {
          if (cancelled) return;
          setQuote(q);
          setPriceError("");
        })
        .catch((err) => !cancelled && setPriceError(err.message));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [locale, currency, quantity, verification, managed]); // eslint-disable-line react-hooks/exhaustive-deps

  const contactReady = client.name.trim().length >= 2 && EMAIL_RE.test(client.email.trim());

  async function download() {
    setAction({ kind: "download", phase: "busy" });
    try {
      const res = await post("/quotes/pdf", { ...body, client });
      const blob = await res.blob();
      const number = res.headers.get("X-Quote-Number");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = number ? `HashProof-${number}.pdf` : "HashProof-quote.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
      setAction(null);
    } catch (err) {
      setAction({ kind: "download", phase: "error", error: errorText(err) });
    }
  }

  async function send() {
    setAction({ kind: "email", phase: "busy" });
    try {
      const res = await post("/quotes/email", { ...body, client });
      const out = await res.json();
      setAction({ kind: "email", phase: "done", email: out.email });
    } catch (err) {
      setAction({ kind: "email", phase: "error", error: errorText(err) });
    }
  }

  const errorText = (err) =>
    err.code === "rate_limited" ? t("quote.err.rate") : err.code === "email_failed" ? t("quote.err.email") : err.message;

  const busy = action?.phase === "busy";
  const set = (k) => (e) => setClient({ ...client, [k]: e.target.value });

  return (
    <div className="page quote-page">
      <Helmet>
        <html lang={locale} />
        <title>{t("quote.meta.title")}</title>
        <meta name="description" content={t("quote.meta.description")} />
        <meta property="og:title" content={t("quote.meta.title")} />
        <meta property="og:description" content={t("quote.meta.description")} />
        <meta property="og:url" content="https://www.hashproof.dev/quote" />
        <meta property="og:image" content="https://www.hashproof.dev/thumbnail.png" />
        <link rel="canonical" href="https://www.hashproof.dev/quote" />
      </Helmet>

      <SiteHeader />

      <main>
        <section className="quote-hero">
          <span className="quote-eyebrow">{t("quote.eyebrow")}</span>
          <h1>{t("quote.title")}</h1>
          <p className="quote-lead">{t("quote.lead")}</p>
          <div className="quote-toggles">
            <Segmented label={t("quote.language")} value={locale} onChange={setLocale} options={[["es", "Español"], ["en", "English"]]} />
            <Segmented label={t("quote.currency")} value={currency} onChange={setCurrency} options={[["USD", "USD"], ["COP", "COP"]]} />
          </div>
        </section>

        <section className="quote-grid">
          <form className="quote-card quote-form" onSubmit={(e) => e.preventDefault()}>
            <h2>{t("quote.config")}</h2>

            <label className="quote-field">
              <span>{t("quote.quantity")}</span>
              <input
                type="number"
                min={1}
                max={1000000}
                step={1}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === "" ? "" : Math.max(0, Math.floor(Number(e.target.value))))}
              />
              <div className="quote-chips">
                {QUICK_QUANTITIES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`quote-chip${Number(quantity) === n ? " is-on" : ""}`}
                    onClick={() => setQuantity(n)}
                  >
                    {n.toLocaleString(locale === "en" ? "en-US" : "es-CO")}
                  </button>
                ))}
              </div>
              <small>{t("quote.quantityHelp")}</small>
            </label>

            <fieldset className="quote-extras">
              <legend>{t("quote.extras")}</legend>
              <Toggle checked={verification} onChange={setVerification} title={t("quote.verification")} help={t("quote.verificationHelp")} />
              <Toggle checked={managed} onChange={setManaged} title={t("quote.managed")} help={t("quote.managedHelp")} />
            </fieldset>

            <fieldset className="quote-client">
              <legend>{t("quote.client")}</legend>
              <small>{t("quote.clientHelp")}</small>
              <div className="quote-two">
                <label className="quote-field">
                  <span>{t("quote.name")}</span>
                  <input value={client.name} maxLength={120} onChange={set("name")} autoComplete="name" />
                </label>
                <label className="quote-field">
                  <span>{t("quote.company")}</span>
                  <input value={client.company} maxLength={120} onChange={set("company")} autoComplete="organization" />
                </label>
              </div>
              <label className="quote-field">
                <span>{t("quote.email")}</span>
                <input type="email" value={client.email} maxLength={254} onChange={set("email")} autoComplete="email" />
              </label>
              <label className="quote-field">
                <span>{t("quote.event")}</span>
                <input value={client.event} maxLength={160} onChange={set("event")} />
              </label>
            </fieldset>

            {quote && (
              <div className="quote-mini-total">
                <span>{t("quote.paper.total")}</span>
                <strong>{quote.total_label}</strong>
              </div>
            )}

            <div className="quote-actions">
              <button type="button" className="btn btn-primary" disabled={!contactReady || busy || !quote} onClick={download}>
                {busy && action.kind === "download" ? t("quote.downloading") : t("quote.download")}
              </button>
              <button type="button" className="btn btn-secondary" disabled={!contactReady || busy || !quote} onClick={send}>
                {busy && action.kind === "email" ? t("quote.sending") : t("quote.send")}
              </button>
            </div>
            {!contactReady && <p className="quote-hint">{t("quote.needContact")}</p>}
            {action?.phase === "done" && <p className="quote-ok">{fill(t("quote.sent"), { email: action.email })}</p>}
            {action?.phase === "error" && <p className="quote-error">{action.error}</p>}
          </form>

          <Paper t={t} quote={quote} client={client} locale={locale} error={priceError} />
        </section>

        <section className="section quote-section">
          <h2>{t("quote.why.title")}</h2>
          <div className="quote-why">
            {["verify", "forge", "brand", "share"].map((k) => (
              <div key={k} className="quote-why-item">
                <h3>{t(`quote.why.${k}.title`)}</h3>
                <p>{t(`quote.why.${k}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section quote-section">
          <h2>{t("quote.samples.title")}</h2>
          <p className="quote-muted">{t("quote.samples.body")}</p>
          <div className="quote-samples">
            {samples.map((s) => (
              <SampleCertificate key={s.org} sample={s} verified={t("quote.samples.verified")} />
            ))}
          </div>
        </section>

        <section className="section quote-section">
          <h2>{t("quote.how.title")}</h2>
          <ol className="quote-how">
            {[1, 2, 3].map((n) => (
              <li key={n}>
                <span className="quote-how-num">{n}</span>
                <div>
                  <h3>{t(`quote.how.${n}.title`)}</h3>
                  <p>{t(`quote.how.${n}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="quote-cta">
            <Link to={`/verify/${DEMO_CREDENTIAL_ID}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              {t("quote.demo")}
            </Link>
            <Link to="/app" className="btn btn-primary">
              {t("quote.start")}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Segmented({ label, value, onChange, options }) {
  return (
    <div className="quote-seg" role="radiogroup" aria-label={label}>
      <span className="quote-seg-label">{label}</span>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? "is-on" : ""} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, title, help }) {
  return (
    <label className={`quote-toggle${checked ? " is-on" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <strong>{title}</strong>
        <small>{help}</small>
      </span>
    </label>
  );
}

/** The proposal as it will read: same numbers the PDF gets, from the server. */
function Paper({ t, quote, client, locale, error }) {
  const hasClient = client.name || client.company || client.email || client.event;
  return (
    <article className="quote-paper" aria-live="polite">
      <header className="quote-paper-head">
        <img src="/hashproof-logo.png" alt="HashProof" />
        <div>
          <strong>{t("quote.paper.title")}</strong>
          {quote && <span>{fill(t("quote.paper.valid"), { date: formatDate(quote.valid_until, locale) })}</span>}
        </div>
      </header>
      <div className="quote-paper-body">
        {hasClient && (
          <div className="quote-paper-client">
            <span className="quote-paper-label">{t("quote.paper.preparedFor")}</span>
            {client.name && <strong>{client.name}</strong>}
            {client.company && <span>{client.company}</span>}
            {client.event && <span className="quote-paper-muted">{client.event}</span>}
          </div>
        )}
        {error && <p className="quote-error">{error}</p>}
        {!quote && !error && <p className="quote-paper-muted">{t("quote.loading")}</p>}
        {quote && (
          <>
            <table className="quote-table">
              <thead>
                <tr>
                  <th>{t("quote.paper.item")}</th>
                  <th>{t("quote.paper.qty")}</th>
                  <th>{t("quote.paper.unit")}</th>
                  <th>{t("quote.paper.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((l) => (
                  <tr key={l.key}>
                    <td>{t(`quote.line.${l.key}`)}</td>
                    <td>{l.quantity.toLocaleString(locale === "en" ? "en-US" : "es-CO")}</td>
                    <td>{l.unit_label}</td>
                    <td>{l.amount_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="quote-total">
              <span>{t("quote.paper.total")}</span>
              <strong>{quote.total_label}</strong>
            </div>
            {quote.rate && (
              <p className="quote-paper-muted quote-rate">
                {fill(t(quote.rate.source === "market" ? "quote.paper.rate" : "quote.paper.rateFallback"), {
                  date: formatDate(quote.rate.date, locale),
                  rate: quote.rate.usd_cop.toLocaleString(locale === "en" ? "en-US" : "es-CO", { maximumFractionDigits: 2 }),
                })}
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function SampleCertificate({ sample, verified }) {
  return (
    <figure className={`quote-sample quote-sample--${sample.theme}`}>
      <div className="quote-sample-band" />
      <div className="quote-sample-inner">
        <span className="quote-sample-org">{sample.org}</span>
        <span className="quote-sample-kind">{sample.kind}</span>
        <span className="quote-sample-name">{sample.name}</span>
        <span className="quote-sample-rule" />
        <span className="quote-sample-badge">✓ {verified}</span>
      </div>
      <svg className="quote-sample-qr" viewBox="0 0 7 7" aria-hidden="true">
        {/* A QR-like mark: the real one links to the certificate's page. */}
        {[[0,0],[0,1],[0,2],[1,0],[2,0],[1,2],[2,1],[2,2],[4,0],[5,0],[6,0],[6,1],[6,2],[4,2],[5,2],[0,4],[0,5],[0,6],[1,6],[2,6],[2,4],[2,5],[4,4],[5,5],[6,4],[4,6],[6,6],[3,3],[5,3],[3,5]].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
        ))}
      </svg>
    </figure>
  );
}
