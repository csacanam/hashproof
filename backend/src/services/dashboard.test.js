import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../supabase.js", () => ({ supabase: {} }));

const deductCredit = vi.fn();
const refundCredit = vi.fn();
vi.mock("./apiKeys.js", () => ({
  deductCredit: (...a) => deductCredit(...a),
  refundCredit: (...a) => refundCredit(...a),
  generateSecret: () => ({ secret: "hp_x", keyHash: "h" }),
}));
const createIssuanceJob = vi.fn();
vi.mock("./issuanceJobs.js", () => ({ createIssuanceJob: (...a) => createIssuanceJob(...a) }));
vi.mock("./accounts.js", async (orig) => ({
  ...(await orig()),
  ensurePanelKey: vi.fn(async () => ({ id: "panel-key", credits_balance: 10 })),
}));
vi.mock("../utils/notify.js", () => ({ sendTelegramAlert: vi.fn(async () => true) }));

const { buildPayload, issueFromDashboard } = await import("./dashboardIssuance.js");
const { validateLayout, readImageInfo } = await import("./dashboardTemplates.js");
const { parseCredits, priceCents } = await import("./payments.js");
const { normalizeSlug } = await import("./accounts.js");

const ENTITY = { id: "e1", display_name: "Acme University", slug: "acme-university", status: "unverified" };
const INPUT = { holder_name: "Ana Ruiz", context_title: "Diplomado IA", title: "Certificado", template_slug: "hashproof" };

describe("buildPayload", () => {
  it("always issues as the organization, whatever the input says", () => {
    const p = buildPayload(ENTITY, {
      ...INPUT,
      issuer: { display_name: "Harvard", slug: "harvard" },
      issuer_entity_id: "someone-else",
    });
    expect(p.issuer).toEqual({ display_name: "Acme University", slug: "acme-university" });
    expect(p.platform).toEqual(p.issuer);
    expect(p.issuer_entity_id).toBe("e1");
  });

  it("fills holder_name for the template from the holder when not given", () => {
    expect(buildPayload(ENTITY, INPUT).values.holder_name).toBe("Ana Ruiz");
  });

  it("drops empty values and keeps the email on the holder for private storage", () => {
    const p = buildPayload(ENTITY, { ...INPUT, holder_email: "ana@x.co", values: { details: "", extra: "8h" } });
    expect(p.values).toEqual({ extra: "8h", holder_name: "Ana Ruiz" });
    expect(p.holder.email).toBe("ana@x.co");
  });

  it("rejects missing fields with a message naming them", () => {
    expect(() => buildPayload(ENTITY, { ...INPUT, holder_name: " " })).toThrow("holder_name is required");
    expect(() => buildPayload(ENTITY, { ...INPUT, context_title: "" })).toThrow(/context/);
    expect(() => buildPayload(ENTITY, { ...INPUT, credential_type: "diploma" })).toThrow(/credential_type/);
    expect(() => buildPayload(ENTITY, { ...INPUT, expires_at: "2000-01-01" })).toThrow(/future/);
  });
});

describe("issueFromDashboard", () => {
  beforeEach(() => {
    deductCredit.mockReset().mockResolvedValue({ ok: true, remaining: 9 });
    refundCredit.mockReset().mockResolvedValue({ ok: true });
    createIssuanceJob.mockReset().mockResolvedValue({ job: { id: "j1", status: "queued" }, created: true });
  });

  it("charges the panel key and queues a job under a namespaced idempotency key", async () => {
    const out = await issueFromDashboard({ entity: ENTITY, input: INPUT, idempotencyKey: "row-3" });
    expect(deductCredit).toHaveBeenCalledWith("panel-key");
    expect(createIssuanceJob).toHaveBeenCalledWith(
      expect.objectContaining({ issuerEntityId: "e1", apiKeyId: "panel-key", idempotencyKey: "panel:row-3" }),
    );
    expect(out).toMatchObject({ job_id: "j1", created: true, remaining: 9 });
    expect(refundCredit).not.toHaveBeenCalled();
  });

  it("gives the credit back when the row was already queued", async () => {
    createIssuanceJob.mockResolvedValue({ job: { id: "j1", status: "completed" }, created: false });
    const out = await issueFromDashboard({ entity: ENTITY, input: INPUT, idempotencyKey: "row-3" });
    expect(refundCredit).toHaveBeenCalledWith("panel-key");
    expect(out.remaining).toBe(10);
  });

  it("gives the credit back when queueing fails", async () => {
    createIssuanceJob.mockRejectedValue(new Error("db down"));
    await expect(issueFromDashboard({ entity: ENTITY, input: INPUT })).rejects.toThrow("db down");
    expect(refundCredit).toHaveBeenCalledOnce();
  });

  it("answers 402 without queueing when there are no credits", async () => {
    deductCredit.mockResolvedValue({ ok: false, remaining: 0, reason: "insufficient_credits" });
    await expect(issueFromDashboard({ entity: ENTITY, input: INPUT })).rejects.toMatchObject({ status: 402 });
    expect(createIssuanceJob).not.toHaveBeenCalled();
  });

  it("refuses a suspended organization before charging", async () => {
    await expect(
      issueFromDashboard({ entity: { ...ENTITY, status: "suspended" }, input: INPUT }),
    ).rejects.toMatchObject({ status: 403 });
    expect(deductCredit).not.toHaveBeenCalled();
  });

  it("validates before charging", async () => {
    await expect(issueFromDashboard({ entity: ENTITY, input: { ...INPUT, title: "" } })).rejects.toMatchObject({ status: 400 });
    expect(deductCredit).not.toHaveBeenCalled();
  });
});

