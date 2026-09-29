/**
 * Emails HashProof sends itself, through SendGrid's HTTP API.
 *
 * Only on request: a credential is emailed to its holder when the issuance asks
 * for it (notify_holder), never by default — an integration that stores emails
 * for its own reasons must not start having its attendees mailed by us.
 *
 * Sign-in emails are not here: Supabase Auth sends those through its SMTP
 * settings.
 */

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

export function isMailerConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const COPY = {
  es: {
    subject: (c) => `Tu certificado: ${c.context}`,
    hello: (c) => `Hola, ${c.holder}:`,
    body: (c) => `${c.issuer} te entregó un certificado verificable por <strong>${c.context}</strong>. Cualquiera puede comprobar que es auténtico desde el enlace o el código QR del PDF.`,
    view: "Ver mi certificado",
    pdf: "Descargar el PDF",
    share: "Puedes compartir el enlace en LinkedIn o enviarlo a quien necesite verificarlo.",
    foot: (c) => `Enviado por HashProof en nombre de ${c.issuer}.`,
  },
  en: {
    subject: (c) => `Your certificate: ${c.context}`,
    hello: (c) => `Hi ${c.holder},`,
    body: (c) => `${c.issuer} issued you a verifiable certificate for <strong>${c.context}</strong>. Anyone can check it is authentic from the link or the QR code on the PDF.`,
    view: "View my certificate",
    pdf: "Download the PDF",
    share: "You can share the link on LinkedIn or send it to anyone who needs to verify it.",
    foot: (c) => `Sent by HashProof on behalf of ${c.issuer}.`,
  },
};

export function credentialEmail({ locale, holder, issuer, context, verificationUrl, pdfUrl }) {
  const L = COPY[locale === "en" ? "en" : "es"];
  const c = { holder: esc(holder), issuer: esc(issuer), context: esc(context) };
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background:#0a0a0b;padding:24px 32px;"><img src="https://www.hashproof.dev/hashproof-logo.png" alt="HashProof" height="30" style="display:block;height:30px;border:0;"></td></tr>
<tr><td style="height:3px;background:#22d3ee;"></td></tr>
<tr><td style="padding:28px 32px 32px;font-size:15px;line-height:1.6;color:#3f3f46;">
<p style="margin:0 0 12px;color:#0a0a0b;font-weight:600;">${L.hello(c)}</p>
<p style="margin:0 0 24px;">${L.body(c)}</p>
<p style="margin:0 0 12px;"><a href="${esc(verificationUrl)}" style="display:inline-block;background:#0a0a0b;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px;">${L.view}</a></p>
<p style="margin:0 0 24px;"><a href="${esc(pdfUrl)}" style="color:#0a0a0b;">${L.pdf}</a></p>
<p style="margin:0;font-size:13px;color:#71717a;">${L.share}</p>
</td></tr></table>
<p style="font-size:12px;color:#a1a1aa;margin:16px 0 0;">${L.foot(c)}</p>
</td></tr></table></body></html>`;
  const text = [
    L.hello({ holder }),
    "",
    L.body({ issuer, context }).replace(/<[^>]+>/g, ""),
    "",
    `${L.view}: ${verificationUrl}`,
    `${L.pdf}: ${pdfUrl}`,
    "",
    L.foot({ issuer }),
  ].join("\n");
  return { subject: L.subject({ context }), html, text };
}

/**
 * Email a holder their credential. Never throws: the credential already exists,
 * and a failed email must not look like a failed issuance.
 * @returns {Promise<boolean>} whether SendGrid accepted it
 */
export async function sendCredentialEmail({ to, locale, holder, issuer, context, verificationUrl, pdfUrl }) {
  if (!isMailerConfigured()) {
    console.warn("[mailer] SENDGRID_API_KEY/SENDGRID_FROM not set; credential email skipped");
    return false;
  }
  const { subject, html, text } = credentialEmail({ locale, holder, issuer, context, verificationUrl, pdfUrl });
  try {
    const res = await fetch(SENDGRID_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        // The issuer's name up front: the email is theirs, we only carry it.
        from: { email: process.env.SENDGRID_FROM, name: `${String(issuer).slice(0, 60)} ${locale === "en" ? "via" : "vía"} HashProof` },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
        tracking_settings: { click_tracking: { enable: false } },
      }),
    });
    if (!res.ok) {
      console.error("[mailer] SendGrid refused a credential email:", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mailer] credential email failed:", err.message);
    return false;
  }
}
