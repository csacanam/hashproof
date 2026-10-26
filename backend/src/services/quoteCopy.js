/**
 * Wording of a quote, shared by the PDF and the email so both say the same.
 */

export const QUOTE_COPY = {
  es: {
    title: "Cotización",
    number: "Cotización N.º",
    issued: "Fecha",
    validUntil: "Válida hasta",
    preparedFor: "Preparada para",
    event: "Evento o curso",
    concept: "Concepto",
    qty: "Cant.",
    unit: "Valor unitario",
    amount: "Total",
    total: "Total",
    lines: {
      certificates: {
        name: "Certificados verificables",
        detail: "Emisión con el diseño de tu organización, registro en blockchain, PDF con código QR y página pública de verificación.",
      },
      verification: {
        name: "Verificación de la organización",
        detail: "Revisión de la organización y prueba de dominio. Tus certificados muestran el sello de emisor verificado. Pago único, sin suscripción.",
      },
      managed: {
        name: "Operación gestionada",
        detail: "Nosotros cargamos la lista de asistentes, montamos el template con tu diseño y emitimos los certificados por ti.",
      },
    },
    rate: (r) => `Valores en pesos colombianos calculados con la tasa USD/COP del ${r.dateLabel}: ${r.usd_cop.toLocaleString("es-CO", { maximumFractionDigits: 2 })}.`,
    rateFallback: (r) => `Valores en pesos colombianos calculados con una tasa de referencia USD/COP de ${r.usd_cop.toLocaleString("es-CO")}.`,
    terms: [
      "Los créditos no vencen: si emites menos certificados, los que sobran quedan para tu próximo evento.",
      "Cada certificado se paga una sola vez. Sin suscripción ni cobros por verificación.",
      "Para aceptarla, escríbenos a hi@hashproof.dev con el número de la cotización y te enviamos las instrucciones de pago.",
    ],
    whyTitle: "Por qué HashProof",
    why: [
      ["Verificable por cualquiera", "Cada certificado tiene un enlace y un código QR. Quien lo reciba comprueba en segundos que es auténtico, sin llamar a nadie."],
      ["Imposible de falsificar", "Queda registrado en la blockchain de Celo y en IPFS. La página de verificación muestra los datos de ese registro, no los del PDF: un certificado editado no pasa."],
      ["Con tu marca", "Cada organización usa su propio diseño: tu fondo, tus logos, tus firmas. Nosotros solo ponemos la verificación."],
      ["Fácil de compartir", "Tus asistentes lo descargan, lo agregan a LinkedIn o comparten el enlace con quien necesite validarlo."],
    ],
    samplesTitle: "Cada cliente, su propio diseño",
    samplesBody: "Ejemplos ilustrativos. Tus certificados llevan tu diseño y el código QR de verificación.",
    samples: [
      { org: "Universidad del Pacífico", kind: "Diploma de participación", name: "María Fernanda López", color: "#1e3a8a", accent: "#c9a227" },
      { org: "Congreso Latam de Medicina", kind: "Certificado de asistencia", name: "Andrés Gómez Ruiz", color: "#0f766e", accent: "#5eead4" },
      { org: "Academia Digital", kind: "Certificado de finalización", name: "Laura Martínez", color: "#7c2d12", accent: "#fb923c" },
    ],
    howTitle: "Cómo funciona",
    how: [
      ["Diseño", "Subes el fondo de tu certificado y ubicas los campos. O lo montamos nosotros."],
      ["Emisión", "Cargas la lista de asistentes y emites todos los certificados en minutos."],
      ["Entrega", "Cada persona recibe su certificado por correo, listo para descargar y verificar."],
    ],
    demo: "Mira un certificado real verificado:",
    contact: "¿Preguntas? Escríbenos a hi@hashproof.dev",
    footer: "HashProof · Certificados verificables · hashproof.dev",
    email: {
      subject: (q) => `Tu cotización de HashProof ${q.number}`,
      hello: (name) => `Hola, ${name}:`,
      body: "Adjuntamos la cotización que generaste en HashProof, con el detalle de precios, cómo funciona y ejemplos de certificados.",
      totalLabel: "Total",
      reply: "Para aceptarla o hacer cambios, solo responde este correo.",
      cta: "Ver cómo se verifica un certificado",
    },
  },
  en: {
    title: "Quote",
    number: "Quote No.",
    issued: "Date",
    validUntil: "Valid until",
    preparedFor: "Prepared for",
    event: "Event or course",
    concept: "Item",
    qty: "Qty",
    unit: "Unit price",
    amount: "Amount",
    total: "Total",
    lines: {
      certificates: {
        name: "Verifiable certificates",
        detail: "Issued with your organization's design, registered on a blockchain, delivered as a PDF with a QR code and a public verification page.",
      },
      verification: {
        name: "Organization verification",
        detail: "Review of your organization and proof of domain. Your certificates show the verified issuer badge. One-time fee, no subscription.",
      },
      managed: {
        name: "Managed issuance",
        detail: "We load your attendee list, set up the template with your design and issue the certificates for you.",
      },
    },
    rate: (r) => `Amounts in Colombian pesos at the USD/COP rate of ${r.dateLabel}: ${r.usd_cop.toLocaleString("en-US", { maximumFractionDigits: 2 })}.`,
    rateFallback: (r) => `Amounts in Colombian pesos at a reference USD/COP rate of ${r.usd_cop.toLocaleString("en-US")}.`,
    terms: [
      "Credits never expire: if you issue fewer certificates, the rest carry over to your next event.",
      "Each certificate is paid once. No subscription, no fees for verification.",
      "To accept, write to hi@hashproof.dev with the quote number and we will send you payment instructions.",
    ],
    whyTitle: "Why HashProof",
    why: [
      ["Anyone can verify it", "Every certificate has a link and a QR code. Whoever receives it can check it is authentic in seconds, without calling anyone."],
      ["Impossible to forge", "It is registered on the Celo blockchain and on IPFS. The verification page shows the data from that record, not from the PDF: an edited certificate does not pass."],
      ["Your brand", "Each organization uses its own design: your background, your logos, your signatures. We only add the verification."],
      ["Easy to share", "Recipients download it, add it to LinkedIn or share the link with anyone who needs to check it."],
    ],
    samplesTitle: "Every client, its own design",
    samplesBody: "Illustrative examples. Your certificates carry your design and the verification QR code.",
    samples: [
      { org: "Pacific University", kind: "Certificate of participation", name: "Maria Lopez", color: "#1e3a8a", accent: "#c9a227" },
      { org: "Latam Medical Congress", kind: "Certificate of attendance", name: "Andrew Gomez", color: "#0f766e", accent: "#5eead4" },
      { org: "Digital Academy", kind: "Certificate of completion", name: "Laura Martin", color: "#7c2d12", accent: "#fb923c" },
    ],
    howTitle: "How it works",
    how: [
      ["Design", "Upload your certificate background and place the fields. Or we set it up for you."],
      ["Issue", "Load your attendee list and issue every certificate in minutes."],
      ["Deliver", "Each person gets their certificate by email, ready to download and verify."],
    ],
    demo: "See a real, verified certificate:",
    contact: "Questions? Write to hi@hashproof.dev",
    footer: "HashProof · Verifiable certificates · hashproof.dev",
    email: {
      subject: (q) => `Your HashProof quote ${q.number}`,
      hello: (name) => `Hi ${name},`,
      body: "Attached is the quote you generated on HashProof, with the pricing, how it works and sample certificates.",
      totalLabel: "Total",
      reply: "To accept it or ask for changes, just reply to this email.",
      cta: "See how a certificate is verified",
    },
  },
};

// Issued by Peewah to the person who runs it: nobody else's data.
export const DEMO_VERIFY_URL = "https://www.hashproof.dev/verify/e313fd8d-c964-4b9c-ad1a-d21ca920ae75";
