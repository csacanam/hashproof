/**
 * Same QR geometry the renderer uses (backend generatePdf / template-previews):
 * a square in the top-right corner, sized from the page width.
 */
export function qrZone(pageWidth) {
  const size = Math.round(Math.min(360, Math.max(96, 360 * (pageWidth / 3508))));
  const margin = Math.round(size * 0.4);
  return { x: pageWidth - size - margin, y: margin, size };
}


/**
 * How much of the QR corner of a background is something other than its plain
 * backdrop — a seal, a logo, a signature painted into the design, which a
 * field check cannot see. Returns the share of pixels (0–1) that differ from
 * the corner's dominant tone. Above ~3% there is something there; below it is
 * JPEG noise and gentle gradients. Same approach as Peewah's generator.
 *
 * @returns {Promise<number|null>} null when the image cannot be read (CORS, load error)
 */
export function qrCornerBusyness(url, pageWidth) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const scale = img.naturalWidth / pageWidth;
        const q = qrZone(pageWidth);
        const sx = q.x * scale;
        const sy = q.y * scale;
        const size = q.size * scale;
        const n = 96; // sample resolution: plenty to see a seal, cheap to scan
        const canvas = document.createElement("canvas");
        canvas.width = n;
        canvas.height = n;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, sx, sy, size, size, 0, 0, n, n);
        const { data } = ctx.getImageData(0, 0, n, n);

        // Dominant tone: the most common colour after coarse quantization.
        const bins = new Map();
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 16) continue; // transparent: whatever is behind it
          const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
          bins.set(k, (bins.get(k) || 0) + 1);
        }
        if (!bins.size) return resolve(0);
        const top = [...bins.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const dr = ((top >> 8) & 15) * 16 + 8;
        const dg = ((top >> 4) & 15) * 16 + 8;
        const db = (top & 15) * 16 + 8;

        let differ = 0;
        let counted = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 16) continue;
          counted++;
          const d = Math.hypot(data[i] - dr, data[i + 1] - dg, data[i + 2] - db);
          if (d > 60) differ++;
        }
        resolve(counted ? differ / counted : 0);
      } catch {
        resolve(null); // a tainted canvas (no CORS) — say nothing rather than guess
      }
    };
    img.src = url;
  });
}
