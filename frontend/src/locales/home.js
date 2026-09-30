/**
 * Translations for the landing page.
 *
 * The page used to open with "issue credentials with one API call" — the how,
 * aimed at developers and agents. Five months in, none had arrived: of six
 * issuers, one accounts for 97% of every credential, and it is a platform that
 * certifies events. Now that the dashboard issues without code or a wallet, the
 * page speaks to whoever runs the event or the course: what they get, how it
 * works, what it costs. The API is the last section.
 */

export const homeMessages = {
  en: {
    "home.meta.title": "Digital certificates for events and courses from $0.10 | HashProof",
    "home.meta.description":
      "Send verifiable digital certificates for your events, courses and training from $0.10 each. Upload a spreadsheet and every person gets theirs by email. No minimums, no annual fee.",

    // Hero
    "home.hero.title": "Digital certificates for your events and courses, from $0.10 each",
    "home.hero.lead":
      "Upload your list and every person gets their certificate by email, ready to share on LinkedIn and verifiable by anyone in one click. No minimums, no annual fee, no setup cost.",
    "home.hero.cta.start": "Start issuing",
    "home.hero.cta.credential": "Or see a real certificate →",
    "home.hero.since": "Since March 10, 2026",
    "home.hero.stat.credentials": "Certificates issued",
    "home.hero.stat.entities": "Verified issuers",
    "home.hero.onchain": "See the public record ↗",

    // How it works
    "home.how.title": "How it works",
    "home.how.account.title": "Create your account",
    "home.how.account.body":
      "Sign in with your email — no password and no card. Invite your team when you need to.",
    "home.how.design.title": "Choose a design",
    "home.how.design.body":
      "Use ours, or upload your own background and place the name, the event and the date where you want them.",
    "home.how.send.title": "Upload your list",
    "home.how.send.body":
      "A spreadsheet with names and emails, or one person at a time. Each one gets an email with their certificate, and you can see who received it.",

    // What the recipient gets
    "home.value.title": "What each person receives",
    "home.value.share.title": "A certificate worth sharing",
    "home.value.share.body":
      "Their name and the event in the link preview, with the certificate itself as the image. One click to add it to LinkedIn, or share it on WhatsApp, Telegram, X and Facebook.",
    "home.value.verify.title": "Verifiable by anyone",
    "home.value.verify.body":
      "A public page showing who issued it, to whom and when. No account, no app, nothing to install.",
    "home.value.issuer.title": "An issuer that proved who it is",
    "home.value.issuer.body":
      "We review the organization, and it proves control of its domain with a DNS record that anyone can resolve. Both are required before it shows as verified.",
    "home.value.durable.title": "It outlives us",
    "home.value.durable.body":
      "Each certificate is recorded on a public blockchain and its design on IPFS, so it can be verified and rebuilt even if HashProof disappears.",

    // Pricing
    "home.pricing.title": "Pay only for what you issue",
    "home.pricing.plan.price": "$0.25",
    "home.pricing.plan.unit": " per certificate",
    "home.pricing.plan.crypto": "$0.225 if you pay in crypto. Buy credits from $2.25.",
    "home.pricing.plan.noMinimum": "No minimum volume and no commitment",
    "home.pricing.plan.noFee": "No annual fee, no setup cost",
    "home.pricing.plan.included": "Your own designs, spreadsheet uploads, email delivery, revocation and your team, all included",
    "home.pricing.compareTitle": "Next to everyone else",
    "home.pricing.lead":
      "Taken from each vendor\u2019s own pricing page, August 2026. What separates them is the model, not the unit price: we charge for certificates you issue, not for a tier to fill or for counting people.",
    "home.pricing.col.platform": "Platform",
    "home.pricing.col.each": "Model",
    "home.pricing.v2000": "2,000 a year",
    "home.pricing.v10000": "10,000 a year",
    "home.pricing.v20000": "20,000 a year",
    "home.pricing.perCredential": "Per credential issued",
    "home.pricing.perTier": "Yearly tier you must fill",
    "home.pricing.perRecipient": "Per unique recipient",
    "home.pricing.quoted": "Quote only",
    "home.pricing.notPublished": "Not published",
    "home.pricing.api": "HashProof · API",
    "home.pricing.dashboard": "HashProof · Dashboard",
    "home.pricing.note":
      "In the dashboard, credits cost $0.25 by card or $0.225 in crypto. Developers who issue through the API pay $0.10 per credential. Where a yearly plan comes out cheaper, it is because you prepay a volume: at exactly 10,000 Certifier beats both of our prices, and above about 12,000 a year POK's $3,000 plan beats the dashboard. We never ask for a commitment — you pay for what you issued.",
    "home.pricing.compare": "Compare in detail:",


    // Developers
    "home.dev.title": "For developers and AI agents",
    "home.dev.lead":
      "Everything the dashboard does is also an API. Pay $0.10 per credential in USDC over x402 — no key and no subscription — or create a key in the dashboard and spend your organization's credits. There is an MCP server too, so an agent can issue on its own.",
    "home.dev.docs": "Read the docs →",
  },

  es: {
    "home.meta.title": "Certificados digitales para eventos y cursos desde $0,10 | HashProof",
    "home.meta.description":
      "Envía certificados digitales verificables de tus eventos, cursos y formaciones desde $0,10 cada uno. Sube una hoja de cálculo y cada persona recibe el suyo por correo. Sin mínimos ni cuota anual.",

    // Hero
    "home.hero.title": "Certificados digitales para tus eventos y cursos, desde $0,10 cada uno",
    "home.hero.lead":
      "Sube tu lista y cada persona recibe su certificado por correo, listo para compartir en LinkedIn y verificable por cualquiera con un clic. Sin mínimos, sin cuota anual y sin costo de implementación.",
    "home.hero.cta.start": "Empieza a emitir",
    "home.hero.cta.credential": "O mira un certificado real →",
    "home.hero.since": "Desde el 10 de marzo de 2026",
    "home.hero.stat.credentials": "Certificados emitidos",
    "home.hero.stat.entities": "Emisores verificados",
    "home.hero.onchain": "Ver el registro público ↗",

    // Cómo funciona
    "home.how.title": "Cómo funciona",
    "home.how.account.title": "Crea tu cuenta",
    "home.how.account.body":
      "Entra con tu correo, sin contraseña y sin tarjeta. Invita a tu equipo cuando lo necesites.",
    "home.how.design.title": "Elige un diseño",
    "home.how.design.body":
      "Usa el nuestro, o sube tu propio fondo y ubica el nombre, el evento y la fecha donde quieras.",
    "home.how.send.title": "Sube tu lista",
    "home.how.send.body":
      "Una hoja de cálculo con nombres y correos, o de a una persona. Cada una recibe un correo con su certificado, y tú ves quién lo recibió.",

    // Qué recibe la persona
    "home.value.title": "Qué recibe cada persona",
    "home.value.share.title": "Un certificado que da ganas de compartir",
    "home.value.share.body":
      "Su nombre y el evento en la vista previa del enlace, con el certificado como imagen. Un clic para añadirlo a LinkedIn, o compartirlo por WhatsApp, Telegram, X y Facebook.",
    "home.value.verify.title": "Verificable por cualquiera",
    "home.value.verify.body":
      "Una página pública que muestra quién lo emitió, a quién y cuándo. Sin cuenta, sin app y sin instalar nada.",
    "home.value.issuer.title": "Un emisor que demostró quién es",
    "home.value.issuer.body":
      "Revisamos la organización, y ella prueba el control de su dominio con un registro DNS que cualquiera puede resolver. Se exigen las dos cosas antes de mostrarla como verificada.",
    "home.value.durable.title": "Sobrevive a nosotros",
    "home.value.durable.body":
      "Cada certificado queda registrado en una blockchain pública y su diseño en IPFS, así que se puede verificar y reconstruir aunque HashProof desaparezca.",

    // Precios
    "home.pricing.title": "Pagas solo lo que emites",
    "home.pricing.plan.price": "$0,25",
    "home.pricing.plan.unit": " por certificado",
    "home.pricing.plan.crypto": "$0,225 si pagas en cripto. Compras desde $2,25.",
    "home.pricing.plan.noMinimum": "Sin volumen mínimo y sin compromiso",
    "home.pricing.plan.noFee": "Sin cuota anual y sin costo de implementación",
    "home.pricing.plan.included": "Diseños propios, carga desde hoja de cálculo, envío por correo, revocación y tu equipo, todo incluido",
    "home.pricing.compareTitle": "Al lado de los demás",
    "home.pricing.lead":
      "Tomados de la página de precios de cada proveedor, agosto de 2026. Lo que los separa es el modelo, no el precio unitario: cobramos por certificados emitidos, no por un cupo que llenar ni por contar personas.",
    "home.pricing.col.platform": "Plataforma",
    "home.pricing.col.each": "Modelo",
    "home.pricing.v2000": "2.000 al año",
    "home.pricing.v10000": "10.000 al año",
    "home.pricing.v20000": "20.000 al año",
    "home.pricing.perCredential": "Por credencial emitida",
    "home.pricing.perTier": "Cupo anual que debes llenar",
    "home.pricing.perRecipient": "Por receptor único",
    "home.pricing.quoted": "Solo cotizado",
    "home.pricing.notPublished": "No lo publican",
    "home.pricing.api": "HashProof · API",
    "home.pricing.dashboard": "HashProof · Panel",
    "home.pricing.note":
      "En el panel, los créditos cuestan $0,25 con tarjeta o $0,225 en cripto. Los desarrolladores que emiten por API pagan $0,10 por credencial. Donde un plan anual sale más barato es porque pagas un volumen por adelantado: a exactamente 10.000 Certifier le gana a nuestros dos precios, y por encima de unas 12.000 al año el plan de $3.000 de POK le gana al panel. Nosotros nunca pedimos compromiso: pagas lo que emitiste.",
    "home.pricing.compare": "Comparar en detalle:",


    // Desarrolladores
    "home.dev.title": "Para desarrolladores y agentes de IA",
    "home.dev.lead":
      "Todo lo que hace el panel también es una API. Paga $0,10 por credencial en USDC vía x402 —sin llave y sin suscripción— o crea una llave en el panel y gasta los créditos de tu organización. También hay servidor MCP, para que un agente emita por su cuenta.",
    "home.dev.docs": "Ver la documentación →",
  },
};

