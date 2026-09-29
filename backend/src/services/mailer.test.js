import { describe, it, expect } from "vitest";
import { credentialEmail } from "./mailer.js";

const base = {
  holder: "Ana <b>Ruiz</b>",
  issuer: "Universidad & Cía",
  context: "Diplomado IA",
  verificationUrl: "https://hashproof.dev/verify/abc",
  pdfUrl: "https://hashproof.dev/verify/abc/pdf",
};

describe("credentialEmail", () => {
  it("writes Spanish by default and English on request", () => {
    expect(credentialEmail({ ...base }).subject).toBe("Tu certificado: Diplomado IA");
    expect(credentialEmail({ ...base, locale: "en" }).subject).toBe("Your certificate: Diplomado IA");
  });

  it("escapes names in the HTML, so a holder name cannot inject markup", () => {
    const { html, text } = credentialEmail(base);
    expect(html).toContain("Ana &lt;b&gt;Ruiz&lt;/b&gt;");
    expect(html).toContain("Universidad &amp; Cía");
    expect(html).not.toContain("<b>Ruiz</b>");
    // Plain text keeps the real characters.
    expect(text).toContain("Universidad & Cía");
  });

  it("links to the verification page and the PDF", () => {
    const { html, text } = credentialEmail(base);
    expect(html).toContain('href="https://hashproof.dev/verify/abc"');
    expect(text).toContain("https://hashproof.dev/verify/abc/pdf");
  });
});
