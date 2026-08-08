/**
 * Translations for the "get verified" explainer (/entity-verification).
 *
 * The copy also had to be brought up to date: it described verification as
 * ending at our review, which stopped being true when domain proof shipped.
 * A page that promises a badge after step 5 and then does not deliver one is
 * worse than an untranslated page.
 */

export const entityVerificationMessages = {
  en: {
    "ev.meta.title": "Get verified as an issuer | HashProof",
    "ev.meta.description":
      "How to become a verified issuer on HashProof: review of your organization plus a DNS record proving you control your domain. $49, no subscription.",

    "ev.badge": "Entity verification",
    "ev.h1": "Get verified on HashProof",
    "ev.lead":
      "A verified badge on every credential you issue — so recipients and verifiers know your identity has been reviewed and that the domain behind it is really yours.",

    "ev.why.title": "Why verify?",
    "ev.why.badge.title": "Verified badge on every credential",
    "ev.why.badge.body":
      "Your credentials show a verified issuer badge when anyone scans the QR code or opens the verification page.",
    "ev.why.wallets.title": "Authorized wallets",
    "ev.why.wallets.body":
      "Only the wallets you declare can issue credentials on your behalf — nobody can pass themselves off as your organization.",
    "ev.why.trust.title": "Trust that does not depend on us",
    "ev.why.trust.body":
      "Anyone reading a credential can resolve your domain's DNS record themselves and confirm it is yours, without taking our word for it.",

    "ev.types.title": "Types of verification",
    "ev.types.individual": "Individual",
    "ev.types.individualDesc":
      "For freelancers, educators, or professionals issuing credentials as a person.",
    "ev.types.individual.name": "Full legal name",
    "ev.types.individual.profile": "Public profile or website",
    "ev.types.individual.email": "Contact email",
    "ev.types.individual.country": "Country",
    "ev.types.individual.wallets": "Authorized EVM wallet addresses",
    "ev.types.org": "Organization",
    "ev.types.orgDesc":
      "For companies, schools, DAOs, or platforms issuing on behalf of an institution.",
    "ev.types.org.name": "Legal organization name",
    "ev.types.org.website":
      "Corporate website — this is the domain you will prove control of",
    "ev.types.org.contact": "Contact person's name and role",
    "ev.types.org.email": "Contact email (the domain must match the website)",
    "ev.types.org.country": "Country",
    "ev.types.org.support":
      "Supporting link (your profile on the organization's site)",
    "ev.types.org.wallets": "Authorized EVM wallet addresses",

    "ev.how.title": "How it works",
    "ev.how.1.title": "Find your entity page",
    "ev.how.1.body":
      "Go to {url}. If your entity does not exist yet, it is created automatically the first time you issue a credential with your slug.",
    "ev.how.2.title": 'Click "Request verification"',
    "ev.how.2.body":
      "Fill in the form for an individual or an organization: contact details, website, and the EVM wallet addresses authorized to issue.",
    "ev.how.3.title": "Pay $49 USDC",
    "ev.how.3.body":
      "The request is submitted on-chain via x402. You pay in USDC on Base or Celo — no gas fees on your end.",
    "ev.how.4.title": "HashProof reviews your request",
    "ev.how.4.body":
      "We review submissions by hand within a few business days. We check that your email domain matches your website and that the organization is real.",
    "ev.how.5.title": "You publish a DNS record",
    "ev.how.5.body":
      "Once approved, we give you a TXT record to add to your domain. This is the half anyone can check without trusting us — and it lapses on its own if the domain moves to someone else.",
    "ev.how.6.title": "You are verified",
    "ev.how.6.body":
      "With both checks passed, your authorized wallets are activated and every credential you issue from then on shows the verified badge.",

    "ev.cta.title": "Ready to get verified?",
    "ev.cta.existing": "Already issued credentials?",
    "ev.cta.existingBody":
      "Your entity page is at {url}. Open it and click {action}.",
    "ev.cta.existingAction": "Request verification",
    "ev.cta.new": "New to HashProof?",
    "ev.cta.newBody":
      "Your entity is created automatically the first time you issue a credential. Start there, then come back to request verification.",
    "ev.cta.newButton": "Issue your first credential →",
  },

  es: {
    "ev.meta.title": "Verifícate como emisor | HashProof",
    "ev.meta.description":
      "Cómo convertirte en emisor verificado en HashProof: revisión de tu organización más un registro DNS que prueba que controlas tu dominio. $49, sin suscripción.",

    "ev.badge": "Verificación de entidad",
    "ev.h1": "Verifícate en HashProof",
    "ev.lead":
      "Un sello de verificado en cada credencial que emitas — para que quien la reciba y quien la verifique sepan que revisamos tu identidad y que el dominio detrás es realmente tuyo.",

    "ev.why.title": "¿Por qué verificarte?",
    "ev.why.badge.title": "Sello de verificado en cada credencial",
    "ev.why.badge.body":
      "Tus credenciales muestran el sello de emisor verificado cuando alguien escanea el código QR o abre la página de verificación.",
    "ev.why.wallets.title": "Wallets autorizadas",
    "ev.why.wallets.body":
      "Solo las wallets que declares pueden emitir credenciales en tu nombre — nadie puede hacerse pasar por tu organización.",
    "ev.why.trust.title": "Confianza que no depende de nosotros",
    "ev.why.trust.body":
      "Cualquiera que lea una credencial puede resolver por su cuenta el registro DNS de tu dominio y confirmar que es tuyo, sin fiarse de nuestra palabra.",

    "ev.types.title": "Tipos de verificación",
    "ev.types.individual": "Persona",
    "ev.types.individualDesc":
      "Para profesionales independientes, docentes o expertos que emiten credenciales a título personal.",
    "ev.types.individual.name": "Nombre legal completo",
    "ev.types.individual.profile": "Perfil público o sitio web",
    "ev.types.individual.email": "Correo de contacto",
    "ev.types.individual.country": "País",
    "ev.types.individual.wallets": "Direcciones de wallet EVM autorizadas",
    "ev.types.org": "Organización",
    "ev.types.orgDesc":
      "Para empresas, instituciones educativas, DAOs o plataformas que emiten en nombre de una institución.",
    "ev.types.org.name": "Razón social de la organización",
    "ev.types.org.website":
      "Sitio web corporativo — este es el dominio del que probarás control",
    "ev.types.org.contact": "Nombre y cargo de la persona de contacto",
    "ev.types.org.email":
      "Correo de contacto (el dominio debe coincidir con el sitio web)",
    "ev.types.org.country": "País",
    "ev.types.org.support":
      "Enlace de respaldo (tu perfil en el sitio de la organización)",
    "ev.types.org.wallets": "Direcciones de wallet EVM autorizadas",

    "ev.how.title": "Cómo funciona",
    "ev.how.1.title": "Encuentra la página de tu entidad",
    "ev.how.1.body":
      "Ve a {url}. Si tu entidad todavía no existe, se crea automáticamente la primera vez que emites una credencial con tu slug.",
    "ev.how.2.title": 'Haz clic en "Solicitar verificación"',
    "ev.how.2.body":
      "Llena el formulario de persona o de organización: datos de contacto, sitio web y las direcciones de wallet EVM autorizadas para emitir.",
    "ev.how.3.title": "Paga $49 USDC",
    "ev.how.3.body":
      "La solicitud se envía on-chain vía x402. Pagas en USDC sobre Base o Celo — sin comisiones de gas de tu lado.",
    "ev.how.4.title": "HashProof revisa tu solicitud",
    "ev.how.4.body":
      "Revisamos las solicitudes a mano en unos pocos días hábiles. Comprobamos que el dominio de tu correo coincida con tu sitio web y que la organización sea real.",
    "ev.how.5.title": "Publicas un registro DNS",
    "ev.how.5.body":
      "Una vez aprobada, te damos un registro TXT para añadir a tu dominio. Esta es la mitad que cualquiera puede comprobar sin fiarse de nosotros — y deja de valer sola si el dominio pasa a otras manos.",
    "ev.how.6.title": "Quedas verificado",
    "ev.how.6.body":
      "Con las dos comprobaciones superadas, se activan tus wallets autorizadas y cada credencial que emitas desde ese momento muestra el sello de verificado.",

    "ev.cta.title": "¿Listo para verificarte?",
    "ev.cta.existing": "¿Ya emitiste credenciales?",
    "ev.cta.existingBody":
      "La página de tu entidad está en {url}. Ábrela y haz clic en {action}.",
    "ev.cta.existingAction": "Solicitar verificación",
    "ev.cta.new": "¿Nuevo en HashProof?",
    "ev.cta.newBody":
      "Tu entidad se crea automáticamente la primera vez que emites una credencial. Empieza por ahí y vuelve a solicitar la verificación.",
    "ev.cta.newButton": "Emite tu primera credencial →",
  },
};
