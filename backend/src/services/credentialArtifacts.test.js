import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSingle = vi.fn();
vi.mock("../supabase.js", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: mockSingle }) }) }),
  },
}));

vi.mock("./generatePdf.js", () => ({
  renderCredentialPdf: vi.fn(async () => Buffer.from("%PDF-1.3 pretend certificate")),
}));

const mockBackgroundCid = vi.fn();
vi.mock("./backgroundIpfs.js", () => ({
  getBackgroundCid: (...args) => mockBackgroundCid(...args),
}));

const { buildCredentialArtifacts } = await import("./credentialArtifacts.js");

// The template that produced the production leak: a name field and an `extra`
// field the issuer used for a national ID number.
const TEMPLATE = {
  background_url: "https://storage.example/event/background.png",
  page_width: 1056,
  page_height: 816,
  fields_json: [
    { key: "holder_name", x: 80, y: 300, width: 900, font_size: 40, align: "center", bold: true },
    { key: "extra", x: 80, y: 360, width: 900, font_size: 30, align: "center" },
  ],
};

const CREDENTIAL_JSON = {
  name: "Certificado de Asistencia",
  issuanceDate: "2026-08-08T01:10:12.105Z",
  credentialSubject: {
    full_name: "Magda Carolina Buitrago Rojas",
    holder_name: "Magda Carolina Buitrago Rojas",
    extra: "1049640988",
  },
};

const build = () =>
  buildCredentialArtifacts({
    credentialJson: CREDENTIAL_JSON,
    templateId: "tpl-1",
    backgroundUrlOverride: null,
    verificationUrl: "https://hashproof.dev/verify/cred-1",
  });

describe("credential artifacts", () => {
  beforeEach(() => {
    mockSingle.mockResolvedValue({ data: TEMPLATE });
    mockBackgroundCid.mockResolvedValue("bafyBackground");
  });

  it("anchors the hash of the issued PDF", async () => {
    const { credentialJson } = await build();

    expect(credentialJson.document.mediaType).toBe("application/pdf");
    expect(credentialJson.document.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("describes the design so the certificate can be re-rendered", async () => {
    const { credentialJson } = await build();

    expect(credentialJson.design.pageWidth).toBe(1056);
    expect(credentialJson.design.pageHeight).toBe(816);
    expect(credentialJson.design.background).toBe("ipfs://bafyBackground");
    expect(credentialJson.design.fields.map((f) => f.key)).toEqual(["holder_name", "extra"]);
  });

  it("carries field keys and geometry but never their values", async () => {
    const { credentialJson } = await build();
    const serialized = JSON.stringify(credentialJson.design);

    expect(serialized).not.toContain("1049640988");
    expect(serialized).not.toContain("Magda Carolina Buitrago Rojas");

    const nameField = credentialJson.design.fields.find((f) => f.key === "holder_name");
    expect(nameField).toMatchObject({ x: 80, y: 300, fontSize: 40, align: "center", bold: true });
    expect(nameField.value).toBeUndefined();
  });

  it("leaves the rest of the credential untouched", async () => {
    const { credentialJson } = await build();

    expect(credentialJson.name).toBe(CREDENTIAL_JSON.name);
    expect(credentialJson.credentialSubject).toEqual(CREDENTIAL_JSON.credentialSubject);
  });

  it("still issues when the background could not be pinned", async () => {
    mockBackgroundCid.mockResolvedValue(null);
    const { credentialJson } = await build();

    expect(credentialJson.design.background).toBeUndefined();
    expect(credentialJson.design.fields).toHaveLength(2);
    expect(credentialJson.document.hash).toBeDefined();
  });

  it("does not fail a paid credential when the PDF cannot be rendered", async () => {
    const { renderCredentialPdf } = await import("./generatePdf.js");
    renderCredentialPdf.mockRejectedValueOnce(new Error("background unreachable"));

    const { credentialJson, pdf } = await build();

    expect(pdf).toBeNull();
    expect(credentialJson.document).toBeUndefined();
    // The design still anchors, and the credential is still issued.
    expect(credentialJson.design.fields).toHaveLength(2);
  });

  it("does not fail a paid credential when the template cannot be read", async () => {
    mockSingle.mockResolvedValue({ data: null });
    const { credentialJson, pdf } = await build();

    expect(pdf).toBeNull();
    expect(credentialJson).toEqual(CREDENTIAL_JSON);
  });
});
