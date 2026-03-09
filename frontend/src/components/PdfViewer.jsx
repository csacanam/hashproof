import { useEffect, useState, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function PdfViewer({ pdfBlob, containerRef: externalContainerRef }) {
  const containerRef = useRef(null);
  const observeRef = externalContainerRef || containerRef;
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [rendered, setRendered] = useState(false);

  const renderPdf = async (w) => {
    if (!pdfBlob || !w) return;
    const canvas = containerRef.current?.querySelector("canvas");
    if (!canvas) return;
    try {
      const data = await pdfBlob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: w / page.view[2] });
      setDimensions({ width: viewport.width, height: viewport.height });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
      }).promise;
      setRendered(true);
    } catch (err) {
      console.error("[PdfViewer] render error:", err);
      setRendered(false);
    }
  };

  useEffect(() => {
    if (!pdfBlob) return;
    const el = observeRef.current;
    const fallbackEl = containerRef.current;
    if (!el && !fallbackEl) return;
    const measureEl = el || fallbackEl;
    let timeout;
    const update = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const w = measureEl.offsetWidth || measureEl.parentElement?.offsetWidth;
        if (w > 0) renderPdf(w);
      }, 100);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(measureEl);
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(timeout);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [pdfBlob]);

  if (!pdfBlob) return null;

  return (
    <div ref={containerRef} className="pdf-viewer">
      <canvas
        className="pdf-viewer__canvas"
        width={dimensions.width}
        height={dimensions.height}
        style={{
          width: "100%",
          height: "auto",
          display: dimensions.width ? "block" : "none",
        }}
      />
      {!rendered && pdfBlob && (
        <p className="pdf-viewer__loading">Rendering…</p>
      )}
    </div>
  );
}
