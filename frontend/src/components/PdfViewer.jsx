import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Draws the first page of a PDF to fit its container.
 *
 * - Sharp on phones: the canvas is drawn at the screen's pixel density (capped
 *   at 3x) and shown at CSS width, instead of drawn at 1x and stretched.
 * - The canvas size is set only here, never through React props: re-applying
 *   width or height to a canvas clears it, which left certificates blank.
 * - One render at a time: a new size cancels the render in flight, since two
 *   renders on one canvas make pdf.js fail.
 */
export default function PdfViewer({ pdfBlob, containerRef: externalContainerRef }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const taskRef = useRef(null);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!pdfBlob) return;
    let cancelled = false;
    let pagePromise = null;
    let timeout;
    let lastKey = "";

    const page = () => {
      if (!pagePromise) {
        pagePromise = pdfBlob
          .arrayBuffer()
          .then((data) => pdfjsLib.getDocument({ data }).promise)
          .then((pdf) => pdf.getPage(1));
      }
      return pagePromise;
    };

    async function draw(cssWidth) {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const key = `${cssWidth}@${dpr}`;
      if (key === lastKey) return;
      lastKey = key;
      try {
        const p = await page();
        if (cancelled) return;
        taskRef.current?.cancel();
        const viewport = p.getViewport({ scale: (cssWidth / p.view[2]) * dpr });
        // Draw off-screen, then swap in: the visible canvas is never blank
        // while a resize re-renders it.
        const off = document.createElement("canvas");
        off.width = Math.floor(viewport.width);
        off.height = Math.floor(viewport.height);
        const task = p.render({ canvasContext: off.getContext("2d"), viewport });
        taskRef.current = task;
        await task.promise;
        if (cancelled || taskRef.current !== task) return;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext("2d").drawImage(off, 0, 0);
        setRendered(true);
        setFailed(false);
      } catch (err) {
        if (err?.name === "RenderingCancelledException") return;
        console.error("[PdfViewer] render error:", err);
        lastKey = "";
        if (!cancelled) setFailed(true);
      }
    }

    const measureEl = externalContainerRef?.current || containerRef.current;
    const update = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const w = measureEl?.clientWidth || measureEl?.parentElement?.clientWidth;
        if (w > 0) draw(w);
      }, 80);
    };
    update();
    const ro = new ResizeObserver(update);
    if (measureEl) ro.observe(measureEl);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      ro.disconnect();
      taskRef.current?.cancel();
    };
  }, [pdfBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pdfBlob) return null;

  return (
    <div ref={containerRef} className="pdf-viewer">
      <canvas
        ref={canvasRef}
        className="pdf-viewer__canvas"
        style={{ width: "100%", height: "auto", display: rendered ? "block" : "none" }}
      />
      {!rendered && <p className="pdf-viewer__loading">{failed ? "—" : "Rendering…"}</p>}
    </div>
  );
}
