import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import PdfViewer from "../components/PdfViewer.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import { getPreferredLocale, createTranslator } from "../i18n.js";
import { previewMessages } from "../locales/preview.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";

export default function Preview() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const locale = useMemo(() => getPreferredLocale(), []);
  const t = useMemo(() => createTranslator(previewMessages, locale), [locale]);

  const [pdfBlob, setPdfBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wrapperRef = useRef(null);

  // Extract background_url and field values from query params
  const background_url = searchParams.get("background_url") || undefined;
  const fields = useMemo(() => {
    const f = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== "background_url") {
        f[key] = value;
      }
    }
    return f;
  }, [searchParams]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setPdfBlob(null);

    let cancelled = false;

    fetch(`${API_URL}/templates/${slug}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        background_url,
        fields,
        locale,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to generate preview");
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) {
          setPdfBlob(blob);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug, background_url, fields, locale]);

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preview-${slug}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="page verify-page verify-page--loading">
        <Helmet>
          <title>{t("preview.title")} | HashProof</title>
        </Helmet>
        <SiteHeader plain />
        <main className="verify-main">
          <div className="verify-loader">
            <div className="verify-loader__spinner" />
            <p className="verify-loader__text">{t("preview.loading")}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page verify-page">
        <Helmet>
          <title>{t("preview.title")} | HashProof</title>
        </Helmet>
        <SiteHeader plain />
        <main className="verify-main">
          <p className="verify-error">{t("preview.error")}</p>
          <Link to="/" className="link-back">
            {t("preview.backHome")}
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="page verify-page">
      <Helmet>
        <title>{t("preview.title")} | HashProof</title>
      </Helmet>
      <SiteHeader plain />

      <main className="verify-main">
        <div className="preview-banner">
          {t("preview.banner")}
        </div>

        <div className="verify-pdf-section">
          <div className="verify-pdf-header">
            <h1>{t("preview.title")}</h1>
          </div>
          <div ref={wrapperRef} className="verify-pdf-wrapper">
            {pdfBlob ? (
              <PdfViewer pdfBlob={pdfBlob} containerRef={wrapperRef} />
            ) : null}
          </div>
          <div className="verify-pdf-actions">
            <button
              type="button"
              className="btn btn-action"
              onClick={handleDownload}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t("preview.download")}
            </button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