describe("validateLayout", () => {
  const ok = { page_width: 1056, page_height: 816, fields_json: [{ key: "holder_name", x: 80, y: 300, width: 900, font_size: 40, align: "center", bold: true, required: true }] };

  it("normalizes a valid layout to the renderer's format", () => {
    const out = validateLayout(ok);
    expect(out.fields_json[0]).toEqual({
      key: "holder_name", x: 80, y: 300, width: 900, height: 52, font_size: 40,
      font_color: "#000000", align: "center", required: true, bold: true,
    });
  });

  it("keeps the wording of a text zone, trimmed and bounded", () => {
    const f = { ...ok.fields_json[0], key: "texto_1", required: false, text: "  Asistió a {evento} con {horas} horas  " };
    expect(validateLayout({ ...ok, fields_json: [f] }).fields_json[0].text).toBe("Asistió a {evento} con {horas} horas");
    expect(validateLayout({ ...ok, fields_json: [{ ...f, text: "x".repeat(900) }] }).fields_json[0].text).toHaveLength(500);
    expect(validateLayout(ok).fields_json[0]).not.toHaveProperty("text");
  });

  it("rejects fields outside the page, repeated keys and bad colors", () => {
    const f = ok.fields_json[0];
    expect(() => validateLayout({ ...ok, fields_json: [{ ...f, x: 500 }] })).toThrow(/fit inside/);
    expect(() => validateLayout({ ...ok, fields_json: [f, f] })).toThrow(/unique/);
    expect(() => validateLayout({ ...ok, fields_json: [{ ...f, font_color: "red" }] })).toThrow(/hex/);
    expect(() => validateLayout({ ...ok, fields_json: [{ ...f, key: "Holder Name" }] })).toThrow(/lowercase/);
    expect(() => validateLayout({ ...ok, fields_json: [] })).toThrow(/at least one/);
  });
});

describe("readImageInfo", () => {
  it("reads PNG dimensions from the header", () => {
    const png = Buffer.alloc(33);
    png.writeUInt32BE(0x89504e47, 0);
    png.write("IHDR", 12, "ascii");
    png.writeUInt32BE(3508, 16);
    png.writeUInt32BE(2480, 20);
    expect(readImageInfo(png)).toEqual({ mime: "image/png", ext: "png", width: 3508, height: 2480 });
  });

  it("reads JPEG dimensions from the SOF segment", () => {
    // SOI, APP0 (len 16), SOF0 with height 816 and width 1056.
    const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14)]);
    const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x30, 0x04, 0x20, 0x03]);
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.alloc(10)]);
    expect(readImageInfo(jpg)).toMatchObject({ mime: "image/jpeg", width: 1056, height: 816 });
  });

  it("rejects anything else", () => {
    expect(readImageInfo(Buffer.from("GIF89a....................."))).toBeNull();
  });
});

describe("pricing", () => {
  it("prices credits at $0.25 by card and $0.22 in crypto", () => {
    expect(priceCents(50, "stripe")).toBe(1250);
    expect(priceCents(50, "voulti")).toBe(1100);
  });

  it("enforces the per-method minimum", () => {
    expect(() => parseCredits(24, "stripe")).toThrow(/between 25/);
    expect(parseCredits(25, "stripe")).toBe(25);
    expect(() => parseCredits(9, "voulti")).toThrow(/between 10/);
    expect(() => parseCredits("abc", "voulti")).toThrow();
  });
});

describe("normalizeSlug", () => {
  it("turns a display name into a slug", () => {
    expect(normalizeSlug("  Universidad de los Andes — Educación Continua ")).toBe(
      "universidad-de-los-andes-educacion-continua",
    );
  });
});
