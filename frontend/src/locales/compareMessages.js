/**
 * Copy for the head-to-head pages.
 *
 * Written for the person deciding, not for an engineer. Every line answers
 * "what does that do for me": not "we anchor the document hash" but "if anyone
 * questions a certificate, the person holding it can prove theirs is the real
 * one". Technical differences that do not change an outcome are left out.
 *
 * Each page states where the competitor is the better choice, first and in
 * full. A comparison that only flatters its author is worthless to a reader
 * weighing several sources, and gets discarded by anything summarising them.
 */

export const compareMessages = {
  en: {
    "cmp.meta.title": "HashProof vs {name} — an honest comparison",
    "cmp.meta.description":
      "What each one costs and when each is the better choice. Prices taken from {name}'s own pricing page.",
    "cmp.title": "HashProof vs {name}",
    "cmp.subtitle":
      "What each costs and when each is the better choice — with prices from their page, not ours.",
    "cmp.verified":
      "Prices checked on {date} against published pricing pages. They change; check before you decide.",

    "cmp.pricing.title": "What a year costs",
    "cmp.pricing.lead": "What you would pay to issue this many certificates in a year.",
    "cmp.pricing.col.platform": "Platform",
    "cmp.pricing.col.plan": "How they charge",
    "cmp.pricing.v2000": "2,000 a year",
    "cmp.pricing.v10000": "10,000 a year",
    "cmp.pricing.v20000": "20,000 a year",
    "cmp.pricing.ours": "HashProof",
    "cmp.pricing.ourPlan": "$0.10 per certificate issued",
    "cmp.pricing.notPublished": "Not published",
    "cmp.pricing.approx":
      "Figures marked ~ are worked out from the published per-recipient rate; the vendor does not publish a price at that volume.",

    "cmp.better.title": "When {name} is the better choice",
    "cmp.edge.title": "When HashProof is the better choice",
    "cmp.cta.title": "Want to try it?",
    "cmp.cta.body":
      "One certificate costs ten cents. Nothing to sign, no plan to pick and no minimum, so you can try it with a single event before deciding anything.",
    "cmp.cta.button": "Talk to us",
    "cmp.cta.docs": "See how it works",
    "cmp.visit": "See their pricing ↗",

    "how.pok": "$0.30 per certificate, or $3,000 a year for 50,000",
    "how.certifier": "A yearly plan sized in certificates: free to 1,000, then 10,000, then 50,000",
    "how.sertifier": "Per person rather than per certificate, unlimited each — free up to 250",
    "how.credly": "Not published; every plan goes through sales",
    "how.accredible": "Per person: $45 a month for 50, on a twelve-month term. Above that, quoted",

    "pok.strength.obadges":
      "Its certificates travel into LinkedIn and Europass on their own, because POK is a certified Open Badges 3.0 issuer. Ours follow the W3C standard but do not carry that certification, so the automatic import does not work.",
    "pok.strength.nft":
      "If you want each person to own their certificate in their own crypto wallet, POK does that. We deliberately do not — it would mean every attendee needs a wallet before they can receive anything.",
    "pok.strength.features":
      "There is more product around the certificate: it sends the emails for you, plus learning paths, engagement analytics and an app where recipients keep their credentials.",
    "pok.edge.price":
      "A congress with 5,000 attendees costs you $500 with us and $1,500 with POK. Neither of us asks for a minimum, so the difference is simply the price.",
    "pok.edge.document":
      "If anyone questions a certificate, the person holding it can prove their file is the original — we anchor the PDF's fingerprint. POK anchors the NFT image instead, and that image shows a placeholder where the name should be.",
    "pok.edge.revocation":
      "When you revoke a certificate with us it stays on the record, marked as revoked, so you can still show it existed and when it was withdrawn. POK burns it, and the trail goes with it.",
    "pok.edge.wallet":
      "Your attendees never need a wallet, an account, or to know what a blockchain is. They open a link.",

    "certifier.strength.integrations":
      "It connects to Canvas, Moodle, HubSpot and 6,000 other tools without writing code. With us, someone has to build against the API — fine if you are a platform, a problem if you are not.",
    "certifier.strength.obadges":
      "Open Badges 3.0, so recipients can import a certificate into LinkedIn or Europass without you integrating anything.",
    "certifier.strength.volume":
      "If your volume happens to fill one of its plans, it is cheaper than us: 10,000 certificates a year costs $804 there and $1,000 here.",
    "certifier.edge.tier":
      "You pay for what you issued. A year with 2,000 certificates costs $200 with us; with Certifier the free plan stops at 1,000 and the next jumps to 10,000, so you pay $804 for capacity you never used.",
    "certifier.edge.chain":
      "If you stop paying us, or we disappear, the certificates you already handed out keep working. They live on a public blockchain, not in our database.",
    "certifier.edge.agents":
      "Software can issue on its own — an AI agent included — paying per certificate with no account to create first.",

    "sertifier.strength.repeat":
      "It charges per person rather than per certificate, with unlimited certificates each. If the same students receive many a year, that is cheaper than paying for every one.",
    "sertifier.strength.obadges":
      "Open Badges support, and 250 recipients a year at no cost to get started.",
    "sertifier.edge.recipients":
      "We charge per certificate, not per person, which is cheaper for events — where each attendee usually receives one.",
    "sertifier.edge.chain":
      "Anyone can check a certificate against a public blockchain, without going through us and without an account.",
    "sertifier.edge.agents":
      "You pay per certificate as you issue, with no plan to choose and no subscription running in the background.",

    "credly.strength.network":
      "Credly runs the badge network employers already recognise. If what you need is a recruiter seeing a badge and knowing the brand behind it, nothing here replaces that.",
    "credly.strength.enterprise":
      "Mature enterprise features, established compliance and deep integrations for large training organisations.",
    "credly.edge.published":
      "You can see what we cost right now: ten cents a certificate. Credly publishes no price at all — every plan goes through a sales conversation first.",
    "credly.edge.selfserve":
      "You can issue your first certificate today, without a demo, a contract or a call.",
    "credly.edge.chain":
      "Certificates are checked against a public blockchain, so they do not depend on any company staying online — ours included.",

    "accredible.strength.enterprise":
      "Built for universities and large training providers: analytics, full branding and mature LMS integrations.",
    "accredible.strength.features":
      "More product around the certificate than we have — campaigns, reporting and recipient engagement.",
    "accredible.edge.term":
      "Its entry plan is $45 a month for 50 recipients, tied to a twelve-month term. We have no term, so a single event does not commit you to a year.",
    "accredible.edge.published":
      "Only the entry plan has a public price; past that you have to ask. Ours is one number that covers any volume.",
    "accredible.edge.chain":
      "Checking a certificate runs against a public blockchain rather than through us, so it outlives the commercial relationship.",
  },

  es: {
    "cmp.meta.title": "HashProof frente a {name} — comparación honesta",
    "cmp.meta.description":
      "Cuánto cuesta cada uno y cuándo conviene cada uno. Precios tomados de la propia página de {name}.",
    "cmp.title": "HashProof frente a {name}",
    "cmp.subtitle":
      "Cuánto cuesta cada uno y cuándo conviene cada uno — con precios de su página, no de la nuestra.",
    "cmp.verified":
      "Precios comprobados el {date} en sus páginas de precios. Cambian; verifícalos antes de decidir.",

    "cmp.pricing.title": "Cuánto cuesta un año",
    "cmp.pricing.lead": "Lo que pagarías por emitir esta cantidad de certificados en un año.",
    "cmp.pricing.col.platform": "Plataforma",
    "cmp.pricing.col.plan": "Cómo cobran",
    "cmp.pricing.v2000": "2.000 al año",
    "cmp.pricing.v10000": "10.000 al año",
    "cmp.pricing.v20000": "20.000 al año",
    "cmp.pricing.ours": "HashProof",
    "cmp.pricing.ourPlan": "$0,10 por certificado emitido",
    "cmp.pricing.notPublished": "No lo publican",
    "cmp.pricing.approx":
      "Las cifras con ~ salen de la tarifa por receptor publicada; el proveedor no publica precio para ese volumen.",

    "cmp.better.title": "Cuándo conviene {name}",
    "cmp.edge.title": "Cuándo conviene HashProof",
    "cmp.cta.title": "¿Quieres probarlo?",
    "cmp.cta.body":
      "Un certificado cuesta diez centavos. Nada que firmar, ningún plan que elegir y ningún mínimo, así que puedes probarlo con un solo evento antes de decidir nada.",
    "cmp.cta.button": "Hablemos",
    "cmp.cta.docs": "Ver cómo funciona",
    "cmp.visit": "Ver sus precios ↗",

    "how.pok": "$0,30 por certificado, o $3.000 al año por 50.000",
    "how.certifier": "Un plan anual dimensionado en certificados: gratis hasta 1.000, luego 10.000, luego 50.000",
    "how.sertifier": "Por persona y no por certificado, ilimitados cada una — gratis hasta 250",
    "how.credly": "No lo publican; todos los planes pasan por ventas",
    "how.accredible": "Por persona: $45 al mes por 50, con permanencia de doce meses. Por encima, cotizado",

    "pok.strength.obadges":
      "Sus certificados entran solos a LinkedIn y Europass, porque POK es emisor certificado de Open Badges 3.0. Los nuestros siguen el estándar del W3C pero no llevan esa certificación, así que esa importación automática no funciona.",
    "pok.strength.nft":
      "Si quieres que cada persona sea dueña de su certificado en su propia billetera cripto, POK lo hace. Nosotros no, a propósito: obligaría a cada asistente a tener una antes de poder recibir nada.",
    "pok.strength.features":
      "Trae más producto alrededor del certificado: envía los correos por ti, más rutas de aprendizaje, analítica de participación y una app donde el receptor guarda sus credenciales.",
    "pok.edge.price":
      "Un congreso de 5.000 asistentes te cuesta $500 con nosotros y $1.500 con POK. Ninguno de los dos pide mínimo, así que la diferencia es sencillamente el precio.",
    "pok.edge.document":
      "Si alguien pone en duda un certificado, quien lo tiene puede demostrar que su archivo es el original — anclamos la huella del PDF. POK ancla la imagen del NFT, y esa imagen muestra un marcador donde debería ir el nombre.",
    "pok.edge.revocation":
      "Cuando revocas un certificado con nosotros queda en el registro, marcado como revocado, así que puedes seguir mostrando que existió y cuándo se retiró. POK lo quema, y el rastro se va con él.",
    "pok.edge.wallet":
      "Tus asistentes nunca necesitan una billetera, ni una cuenta, ni saber qué es una blockchain. Abren un enlace.",

    "certifier.strength.integrations":
      "Se conecta con Canvas, Moodle, HubSpot y 6.000 herramientas más sin escribir código. Con nosotros alguien tiene que programar contra la API — bien si eres una plataforma, un problema si no lo eres.",
    "certifier.strength.obadges":
      "Open Badges 3.0, así el receptor puede importar el certificado a LinkedIn o Europass sin que tú integres nada.",
    "certifier.strength.volume":
      "Si tu volumen justo llena uno de sus planes, es más barato que nosotros: 10.000 certificados al año cuestan $804 allá y $1.000 aquí.",
    "certifier.edge.tier":
      "Pagas lo que emitiste. Un año de 2.000 certificados te cuesta $200 con nosotros; con Certifier el plan gratuito llega a 1.000 y el siguiente salta a 10.000, así que pagas $804 por una capacidad que nunca usaste.",
    "certifier.edge.chain":
      "Si dejas de pagarnos, o desaparecemos, los certificados que ya entregaste siguen funcionando. Viven en una blockchain pública, no en nuestra base de datos.",
    "certifier.edge.agents":
      "Un software puede emitir solo —incluido un agente de IA— pagando por certificado y sin crear una cuenta primero.",

    "sertifier.strength.repeat":
      "Cobra por persona y no por certificado, con certificados ilimitados para cada una. Si los mismos alumnos reciben muchos al año, sale más barato que pagar por cada uno.",
    "sertifier.strength.obadges":
      "Soporte de Open Badges, y 250 receptores al año sin costo para empezar.",
    "sertifier.edge.recipients":
      "Cobramos por certificado y no por persona, que es más barato en eventos — donde cada asistente suele recibir uno.",
    "sertifier.edge.chain":
      "Cualquiera puede comprobar un certificado contra una blockchain pública, sin pasar por nosotros y sin cuenta.",
    "sertifier.edge.agents":
      "Pagas por certificado según emites, sin plan que elegir ni suscripción corriendo de fondo.",

    "credly.strength.network":
      "Credly opera la red de insignias que los empleadores ya reconocen. Si lo que necesitas es que un reclutador vea una insignia y sepa qué marca hay detrás, eso no lo sustituye nada de aquí.",
    "credly.strength.enterprise":
      "Funciones empresariales maduras, cumplimiento consolidado e integraciones profundas para grandes organizaciones de formación.",
    "credly.edge.published":
      "Puedes ver lo que cobramos ahora mismo: diez centavos por certificado. Credly no publica ningún precio — todos sus planes pasan primero por una conversación de ventas.",
    "credly.edge.selfserve":
      "Puedes emitir tu primer certificado hoy, sin demo, sin contrato y sin llamada.",
    "credly.edge.chain":
      "Los certificados se comprueban contra una blockchain pública, así que no dependen de que ninguna empresa siga en línea — la nuestra incluida.",

    "accredible.strength.enterprise":
      "Pensado para universidades y grandes proveedores de formación: analítica, marca propia completa e integraciones maduras con LMS.",
    "accredible.strength.features":
      "Más producto alrededor del certificado del que tenemos — campañas, reportes y seguimiento del receptor.",
    "accredible.edge.term":
      "Su plan de entrada son $45 al mes por 50 receptores, atado a una permanencia de doce meses. Nosotros no tenemos permanencia, así que un solo evento no te compromete un año.",
    "accredible.edge.published":
      "Solo el plan de entrada tiene precio público; de ahí en adelante hay que preguntar. El nuestro es un número que cubre cualquier volumen.",
    "accredible.edge.chain":
      "Comprobar un certificado corre contra una blockchain pública en vez de pasar por nosotros, así que sobrevive a la relación comercial.",
  },
};
