/**
 * Link-preview image for a credential: the issuer's certificate design with the
 * holder's name on it, at Open Graph proportions.
 *
 * Without this, every attendee of the same event shares an identical picture —
 * the certificate template — so nothing in the preview says whose it is. The
 * name is what makes a connection stop scrolling.
 *
 * Renders only the name. Every other template field is issuer-defined and
 * unbounded (in production one has held a national ID number); a social preview
 * is the last place any of that should surface.
 */

import { ImageResponse } from "@vercel/og";

const API_URL = process.env.HASHPROOF_API_URL || "https://api.hashproof.dev";
const SITE_URL = process.env.HASHPROOF_SITE_URL || "https://www.hashproof.dev";

export const config = { runtime: "edge" };

const WIDTH = 1200;
const HEIGHT = 630;
const BACKDROP = "#0a0a0b";

/** satori reads `type`/`props`, so plain objects work and React is not needed. */
const h = (type, props, ...children) => ({
  type,
  props: { ...props, children: children.length > 1 ? children : children[0] },
  key: null,
});

function backdropOnly(message) {
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
          fontSize: 44,
          fontWeight: 700,
        },
      },
      message
    ),
    { width: WIDTH, height: HEIGHT }
  );
}

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get("id") || "";

  let meta = null;
  try {
    const res = await fetch(`${API_URL}/verify/${encodeURIComponent(id)}/meta`);
    if (res.ok) meta = await res.json();
  } catch {
    meta = null;
  }

  if (!meta?.image_url) {
    try {
      return backdropOnly("HashProof");
    } catch {
      return Response.redirect(`${SITE_URL}/thumbnail.png`, 302);
    }
  }

  try {
    // Fetch the background here rather than letting satori resolve <img src>.
    // ImageResponse renders asynchronously, so a fetch it performs happens after
    // this function has already returned — outside any try/catch, surfacing as a
    // 500. Crawlers cache those and stop asking.
    const background = await fetchAsDataUri(meta.image_url);
    if (!background) return Response.redirect(meta.image_url, 302);

    return renderCertificate(meta, background);
  } catch {
    return Response.redirect(meta.image_url, 302);
  }
}

async function fetchAsDataUri(url) {
  const res = await fetch(url);
  if (!res.ok) return null;

  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

  const type = res.headers.get("content-type") || "image/png";
  return `data:${type};base64,${btoa(binary)}`;
}

function renderCertificate(meta, background) {
  // Fit the whole certificate rather than cropping it: the issuer's branding,
  // signatures and event name are baked into that image, and cropping would cut
  // out whichever one happens to sit near the edge.
  const pageW = meta.page_width || 1056;
  const pageH = meta.page_height || 816;
  const scale = Math.min(WIDTH / pageW, HEIGHT / pageH);
  const drawW = pageW * scale;
  const drawH = pageH * scale;
  const offsetX = (WIDTH - drawW) / 2;
  const offsetY = (HEIGHT - drawH) / 2;

  const layers = [
    h("img", {
      src: background,
      width: drawW,
      height: drawH,
      style: { position: "absolute", left: offsetX, top: offsetY },
    }),
  ];

  const field = meta.name_field;
  if (meta.holder_name && field) {
    const boxWidth = (field.width ?? pageW) * scale;
    layers.push(
      h(
        "div",
        {
          style: {
            position: "absolute",
            left: offsetX + field.x * scale,
            top: offsetY + field.y * scale,
            width: boxWidth,
            display: "flex",
            justifyContent:
              field.align === "center" ? "center" : field.align === "right" ? "flex-end" : "flex-start",
            fontSize: Math.max(field.font_size * scale, 18),
            fontWeight: field.bold ? 700 : 400,
            color: field.font_color,
          },
        },
        meta.holder_name
      )
    );
  }

  return new ImageResponse(
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: BACKDROP,
        },
      },
      ...layers
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: { "cache-control": "public, max-age=300, s-maxage=86400" },
    }
  );
}
