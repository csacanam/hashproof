/**
 * Link-preview image for a credential: the issuer's certificate design with the
 * holder's name on it.
 *
 * Without this, every attendee of the same event shares an identical picture —
 * the blank template — so nothing in the preview says whose it is. The name is
 * what makes a connection stop scrolling.
 *
 * Renders only the name. Every other template field is issuer-defined and
 * unbounded (in production one has held a national ID number); a social preview
 * is the last place any of that should surface.
 *
 * Matches the PDF on purpose. The output keeps the certificate's own aspect
 * ratio rather than being letterboxed into 1.91:1 — black bars down both sides
 * are what a viewer notices first — and the name is drawn in Arimo, which is
 * metric-compatible with the Helvetica the PDF uses, so it breaks lines in the
 * same places at the same width.
 */

import { ImageResponse } from "@vercel/og";

const API_URL = process.env.HASHPROOF_API_URL || "https://api.hashproof.dev";
const SITE_URL = process.env.HASHPROOF_SITE_URL || "https://www.hashproof.dev";

/** Longest side of the output. Enough for a retina card without being wasteful. */
const MAX_EDGE = 1200;
const BACKDROP = "#0a0a0b";

/** satori reads `type`/`props`, so plain objects work and React is not needed. */
const h = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length > 1 ? children : children[0] },
  key: null,
});

let fontsPromise = null;
function loadFonts() {
  // Bundled rather than fetched at render time: @vercel/og otherwise pulls its
  // default family over the network on every invocation, and that default is
  // not the font the PDF uses.
  fontsPromise ??= Promise.all([
    fetch(new URL("./assets/arimo-regular.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./assets/arimo-bold.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
  ]).then(([regular, bold]) => [
    { name: "Arimo", data: regular, weight: 400, style: "normal" },
    { name: "Arimo", data: bold, weight: 700, style: "normal" },
  ]);
  return fontsPromise;
}

async function fetchAsDataUri(url) {
  const res = await fetch(url);
  if (!res.ok) return null;

  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

  return `data:${res.headers.get("content-type") || "image/png"};base64,${btoa(binary)}`;
}

export const config = { runtime: "edge" };

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get("id") || "";

  let meta = null;
  try {
    const res = await fetch(`${API_URL}/verify/${encodeURIComponent(id)}/meta`);
    if (res.ok) meta = await res.json();
  } catch {
    meta = null;
  }

  try {
    const fonts = await loadFonts();

    if (!meta?.image_url) {
      return new ImageResponse(
        h(
          "div",
          {
            style: {
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: BACKDROP,
              color: "#ffffff",
              fontFamily: "Arimo",
              fontSize: 44,
              fontWeight: 700,
            },
          },
          "HashProof"
        ),
        { width: 1200, height: 630, fonts }
      );
    }

    // Fetch the background here rather than letting satori resolve <img src>.
    // ImageResponse renders asynchronously, so a fetch it performs happens after
    // this function has returned — outside any try/catch, surfacing as a 500.
    // Crawlers cache those and stop asking.
    const background = await fetchAsDataUri(meta.image_url);
    if (!background) return Response.redirect(meta.image_url, 302);

    return renderCertificate(meta, background, fonts);
  } catch {
    // Fall back to the plain template rather than a broken preview.
    return meta?.image_url ? Response.redirect(meta.image_url, 302) : Response.redirect(`${SITE_URL}/thumbnail.png`, 302);
  }
}

function renderCertificate(meta, background, fonts) {
  const pageW = meta.page_width || 1056;
  const pageH = meta.page_height || 816;

  // The certificate's own proportions, so nothing is cropped and no bars are
  // baked in. Each platform then frames it however it likes.
  const scale = MAX_EDGE / Math.max(pageW, pageH);
  const width = Math.round(pageW * scale);
  const height = Math.round(pageH * scale);

  const layers = [
    h("img", { src: background, width, height, style: { position: "absolute", left: 0, top: 0 } }),
  ];

  const field = meta.name_field;
  if (meta.holder_name && field) {
    const align = field.align === "center" ? "center" : field.align === "right" ? "right" : "left";
    layers.push(
      h(
        "div",
        {
          style: {
            position: "absolute",
            left: field.x * scale,
            top: field.y * scale,
            width: (field.width ?? pageW) * scale,
            display: "flex",
            justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
            textAlign: align,
            fontFamily: "Arimo",
            fontSize: field.font_size * scale,
            fontWeight: field.bold ? 700 : 400,
            color: field.font_color,
            // pdfkit adds no line gap, so keep the same tight leading.
            lineHeight: 1.15,
          },
        },
        meta.holder_name
      )
    );
  }

  return new ImageResponse(
    h("div", { style: { width: "100%", height: "100%", display: "flex", position: "relative" } }, ...layers),
    {
      width,
      height,
      fonts,
      headers: { "cache-control": "public, max-age=300, s-maxage=86400" },
    }
  );
}
