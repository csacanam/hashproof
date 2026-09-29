/**
 * Translations for the landing page.
 *
 * The page used to open with "issue credentials with one API call" — the how,
 * aimed at developers and agents. Five months in, none had arrived: of six
 * issuers, one accounts for 97% of every credential, and it is a platform that
 * certifies events. So it now opens with what the service is and what it costs,
 * and the API moved below.
 */

export const homeMessages = {
  en: {
    "home.meta.title": "Verifiable digital credentials from $0.10 | HashProof",
    "home.meta.description":
      "Issue verifiable digital certificates for events, courses and training from $0.10 each. No minimums, no annual fee, no setup cost.",

    // Hero
    "home.hero.title": "Verifiable digital credentials, from $0.10 each",
    "home.hero.lead":
      "Issue certificates for events, courses and training that anyone can verify — anchored on a public blockchain, with no minimums, no annual fee and no setup cost.",
    "home.hero.cta.credential": "See a live certificate →",
    "home.hero.cta.contact": "Talk to us",
    "home.hero.cta.start": "Start issuing",
    "home.hero.since": "Since March 10, 2026",
    "home.hero.stat.credentials": "Certificates issued",
    "home.hero.stat.entities": "Verified issuers",
    "home.hero.onchain": "Verify onchain ↗",

    // Pricing
    "home.pricing.title": "What it costs, next to everyone else",
    "home.pricing.lead":
      "Taken from each vendor\u2019s own pricing page, August 2026. What separates them is the model, not the unit price: we charge for credentials you issue, not for a tier to fill or for counting people.",
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
      "Two ways to issue with us. Through the API you pay $0.10 per credential over x402. In the dashboard — templates, spreadsheet uploads, revocation, your team, no code — credits cost $0.225 in crypto or $0.25 by card, below any per-credential price above. Where a yearly plan is cheaper, it is because you prepay a volume: at exactly 10,000 Certifier beats both of our prices, and above about 12,000 a year POK's $3,000 plan beats the dashboard. We never ask for a commitment — you pay for what you issued.",
    "home.pricing.compare": "Compare in detail:",

    // What the recipient gets
    "home.value.title": "What the person receives",
    "home.value.share.title": "A certificate worth sharing",
    "home.value.share.body":
      "Their name and the event in the link preview, with the certificate itself as the image. One click to add it to LinkedIn, or share it on WhatsApp, Telegram, X and Facebook.",
    "home.value.verify.title": "Verifiable by anyone",
    "home.value.verify.body":
      "A public page showing the blockchain record, the issuer and the date. No account, no app, nothing to install.",
    "home.value.issuer.title": "An issuer that proved who it is",
    "home.value.issuer.body":
      "We review the organization, and it proves control of its domain with a DNS record that anyone can resolve. Both are required before it shows as verified.",
    "home.value.durable.title": "It outlives us",
    "home.value.durable.body":
      "The record lives on a public blockchain and the certificate's design on IPFS, so it can be verified and rebuilt even if HashProof disappears.",

    // Developers
    "home.dev.title": "For developers and AI agents",
    "home.dev.lead":
      "One API call issues a certificate. Pay per credential in USDC over x402 — no API key and no subscription — or create a key in the dashboard and spend your organization's credits.",
    "home.dev.docs": "Read the docs",
    "home.dev.mcp": "There is an MCP server too, so an agent can issue on its own.",

    // Contact
    "home.contact.title": "Talk to us",
    "home.contact.body":
      "Running events, courses or training and want to see whether this fits? Write to us — a person answers.",
  },

  es: {
    "home.meta.title": "Credenciales digitales verificables desde $0,10 | HashProof",
    "home.meta.description":
      "Emite certificados digitales verificables para eventos, cursos y formación desde $0,10. Sin mínimos, sin cuota anual y sin costo de implementación.",

    // Hero
    "home.hero.title": "Credenciales digitales verificables, desde $0,10 cada una",
    "home.hero.lead":
      "Emite certificados de eventos, cursos y formación que cualquiera puede verificar — anclados en una blockchain pública, sin mínimos, sin cuota anual y sin costo de implementación.",
    "home.hero.cta.credential": "Ver un certificado real →",
    "home.hero.cta.contact": "Hablemos",
    "home.hero.cta.start": "Empieza a emitir",
    "home.hero.since": "Desde el 10 de marzo de 2026",
    "home.hero.stat.credentials": "Certificados emitidos",
    "home.hero.stat.entities": "Emisores verificados",
    "home.hero.onchain": "Verificar en la cadena ↗",

    // Precios
    "home.pricing.title": "Cuánto cuesta, al lado de los demás",
    "home.pricing.lead":
      "Tomados de la página de precios de cada proveedor, agosto de 2026. Lo que los separa es el modelo, no el precio unitario: cobramos por credenciales emitidas, no por un cupo que llenar ni por contar personas.",
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
      "Hay dos formas de emitir con nosotros. Por API pagas $0,10 por credencial vía x402. En el panel —plantillas, carga desde Excel, revocación, tu equipo, sin programar— los créditos cuestan $0,225 en cripto o $0,25 con tarjeta, por debajo de cualquier precio por credencial de la tabla. Donde un plan anual sale más barato es porque pagas un volumen por adelantado: a exactamente 10.000 Certifier le gana a nuestros dos precios, y por encima de unas 12.000 al año el plan de $3.000 de POK le gana al panel. Nosotros nunca pedimos compromiso: pagas lo que emitiste.",
    "home.pricing.compare": "Comparar en detalle:",

    // Qué recibe la persona
    "home.value.title": "Qué recibe la persona",
    "home.value.share.title": "Un certificado que da ganas de compartir",
    "home.value.share.body":
      "Su nombre y el evento en la vista previa del enlace, con el certificado como imagen. Un clic para añadirlo a LinkedIn, o compartirlo por WhatsApp, Telegram, X y Facebook.",
    "home.value.verify.title": "Verificable por cualquiera",
    "home.value.verify.body":
      "Una página pública con el registro en blockchain, el emisor y la fecha. Sin cuenta, sin app y sin instalar nada.",
    "home.value.issuer.title": "Un emisor que demostró quién es",
    "home.value.issuer.body":
      "Revisamos la organización, y ella prueba el control de su dominio con un registro DNS que cualquiera puede resolver. Se exigen las dos cosas antes de mostrarla como verificada.",
    "home.value.durable.title": "Sobrevive a nosotros",
    "home.value.durable.body":
      "El registro vive en una blockchain pública y el diseño del certificado en IPFS, así que se puede verificar y reconstruir aunque HashProof desaparezca.",

    // Desarrolladores
    "home.dev.title": "Para desarrolladores y agentes de IA",
    "home.dev.lead":
      "Una llamada a la API emite un certificado. Paga por credencial en USDC vía x402 —sin API key y sin suscripción— o crea una llave en el panel y gasta los créditos de tu organización.",
    "home.dev.docs": "Ver la documentación",
    "home.dev.mcp": "También hay servidor MCP, para que un agente emita por su cuenta.",

    // Contacto
    "home.contact.title": "Hablemos",
    "home.contact.body":
      "¿Organizas eventos, cursos o formación y quieres ver si esto encaja? Escríbenos — responde una persona.",
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
