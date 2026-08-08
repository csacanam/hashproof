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
  const [copied, setCopied] = useState(false);
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

  // Four states, not three. Collapsing "reviewed but the domain is still
  // unproven" into plain "unverified" reads as "we have no idea who this is",
  // which understates an issuer we did review — as misleading as the badge it
  // replaced, just in the other direction.
  const entityState = (kind) => {
    if (data?.[`${kind}_status`] === "suspended") return "suspended";
    if (data?.[`${kind}_verified`]) return "verified";
    return data?.[`${kind}_verification_level`] === "reviewed" ? "reviewed" : "unverified";
  };
  const issuerState = entityState("issuer");
  const platformState = entityState("platform");

  // Sharing. For an event credential the recipient is the distribution channel,
  // so this matters as much as the certificate itself. `verification_url` comes
  // from the API so the shared link is always the canonical one.
  const shareUrl =
    data?.verification_url ?? (typeof window !== "undefined" ? window.location.href : "");
  const shareText = [t("verify.share.text"), credentialName !== "—" ? credentialName : null]
    .filter(Boolean)
    .join(" ");

  // LinkedIn's "add to profile" deep link lands the credential in Licenses &
  // Certifications. No OAuth app needed.
  const linkedInAddUrl = (() => {
    const params = new URLSearchParams({
      startTask: "CERTIFICATION_NAME",
      name: credentialName !== "—" ? credentialName : "Credential",
      organizationName: issuedBy !== "—" ? issuedBy : "HashProof",
      certUrl: shareUrl,
    });
    if (id) params.set("certId", id);
    if (issuedDateRaw) {
      const d = new Date(issuedDateRaw);
      if (!Number.isNaN(d.getTime())) {
        params.set("issueYear", String(d.getFullYear()));
        params.set("issueMonth", String(d.getMonth() + 1));
      }
    }
    return `https://www.linkedin.com/profile/add?${params.toString()}`;
  })();

  const shareTargets = [
    {
      key: "whatsapp",
      label: t("verify.share.on.whatsapp"),
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
    },
    {
      key: "telegram",
      label: t("verify.share.on.telegram"),
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      path: "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
    },
    {
      key: "x",
      label: t("verify.share.on.x"),
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
    },
    {
      key: "facebook",
      label: t("verify.share.on.facebook"),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    },
  ];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied (insecure context, permissions). Nothing to recover.
    }
  };

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

          <div className="verify-share">
            <span className="verify-share-title">{t("verify.share.title")}</span>
            <div className="verify-share-actions">
              <a
                className="btn btn-action btn-action--linkedin"
                href={linkedInAddUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
                </svg>
                {t("verify.share.linkedin")}
              </a>

              {shareTargets.map((target) => (
                <a
                  key={target.key}
                  className="verify-share-icon"
                  href={target.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={target.label}
                  title={target.label}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={target.path} />
                  </svg>
                </a>
              ))}

              <button
                type="button"
                className="verify-share-icon"
                onClick={handleCopyLink}
                aria-label={copied ? t("verify.share.copied") : t("verify.share.copy")}
                title={copied ? t("verify.share.copied") : t("verify.share.copy")}
              >
                {copied ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
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
          {status === "active" && (issuerState === "reviewed" || platformState === "reviewed") && issuerState !== "unverified" && platformState !== "unverified" && (
            <div className="verify-warning verify-warning--soft">
              <span>{t("verify.warning.domainPending")}</span>
            </div>
          )}

          {status === "active" && (issuerState === "unverified" || platformState === "unverified") && (
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
                  {data?.issuer_entity_id ? (
                    <Link to={`/entities/${data.issuer_entity_id}`} className="verify-entity-link">
                      {issuedBy}
                    </Link>
                  ) : (
                    <span>{issuedBy}</span>
                  )}
                  {issuerState !== "verified" && issuerState !== "suspended" && data?.issuer_entity_id && (
                    <span>
                      {" · "}
                      <Link to={`/entities/${data.issuer_entity_id}`} className="verify-explorer-link">
                        {t(issuerState === "reviewed" ? "verify.link.completeVerification" : "verify.link.startVerification")}
                      </Link>
                    </span>
                  )}
                </div>
                {(data?.issuer_proofs ?? []).length > 0 && (
                  <div className="verify-issuer-proofs">
                    {data.issuer_proofs.map((p) => (
                      <span key={p.resource} className="verify-issuer-proof" title={p.expected_record}>
                        <span className="proofs-check" aria-hidden>✓</span>
                        {p.resource}
                      </span>
                    ))}
                  </div>
                )}
                <div className="verify-detail-id">
                  <span className={`entity-flag entity-flag--${issuerState}`}>
                    {t(`verify.status.${issuerState}`)}
                  </span>
                  <span className="verify-tooltip">
                    <span className="verify-tooltip__icon" aria-hidden>?</span>
                    <span className="verify-tooltip__content">
                      {issuerState === "verified" && t("verify.tooltip.issuerVerified")}
                      {issuerState === "suspended" && t("verify.tooltip.issuerSuspended")}
                      {issuerState === "reviewed" && t("verify.tooltip.issuerReviewed")}
                      {issuerState === "unverified" && t("verify.tooltip.issuerUnverified")}
                    </span>
                  </span>
                </div>
              </dd>
            </div>
            <div className="verify-detail">
              <dt>{t("verify.label.platform")}</dt>
              <dd>
                <div>
                  {data?.platform_entity_id ? (
                    <Link to={`/entities/${data.platform_entity_id}`} className="verify-entity-link">
                      {issuedThrough}
                    </Link>
                  ) : (
                    <span>{issuedThrough}</span>
                  )}
                  {platformState !== "verified" && platformState !== "suspended" && data?.platform_entity_id && (
                    <span>
                      {" · "}
                      <Link to={`/entities/${data.platform_entity_id}`} className="verify-explorer-link">
                        {t(platformState === "reviewed" ? "verify.link.completeVerification" : "verify.link.startVerification")}
                      </Link>
                    </span>
                  )}
                </div>
                <div className="verify-detail-id">
                  <span className={`entity-flag entity-flag--${platformState}`}>
                    {t(`verify.status.${platformState}`)}
                  </span>
                  <span className="verify-tooltip">
                    <span className="verify-tooltip__icon" aria-hidden>?</span>
                    <span className="verify-tooltip__content">
                      {platformState === "verified" && t("verify.tooltip.platformVerified")}
                      {platformState === "suspended" && t("verify.tooltip.platformSuspended")}
                      {platformState === "reviewed" && t("verify.tooltip.platformReviewed")}
                      {platformState === "unverified" && t("verify.tooltip.platformUnverified")}
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
