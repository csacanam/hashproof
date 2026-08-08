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
    "home.meta.title": "Verifiable certificates from $0.10 | HashProof",
    "home.meta.description":
      "Issue verifiable digital certificates for events, courses and training from $0.10 each. No minimums, no annual fee, no setup cost.",

    // Hero
    "home.hero.title": "Verifiable certificates, $0.10 each",
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
      "Published prices from each platform, August 2026. The column that matters is the last one: everyone else asks for a yearly commitment before you issue anything.",
    "home.pricing.col.platform": "Platform",
    "home.pricing.col.each": "Per certificate",
    "home.pricing.col.year": "12,720 a year",
    "home.pricing.col.commitment": "Commitment",
    "home.pricing.none": "None",
    "home.pricing.quoted": "Quoted",
    "home.pricing.setup": "+ ~$2,000 setup",
    "home.pricing.minimum": "~$1,500 setup + ~$1,000 minimum",
    "home.pricing.included": "$3,000/year, 50k included",
    "home.pricing.sales": "Contact sales",
    "home.pricing.free": "250 recipients free",
    "home.pricing.perRecipient": "$1 per recipient",
    "home.pricing.note":
      "12,720 is the real yearly volume of the platform that issues most through HashProof. Below roughly 50,000 a year, the commitment costs more than the certificates.",

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
    "home.meta.title": "Certificados verificables desde $0,10 | HashProof",
    "home.meta.description":
      "Emite certificados digitales verificables para eventos, cursos y formación desde $0,10. Sin mínimos, sin cuota anual y sin costo de implementación.",

    // Hero
    "home.hero.title": "Certificados verificables, $0,10 cada uno",
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
      "Precios publicados por cada plataforma, agosto de 2026. La columna que importa es la última: todos los demás piden un compromiso anual antes de que emitas nada.",
    "home.pricing.col.platform": "Plataforma",
    "home.pricing.col.each": "Por certificado",
    "home.pricing.col.year": "12.720 al año",
    "home.pricing.col.commitment": "Compromiso",
    "home.pricing.none": "Ninguno",
    "home.pricing.quoted": "Cotizado",
    "home.pricing.setup": "+ ~$2.000 de implementación",
    "home.pricing.minimum": "~$1.500 implementación + ~$1.000 mínimo",
    "home.pricing.included": "$3.000/año, 50k incluidas",
    "home.pricing.sales": "Contactar ventas",
    "home.pricing.free": "250 receptores gratis",
    "home.pricing.perRecipient": "$1 por receptor",
    "home.pricing.note":
      "12.720 es el volumen anual real de la plataforma que más emite con HashProof. Por debajo de unas 50.000 al año, el compromiso cuesta más que los certificados.",

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
export const PRICING_ROWS = [
  { key: "hashproof", name: "HashProof", each: "$0.10", year: "$1,272", commitment: "none", highlight: true },
  { key: "pok-verify", name: "POK · Blockchain Verify", each: "$0.06", year: "$3,000", commitment: "included" },
  { key: "sertifier", name: "Sertifier", each: "perRecipient", year: "~$12,720", commitment: "free" },
  { key: "pok-nft", name: "POK · NFT", each: "$0.80–1.50", year: "$10,176–19,080", commitment: "sales" },
  { key: "credly", name: "Credly", each: "~$3.00", year: "~$38,160", commitment: "setup" },
  { key: "accredible", name: "Accredible", each: "quoted", year: "—", commitment: "minimum" },
];
