/**
 * Head-to-head comparisons.
 *
 * Written to be quoted, including by an assistant answering "what is the
 * cheapest way to issue verifiable credentials". That means every number comes
 * from the vendor's own pricing page, dated, and every page states plainly
 * where the competitor is the better choice. A comparison that only flatters
 * the author is worthless to a reader and gets discarded by anything
 * synthesising several sources.
 *
 * Prices verified 8 August 2026 against each vendor's published pricing page.
 * Re-check before relying on them; they move.
 */

export const PRICE_CHECK_DATE = "2026-08-08";

/** What we can defend with evidence, and nothing more. */
export const OUR_FACTS = {
  pricePerCredential: "$0.10",
  model: "per credential issued",
  minimum: "none",
  setup: "none",
  chain: "Celo",
};

export const COMPETITORS = {
  pok: {
    slug: "pok",
    name: "POK",
    site: "https://www.pok.tech",
    pricing: [
      { plan: "Free", price: "$0", detail: "unlimited, no blockchain record" },
      { plan: "Blockchain Verify", price: "$0.30 / credential", detail: "or $3,000/year for 50,000" },
      { plan: "NFT Ownership", price: "$1.50 → $0.80", detail: "by volume, 1,000 → 100,000" },
    ],
    theirStrength: ["pok.strength.obadges", "pok.strength.nft", "pok.strength.features"],
    ourEdge: ["pok.edge.price", "pok.edge.document", "pok.edge.revocation", "pok.edge.wallet"],
  },
  certifier: {
    slug: "certifier",
    name: "Certifier",
    site: "https://certifier.io",
    pricing: [
      { plan: "Starter", price: "$0", detail: "1,000 credentials/year" },
      { plan: "Professional", price: "$79/month", detail: "10,000 credentials/year" },
      { plan: "Advanced", price: "$399/month", detail: "50,000 credentials/year" },
    ],
    theirStrength: ["certifier.strength.integrations", "certifier.strength.obadges", "certifier.strength.volume"],
    ourEdge: ["certifier.edge.tier", "certifier.edge.chain", "certifier.edge.agents"],
  },
  sertifier: {
    slug: "sertifier",
    name: "Sertifier",
    site: "https://sertifier.com",
    pricing: [
      { plan: "Free", price: "$0/year", detail: "250 yearly recipients, unlimited credentials" },
      { plan: "Pro", price: "$250/year", detail: "priced by unique recipient" },
    ],
    theirStrength: ["sertifier.strength.repeat", "sertifier.strength.obadges"],
    ourEdge: ["sertifier.edge.recipients", "sertifier.edge.chain", "sertifier.edge.agents"],
  },
  credly: {
    slug: "credly",
    name: "Credly",
    site: "https://www.credly.com",
    pricing: [{ plan: "All plans", price: "Not published", detail: "contact sales for a quote" }],
    theirStrength: ["credly.strength.network", "credly.strength.enterprise"],
    ourEdge: ["credly.edge.published", "credly.edge.selfserve", "credly.edge.chain"],
  },
  accredible: {
    slug: "accredible",
    name: "Accredible",
    site: "https://www.accredible.com",
    pricing: [
      { plan: "Launch", price: "$45/month", detail: "50 recipients, 12-month term" },
      { plan: "Connect & Growth", price: "Not published", detail: "contact sales" },
    ],
    theirStrength: ["accredible.strength.enterprise", "accredible.strength.features"],
    ourEdge: ["accredible.edge.term", "accredible.edge.published", "accredible.edge.chain"],
  },
};