/**
 * Published prices, August 2026. Kept out of the locale files because the
 * numbers are the same in every language and only the labels are translated.
 */
/**
 * Verified 8 August 2026 against each vendor's own pricing page, not against
 * third-party blogs — several of which had figures out by a factor of eight,
 * and were published by competitors of the platforms they were pricing.
 *
 * Three round volumes rather than one, because a single number hides the shape:
 * at 10,000 Certifier is cheaper than us, at 2,000 and 20,000 it is not. That
 * is the whole argument — the billing model matters more than the unit price.
 */
export const PRICING_ROWS = [
  { key: "hashproof", nameKey: "home.pricing.api", name: "HashProof · API", model: "perCredential",
    costs: { v2000: "$200", v10000: "$1,000", v20000: "$2,000" }, highlight: true },
  // Credits in the dashboard: $0.225 in crypto, $0.25 by card.
  { key: "hashproof-dashboard", nameKey: "home.pricing.dashboard", name: "HashProof · Dashboard", model: "perCredential",
    costs: { v2000: "$450–$500", v10000: "$2,250–$2,500", v20000: "$4,500–$5,000" }, highlight: true },
  { key: "pok", name: "POK · Blockchain Verify", model: "perCredential",
    costs: { v2000: "$600", v10000: "$3,000", v20000: "$3,000" } },
  { key: "certifier", name: "Certifier", model: "perTier",
    costs: { v2000: "$804", v10000: "$804", v20000: "$4,068" } },
  { key: "sertifier", name: "Sertifier", model: "perRecipient",
    costs: { v2000: "~$2,000", v10000: "~$10,000", v20000: "~$20,000" } },
  { key: "accredible", name: "Accredible", model: "perRecipient",
    costs: { v2000: "notPublished", v10000: "notPublished", v20000: "notPublished" } },
  { key: "credly", name: "Credly", model: "quoted",
    costs: { v2000: "notPublished", v10000: "notPublished", v20000: "notPublished" } },
];
