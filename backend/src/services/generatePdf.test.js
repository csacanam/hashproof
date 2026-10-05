import { describe, it, expect } from "vitest";
import PDFDocument from "pdfkit";
import { fitFontSize, renderCredentialPdf } from "./generatePdf.js";

const LONG_NAME = "JUAN SEBASTIAN EDUARDO CASTRO FETECUA";

function boldDoc() {
  return new PDFDocument({ size: [1056, 816] }).font("Helvetica-Bold");
}

describe("fitFontSize", () => {
  it("shrinks a one-line field until a long value fits its width", () => {
    const doc = boldDoc();
    const size = fitFontSize(doc, LONG_NAME, { key: "holder_name" }, 40, 900);

    expect(size).toBeLessThan(40);
    expect(size).toBeGreaterThanOrEqual(24);
    expect(doc.fontSize(size).widthOfString(LONG_NAME)).toBeLessThanOrEqual(900);
  });

  it("keeps the designed size when the value already fits", () => {
    expect(fitFontSize(boldDoc(), "Ana Ruiz", { key: "holder_name" }, 40, 900)).toBe(40);
  });

  it("never shrinks below 60% of the designed size", () => {
    expect(fitFontSize(boldDoc(), LONG_NAME.repeat(4), { key: "holder_name" }, 40, 900)).toBe(24);
  });

  it("leaves multi-line fields at their size so they wrap", () => {
    const doc = boldDoc();
    const sentence = "Attended the sixth edition of the course on trauma care ".repeat(3);

    expect(fitFontSize(doc, sentence, { key: "details", height: 169 }, 84, 2077)).toBe(84);
    expect(fitFontSize(doc, sentence, { key: "zone", text: "Attended {context}" }, 30, 600)).toBe(30);
  });
});

describe("renderCredentialPdf", () => {
  it("is deterministic with a value that has to shrink", async () => {
    const args = {
      credentialJson: {
        issuanceDate: "2026-10-03T22:45:59.522Z",
        credentialSubject: { holder_name: LONG_NAME, extra: "1001346453" },
      },
      template: {
        page_width: 1056,
        page_height: 816,
        fields_json: [
          { key: "holder_name", x: 80, y: 300, width: 900, font_size: 40, bold: true, align: "center" },
          { key: "extra", x: 80, y: 360, width: 900, font_size: 30, align: "center" },
        ],
      },
      backgroundUrl: null,
      verificationUrl: "https://hashproof.dev/verify/test",
    };

    const a = await renderCredentialPdf(args);
    const b = await renderCredentialPdf(args);
    expect(a.equals(b)).toBe(true);
  });
});
