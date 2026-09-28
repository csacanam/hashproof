/**
 * Same QR geometry the renderer uses (backend generatePdf / template-previews):
 * a square in the top-right corner, sized from the page width.
 */
export function qrZone(pageWidth) {
  const size = Math.round(Math.min(360, Math.max(96, 360 * (pageWidth / 3508))));
  const margin = Math.round(size * 0.4);
  return { x: pageWidth - size - margin, y: margin, size };
}

