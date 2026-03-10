import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import PdfViewer from "../components/PdfViewer.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";

export default function Verify() {
  const { id } = useParams();
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
    if (state === "running") return "Checking…";
    if (state === "success") return "Done";
    if (state === "error") return "Error";
    return "Waiting…";
  };

  const getStepDotClass = (state) => {
    if (state === "running") return "verify-step__dot verify-step__dot--active";
    if (state === "success") return "verify-step__dot verify-step__dot--done";
    if (state === "error") return "verify-step__dot verify-step__dot--error";
    return "verify-step__dot";
  };

  if (loading) {
    return (
      <div className="page verify-page verify-page--loading">
        <SiteHeader plain />
        <main className="verify-main">
          <div className="verify-loader">
            <div className="verify-loader__spinner" />
            <p className="verify-loader__text">Verifying credential…</p>
            <ul className="verify-steps">
              <li className="verify-step">
                <span className="verify-step__label">1. Checking blockchain record</span>
                <span className="verify-step__status">
                  <span className={getStepDotClass(steps.contract)} />
                  {getStepText(steps.contract)}
                </span>
              </li>
              <li className="verify-step">
                <span className="verify-step__label">2. Retrieving credential data</span>
                <span className="verify-step__status">
                  <span className={getStepDotClass(steps.ipfs)} />
                  {getStepText(steps.ipfs)}
                </span>
              </li>
              <li className="verify-step">
                <span className="verify-step__label">3. Verifying data integrity</span>
                <span className="verify-step__status">
                  <span className={getStepDotClass(steps.db)} />
                  {getStepText(steps.db)}
                </span>
              </li>
            </ul>
            <p className="verify-loader__brand">Powered by HashProof</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page verify-page">
        <SiteHeader plain />
        <main className="verify-main">
          <p className="verify-error">{error}</p>
          <Link to="/" className="link-back">
            ← Back to home
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
    ? new Date(issuedDateRaw).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const expirationDateRaw = cred.expirationDate ?? data?.expires_at ?? null;
  const expirationDate = expirationDateRaw
    ? new Date(expirationDateRaw).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "No expiration";
  const credentialIdDisplay = id ?? "—";

  return (
    <div className="page verify-page">
      <SiteHeader plain />

      <main className="verify-main">
        <div className="verify-pdf-section">
          <div className="verify-pdf-header">
            <h1>{[credentialName, activity].filter((x) => x && x !== "—").join(" · ") || "Credential"}</h1>
          </div>
          <div ref={wrapperRef} className="verify-pdf-wrapper">
            {pdfBlob ? (
              <PdfViewer pdfBlob={pdfBlob} containerRef={wrapperRef} />
            ) : (
              <p className="verify-pdf-loading">Loading PDF…</p>
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
              Download
            </button>
            <button
              type="button"
              className="btn btn-action btn-action--verify"
              onClick={handleScrollToVerify}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Verify
            </button>
          </div>
        </div>

        <div ref={verifyCardRef} className="verify-card">
          <h2>Verification details</h2>
          {status !== "active" && status !== "revoked" && status !== "expired" && (
            <p className="verify-warning verify-warning--error">
              <span className="verify-warning-icon">❌</span>
              <span>
                This credential could not be verified.
              </span>
            </p>
          )}
          {status === "expired" && (
            <p className="verify-warning">
              <span className="verify-warning-icon">⚠️</span>
              <span>
                This credential has expired.
              </span>
            </p>
          )}
          {status === "revoked" && (
            <p className="verify-warning verify-warning--error">
              <span className="verify-warning-icon">❌</span>
              <span>
                This credential has been revoked by the issuer.
              </span>
            </p>
          )}
          {status === "active" && (data?.issuer_status === "suspended" || data?.platform_status === "suspended") && (
            <p className="verify-warning verify-warning--error">
              <span className="verify-warning-icon">🚫</span>
              <span>
                One or more entities involved in issuing this credential have been suspended by HashProof. Exercise caution.
              </span>
            </p>
          )}
          {status === "active" && (!data?.issuer_verified || !data?.platform_verified) && data?.issuer_status !== "suspended" && data?.platform_status !== "suspended" && (
            <p className="verify-warning">
              <span className="verify-warning-icon">⚠️</span>
              <span>
                This credential is authentic, but some entities involved in issuing it have not been verified.
              </span>
            </p>
          )}
          <dl className="verify-details">
            <div className="verify-detail">
              <dt>Credential</dt>
              <dd>
                <div>{credentialIdDisplay}</div>
                <div className="verify-detail-id">
                  <span className={`verify-status verify-status--${status}`}>
                    {status === "active" ? "Verified" : status}
                  </span>
                  <span className="verify-tooltip">
                    <span className="verify-tooltip__icon" aria-hidden>
                      ?
                    </span>
                    <span className="verify-tooltip__content">
                      {status === "active" && statusSource === "contract" && (
                        <>
                          This credential is valid on the blockchain. The record exists and has not been revoked or expired.
                        </>
                      )}
                      {status === "revoked" && (
                        <>
                          This credential was revoked by the issuer on the blockchain.
                        </>
                      )}
                      {status === "expired" && (
                        <>
                          This credential has expired based on its validity period.
                        </>
                      )}
                      {status !== "active" && status !== "revoked" && status !== "expired" && (
                        <>
                          This credential could not be fully verified. The blockchain record may be missing or temporarily unavailable.
                        </>
                      )}
                    </span>
                  </span>
                </div>
              </dd>
            </div>
            <div className="verify-detail">
              <dt>Issuer</dt>
              <dd>
                <div>
                  <span>{issuedBy}</span>
                  {!data?.issuer_verified && data?.issuer_entity_id && data?.issuer_status !== "suspended" && (
                    <span>
                      {" · "}
                      <Link to={`/entities/${data.issuer_entity_id}`} className="verify-explorer-link">
                        Start verification
                      </Link>
                    </span>
                  )}
                </div>
                <div className="verify-detail-id">
                  <span className={`entity-flag entity-flag--${data?.issuer_verified ? "verified" : data?.issuer_status === "suspended" ? "suspended" : "unverified"}`}>
                    {data?.issuer_verified ? "Verified" : data?.issuer_status === "suspended" ? "Suspended" : "Unverified"}
                  </span>
                  <span className="verify-tooltip">
                    <span className="verify-tooltip__icon" aria-hidden>
                      ?
                    </span>
                    <span className="verify-tooltip__content">
                      {data?.issuer_verified ? (
                        <>
                          This issuer has been verified by HashProof as the issuer of this credential.
                        </>
                      ) : data?.issuer_status === "suspended" ? (
                        <>
                          This issuer has been suspended by HashProof. Exercise caution with credentials issued by this entity.
                        </>
                      ) : (
                        <>
                          The issuer has not been verified by HashProof. The credential may still be valid if the
                          blockchain record matches.
                        </>
                      )}
                    </span>
                  </span>
                </div>
              </dd>
            </div>
            <div className="verify-detail">
              <dt>Platform</dt>
              <dd>
                <div>
                  <span>{issuedThrough}</span>
                  {!data?.platform_verified && data?.platform_entity_id && data?.platform_status !== "suspended" && (
                    <span>
                      {" · "}
                      <Link to={`/entities/${data.platform_entity_id}`} className="verify-explorer-link">
                        Start verification
                      </Link>
                    </span>
                  )}
                </div>
                <div className="verify-detail-id">
                  <span className={`entity-flag entity-flag--${data?.platform_verified ? "verified" : data?.platform_status === "suspended" ? "suspended" : "unverified"}`}>
                    {data?.platform_verified ? "Verified" : data?.platform_status === "suspended" ? "Suspended" : "Unverified"}
                  </span>
                  <span className="verify-tooltip">
                    <span className="verify-tooltip__icon" aria-hidden>
                      ?
                    </span>
                    <span className="verify-tooltip__content">
                      {data?.platform_verified ? (
                        <>
                          This platform has been verified by HashProof as a trusted credential issuer or intermediary.
                        </>
                      ) : data?.platform_status === "suspended" ? (
                        <>
                          This platform has been suspended by HashProof. Exercise caution with credentials issued through this platform.
                        </>
                      ) : (
                        <>
                          This platform has not been verified by HashProof. Credentials issued through it should be
                          reviewed carefully.
                        </>
                      )}
                    </span>
                  </span>
                </div>
              </dd>
            </div>
            <div className="verify-detail">
              <dt>Recipient</dt>
              <dd>{recipient}</dd>
            </div>
            <div className="verify-detail">
              <dt>Credential</dt>
              <dd>{credentialName}</dd>
            </div>
            <div className="verify-detail">
              <dt>Activity</dt>
              <dd>{activity}</dd>
            </div>
            <div className="verify-detail">
              <dt>Issued date</dt>
              <dd>{issuedDate}</dd>
            </div>
            <div className="verify-detail">
              <dt>Expiration date</dt>
              <dd>{expirationDate}</dd>
            </div>
            <div className="verify-detail">
              <dt>Blockchain Record</dt>
              <dd>
                {explorerUrl ? (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="verify-explorer-link">
                    View transaction
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {data?.ipfs_uri && (
              <div className="verify-detail">
                <dt>IPFS Backup</dt>
                <dd>
                  <a href={data.ipfs_uri} target="_blank" rel="noopener noreferrer" className="verify-explorer-link">
                    View on IPFS
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
