/**
 * Per-credential Open Graph tags for /verify/:id.
 *
 * Only social crawlers reach this function — vercel.json routes here on a
 * user-agent match, so humans always get the untouched SPA. That keeps the
 * blast radius at zero: if this breaks, no real user notices.
 *
 * Crawlers do not run JavaScript, so the <Helmet> tags Verify.jsx renders never
 * reach them; without this they read the static shell and every shared
 * certificate collapses into the same social object (same title, same image,
 * and og:url pointing at the homepage).
 */

const API_URL = process.env.HASHPROOF_API_URL || "https://api.hashproof.dev";
const SITE_URL = process.env.HASHPROOF_SITE_URL || "https://www.hashproof.dev";
const FALLBACK_IMAGE = `${SITE_URL}/thumbnail.png`;

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function page({ url, title, description, image }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="HashProof" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${esc(url)}" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<link rel="canonical" href="${esc(url)}" />
</head>
<body><a href="${esc(url)}">${esc(title)}</a></body>
</html>`;
}

export default async function handler(req, res) {
  const id = typeof req.query?.id === "string" ? req.query.id : "";
  const url = `${SITE_URL}/verify/${encodeURIComponent(id)}`;

  // Any failure falls back to generic tags. A crawler must never get a 5xx:
  // some providers cache the failure and stop retrying the URL.
  let meta = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const upstream = await fetch(`${API_URL}/verify/${encodeURIComponent(id)}/meta`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (upstream.ok) meta = await upstream.json();
  } catch {
    meta = null;
  }

  if (!meta) {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=60");
    return res.status(200).send(
      page({
        url,
        title: "Verify credential | HashProof",
        description: "This credential is publicly verifiable through HashProof.",
        image: FALLBACK_IMAGE,
      })
    );
  }

  const holder = meta.holder_name;
  const activity = meta.context_title || meta.credential_name;

  const title = [holder, activity].filter(Boolean).join(" · ") || "Verified credential";
  const description = meta.issuer_name
    ? `Issued by ${meta.issuer_name}. Publicly verifiable on HashProof.`
    : "Publicly verifiable on HashProof.";

  res.setHeader("content-type", "text/html; charset=utf-8");
  // Cached per credential — the shell's CDN caching must not apply here.
  res.setHeader("cache-control", "public, max-age=300, s-maxage=3600");
  return res.status(200).send(
    page({
      url,
      title: `${title} | HashProof`,
      description,
      // The certificate rendered with the holder's name, which is what makes
      // each share look like its own rather than one picture repeated across
      // every attendee of an event. It renders only the name field: the rest
      // are issuer-defined and a preview is the last place they should surface.
      //
      // Falls back to the plain template when that route cannot answer, and to
      // the logo when there is no template image at all.
      image: meta.image_url
        ? `${SITE_URL}/verify/${encodeURIComponent(id)}/image`
        : FALLBACK_IMAGE,
    })
  );
}
