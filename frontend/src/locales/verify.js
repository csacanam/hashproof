/**
 * Translations for the verification page (/verify/:id).
 * Keys are used in Verify.jsx via t("key").
 */

export const verifyMessages = {
  en: {
    // Loading
    "verify.verifying": "Verifying credential…",
    "verify.poweredBy": "Powered by HashProof",
    "verify.step.checking": "Checking…",
    "verify.step.done": "Done",
    "verify.step.error": "Error",
    "verify.step.waiting": "Waiting…",
    "verify.step.1": "1. Checking blockchain record",
    "verify.step.2": "2. Retrieving credential data",
    "verify.step.3": "3. Verifying data integrity",

    // Error
    "verify.backHome": "← Back to home",
    "verify.error.notFound": "Credential not found",
    "verify.error.generic": "Failed to verify credential",

    // PDF
    "verify.loadingPdf": "Loading PDF…",
    "verify.download": "Download",
    "verify.verify": "Verify",
    "verify.credentialTitle": "Credential",

    // Share
    "verify.share.title": "Share your achievement",
    "verify.share.linkedin": "Add to LinkedIn",
    "verify.share.copy": "Copy link",
    "verify.share.copied": "Link copied",
    "verify.share.text": "I earned this credential, verifiable on HashProof:",
    "verify.share.on.whatsapp": "Share on WhatsApp",
    "verify.share.on.telegram": "Share on Telegram",
    "verify.share.on.x": "Share on X",
    "verify.share.on.facebook": "Share on Facebook",

    // Card
    "verify.detailsTitle": "Verification details",
    "verify.warning.notVerified": "This credential could not be verified.",
    "verify.warning.expired": "This credential has expired.",
    "verify.warning.revoked": "This credential has been revoked by the issuer.",
    "verify.warning.suspended": "One or more entities involved in issuing this credential have been suspended by HashProof. Exercise caution.",
    "verify.warning.unverifiedEntities": "This credential is authentic, but some entities involved in issuing it have not been verified.",
    "verify.warning.domainPending": "This credential is authentic and HashProof reviewed the organizations behind it. They have not yet proven control of their domain, which is the last step of verification.",

    // Details labels
    "verify.label.credential": "Credential",
    "verify.label.issuer": "Issuer",
    "verify.label.platform": "Platform",
    "verify.label.recipient": "Recipient",
    "verify.label.activity": "Activity",
    "verify.label.issuedDate": "Issued date",
    "verify.label.expirationDate": "Expiration date",
    "verify.label.noExpiration": "No expiration",
    "verify.label.blockchainRecord": "Blockchain Record",
    "verify.label.viewTransaction": "View transaction",
    "verify.label.ipfsBackup": "IPFS Backup",
    "verify.label.viewOnIpfs": "View on IPFS",

    // Status
    "verify.status.verified": "Verified",
    "verify.status.reviewed": "Reviewed — domain pending",
    "verify.status.suspended": "Suspended",
    "verify.status.unverified": "Unverified",
    "verify.link.startVerification": "Start verification",
    "verify.link.completeVerification": "Complete verification",

    // Tooltips - credential status
    "verify.tooltip.active": "This credential is valid on the blockchain. The record exists and has not been revoked or expired.",
    "verify.tooltip.revoked": "This credential was revoked by the issuer on the blockchain.",
    "verify.tooltip.expired": "This credential has expired based on its validity period.",
    "verify.tooltip.notFound": "This credential could not be fully verified. The blockchain record may be missing or temporarily unavailable.",

    // Tooltips - issuer
    "verify.tooltip.issuerVerified": "HashProof reviewed this organization, and it has proven control of its domain by DNS — something you can confirm yourself, without trusting us.",
    "verify.tooltip.issuerReviewed": "HashProof reviewed this organization, but it has not yet proven control of its domain. Verification completes when it publishes the DNS record.",
    "verify.tooltip.issuerSuspended": "This issuer has been suspended by HashProof. Exercise caution with credentials issued by this entity.",
    "verify.tooltip.issuerUnverified": "The issuer has not been verified by HashProof. The credential may still be valid if the blockchain record matches.",

    // Tooltips - platform
    "verify.tooltip.platformVerified": "HashProof reviewed this platform, and it has proven control of its domain by DNS — something you can confirm yourself, without trusting us.",
    "verify.tooltip.platformReviewed": "HashProof reviewed this platform, but it has not yet proven control of its domain. Verification completes when it publishes the DNS record.",
    "verify.tooltip.platformSuspended": "This platform has been suspended by HashProof. Exercise caution with credentials issued through this platform.",
    "verify.tooltip.platformUnverified": "This platform has not been verified by HashProof. Credentials issued through it should be reviewed carefully.",
  },

  es: {
    // Loading
    "verify.verifying": "Verificando credencial…",
    "verify.poweredBy": "Desarrollado por HashProof",
    "verify.step.checking": "Comprobando…",
    "verify.step.done": "Listo",
    "verify.step.error": "Error",
    "verify.step.waiting": "Esperando…",
    "verify.step.1": "1. Comprobando registro en blockchain",
    "verify.step.2": "2. Obteniendo datos de la credencial",
    "verify.step.3": "3. Verificando integridad de datos",

    // Error
    "verify.backHome": "← Volver al inicio",
    "verify.error.notFound": "Credencial no encontrada",
    "verify.error.generic": "No se pudo verificar la credencial",

    // PDF
    "verify.loadingPdf": "Cargando PDF…",
    "verify.download": "Descargar",
    "verify.verify": "Verificar",
    "verify.credentialTitle": "Credencial",

    // Share
    "verify.share.title": "Comparte tu logro",
    "verify.share.linkedin": "Añadir a LinkedIn",
    "verify.share.copy": "Copiar enlace",
    "verify.share.copied": "Enlace copiado",
    "verify.share.text": "Obtuve esta credencial, verificable en HashProof:",
    "verify.share.on.whatsapp": "Compartir en WhatsApp",
    "verify.share.on.telegram": "Compartir en Telegram",
    "verify.share.on.x": "Compartir en X",
    "verify.share.on.facebook": "Compartir en Facebook",

    // Card
    "verify.detailsTitle": "Detalles de verificación",
    "verify.warning.notVerified": "No se pudo verificar esta credencial.",
    "verify.warning.expired": "Esta credencial ha caducado.",
    "verify.warning.revoked": "Esta credencial ha sido revocada por el emisor.",
    "verify.warning.suspended": "Una o más entidades que participaron en la emisión de esta credencial han sido suspendidas por HashProof. Tenga precaución.",
    "verify.warning.unverifiedEntities": "Esta credencial es auténtica, pero algunas entidades que participaron en su emisión no han sido verificadas.",
    "verify.warning.domainPending": "Esta credencial es auténtica y HashProof revisó las organizaciones que la emitieron. Aún no han probado el control de su dominio, que es el último paso de la verificación.",

    // Details labels
    "verify.label.credential": "Credencial",
    "verify.label.issuer": "Emisor",
    "verify.label.platform": "Plataforma",
    "verify.label.recipient": "Destinatario",
    "verify.label.activity": "Actividad",
    "verify.label.issuedDate": "Fecha de emisión",
    "verify.label.expirationDate": "Fecha de caducidad",
    "verify.label.noExpiration": "Sin caducidad",
    "verify.label.blockchainRecord": "Registro en blockchain",
    "verify.label.viewTransaction": "Ver transacción",
    "verify.label.ipfsBackup": "Copia en IPFS",
    "verify.label.viewOnIpfs": "Ver en IPFS",

    // Status
    "verify.status.verified": "Verificado",
    "verify.status.reviewed": "Revisado — falta dominio",
    "verify.status.suspended": "Suspendido",
    "verify.status.unverified": "No verificado",
    "verify.link.startVerification": "Iniciar verificación",
    "verify.link.completeVerification": "Completar verificación",

    // Tooltips - credential status
    "verify.tooltip.active": "Esta credencial es válida en la blockchain. El registro existe y no ha sido revocado ni ha caducado.",
    "verify.tooltip.revoked": "Esta credencial fue revocada por el emisor en la blockchain.",
    "verify.tooltip.expired": "Esta credencial ha caducado según su período de validez.",
    "verify.tooltip.notFound": "No se pudo verificar completamente esta credencial. El registro en blockchain puede no existir o no estar disponible temporalmente.",

    // Tooltips - issuer
    "verify.tooltip.issuerVerified": "HashProof revisó esta organización, y ha probado el control de su dominio por DNS — algo que puedes comprobar tú mismo, sin fiarte de nosotros.",
    "verify.tooltip.issuerReviewed": "HashProof revisó esta organización, pero aún no ha probado el control de su dominio. La verificación se completa cuando publique el registro DNS.",
    "verify.tooltip.issuerSuspended": "Este emisor ha sido suspendido por HashProof. Tenga precaución con las credenciales emitidas por esta entidad.",
    "verify.tooltip.issuerUnverified": "El emisor no ha sido verificado por HashProof. La credencial puede seguir siendo válida si el registro en blockchain coincide.",

    // Tooltips - platform
    "verify.tooltip.platformVerified": "HashProof revisó esta plataforma, y ha probado el control de su dominio por DNS — algo que puedes comprobar tú mismo, sin fiarte de nosotros.",
    "verify.tooltip.platformReviewed": "HashProof revisó esta plataforma, pero aún no ha probado el control de su dominio. La verificación se completa cuando publique el registro DNS.",
    "verify.tooltip.platformSuspended": "Esta plataforma ha sido suspendida por HashProof. Tenga precaución con las credenciales emitidas a través de ella.",
    "verify.tooltip.platformUnverified": "Esta plataforma no ha sido verificada por HashProof. Las credenciales emitidas a través de ella deben revisarse con cuidado.",
  },
};
