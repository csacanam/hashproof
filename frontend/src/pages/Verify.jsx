import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import PdfViewer from "../components/PdfViewer.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";

export default function Verify() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wrapperRef = useRef(null);
  const verifyCardRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setPdfBlob(null);
    fetch(`${API_URL}/verify/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Credential not found" : "Failed to fetch");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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

  if (loading) {
    return (
      <div className="page verify-page verify-page--loading">
        <main className="verify-main">
          <div className="verify-loader">
            <div className="verify-loader__spinner" />
            <p className="verify-loader__text">Verifying credential…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page verify-page">
        <header className="header header--verify">
          <Link to="/" className="logo">
            HashProof
          </Link>
          <p className="header-subtitle">Credential Verification Service</p>
        </header>
        <main className="verify-main">
          <p className="verify-error">{error}</p>
          <Link to="/" className="link-back">
            ← Back to home
          </Link>
        </main>
      </div>
    );
  }

  const cred = data?.credential ?? {};
  const proof = cred.proof ?? {};
  const subject = cred.credentialSubject ?? {};
  const issuer = cred.issuer ?? {};
  const status = data?.status ?? "unknown";
  const txHash = proof.txHash ?? null;
  const explorerUrl = txHash ? `https://celoscan.io/tx/${txHash}` : null;

  const recipient = subject.holder_name ?? subject.full_name ?? "—";
  const credentialName = cred.name ?? data?.title ?? "—";
  const activity = cred.context?.title ?? data?.context_title ?? "—";
  const issuedBy = issuer.display_name ?? "—";
  const issuedThrough = cred.platform?.display_name ?? data?.platform_name ?? "—";
  const issuedDateRaw = cred.issuanceDate ?? data?.issued_at;
  const issuedDate = issuedDateRaw
    ? new Date(issuedDateRaw).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const credentialIdDisplay = id ?? "—";

  return (
    <div className="page verify-page">
      <header className="header header--verify">
        <Link to="/" className="logo">
          HashProof
        </Link>
        <p className="header-subtitle">Credential Verification Service</p>
      </header>

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
          <p className="verify-card-description">
            The details below confirm the information recorded for this credential.
          </p>
          <dl className="verify-details">
            <div className="verify-detail">
              <dt>Status</dt>
              <dd>
                <span className={`verify-status verify-status--${status}`}>
                  {status === "active" ? "Verified ✓" : status}
                </span>
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
              <dt>Issued by</dt>
              <dd>{issuedBy}</dd>
            </div>
            <div className="verify-detail">
              <dt>Issued through</dt>
              <dd>{issuedThrough}</dd>
            </div>
            <div className="verify-detail">
              <dt>Issued date</dt>
              <dd>{issuedDate}</dd>
            </div>
            <div className="verify-detail">
              <dt>Credential ID</dt>
              <dd>{credentialIdDisplay}</dd>
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
          </dl>
        </div>
      </main>
    </div>
  );
}
