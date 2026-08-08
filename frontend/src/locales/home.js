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
    "home.hero.title": "Verifiable digital credentials, $0.10 each",
    "home.hero.lead":
      "Issue certificates for events, courses and training that anyone can verify — anchored on a public blockchain, with no minimums, no annual fee and no setup cost.",
    "home.hero.cta.credential": "See a live certificate →",
    "home.hero.cta.contact": "Talk to us",
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
    "home.pricing.col.price": "Price",
    "home.pricing.col.year": "12,720 a year",
    "home.pricing.perCredential": "Per credential issued",
    "home.pricing.perTier": "Yearly tier you must fill",
    "home.pricing.perRecipient": "Per unique recipient",
    "home.pricing.quoted": "Quote only",
    "home.pricing.notPublished": "Not published",
    "home.pricing.note":
      "12,720 is the real yearly volume of the platform that issues most through HashProof. Certifier is slightly cheaper than us at exactly 10,000 a year, when its tier is full \u2014 the difference appears when your volume does not match a tier.",
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
      "One API call issues a certificate. Pay per credential in USDC over x402 — no API key and no subscription — or use a prepaid key if crypto is not for you.",
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
    "home.hero.title": "Credenciales digitales verificables, $0,10 cada una",
    "home.hero.lead":
      "Emite certificados de eventos, cursos y formación que cualquiera puede verificar — anclados en una blockchain pública, sin mínimos, sin cuota anual y sin costo de implementación.",
    "home.hero.cta.credential": "Ver un certificado real →",
    "home.hero.cta.contact": "Hablemos",
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
    "home.pricing.col.price": "Precio",
    "home.pricing.col.year": "12.720 al año",
    "home.pricing.perCredential": "Por credencial emitida",
    "home.pricing.perTier": "Cupo anual que debes llenar",
    "home.pricing.perRecipient": "Por receptor único",
    "home.pricing.quoted": "Solo cotizado",
    "home.pricing.notPublished": "No lo publican",
    "home.pricing.note":
      "12.720 es el volumen anual real de la plataforma que más emite con HashProof. Certifier sale algo más barato que nosotros a exactamente 10.000 al año, con su cupo lleno \u2014 la diferencia aparece cuando tu volumen no encaja en un cupo.",
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
      "Una llamada a la API emite un certificado. Paga por credencial en USDC vía x402 —sin API key y sin suscripción— o usa una llave prepago si prefieres no tocar cripto.",
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
 * third-party blogs — several of which had figures out by a factor of eight.
 * The differentiator is the model, not the unit price: we and POK charge per
 * credential, Certifier sells a yearly tier you have to fill, Sertifier and
 * Accredible count recipients, and Credly publishes nothing.
 */
export const PRICING_ROWS = [
  { key: "hashproof", name: "HashProof", model: "perCredential", price: "$0.10", year: "$1,272", highlight: true },
  { key: "pok", name: "POK · Blockchain Verify", model: "perCredential", price: "$0.30", year: "$3,000" },
  { key: "certifier", name: "Certifier", model: "perTier", price: "$79–399/mo", year: "$4,068" },
  { key: "sertifier", name: "Sertifier", model: "perRecipient", price: "$250/yr", year: "~$12,720" },
  { key: "accredible", name: "Accredible", model: "perRecipient", price: "$45/mo +", year: "notPublished" },
  { key: "credly", name: "Credly", model: "quoted", price: "notPublished", year: "notPublished" },
];