export const compareMessages = {
  en: {
    "cmp.meta.title": "HashProof vs {name} — honest comparison",
    "cmp.meta.description":
      "How HashProof and {name} compare on price, commitment and what each does best. Prices taken from each vendor's own pricing page.",
    "cmp.title": "HashProof vs {name}",
    "cmp.subtitle": "Where each one is the better choice, with prices from their own pricing page.",
    "cmp.verified": "Prices verified {date} against published pricing pages. They change — check before deciding.",

    "cmp.pricing.title": "What each charges",
    "cmp.pricing.ours": "HashProof",
    "cmp.pricing.ourPlan": "Pay per credential",
    "cmp.pricing.ourPrice": "$0.10 / credential",
    "cmp.pricing.ourDetail": "no minimum, no setup, no subscription",

    "cmp.better.title": "When {name} is the better choice",
    "cmp.edge.title": "When HashProof is the better choice",
    "cmp.cta.title": "Want to try it?",
    "cmp.cta.body":
      "Issuing one credential costs $0.10 and takes one API call. There is nothing to sign and nothing to commit to.",
    "cmp.cta.button": "Talk to us",
    "cmp.cta.docs": "Read the docs",
    "cmp.visit": "See their pricing ↗",

    // POK
    "pok.strength.obadges": "Its free tier is a certified Open Badges 3.0 issuer. We are not — our credentials follow W3C Verifiable Credentials but are not Open Badges certified.",
    "pok.strength.nft": "It can mint each credential as an NFT the recipient owns in their own wallet. We deliberately do not, because it requires every recipient to have one.",
    "pok.strength.features": "It ships more around the credential: LMS integrations, email delivery, learning paths, analytics and a recipient wallet app.",
    "pok.edge.price": "$0.10 against $0.30 per blockchain-anchored credential — three times cheaper, with neither of us asking for a minimum.",
    "pok.edge.document": "We anchor the hash of the PDF itself, so whoever holds the file can prove it is the original. POK anchors the NFT image, which carries a placeholder instead of the holder's name.",
    "pok.edge.revocation": "Revoking with us keeps the record and marks it revoked. POK burns the token, which destroys the trail along with it.",
    "pok.edge.wallet": "No wallet needed for the recipient, and expiry is explicit on-chain.",

    // Certifier
    "certifier.strength.integrations": "Native integrations with Canvas, Moodle, HubSpot, Salesforce and 6,000 more through Zapier. We have an API and an MCP server, and nothing else.",
    "certifier.strength.obadges": "Open Badges 3.0 compliant, which matters if your credentials need to travel into LinkedIn or Europass on their own.",
    "certifier.strength.volume": "At steady volume that fills a tier it is very cheap: 10,000 credentials on the $79/month plan works out to $0.095 each — slightly under our $0.10.",
    "certifier.edge.tier": "You pay for credentials issued, not for a tier you must fill. At 12,000 a year Certifier needs the 50,000 plan at $399/month — $4,788 for capacity you use a quarter of, against $1,200 with us.",
    "certifier.edge.chain": "Every credential is registered on a public blockchain and verifiable without us. Certifier's verification runs through Certifier.",
    "certifier.edge.agents": "An AI agent can issue on its own through our MCP server, paying per credential in USDC with no account.",

    // Sertifier
    "sertifier.strength.repeat": "It charges per unique recipient with unlimited credentials each, so if the same people receive many credentials a year it works out cheaper than paying per credential.",
    "sertifier.strength.obadges": "Open Badges support and a free tier of 250 recipients a year.",
    "sertifier.edge.recipients": "We charge per credential, not per person, which is cheaper whenever each recipient gets one or two.",
    "sertifier.edge.chain": "Public blockchain record and independent verification, which Sertifier does not offer.",
    "sertifier.edge.agents": "API and MCP server with per-credential payment, no account and no subscription.",

    // Credly
    "credly.strength.network": "Credly runs the largest badge network there is. A badge issued there is recognised by employers who already know the brand, which nothing here replaces.",
    "credly.strength.enterprise": "Enterprise features, an established compliance story and deep integrations for large training organisations.",
    "credly.edge.published": "We publish our price. Credly does not publish any figure at all — every plan goes through sales.",
    "credly.edge.selfserve": "You can issue your first credential today without talking to anyone, for $0.10.",
    "credly.edge.chain": "Public blockchain record, verifiable by anyone without depending on us staying online.",

    // Accredible
    "accredible.strength.enterprise": "Built for universities and large training providers, with analytics, white-label branding and mature LMS integrations.",
    "accredible.strength.features": "More product around the credential than we have: campaigns, reporting, recipient engagement.",
    "accredible.edge.term": "Its entry plan is $45/month on a 12-month term for 50 recipients. We have no term and no minimum.",
    "accredible.edge.published": "Only the entry plan has a published price; the rest goes through sales. Ours is one number.",
    "accredible.edge.chain": "Public blockchain record and verification that does not depend on us.",
  },

  es: {
    "cmp.meta.title": "HashProof frente a {name} — comparación honesta",
    "cmp.meta.description":
      "Cómo se comparan HashProof y {name} en precio, compromiso y en qué es mejor cada uno. Precios tomados de la página de precios de cada proveedor.",
    "cmp.title": "HashProof frente a {name}",
    "cmp.subtitle": "En qué es mejor cada uno, con precios de su propia página.",
    "cmp.verified": "Precios verificados el {date} en las páginas de precios publicadas. Cambian — compruébalos antes de decidir.",

    "cmp.pricing.title": "Cuánto cobra cada uno",
    "cmp.pricing.ours": "HashProof",
    "cmp.pricing.ourPlan": "Pago por credencial",
    "cmp.pricing.ourPrice": "$0,10 / credencial",
    "cmp.pricing.ourDetail": "sin mínimo, sin implementación, sin suscripción",

    "cmp.better.title": "Cuándo es mejor {name}",
    "cmp.edge.title": "Cuándo es mejor HashProof",
    "cmp.cta.title": "¿Quieres probarlo?",
    "cmp.cta.body":
      "Emitir una credencial cuesta $0,10 y es una llamada a la API. No hay nada que firmar ni a qué comprometerse.",
    "cmp.cta.button": "Hablemos",
    "cmp.cta.docs": "Ver la documentación",
    "cmp.visit": "Ver sus precios ↗",

    // POK
    "pok.strength.obadges": "Su plan gratuito es emisor certificado de Open Badges 3.0. Nosotros no — nuestras credenciales siguen W3C Verifiable Credentials pero no están certificadas como Open Badges.",
    "pok.strength.nft": "Puede acuñar cada credencial como un NFT que el receptor posee en su propia wallet. Nosotros no lo hacemos a propósito, porque exige que cada receptor tenga una.",
    "pok.strength.features": "Trae más alrededor de la credencial: integraciones con LMS, envío de correo, rutas de aprendizaje, analítica y una app de cartera para el receptor.",
    "pok.edge.price": "$0,10 frente a $0,30 por credencial anclada en blockchain — tres veces más barato, y ninguno de los dos pide mínimo.",
    "pok.edge.document": "Anclamos el hash del PDF, así que quien tenga el archivo puede probar que es el original. POK ancla la imagen del NFT, que lleva un marcador en vez del nombre del titular.",
    "pok.edge.revocation": "Revocar con nosotros conserva el registro y lo marca como revocado. POK quema el token, y con él destruye el rastro.",
    "pok.edge.wallet": "El receptor no necesita wallet, y la caducidad es explícita en la cadena.",

    // Certifier
    "certifier.strength.integrations": "Integraciones nativas con Canvas, Moodle, HubSpot, Salesforce y 6.000 más vía Zapier. Nosotros tenemos una API y un servidor MCP, y nada más.",
    "certifier.strength.obadges": "Cumple Open Badges 3.0, que importa si tus credenciales deben viajar solas a LinkedIn o Europass.",
    "certifier.strength.volume": "A volumen estable que llene un cupo es muy barato: 10.000 credenciales en el plan de $79/mes salen a $0,095 cada una — algo por debajo de nuestros $0,10.",
    "certifier.edge.tier": "Pagas por credenciales emitidas, no por un cupo que debes llenar. A 12.000 al año Certifier obliga al plan de 50.000 a $399/mes — $4.788 por una capacidad que usas en un cuarto, frente a $1.200 con nosotros.",
    "certifier.edge.chain": "Cada credencial queda registrada en una blockchain pública y es verificable sin nosotros. La verificación de Certifier pasa por Certifier.",
    "certifier.edge.agents": "Un agente de IA puede emitir por su cuenta con nuestro servidor MCP, pagando por credencial en USDC y sin cuenta.",

    // Sertifier
    "sertifier.strength.repeat": "Cobra por receptor único con credenciales ilimitadas para cada uno, así que si las mismas personas reciben muchas al año sale más barato que pagar por credencial.",
    "sertifier.strength.obadges": "Soporte de Open Badges y capa gratuita de 250 receptores al año.",
    "sertifier.edge.recipients": "Cobramos por credencial, no por persona, que es más barato cuando cada receptor recibe una o dos.",
    "sertifier.edge.chain": "Registro en blockchain pública y verificación independiente, que Sertifier no ofrece.",
    "sertifier.edge.agents": "API y servidor MCP con pago por credencial, sin cuenta y sin suscripción.",

    // Credly
    "credly.strength.network": "Credly opera la mayor red de insignias que existe. Una insignia emitida ahí la reconocen empleadores que ya conocen la marca, y eso no lo sustituye nada de aquí.",
    "credly.strength.enterprise": "Funciones empresariales, historial de cumplimiento consolidado e integraciones profundas para grandes organizaciones de formación.",
    "credly.edge.published": "Nosotros publicamos el precio. Credly no publica ninguna cifra — todos sus planes pasan por ventas.",
    "credly.edge.selfserve": "Puedes emitir tu primera credencial hoy sin hablar con nadie, por $0,10.",
    "credly.edge.chain": "Registro en blockchain pública, verificable por cualquiera sin depender de que sigamos en línea.",

    // Accredible
    "accredible.strength.enterprise": "Pensado para universidades y grandes proveedores de formación, con analítica, marca blanca e integraciones maduras con LMS.",
    "accredible.strength.features": "Más producto alrededor de la credencial del que tenemos: campañas, reportes, seguimiento del receptor.",
    "accredible.edge.term": "Su plan de entrada son $45/mes con permanencia de 12 meses para 50 receptores. Nosotros no tenemos permanencia ni mínimo.",
    "accredible.edge.published": "Solo el plan de entrada tiene precio público; el resto pasa por ventas. El nuestro es un número.",
    "accredible.edge.chain": "Registro en blockchain pública y verificación que no depende de nosotros.",
  },
};
