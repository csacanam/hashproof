import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import PdfViewer from "../components/PdfViewer.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import { getPreferredLocale, createTranslator } from "../i18n.js";
import { verifyMessages } from "../locales/verify.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";

const localeToDateLocale = { en: "en-US", es: "es" };

export default function Verify() {
  const { id } = useParams();
  const locale = useMemo(() => getPreferredLocale(), []);
  const t = useMemo(() => createTranslator(verifyMessages, locale), [locale]);
  const dateLocale = localeToDateLocale[locale] || "en-US";

  const [data, setData] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [steps, setSteps] = useState({
    contract: "pending",
    ipfs: "pending",
    db: "pending",
  });
  const wrapperRef = useRef(null);
  const verifyCardRef = useRef(null);

  const holderName =
    data?.credential?.credentialSubject?.holder_name ||
    data?.credential?.credentialSubject?.full_name ||
    data?.credential?.credentialSubject?.name ||
    null;

  const contextTitle =
    data?.credential?.context?.title ||
    data?.context_title ||
    null;

  const metaTitle =
    holderName && contextTitle
      ? `${holderName} - ${contextTitle} | HashProof`
      : "Verify credential | HashProof";

  const metaDescription = contextTitle
    ? `Verify the credential issued to ${holderName || "the holder"} for ${contextTitle}. This credential is publicly verifiable through HashProof.`
    : "Verify a HashProof credential. This credential is publicly verifiable through HashProof.";

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setSteps({ contract: "pending", ipfs: "pending", db: "pending" });
    setPdfBlob(null);

    let cancelled = false;

    async function runVerification() {
      try {
        // Step 1: Smart contract
        setSteps((s) => ({ ...s, contract: "running" }));
        const contractRes = await fetch(`${API_URL}/verify/${id}/contract`);
        if (!contractRes.ok) {
          throw new Error("Failed to verify on-chain status");
        }
        const contractJson = await contractRes.json();
        if (cancelled) return;
        setSteps((s) => ({ ...s, contract: "success" }));

        // Step 2: IPFS
        setSteps((s) => ({ ...s, ipfs: "running" }));
        const ipfsRes = await fetch(`${API_URL}/verify/${id}/ipfs`);
        if (!ipfsRes.ok) {
          throw new Error("Failed to verify IPFS backup");
        }
        const ipfsJson = await ipfsRes.json();
        if (cancelled) return;
        setSteps((s) => ({ ...s, ipfs: "success" }));

        // Step 3: Full verification (DB + aggregated status)
        setSteps((s) => ({ ...s, db: "running" }));
        const finalRes = await fetch(`${API_URL}/verify/${id}`);
        if (!finalRes.ok) {
          throw new Error(finalRes.status === 404 ? "Credential not found" : "Failed to fetch credential data");
        }
        const finalJson = await finalRes.json();
        if (cancelled) return;
        setData({
          ...finalJson,
          verification_report: finalJson.verification_report ?? {
            contract: contractJson.contract,
            ipfs: ipfsJson.ipfs,
            database: {},
          },
        });
        setSteps((s) => ({ ...s, db: "success" }));
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to verify credential");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    runVerification();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!data || !id) return;
    let cancelled = false;
    fetch(`${API_URL}/verify/${id}/pdf`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load PDF");
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) setPdfBlob(blob);
      })
      .catch(() => {
        if (!cancelled) setPdfBlob(null);
      });
    return () => { cancelled = true; };
  }, [data, id]);

  const handleDownloadPdf = () => {
    window.open(`${API_URL}/verify/${id}/pdf`, "_blank");
  };

  const handleScrollToVerify = () => {
    verifyCardRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getStepText = (state) => {
    if (state === "running") return t("verify.step.checking");
    if (state === "success") return t("verify.step.done");
    if (state === "error") return t("verify.step.error");
    return t("verify.step.waiting");
  };

  const displayError = error === "Credential not found" ? t("verify.error.notFound")
    : error === "Failed to verify credential" ? t("verify.error.generic")
    : error;

  const getStepDotClass = (state) => {
    if (state === "running") return "verify-step__dot verify-step__dot--active";
    if (state === "success") return "verify-step__dot verify-step__dot--done";
    if (state === "error") return "verify-step__dot verify-step__dot--error";
    return "verify-step__dot";
  };

  if (loading) {
    return (
      <div className="page verify-page verify-page--loading">
        <Helmet>
          <title>{metaTitle}</title>
          <meta name="description" content={metaDescription} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={`https://hashproof.dev/verify/${id || ""}`} />
          <meta property="og:title" content={metaTitle} />
          <meta property="og:description" content={metaDescription} />
          <meta property="og:image" content="https://hashproof.dev/thumbnail.png" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:url" content={`https://hashproof.dev/verify/${id || ""}`} />
          <meta name="twitter:title" content={metaTitle} />
          <meta name="twitter:description" content={metaDescription} />
          <meta name="twitter:image" content="https://hashproof.dev/thumbnail.png" />
        </Helmet>
        <SiteHeader plain />
        <main className="verify-main">
          <div className="verify-loader">
            <div className="verify-loader__spinner" />
            <p className="verify-loader__text">{t("verify.verifying")}</p>
            <ul className="verify-steps">
              <li className="verify-step">
                <span className="verify-step__label">{t("verify.step.1")}</span>
                <span className="verify-step__status">
                  <span className={getStepDotClass(steps.contract)} />
                  {getStepText(steps.contract)}
                </span>
              </li>
              <li className="verify-step">
                <span className="verify-step__label">{t("verify.step.2")}</span>
                <span className="verify-step__status">
                  <span className={getStepDotClass(steps.ipfs)} />
                  {getStepText(steps.ipfs)}
                </span>
              </li>
              <li className="verify-step">
                <span className="verify-step__label">{t("verify.step.3")}</span>
                <span className="verify-step__status">
                  <span className={getStepDotClass(steps.db)} />
                  {getStepText(steps.db)}
                </span>
              </li>
            </ul>
            <p className="verify-loader__brand">{t("verify.poweredBy")}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page verify-page">
        <Helmet>
          <title>{metaTitle}</title>
          <meta name="description" content={metaDescription} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={`https://hashproof.dev/verify/${id || ""}`} />
          <meta property="og:title" content={metaTitle} />
          <meta property="og:description" content={metaDescription} />
          <meta property="og:image" content="https://hashproof.dev/thumbnail.png" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:url" content={`https://hashproof.dev/verify/${id || ""}`} />
          <meta name="twitter:title" content={metaTitle} />
          <meta name="twitter:description" content={metaDescription} />
          <meta name="twitter:image" content="https://hashproof.dev/thumbnail.png" />
        </Helmet>
        <SiteHeader plain />
        <main className="verify-main">
          <p className="verify-error">{displayError}</p>
          <Link to="/" className="link-back">
            {t("verify.backHome")}
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const cred = data?.credential ?? {};
  const proof = cred.proof ?? {};
  const subject = cred.credentialSubject ?? {};
  const issuer = cred.issuer ?? {};
  const status = data?.status ?? "unknown";
  const statusSource = data?.status_source ?? "unknown";
  const txHash = proof.txHash ?? data?.tx_hash ?? null;
  const explorerUrl = txHash ? `https://celoscan.io/tx/${txHash}` : null;

  const recipient = subject.holder_name ?? subject.full_name ?? "—";
  const credentialName = cred.name ?? data?.title ?? "—";
  const activity = cred.context?.title ?? data?.context_title ?? "—";
  const issuedBy = issuer.display_name ?? "—";
  const issuedThrough = cred.platform?.display_name ?? data?.platform_name ?? "—";
  const issuedDateRaw = cred.issuanceDate ?? data?.created_at;
  const issuedDate = issuedDateRaw
    ? new Date(issuedDateRaw).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const expirationDateRaw = cred.expirationDate ?? data?.expires_at ?? null;
  const expirationDate = expirationDateRaw
    ? new Date(expirationDateRaw).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })
    : t("verify.label.noExpiration");
  const credentialIdDisplay = id ?? "—";

  return (
    <div className="page verify-page">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://hashproof.dev/verify/${id || ""}`} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content="https://hashproof.dev/thumbnail.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={`https://hashproof.dev/verify/${id || ""}`} />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content="https://hashproof.dev/thumbnail.png" />
      </Helmet>
      <SiteHeader plain />

      <main className="verify-main">
        <div className="verify-pdf-section">
          <div className="verify-pdf-header">
            <h1>{[credentialName, activity].filter((x) => x && x !== "—").join(" · ") || t("verify.credentialTitle")}</h1>
          </div>
          <div ref={wrapperRef} className="verify-pdf-wrapper">
            {pdfBlob ? (
              <PdfViewer pdfBlob={pdfBlob} containerRef={wrapperRef} />
            ) : (
              <p className="verify-pdf-loading">{t("verify.loadingPdf")}</p>
            )}
          </div>
          <div className="verify-pdf-actions">
            <button
              type="button"
              className="btn btn-action"
              onClick={handleDownloadPdf}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t("verify.download")}
            </button>
            <button
              type="button"
              className="btn btn-action btn-action--verify"
              onClick={handleScrollToVerify}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {t("verify.verify")}
            </button>
          </div>
        </div>

        <div ref={verifyCardRef} className="verify-card">
          <h2>{t("verify.detailsTitle")}</h2>
          {status !== "active" && status !== "revoked" && status !== "expired" && (
            <p className="verify-warning verify-warning--error">
              <span className="verify-warning-icon">❌</span>
              <span>{t("verify.warning.notVerified")}</span>
            </p>
          )}
          {status === "expired" && (
            <p className="verify-warning">
              <span className="verify-warning-icon">⚠️</span>
              <span>{t("verify.warning.expired")}</span>
            </p>
          )}
          {status === "revoked" && (
            <p className="verify-warning verify-warning--error">
              <span className="verify-warning-icon">❌</span>
              <span>{t("verify.warning.revoked")}</span>
            </p>
          )}
          {status === "active" && (data?.issuer_status === "suspended" || data?.platform_status === "suspended") && (
            <p className="verify-warning verify-warning--error">
              <span className="verify-warning-icon">🚫</span>
              <span>{t("verify.warning.suspended")}</span>
            </p>
          )}
          {status === "active" && (!data?.issuer_verified || !data?.platform_verified) && data?.issuer_status !== "suspended" && data?.platform_status !== "suspended" && (
            <p className="verify-warning">
              <span className="verify-warning-icon">⚠️</span>
              <span>{t("verify.warning.unverifiedEntities")}</span>
            </p>
          )}
          <dl className="verify-details">
            <div className="verify-detail">
              <dt>{t("verify.label.credential")}</dt>
              <dd>
                <div>{credentialIdDisplay}</div>
                <div className="verify-detail-id">
                  <span className={`verify-status verify-status--${status}`}>
                    {status === "active" ? t("verify.status.verified") : status}
                  </span>
                  <span className="verify-tooltip">
                    <span className="verify-tooltip__icon" aria-hidden>?</span>
                    <span className="verify-tooltip__content">
                      {status === "active" && statusSource === "contract" && t("verify.tooltip.active")}
                      {status === "revoked" && t("verify.tooltip.revoked")}
                      {status === "expired" && t("verify.tooltip.expired")}
                      {status !== "active" && status !== "revoked" && status !== "expired" && t("verify.tooltip.notFound")}
                    </span>
                  </span>
                </div>
              </dd>
            </div>
            <div className="verify-detail">
              <dt>{t("verify.label.issuer")}</dt>
              <dd>
                <div>
                  <span>{issuedBy}</span>
                  {!data?.issuer_verified && data?.issuer_entity_id && data?.issuer_status !== "suspended" && (
                    <span>
                      {" · "}
                      <Link to={`/entities/${data.issuer_entity_id}`} className="verify-explorer-link">
                        {t("verify.link.startVerification")}
                      </Link>
                    </span>
                  )}
                </div>
                <div className="verify-detail-id">
                  <span className={`entity-flag entity-flag--${data?.issuer_verified ? "verified" : data?.issuer_status === "suspended" ? "suspended" : "unverified"}`}>
                    {data?.issuer_verified ? t("verify.status.verified") : data?.issuer_status === "suspended" ? t("verify.status.suspended") : t("verify.status.unverified")}
                  </span>
                  <span className="verify-tooltip">
                    <span className="verify-tooltip__icon" aria-hidden>?</span>
                    <span className="verify-tooltip__content">
                      {data?.issuer_verified && t("verify.tooltip.issuerVerified")}
                      {data?.issuer_status === "suspended" && t("verify.tooltip.issuerSuspended")}
                      {!data?.issuer_verified && data?.issuer_status !== "suspended" && t("verify.tooltip.issuerUnverified")}
                    </span>
                  </span>
                </div>
              </dd>
            </div>
            <div className="verify-detail">
              <dt>{t("verify.label.platform")}</dt>
              <dd>
                <div>
                  <span>{issuedThrough}</span>
                  {!data?.platform_verified && data?.platform_entity_id && data?.platform_status !== "suspended" && (
                    <span>
                      {" · "}
                      <Link to={`/entities/${data.platform_entity_id}`} className="verify-explorer-link">
                        {t("verify.link.startVerification")}
                      </Link>
                    </span>
                  )}
                </div>
                <div className="verify-detail-id">
                  <span className={`entity-flag entity-flag--${data?.platform_verified ? "verified" : data?.platform_status === "suspended" ? "suspended" : "unverified"}`}>
                    {data?.platform_verified ? t("verify.status.verified") : data?.platform_status === "suspended" ? t("verify.status.suspended") : t("verify.status.unverified")}
                  </span>
                  <span className="verify-tooltip">
                    <span className="verify-tooltip__icon" aria-hidden>?</span>
                    <span className="verify-tooltip__content">
                      {data?.platform_verified && t("verify.tooltip.platformVerified")}
                      {data?.platform_status === "suspended" && t("verify.tooltip.platformSuspended")}
                      {!data?.platform_verified && data?.platform_status !== "suspended" && t("verify.tooltip.platformUnverified")}
                    </span>
                  </span>
                </div>
              </dd>
            </div>
            <div className="verify-detail">
              <dt>{t("verify.label.recipient")}</dt>
              <dd>{recipient}</dd>
            </div>
            <div className="verify-detail">
              <dt>{t("verify.label.credential")}</dt>
              <dd>{credentialName}</dd>
            </div>
            <div className="verify-detail">
              <dt>{t("verify.label.activity")}</dt>
              <dd>{activity}</dd>
            </div>
            <div className="verify-detail">
              <dt>{t("verify.label.issuedDate")}</dt>
              <dd>{issuedDate}</dd>
            </div>
            <div className="verify-detail">
              <dt>{t("verify.label.expirationDate")}</dt>
              <dd>{expirationDate}</dd>
            </div>
            <div className="verify-detail">
              <dt>{t("verify.label.blockchainRecord")}</dt>
              <dd>
                {explorerUrl ? (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="verify-explorer-link">
                    {t("verify.label.viewTransaction")}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {data?.ipfs_uri && (
              <div className="verify-detail">
                <dt>{t("verify.label.ipfsBackup")}</dt>
                <dd>
                  <a href={data.ipfs_uri} target="_blank" rel="noopener noreferrer" className="verify-explorer-link">
                    {t("verify.label.viewOnIpfs")}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
