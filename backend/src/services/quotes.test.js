import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../supabase.js", () => ({ supabase: {} }));

const { priceQuote, parseClient, getUsdCopRate, clearRateCache, formatAmount, quoteNumber, QUOTE_PRICES_USD_CENTS } =
  await import("./quotes.js");
const { renderQuotePdf } = await import("./quotePdf.js");

const RATE = { rate: 4000, date: "2026-10-26", source: "market" };
const NOW = new Date("2026-10-26T15:00:00Z");

describe("priceQuote", () => {
  it("prices certificates at the card price, with verification by default", () => {
    const q = priceQuote({ currency: "USD", quantity: 400 }, RATE, { now: NOW });
    expect(q.lines).toEqual([
      { key: "certificates", quantity: 400, unit_amount: QUOTE_PRICES_USD_CENTS.certificate, amount: 400 * QUOTE_PRICES_USD_CENTS.certificate },
      { key: "verification", quantity: 1, unit_amount: 4900, amount: 4900 },
    ]);
    expect(q.total).toBe(10000 + 4900);
    expect(q.rate).toBeNull();
    expect(q.valid_until).toBe("2026-11-10");
  });

  it("adds managed issuance only when asked, and drops verification when declined", () => {
    const q = priceQuote({ currency: "USD", quantity: 10, verification: false, managed: true }, RATE, { now: NOW });
    expect(q.lines.map((l) => l.key)).toEqual(["certificates", "managed"]);
  });

  it("converts to whole pesos so unit × quantity is the line total", () => {
    const q = priceQuote({ currency: "COP", quantity: 400, managed: true }, { ...RATE, rate: 3170.49 }, { now: NOW });
    const cert = q.lines[0];
    expect(cert.unit_amount).toBe(793);
    expect(cert.amount).toBe(793 * 400);
    expect(q.lines[1].amount % 1000).toBe(0);
    expect(q.total).toBe(q.lines.reduce((s, l) => s + l.amount, 0));
    expect(q.rate).toEqual({ usd_cop: 3170.49, date: "2026-10-26", source: "market" });
    expect(formatAmount(q.total, q)).toBe("COP 631.200");
  });

  it("rejects quantities that are not whole and positive", () => {
    for (const quantity of [0, -1, 1.5, "abc", 2_000_000]) {
      expect(() => priceQuote({ quantity }, RATE)).toThrow(/Quantity/);
    }
  });
});

describe("parseClient", () => {
  it("requires a name and a valid email to leave the page", () => {
    expect(() => parseClient({ name: "A", email: "a@b.co" }, { requireContact: true })).toThrow(/name/);
    expect(() => parseClient({ name: "Ana", email: "nope" }, { requireContact: true })).toThrow(/email/);
    expect(parseClient({ name: " Ana \n Ruiz ", email: "ANA@B.CO" }, { requireContact: true })).toMatchObject({
      name: "Ana Ruiz",
      email: "ana@b.co",
    });
  });
});

describe("getUsdCopRate", () => {
  beforeEach(() => clearRateCache());

  it("uses the market rate and caches it", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ rates: { COP: 3900 }, time_last_update_unix: 1793000000 }) }));
    const a = await getUsdCopRate({ fetchImpl, now: 1 });
    const b = await getUsdCopRate({ fetchImpl, now: 2 });
    expect(a).toMatchObject({ rate: 3900, source: "market" });
    expect(b).toBe(a);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("falls back to a labelled reference rate when the source is down", async () => {
    const r = await getUsdCopRate({ fetchImpl: async () => { throw new Error("down"); } });
    expect(r.source).toBe("fallback");
    expect(r.rate).toBeGreaterThan(0);
  });
});

describe("renderQuotePdf", () => {
  it("renders a two-page PDF in both languages", async () => {
    for (const [currency, locale] of [["COP", "es"], ["USD", "en"]]) {
      const q = { ...priceQuote({ currency, locale, quantity: 400, managed: true, client: { name: "Ana" } }, RATE, { now: NOW }), number: quoteNumber(NOW) };
      const pdf = await renderQuotePdf(q);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(2);
    }
  });
});
