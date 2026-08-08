import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeDomain, expectedToken, expectedRecord, checkProof, resetDnsCache } from "./entityProofs.js";

vi.mock("../supabase.js", () => ({ supabase: {} }));

const ENTITY = "4acaf733-ea85-40c6-9d4b-63522bd8b207";

describe("domain normalisation", () => {
  it("accepts a bare domain and a full URL alike", () => {
    expect(normalizeDomain("peewah.co")).toBe("peewah.co");
    expect(normalizeDomain("https://peewah.co/about?x=1")).toBe("peewah.co");
    expect(normalizeDomain("  PEEWAH.CO  ")).toBe("peewah.co");
  });

  it("strips www and a trailing dot so one domain cannot be declared twice", () => {
    expect(normalizeDomain("www.peewah.co")).toBe("peewah.co");
    expect(normalizeDomain("peewah.co.")).toBe("peewah.co");
  });

  it("rejects what could never resolve, rather than storing a proof that can never pass", () => {
    for (const bad of ["", "not a domain", "localhost", "peewah", "-bad.co", "http://", null, 42]) {
      expect(normalizeDomain(bad)).toBeNull();
    }
  });
});

describe("expected token", () => {
  it("is reproducible by anyone holding the entity id and the domain", () => {
    expect(expectedToken(ENTITY, "peewah.co")).toBe(expectedToken(ENTITY, "peewah.co"));
    expect(expectedToken(ENTITY, "peewah.co")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs per domain, so one record cannot verify another", () => {
    expect(expectedToken(ENTITY, "peewah.co")).not.toBe(expectedToken(ENTITY, "hashproof.dev"));
  });

  it("differs per entity, so an issuer cannot ride on another's record", () => {
    expect(expectedToken(ENTITY, "peewah.co")).not.toBe(
      expectedToken("00000000-0000-0000-0000-000000000000", "peewah.co")
    );
  });

  it("is published under a recognisable prefix", () => {
    expect(expectedRecord(ENTITY, "peewah.co")).toBe(`hashproof-verification=${expectedToken(ENTITY, "peewah.co")}`);
  });
});

describe("checking a proof against live DNS", () => {
  const realFetch = global.fetch;
  const answer = (records) => ({
    ok: true,
    json: async () => ({ Answer: records.map((data) => ({ type: 16, data })) }),
  });

  beforeEach(() => {
    resetDnsCache(); // resolutions are cached; without this, cases bleed
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("passes when the domain publishes the expected record", async () => {
    global.fetch = vi.fn(async () => answer([`"${expectedRecord(ENTITY, "peewah.co")}"`, '"v=spf1 -all"']));
    const r = await checkProof({ entity_id: ENTITY, resource: "peewah.co" });
    expect(r).toMatchObject({ verified: true, result: "verified" });
  });

  it("rejoins TXT values that the resolver split into chunks", async () => {
    const record = expectedRecord(ENTITY, "peewah.co");
    const split = `"${record.slice(0, 40)}" "${record.slice(40)}"`;
    global.fetch = vi.fn(async () => answer([split]));
    expect((await checkProof({ entity_id: ENTITY, resource: "peewah.co" })).verified).toBe(true);
  });

  it("fails when the record is absent", async () => {
    global.fetch = vi.fn(async () => answer(['"v=spf1 -all"']));
    const r = await checkProof({ entity_id: ENTITY, resource: "peewah.co" });
    expect(r).toMatchObject({ verified: false, result: "missing" });
  });

  it("fails when another entity's record is published on the domain", async () => {
    global.fetch = vi.fn(async () => answer([`"${expectedRecord("some-other-entity", "peewah.co")}"`]));
    expect((await checkProof({ entity_id: ENTITY, resource: "peewah.co" })).verified).toBe(false);
  });

  it("reports an error rather than a failed proof when no resolver answers", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    });
    const r = await checkProof({ entity_id: ENTITY, resource: "peewah.co" });
    expect(r).toMatchObject({ verified: false, result: "error" });
  });

  it("falls through to the second resolver when the first fails", async () => {
    let call = 0;
    global.fetch = vi.fn(async () => {
      if (++call === 1) throw new Error("cloudflare down");
      return answer([`"${expectedRecord(ENTITY, "peewah.co")}"`]);
    });
    expect((await checkProof({ entity_id: ENTITY, resource: "peewah.co" })).verified).toBe(true);
    expect(call).toBe(2);
  });
});
