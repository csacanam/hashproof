/**
 * Translations for the API reference (/docs).
 *
 * Only the prose is translated. Endpoint paths, field names, enum values, HTTP
 * codes and every code sample stay in English on purpose: they are the API
 * surface, not copy. A reader who sees `holder.full_name` translated cannot
 * paste it into a request.
 */

export const docsMessages = {
  en: {
    "docs.meta.title": "Verifiable credentials API documentation | HashProof",
    "docs.meta.description":
      "Issue and verify blockchain-backed credentials with one API call. $0.10 per credential, pay by wallet or API key, no subscription.",

    "docs.topbar.title": "Documentation",
    "docs.topbar.menu": "Toggle menu",
    "docs.copy": "Copy",
    "docs.copied": "Copied!",
    "docs.table.field": "Field",
    "docs.table.type": "Type",
    "docs.table.required": "Required",
    "docs.table.description": "Description",
    "docs.label.terminal": "terminal",
    "docs.label.output": "output",
    "docs.label.requestBody": "request body",
    "docs.label.requestBodyReuse": "request body (template already created)",
    "docs.label.response": "response",
    "docs.table.yes": "yes",
    "docs.table.no": "no",

    "docs.nav.quickstart": "Quick start",
    "docs.nav.authentication": "Authentication",
    "docs.nav.templates": "Templates",
    "docs.nav.preview": "Template preview",
    "docs.nav.entityVerification": "Entity verification",

    // ── Quick start ──
    "docs.qs.title": "Quick start",
    "docs.qs.lead":
      "Issue a verifiable credential with a single API call. Each credential costs {price}. Choose how you want to pay:",
    "docs.qs.paths": "Three ways to get started",
    "docs.qs.crypto.title": "Pay with crypto",
    "docs.qs.crypto.body":
      "No account, no API key. $0.10 USDC per credential is charged automatically from your wallet via x402. You need a wallet with USDC on Base or Celo and a {link} (free).",
    "docs.qs.crypto.link": "thirdweb Client ID",
    "docs.qs.apikey.title": "Pay with an API key",
    "docs.qs.apikey.body":
      "No wallet needed. Buy prepaid credits from HashProof, get an API key, and use it like any standard REST API. Write to {link}.",
    "docs.qs.agent.title": "AI agent",
    "docs.qs.agent.body":
      "Read {link} and follow the instructions. The skill file has everything: what to ask the human, how to pay, and how to use templates.",
    "docs.qs.x402.title": "Quick start — pay with crypto",
    "docs.qs.x402.prereq":
      "Requirements: Node.js 18+, a wallet with USDC on Base or Celo, and a thirdweb Client ID.",
    "docs.qs.apikey2.title": "Quick start — pay with an API key",
    "docs.qs.apikey2.prereq":
      "Requirements: a HashProof API key with prepaid credits.",
    "docs.qs.agent2.title": "For AI agents",
    "docs.qs.agent2.body":
      "If you are building an agent that issues credentials, read the agent skill file at {link}. It has step-by-step instructions: what to ask the human, how to call the API, and how to handle templates and payments.",

    // ── Authentication ──
    "docs.auth.title": "Authentication",
    "docs.auth.x402.title": "Pay with crypto (x402)",
    "docs.auth.x402.body":
      "No API key needed. When you call a paid endpoint the API returns {code} with the amount and the network. The thirdweb SDK signs a USDC transfer from your wallet and retries the request on its own. No gas on your side. {price} per credential on Base or Celo.",
    "docs.auth.apikey.title": "Pay with an API key",
    "docs.auth.apikey.body1": "Send {header1} or {header2}.",
    "docs.auth.apikey.body2":
      "Each issuance deducts 1 credit and the key belongs to a single issuer entity. If you run out of credits the API returns {code}. Write to {email} to buy more.",

    // ── issueCredential ──
    "docs.issue.lead":
      "Issues one verifiable credential. Paid by x402 or API key.",
    "docs.issue.body.title": "Request body",
    "docs.issue.example.title": "Minimal example",
    "docs.issue.response.title": "Response 200",
    "docs.issue.response.note":
      "Share {field} with the credential holder. The QR code on the PDF points to that URL.",
    "docs.issue.errors.title": "Errors",

    "docs.f.issuerName": "Name of the issuing organization",
    "docs.f.issuerSlug": "URL-safe identifier, e.g. acme-corp",
    "docs.f.platformName": "Name of the platform managing issuance",
    "docs.f.platformSlug": "URL-safe identifier",
    "docs.f.holderName": "Full name of the credential recipient",
    "docs.f.holderEmail": "Email for delivery",
    "docs.f.contextType": "Kind of activity being certified",
    "docs.f.contextTitle": "Name of the event, course, or programme",
    "docs.f.startsAt": "Start date",
    "docs.f.endsAt": "End date",
    "docs.f.credentialType": "What the credential attests to",
    "docs.f.title": "Title printed on the credential PDF",
    "docs.f.expiresAt": "Expiry date. null = never expires",
    "docs.f.values":
      "Key-value pairs for the template fields (e.g. holder_name, details)",
    "docs.f.templateSlug": "Slug of an existing template",
    "docs.f.templateId": "UUID of an existing template",
    "docs.f.template":
      "Inline template definition (creation only). See Templates.",
    "docs.f.bgOverride":
      "Replaces the background image for this credential only",
    "docs.f.issuerEntity": "Your verified entity ID (shows the verified badge)",
    "docs.f.platformEntity": "Platform entity ID",

    "docs.e.400": "Missing required field or invalid value",
    "docs.e.401": "Invalid API key",
    "docs.e.402": "Payment required (x402 challenge) or no credits left",
    "docs.e.403":
      "Entity suspended, or the paying wallet is not in authorized_wallets",
    "docs.e.500": "IPFS, on-chain, or database error",

    // ── Templates ──
    "docs.tpl.title": "Templates",
    "docs.tpl.lead":
      "A credential PDF has two parts: the {bg} (the image) and the {tpl} (the layout). The difference matters.",
    "docs.tpl.bgWord": "background",
    "docs.tpl.tplWord": "template",
    "docs.tpl.bg.title": "Background = the image",
    "docs.tpl.bg.body1":
      "The background is a PNG or JPG that fills the whole PDF page. It is the visual design of your certificate — borders, logos, colours, decoration. It carries no dynamic text.",
    "docs.tpl.bg.body2":
      "You can set a default background when you create the template and replace it per credential with {code} (same layout, different image).",
    "docs.tpl.layout.title": "Template = the layout",
    "docs.tpl.layout.body":
      "The template defines where and how each piece of text is drawn on top of the background: the page dimensions, and per field its position ({xy}), width, font size and colour, alignment, bold/italic, and whether it is required.",
    "docs.tpl.layout.note":
      "Dimensions use the same units as your background image. If the image is 3508 × 2480 pixels, set {code} and use pixel coordinates for the field positions.",
    "docs.tpl.options.title": "Which option to use",
    "docs.tpl.options.scenario": "Scenario",
    "docs.tpl.options.send": "What to send",
    "docs.tpl.options.default": "Default certificate (quick start)",
    "docs.tpl.options.defaultBody":
      "Omit every template field. Use values.holder_name and, optionally, values.details.",
    "docs.tpl.options.existing": "Existing template",
    "docs.tpl.options.existingBody":
      "template_slug or template_id. Provide values for each required field.",
    "docs.tpl.options.new": "New custom template (first time)",
    "docs.tpl.options.newBody":
      "A template object with slug, name, background_url, page_width, page_height, fields_json. From then on, reuse it with template_slug.",
    "docs.tpl.options.sameTpl": "Same template, different background",
    "docs.tpl.options.sameTplBody":
      "template_slug + background_url_override. The layout stays; only the image changes.",
    "docs.tpl.options.note":
      "Send only one of template_slug, template_id, or template. Sending more than one returns 400.",
    "docs.tpl.fields.title": "Template field properties",
    "docs.tpl.req.title": "Discover the required fields",
    "docs.tpl.req.body":
      "No auth needed. Returns required_keys and the full fields_json, so you know exactly which values to send and where they will appear.",
    "docs.tpl.inline.title": "Example: create a template inline",
    "docs.tpl.inline.body":
      "Use this the first time you want a custom layout. From then on, reuse it with template_slug.",
    "docs.tpl.inline.qr":
      "The QR code is added automatically in the top-right corner — leave that area clear in your background.",
    "docs.tpl.reuse.title": "Example: reuse an existing template",

    "docs.t.slug": "Unique slug (global). Used later as template_slug.",
    "docs.t.name": "Human-readable name",
    "docs.t.bg": "URL of the background image (PNG or JPG)",
    "docs.t.pw": "Page width, same units as the image. Default: 595",
    "docs.t.ph": "Page height. Default: 842",
    "docs.t.fields": "Array of field definitions",
    "docs.t.key": "Maps to a key in values{}",
    "docs.t.x": "Horizontal position from the left",
    "docs.t.y": "Vertical position from the top",
    "docs.t.width": "Width of the text box",
    "docs.t.fontSize": "Font size. Default: 12",
    "docs.t.fontColor": "Hex colour. Default: #000000",
    "docs.t.align": "left · center · right. Default: left",
    "docs.t.required":
      "If true, issuance fails when the key is missing from values",
    "docs.t.bold": "Default: false",

    // ── Preview ──
    "docs.prev.title": "Template preview",
    "docs.prev.lead":
      "Before issuing real credentials, see how your certificate looks. No cost, no blockchain, no registration — just a PDF with a watermark.",
    "docs.prev.url.title": "Preview by URL",
    "docs.prev.url.body":
      "Open a URL with the template slug and the field values as query parameters:",
    "docs.prev.url.note":
      'The page builds the PDF in real time with a "PREVIEW" watermark ("VISTA PREVIA" in Spanish). You can download it, and the QR on the PDF points back to the same preview URL.',
    "docs.prev.api.title": "Preview by API",
    "docs.prev.api.noAuth": "No auth needed.",
    "docs.prev.api.note":
      "Returns a PDF with the watermark. Use it to check the field positions before issuing.",
    "docs.p.bg": "Replaces the template's default background",
    "docs.p.fields": "Key-value pairs for each template field",
    "docs.p.locale": '"en" or "es" — sets the watermark language',

    // ── verify ──
    "docs.verify.lead":
      "Full three-layer verification: the on-chain contract, the IPFS content hash, and the database. If any layer disagrees, the credential is flagged. Free, no auth.",
    "docs.verify.response.title": "Response 200",
    "docs.verify.status.title": "status values",
    "docs.verify.other.title": "Other endpoints",
    "docs.verify.note.contract": "Blockchain only",
    "docs.verify.note.ipfs": "IPFS integrity check",
    "docs.verify.note.pdf": "Download the PDF. Add ?inline=1 to preview it",
    "docs.s.active": "Valid, not revoked, not expired",
    "docs.s.revoked": "Explicitly revoked on-chain",
    "docs.s.expired": "Past expires_at",
    "docs.s.notFound": "Not registered on-chain",
    "docs.s.unknown": "Contract unreachable",

    // ── entities ──
    "docs.entities.lead":
      "Returns the entity's data and verification status. {id} may be a UUID or a slug. Free, no auth.",
    "docs.entities.status.title": "status values",
    "docs.es.unverified": "Registered but not yet verified",
    "docs.es.individual": "Verified as a person",
    "docs.es.organization": "Verified as an organization",
    "docs.es.suspended": "Suspended by HashProof",

    // ── entity verification ──
    "docs.ev.title": "Entity verification",
    "docs.ev.lead":
      "Organizations and individuals can verify their identity with HashProof. Verified issuers show a verified badge on every credential they issue.",
    "docs.ev.how.title": "How to request verification",
    "docs.ev.how.action": "Request verification",
    "docs.ev.how.1": "Go to your entity page: {path}",
    "docs.ev.how.2": "Click {action}.",
    "docs.ev.how.3":
      "Fill in the form (organization or individual) and pay $49 USDC.",
    "docs.ev.how.4": "HashProof reviews the request and approves it by hand.",
    "docs.ev.how.5":
      "Publish the TXT record we give you on your domain. This is what lets anyone confirm the domain is yours without trusting us.",
    "docs.ev.how.6":
      "With both checks passed, your entity shows as verified and your wallets are authorized.",
    "docs.ev.wallets.title": "Authorized wallets",
    "docs.ev.wallets.body":
      "When you verify your entity you declare which EVM wallets may issue credentials on your behalf. Only those wallets can call {endpoint} with your {field}.",
  },

  es: {
    "docs.meta.title":
      "Documentación de la API de credenciales verificables | HashProof",
    "docs.meta.description":
      "Emite y verifica credenciales respaldadas en blockchain con una sola llamada a la API. $0.10 por credencial, pagas con wallet o API key, sin suscripción.",

    "docs.topbar.title": "Documentación",
    "docs.topbar.menu": "Abrir menú",
    "docs.copy": "Copiar",
    "docs.copied": "¡Copiado!",
    "docs.table.field": "Campo",
    "docs.table.type": "Tipo",
    "docs.table.required": "Obligatorio",
    "docs.table.description": "Descripción",
    "docs.label.terminal": "terminal",
    "docs.label.output": "salida",
    "docs.label.requestBody": "cuerpo de la petición",
    "docs.label.requestBodyReuse":
      "cuerpo de la petición (plantilla ya creada)",
    "docs.label.response": "respuesta",
    "docs.table.yes": "sí",
    "docs.table.no": "no",

    "docs.nav.quickstart": "Inicio rápido",
    "docs.nav.authentication": "Autenticación",
    "docs.nav.templates": "Plantillas",
    "docs.nav.preview": "Vista previa de plantillas",
    "docs.nav.entityVerification": "Verificación de entidad",

    // ── Inicio rápido ──
    "docs.qs.title": "Inicio rápido",
    "docs.qs.lead":
      "Emite una credencial verificable con una sola llamada a la API. Cada credencial cuesta {price}. Elige cómo quieres pagar:",
    "docs.qs.paths": "Tres formas de empezar",
    "docs.qs.crypto.title": "Pagar con cripto",
    "docs.qs.crypto.body":
      "Sin cuenta y sin API key. Se cobran $0.10 USDC por credencial automáticamente desde tu wallet vía x402. Necesitas una wallet con USDC en Base o Celo y un {link} (gratis).",
    "docs.qs.crypto.link": "Client ID de thirdweb",
    "docs.qs.apikey.title": "Pagar con API key",
    "docs.qs.apikey.body":
      "Sin wallet. Compras créditos prepago a HashProof, recibes una API key y la usas como cualquier API REST. Escribe a {link}.",
    "docs.qs.agent.title": "Agente de IA",
    "docs.qs.agent.body":
      "Lee {link} y sigue las instrucciones. El archivo de skill lo tiene todo: qué preguntarle a la persona, cómo pagar y cómo usar plantillas.",
    "docs.qs.x402.title": "Inicio rápido — pagar con cripto",
    "docs.qs.x402.prereq":
      "Requisitos: Node.js 18+, una wallet con USDC en Base o Celo, y un Client ID de thirdweb.",
    "docs.qs.apikey2.title": "Inicio rápido — pagar con API key",
    "docs.qs.apikey2.prereq":
      "Requisitos: una API key de HashProof con créditos prepago.",
    "docs.qs.agent2.title": "Para agentes de IA",
    "docs.qs.agent2.body":
      "Si estás construyendo un agente que emite credenciales, lee el archivo de skill en {link}. Trae instrucciones paso a paso: qué preguntarle a la persona, cómo llamar a la API y cómo manejar plantillas y pagos.",

    // ── Autenticación ──
    "docs.auth.title": "Autenticación",
    "docs.auth.x402.title": "Pagar con cripto (x402)",
    "docs.auth.x402.body":
      "No hace falta API key. Cuando llamas a un endpoint de pago, la API responde {code} con el monto y la red. El SDK de thirdweb firma una transferencia de USDC desde tu wallet y reintenta la petición solo. Sin gas de tu lado. {price} por credencial en Base o Celo.",
    "docs.auth.apikey.title": "Pagar con API key",
    "docs.auth.apikey.body1": "Envía {header1} o {header2}.",
    "docs.auth.apikey.body2":
      "Cada emisión descuenta 1 crédito y la key pertenece a una sola entidad emisora. Si te quedas sin créditos, la API responde {code}. Escribe a {email} para comprar más.",

    // ── issueCredential ──
    "docs.issue.lead":
      "Emite una credencial verificable. Se paga con x402 o con API key.",
    "docs.issue.body.title": "Cuerpo de la petición",
    "docs.issue.example.title": "Ejemplo mínimo",
    "docs.issue.response.title": "Respuesta 200",
    "docs.issue.response.note":
      "Comparte {field} con quien recibe la credencial. El código QR del PDF apunta a esa URL.",
    "docs.issue.errors.title": "Errores",

    "docs.f.issuerName": "Nombre de la organización que emite",
    "docs.f.issuerSlug": "Identificador apto para URL, p. ej. acme-corp",
    "docs.f.platformName": "Nombre de la plataforma que gestiona la emisión",
    "docs.f.platformSlug": "Identificador apto para URL",
    "docs.f.holderName": "Nombre completo de quien recibe la credencial",
    "docs.f.holderEmail": "Correo para el envío",
    "docs.f.contextType": "Tipo de actividad que se certifica",
    "docs.f.contextTitle": "Nombre del evento, curso o programa",
    "docs.f.startsAt": "Fecha de inicio",
    "docs.f.endsAt": "Fecha de fin",
    "docs.f.credentialType": "Qué acredita la credencial",
    "docs.f.title": "Título impreso en el PDF de la credencial",
    "docs.f.expiresAt": "Fecha de vencimiento. null = no vence nunca",
    "docs.f.values":
      "Pares clave-valor para los campos de la plantilla (p. ej. holder_name, details)",
    "docs.f.templateSlug": "Slug de una plantilla existente",
    "docs.f.templateId": "UUID de una plantilla existente",
    "docs.f.template":
      "Definición de plantilla en línea (solo creación). Ver Plantillas.",
    "docs.f.bgOverride":
      "Reemplaza la imagen de fondo solo para esta credencial",
    "docs.f.issuerEntity":
      "El ID de tu entidad verificada (muestra el sello de verificado)",
    "docs.f.platformEntity": "ID de la entidad de la plataforma",

    "docs.e.400": "Falta un campo obligatorio o un valor es inválido",
    "docs.e.401": "API key inválida",
    "docs.e.402": "Pago requerido (reto x402) o sin créditos disponibles",
    "docs.e.403":
      "Entidad suspendida, o la wallet que paga no está en authorized_wallets",
    "docs.e.500": "Error de IPFS, on-chain o de base de datos",

    // ── Plantillas ──
    "docs.tpl.title": "Plantillas",
    "docs.tpl.lead":
      "El PDF de una credencial tiene dos partes: el {bg} (la imagen) y la {tpl} (la disposición). La diferencia importa.",
    "docs.tpl.bgWord": "fondo",
    "docs.tpl.tplWord": "plantilla",
    "docs.tpl.bg.title": "Fondo = la imagen",
    "docs.tpl.bg.body1":
      "El fondo es un PNG o JPG que ocupa toda la página del PDF. Es el diseño visual de tu certificado — bordes, logos, colores, decoración. No lleva texto dinámico.",
    "docs.tpl.bg.body2":
      "Puedes fijar un fondo por defecto al crear la plantilla y reemplazarlo por credencial con {code} (misma disposición, otra imagen).",
    "docs.tpl.layout.title": "Plantilla = la disposición",
    "docs.tpl.layout.body":
      "La plantilla define dónde y cómo se dibuja cada texto sobre el fondo: las dimensiones de la página y, por campo, su posición ({xy}), ancho, tamaño y color de fuente, alineación, negrita/cursiva, y si es obligatorio.",
    "docs.tpl.layout.note":
      "Las dimensiones van en las mismas unidades que tu imagen de fondo. Si la imagen es de 3508 × 2480 píxeles, pon {code} y usa coordenadas en píxeles para la posición de los campos.",
    "docs.tpl.options.title": "Qué opción usar",
    "docs.tpl.options.scenario": "Situación",
    "docs.tpl.options.send": "Qué enviar",
    "docs.tpl.options.default": "Certificado por defecto (inicio rápido)",
    "docs.tpl.options.defaultBody":
      "Omite todos los campos de plantilla. Usa values.holder_name y, si quieres, values.details.",
    "docs.tpl.options.existing": "Plantilla existente",
    "docs.tpl.options.existingBody":
      "template_slug o template_id. Envía values para cada campo obligatorio.",
    "docs.tpl.options.new": "Plantilla propia nueva (primera vez)",
    "docs.tpl.options.newBody":
      "Un objeto template con slug, name, background_url, page_width, page_height, fields_json. De ahí en adelante la reutilizas con template_slug.",
    "docs.tpl.options.sameTpl": "Misma plantilla, otro fondo",
    "docs.tpl.options.sameTplBody":
      "template_slug + background_url_override. La disposición no cambia; solo la imagen.",
    "docs.tpl.options.note":
      "Envía solo uno de template_slug, template_id o template. Mandar más de uno responde 400.",
    "docs.tpl.fields.title": "Propiedades de los campos de plantilla",
    "docs.tpl.req.title": "Descubrir los campos obligatorios",
    "docs.tpl.req.body":
      "No requiere autenticación. Devuelve required_keys y el fields_json completo, así sabes exactamente qué valores enviar y dónde van a aparecer.",
    "docs.tpl.inline.title": "Ejemplo: crear una plantilla en línea",
    "docs.tpl.inline.body":
      "Úsalo la primera vez que quieras una disposición propia. De ahí en adelante la reutilizas con template_slug.",
    "docs.tpl.inline.qr":
      "El código QR se añade automáticamente en la esquina superior derecha — deja esa zona libre en tu fondo.",
    "docs.tpl.reuse.title": "Ejemplo: reutilizar una plantilla existente",

    "docs.t.slug": "Slug único (global). Después se usa como template_slug.",
    "docs.t.name": "Nombre legible",
    "docs.t.bg": "URL de la imagen de fondo (PNG o JPG)",
    "docs.t.pw":
      "Ancho de página, mismas unidades que la imagen. Por defecto: 595",
    "docs.t.ph": "Alto de página. Por defecto: 842",
    "docs.t.fields": "Arreglo con la definición de los campos",
    "docs.t.key": "Corresponde a una clave dentro de values{}",
    "docs.t.x": "Posición horizontal desde la izquierda",
    "docs.t.y": "Posición vertical desde arriba",
    "docs.t.width": "Ancho de la caja de texto",
    "docs.t.fontSize": "Tamaño de fuente. Por defecto: 12",
    "docs.t.fontColor": "Color en hexadecimal. Por defecto: #000000",
    "docs.t.align": "left · center · right. Por defecto: left",
    "docs.t.required":
      "Si es true, la emisión falla cuando la clave no viene en values",
    "docs.t.bold": "Por defecto: false",

    // ── Vista previa ──
    "docs.prev.title": "Vista previa de plantillas",
    "docs.prev.lead":
      "Antes de emitir credenciales reales, mira cómo queda tu certificado. Sin costo, sin blockchain y sin registro — solo un PDF con marca de agua.",
    "docs.prev.url.title": "Vista previa por URL",
    "docs.prev.url.body":
      "Abre una URL con el slug de la plantilla y los valores de los campos como parámetros:",
    "docs.prev.url.note":
      'La página arma el PDF en tiempo real con una marca de agua "VISTA PREVIA" ("PREVIEW" en inglés). Puedes descargarlo, y el QR del PDF apunta de vuelta a la misma URL de vista previa.',
    "docs.prev.api.title": "Vista previa por API",
    "docs.prev.api.noAuth": "No requiere autenticación.",
    "docs.prev.api.note":
      "Devuelve un PDF con la marca de agua. Úsalo para comprobar la posición de los campos antes de emitir.",
    "docs.p.bg": "Reemplaza el fondo por defecto de la plantilla",
    "docs.p.fields": "Pares clave-valor para cada campo de la plantilla",
    "docs.p.locale": '"en" o "es" — define el idioma de la marca de agua',

    // ── verify ──
    "docs.verify.lead":
      "Verificación completa en tres capas: el contrato on-chain, el hash de contenido en IPFS y la base de datos. Si alguna capa no coincide, la credencial queda marcada. Gratis, sin autenticación.",
    "docs.verify.response.title": "Respuesta 200",
    "docs.verify.status.title": "valores de status",
    "docs.verify.other.title": "Otros endpoints",
    "docs.verify.note.contract": "Solo blockchain",
    "docs.verify.note.ipfs": "Chequeo de integridad en IPFS",
    "docs.verify.note.pdf": "Descarga el PDF. Añade ?inline=1 para verlo",
    "docs.s.active": "Válida, sin revocar y sin vencer",
    "docs.s.revoked": "Revocada explícitamente on-chain",
    "docs.s.expired": "Pasó su expires_at",
    "docs.s.notFound": "No está registrada on-chain",
    "docs.s.unknown": "No se pudo alcanzar el contrato",

    // ── entities ──
    "docs.entities.lead":
      "Devuelve los datos de la entidad y su estado de verificación. {id} puede ser un UUID o un slug. Gratis, sin autenticación.",
    "docs.entities.status.title": "valores de status",
    "docs.es.unverified": "Registrada pero todavía sin verificar",
    "docs.es.individual": "Verificada como persona",
    "docs.es.organization": "Verificada como organización",
    "docs.es.suspended": "Suspendida por HashProof",

    // ── verificación de entidad ──
    "docs.ev.title": "Verificación de entidad",
    "docs.ev.lead":
      "Las organizaciones y las personas pueden verificar su identidad con HashProof. Los emisores verificados muestran un sello de verificado en cada credencial que emiten.",
    "docs.ev.how.title": "Cómo solicitar la verificación",
    "docs.ev.how.action": "Solicitar verificación",
    "docs.ev.how.1": "Ve a la página de tu entidad: {path}",
    "docs.ev.how.2": "Haz clic en {action}.",
    "docs.ev.how.3":
      "Llena el formulario (organización o persona) y paga $49 USDC.",
    "docs.ev.how.4": "HashProof revisa la solicitud y la aprueba a mano.",
    "docs.ev.how.5":
      "Publica en tu dominio el registro TXT que te damos. Esto es lo que permite a cualquiera confirmar que el dominio es tuyo sin fiarse de nosotros.",
    "docs.ev.how.6":
      "Con las dos comprobaciones superadas, tu entidad aparece como verificada y tus wallets quedan autorizadas.",
    "docs.ev.wallets.title": "Wallets autorizadas",
    "docs.ev.wallets.body":
      "Al verificar tu entidad declaras qué wallets EVM pueden emitir credenciales en tu nombre. Solo esas wallets pueden llamar a {endpoint} con tu {field}.",
  },
};
