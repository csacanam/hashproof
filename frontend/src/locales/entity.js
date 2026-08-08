/**
 * Translations for the issuer profile (/entities/:id).
 *
 * This is the page an issuer lands on to prove their domain, and the one a
 * reader reaches from a credential to see who issued it. It was the last
 * user-facing page still English-only, which for a product whose customers are
 * Spanish-speaking was the wrong place to leave untranslated.
 */

export const entityMessages = {
  en: {
    "entity.meta.title": "{name} on HashProof",
    "entity.meta.titleGeneric": "Entity profile | HashProof",
    "entity.meta.notFoundTitle": "Entity not found | HashProof",
    "entity.meta.description":
      "View a public entity profile on HashProof. Entities on HashProof can issue or manage verifiable credentials with an API.",
    "entity.flag.verified": "verified",
    "entity.flag.reviewed": "reviewed — domain pending",
    "entity.flag.unverified": "unverified",
    "entity.flag.suspended": "suspended",
    "entity.state.loading": "Loading entity…",
    "entity.state.notFound": "Entity not found",
    "entity.state.fetchFailed": "Failed to fetch",
    "entity.back": "← Back to home",

    "entity.activity.one": "credential issued",
    "entity.activity.many": "credentials issued",
    "entity.activity.since": "since {date}",

    "entity.verified.title": "What we verified",
    "entity.verified.identity": "Organization identity",
    "entity.verified.identityNone": "Not reviewed yet.",
    "entity.verified.identityDone":
      "Reviewed by HashProof — that the organization is real and this domain is theirs.",
    "entity.verified.identityDoneOn":
      "Reviewed by HashProof on {date} — that the organization is real and this domain is theirs.",
    "entity.verified.domain": "Domain control",
    "entity.verified.domainBody":
      "Proven by a DNS record, checked live — the half anyone can confirm without trusting us, and which lapses on its own if the domain moves.",
    "entity.verified.noDomainYet":
      "The domain is established when the organization is verified, so there is nothing to prove here yet.",

    "entity.dns.check": "Check it yourself",
    "entity.dns.checkBody":
      "Resolve the domain's TXT records and look for this value — no need to take our word for it.",
    "entity.dns.verifyThis": "Verify this domain",
    "entity.dns.checking": "Checking…",
    "entity.dns.checkAgain": "Check again",
    "entity.dns.add": "Add this record in the DNS settings for",
    "entity.dns.thenCheck":
      ", then check again. Changes can take a few minutes to propagate.",
    "entity.dns.type": "Type",
    "entity.dns.name": "Name",
    "entity.dns.value": "Value",
    "entity.dns.nameHint":
      "the root domain — some providers want {domain} instead, or leave it blank",
    "entity.dns.coexists":
      "It sits alongside any TXT records you already have, such as email.",
    "entity.dns.copy": "Copy",
    "entity.dns.copied": "Copied",
    "entity.dns.verifiedNow":
      "✓ Domain verified. It now appears on every credential this issuer signs.",
    "entity.dns.missing":
      "Not visible yet. We just looked and the record is not there — if you have only added it, DNS usually takes a few minutes to propagate, so check again shortly. If it has been longer, confirm the value matches exactly and that it is on the root domain.",
    "entity.dns.addFailed": "Could not add the domain",

    "entity.details.website": "Website",
    "entity.details.createdAt": "Created at",
    "entity.details.entityId": "Entity ID",

    "entity.request.lead":
      "Verify this issuer to increase trust in your credentials.",
    "entity.request.button": "Request verification",
    "entity.modal.intro.body":
      "Choose whether this request is for an organization or an individual.",
    "entity.modal.fee": "Verification request fee:",
    "entity.modal.type": "Verification type",
    "entity.modal.typePlaceholder": "Select type",
    "entity.modal.individual": "Individual",
    "entity.modal.organization": "Organization",
    "entity.modal.cancel": "Cancel",
    "entity.modal.continue": "Continue",
    "entity.modal.back": "Back",
    "entity.modal.close": "Close",

    "entity.modal.details.title": "Your details",
    "entity.form.orgName": "Organization name",
    "entity.form.orgNameHelp":
      "The name of the organization that issues credentials.",
    "entity.form.orgNamePlaceholder": "ACME Inc.",
    "entity.form.websiteHelp":
      "The official website of the organization. This is the domain you will prove control of by DNS — verification is not complete until you do.",
    "entity.form.websitePlaceholder": "https://example.org",
    "entity.form.invalidUrl": "Enter a valid URL (e.g. https://example.org).",
    "entity.form.invalidProfileUrl":
      "Enter a valid URL (e.g. https://example.org/your-profile).",
    "entity.form.invalidLinkedin":
      "Enter a valid URL (e.g. https://linkedin.com/in/yourname).",
    "entity.form.contactName": "Contact full name",
    "entity.form.contactNameHelp":
      "The person requesting verification for this organization.",
    "entity.form.contactNamePlaceholder": "Full name of the requester",
    "entity.form.contactEmail": "Contact email",
    "entity.form.contactEmailPlaceholder": "you@example.com",
    "entity.form.emailMustMatch": "Must match the website domain (e.g.",
    "entity.form.country": "Country",
    "entity.form.countryHelpOrg": "Country where the organization operates.",
    "entity.form.countryPlaceholderOrg":
      "Country where the organization operates",
    "entity.form.countryHelpIndividual":
      "Country where you operate or are primarily based.",
    "entity.form.countryPlaceholderIndividual": "Country where you are based",
    "entity.form.role": "Role in the organization",
    "entity.form.roleHelp": "Your role or relationship with the organization.",
    "entity.form.rolePlaceholder":
      "Your role or relationship with the organization",
    "entity.form.supportLink": "Supporting link",
    "entity.form.supportLinkPlaceholder": "https://example.org/your-profile",
    "entity.form.wallets": "Authorized wallets",
    "entity.form.walletsHelpOrg":
      "The only wallets allowed to sign on behalf of this organization in HashProof (one address per line).",
    "entity.form.walletsHelpIndividual":
      "The only wallets allowed to sign on your behalf as an individual issuer in HashProof (one address per line).",
    "entity.form.fullName": "Full name",
    "entity.form.fullNameHelp":
      "The name that will appear as the issuer of credentials.",
    "entity.form.fullNamePlaceholder": "Full name as issuer",
    "entity.form.profile": "Public profile or website",
    "entity.form.profilePlaceholder": "https://your-site-or-profile",
    "entity.form.profileHelp":
      "A public profile or website where we can verify your identity.",
    "entity.form.emailContactHelp":
      "We may contact you if additional verification is required.",

    "entity.modal.pay.title": "Review & pay",
    "entity.modal.pay.amount": "Amount due:",
    "entity.modal.pay.gasless": "⛽ No gas fees for this transaction.",
    "entity.modal.pay.nextStep": "One more step after this.",
    "entity.modal.pay.nextStepBody":
      "Reviewing your organization is half of it. To be shown as verified you also publish a TXT record on {domain}, which is what lets anyone confirm the domain is yours without taking our word for it. We hand you the record once the review is approved.",
    "entity.modal.pay.payWith": "Pay with",
    "entity.modal.pay.on": "on",
    "entity.modal.pay.wallet": "Wallet",
    "entity.modal.pay.disconnect": "Disconnect",
    "entity.modal.pay.balance": "Balance",
    "entity.modal.submitted.title": "Request submitted",
    "entity.modal.done": "Done",

    "entity.error.selectType": "Please select a verification type.",
    "entity.error.completeFields":
      "Please complete all fields before continuing.",
    "entity.error.oneWallet":
      "Please add at least one authorized wallet address.",
    "entity.error.walletFormat":
      "Authorized wallets must be valid EVM addresses (0x...) with one address per line.",
    "entity.error.personalEmail":
      "Personal email providers are not accepted for organization verification.",
    "entity.error.requestFailed": "Request failed. Please try again.",
    "entity.modal.step": "Step {n} of 3",
    "entity.modal.thisEntity": "this entity",
    "entity.modal.intro.requesting": "You are requesting verification for",
    "entity.modal.intro.spam":
      "This fee helps prevent spam and covers the review process. Submitting a request does not guarantee approval.",
    "entity.form.emailExample": "you@yourorg.com",
    "entity.form.emailRejected":
      "). Personal providers like Gmail or Outlook will be rejected.",
    "entity.form.supportLinkHelp":
      "A link showing your relationship with the organization — your profile on the organization website, a LinkedIn listing, or an event page where you appear.",
    "entity.modal.pay.submittingPrefix": "You are submitting a",
    "entity.modal.pay.submittingMid": "verification request for",
    "entity.modal.pay.yourDomain": "your domain",
    "entity.modal.pay.loadingBalance": "Loading…",
    "entity.modal.pay.insufficient":
      "Insufficient {token} balance on {chain}. You need at least ${amount} {token} to proceed.",
    "entity.modal.pay.connect": "Connect Wallet",
    "entity.modal.pay.processing": "Processing…",
    "entity.modal.pay.submit": "Submit & Pay",
    "entity.modal.submitted.prefix": "Your verification request for",
    "entity.modal.submitted.suffix":
      "has been submitted. We will review it and get back to you.",
  },

  es: {
    "entity.meta.title": "{name} en HashProof",
    "entity.meta.titleGeneric": "Perfil de entidad | HashProof",
    "entity.meta.notFoundTitle": "Entidad no encontrada | HashProof",
    "entity.meta.description":
      "Consulta el perfil público de una entidad en HashProof. Las entidades pueden emitir o gestionar credenciales verificables con una API.",
    "entity.flag.verified": "verificado",
    "entity.flag.reviewed": "revisado — falta el dominio",
    "entity.flag.unverified": "sin verificar",
    "entity.flag.suspended": "suspendido",
    "entity.state.loading": "Cargando entidad…",
    "entity.state.notFound": "Entidad no encontrada",
    "entity.state.fetchFailed": "No se pudo cargar",
    "entity.back": "← Volver al inicio",

    "entity.activity.one": "credencial emitida",
    "entity.activity.many": "credenciales emitidas",
    "entity.activity.since": "desde {date}",

    "entity.verified.title": "Qué hemos verificado",
    "entity.verified.identity": "Identidad de la organización",
    "entity.verified.identityNone": "Aún sin revisar.",
    "entity.verified.identityDone":
      "Revisada por HashProof — que la organización es real y que este dominio es suyo.",
    "entity.verified.identityDoneOn":
      "Revisada por HashProof el {date} — que la organización es real y que este dominio es suyo.",
    "entity.verified.domain": "Control del dominio",
    "entity.verified.domainBody":
      "Probado con un registro DNS, comprobado en vivo — la mitad que cualquiera puede confirmar sin fiarse de nosotros, y que deja de valer sola si el dominio cambia de manos.",
    "entity.verified.noDomainYet":
      "El dominio se establece al verificar la organización, así que todavía no hay nada que probar aquí.",

    "entity.dns.check": "Compruébalo tú mismo",
    "entity.dns.checkBody":
      "Resuelve los registros TXT del dominio y busca este valor — no hace falta que nos creas.",
    "entity.dns.verifyThis": "Verificar este dominio",
    "entity.dns.checking": "Comprobando…",
    "entity.dns.checkAgain": "Comprobar de nuevo",
    "entity.dns.add": "Añade este registro en la configuración DNS de",
    "entity.dns.thenCheck":
      ", y vuelve a comprobar. Los cambios pueden tardar unos minutos en propagarse.",
    "entity.dns.type": "Tipo",
    "entity.dns.name": "Nombre",
    "entity.dns.value": "Valor",
    "entity.dns.nameHint":
      "el dominio raíz — algunos proveedores piden {domain}, o dejarlo vacío",
    "entity.dns.coexists":
      "Convive con los registros TXT que ya tengas, como los del correo.",
    "entity.dns.copy": "Copiar",
    "entity.dns.copied": "Copiado",
    "entity.dns.verifiedNow":
      "✓ Dominio verificado. Ya aparece en cada credencial que firme este emisor.",
    "entity.dns.missing":
      "Todavía no es visible. Acabamos de mirar y el registro no está — si lo acabas de añadir, el DNS suele tardar unos minutos en propagarse, así que vuelve a comprobar en un rato. Si ya llevas más tiempo, confirma que el valor coincide exactamente y que está en el dominio raíz.",
    "entity.dns.addFailed": "No se pudo añadir el dominio",

    "entity.details.website": "Sitio web",
    "entity.details.createdAt": "Fecha de creación",
    "entity.details.entityId": "ID de entidad",

    "entity.request.lead":
      "Verifica este emisor para dar más confianza a tus credenciales.",
    "entity.request.button": "Solicitar verificación",
    "entity.modal.intro.body":
      "Elige si la solicitud es para una organización o para una persona.",
    "entity.modal.fee": "Costo de la solicitud:",
    "entity.modal.type": "Tipo de verificación",
    "entity.modal.typePlaceholder": "Selecciona el tipo",
    "entity.modal.individual": "Persona",
    "entity.modal.organization": "Organización",
    "entity.modal.cancel": "Cancelar",
    "entity.modal.continue": "Continuar",
    "entity.modal.back": "Atrás",
    "entity.modal.close": "Cerrar",

    "entity.modal.details.title": "Tus datos",
    "entity.form.orgName": "Nombre de la organización",
    "entity.form.orgNameHelp":
      "El nombre de la organización que emite las credenciales.",
    "entity.form.orgNamePlaceholder": "ACME S.A.S.",
    "entity.form.websiteHelp":
      "El sitio web oficial de la organización. Este es el dominio del que probarás control por DNS — la verificación no está completa hasta que lo hagas.",
    "entity.form.websitePlaceholder": "https://ejemplo.org",
    "entity.form.invalidUrl":
      "Escribe una URL válida (p. ej. https://ejemplo.org).",
    "entity.form.invalidProfileUrl":
      "Escribe una URL válida (p. ej. https://ejemplo.org/tu-perfil).",
    "entity.form.invalidLinkedin":
      "Escribe una URL válida (p. ej. https://linkedin.com/in/tunombre).",
    "entity.form.contactName": "Nombre completo del contacto",
    "entity.form.contactNameHelp":
      "La persona que solicita la verificación de esta organización.",
    "entity.form.contactNamePlaceholder": "Nombre completo de quien solicita",
    "entity.form.contactEmail": "Correo de contacto",
    "entity.form.contactEmailPlaceholder": "tu@ejemplo.com",
    "entity.form.emailMustMatch":
      "Debe coincidir con el dominio del sitio web (p. ej.",
    "entity.form.country": "País",
    "entity.form.countryHelpOrg": "País donde opera la organización.",
    "entity.form.countryPlaceholderOrg": "País donde opera la organización",
    "entity.form.countryHelpIndividual":
      "País donde operas o resides principalmente.",
    "entity.form.countryPlaceholderIndividual": "País donde resides",
    "entity.form.role": "Cargo en la organización",
    "entity.form.roleHelp": "Tu cargo o relación con la organización.",
    "entity.form.rolePlaceholder": "Tu cargo o relación con la organización",
    "entity.form.supportLink": "Enlace de respaldo",
    "entity.form.supportLinkPlaceholder": "https://ejemplo.org/tu-perfil",
    "entity.form.wallets": "Wallets autorizadas",
    "entity.form.walletsHelpOrg":
      "Las únicas wallets que podrán firmar en nombre de esta organización en HashProof (una dirección por línea).",
    "entity.form.walletsHelpIndividual":
      "Las únicas wallets que podrán firmar en tu nombre como emisor individual en HashProof (una dirección por línea).",
    "entity.form.fullName": "Nombre completo",
    "entity.form.fullNameHelp":
      "El nombre que aparecerá como emisor de las credenciales.",
    "entity.form.fullNamePlaceholder": "Nombre completo como emisor",
    "entity.form.profile": "Perfil público o sitio web",
    "entity.form.profilePlaceholder": "https://tu-sitio-o-perfil",
    "entity.form.profileHelp":
      "Un perfil público o sitio web donde podamos verificar tu identidad.",
    "entity.form.emailContactHelp":
      "Podríamos contactarte si hace falta verificación adicional.",

    "entity.modal.pay.title": "Revisar y pagar",
    "entity.modal.pay.amount": "Total a pagar:",
    "entity.modal.pay.gasless": "⛽ Sin comisiones de gas en esta transacción.",
    "entity.modal.pay.nextStep": "Falta un paso después de esto.",
    "entity.modal.pay.nextStepBody":
      "Revisar tu organización es la mitad. Para aparecer como verificado también publicas un registro TXT en {domain}, que es lo que permite a cualquiera confirmar que el dominio es tuyo sin fiarse de nuestra palabra. Te damos el registro en cuanto se apruebe la revisión.",
    "entity.modal.pay.payWith": "Pagar con",
    "entity.modal.pay.on": "en",
    "entity.modal.pay.wallet": "Wallet",
    "entity.modal.pay.disconnect": "Desconectar",
    "entity.modal.pay.balance": "Saldo",
    "entity.modal.submitted.title": "Solicitud enviada",
    "entity.modal.done": "Listo",

    "entity.error.selectType": "Selecciona un tipo de verificación.",
    "entity.error.completeFields":
      "Completa todos los campos antes de continuar.",
    "entity.error.oneWallet":
      "Añade al menos una dirección de wallet autorizada.",
    "entity.error.walletFormat":
      "Las wallets autorizadas deben ser direcciones EVM válidas (0x...), una por línea.",
    "entity.error.personalEmail":
      "No se aceptan correos personales para verificar una organización.",
    "entity.error.requestFailed": "La solicitud falló. Inténtalo de nuevo.",
    "entity.modal.step": "Paso {n} de 3",
    "entity.modal.thisEntity": "esta entidad",
    "entity.modal.intro.requesting": "Estás solicitando la verificación de",
    "entity.modal.intro.spam":
      "Este costo ayuda a evitar spam y cubre el proceso de revisión. Enviar una solicitud no garantiza la aprobación.",
    "entity.form.emailExample": "tu@tuorganizacion.com",
    "entity.form.emailRejected":
      "). No se aceptan proveedores personales como Gmail u Outlook.",
    "entity.form.supportLinkHelp":
      "Un enlace que muestre tu relación con la organización — tu perfil en el sitio web de la organización, una ficha de LinkedIn, o la página de un evento donde apareces.",
    "entity.modal.pay.submittingPrefix":
      "Estás enviando una solicitud de verificación de",
    "entity.modal.pay.submittingMid": "para",
    "entity.modal.pay.yourDomain": "tu dominio",
    "entity.modal.pay.loadingBalance": "Cargando…",
    "entity.modal.pay.insufficient":
      "Saldo insuficiente de {token} en {chain}. Necesitas al menos ${amount} {token} para continuar.",
    "entity.modal.pay.connect": "Conectar wallet",
    "entity.modal.pay.processing": "Procesando…",
    "entity.modal.pay.submit": "Enviar y pagar",
    "entity.modal.submitted.prefix": "Tu solicitud de verificación de",
    "entity.modal.submitted.suffix":
      "fue enviada. La revisaremos y te contactaremos.",
  },
};
