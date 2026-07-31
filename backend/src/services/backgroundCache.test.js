import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getBackgroundImage,
  getBackgroundCacheStats,
  clearBackgroundCache,
} from "./backgroundCache.js";

const URL_A = "https://example.com/bg-a.png";
const URL_B = "https://example.com/bg-b.png";

function okResponse(bytes = 1024, delayMs = 0) {
  return new Promise((resolve) => {
    const respond = () =>
      resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array(bytes).buffer,
      });
    if (delayMs) setTimeout(respond, delayMs);
    else respond();
  });
}

describe("background image cache", () => {
  beforeEach(() => {
    clearBackgroundCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads once and serves the rest from memory", async () => {
    const fetchMock = vi.fn(() => okResponse());
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < 5; i++) await getBackgroundImage(URL_A);

    // Five certificates from the same event, one download.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getBackgroundCacheStats().entries).toBe(1);
  });

  it("collapses a cold-start stampede into a single download", async () => {
    // The moment an event ends: hundreds of requests arrive with the cache empty.
    // Without in-flight sharing this fires hundreds of downloads of one file.
    const fetchMock = vi.fn(() => okResponse(1024, 20));
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all(
      Array.from({ length: 50 }, () => getBackgroundImage(URL_A)),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r && r.byteLength === 1024)).toBe(true);
  });

  it("keeps separate entries per template", async () => {
    const fetchMock = vi.fn(() => okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await getBackgroundImage(URL_A);
    await getBackgroundImage(URL_B);
    await getBackgroundImage(URL_A);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getBackgroundCacheStats().entries).toBe(2);
  });

  it("returns null instead of throwing when the image can't be fetched", async () => {
    // A broken background must not fail the certificate; it renders without it.
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    expect(await getBackgroundImage(URL_A)).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    expect(await getBackgroundImage(URL_B)).toBeNull();
  });

  it("does not retry forever on a failure — the next call tries again", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => ({ ok: false, status: 500 }))
      .mockImplementationOnce(() => okResponse());
    vi.stubGlobal("fetch", fetchMock);

    expect(await getBackgroundImage(URL_A)).toBeNull();
    // A transient failure must not be cached as "no background" forever.
    expect(await getBackgroundImage(URL_A)).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a missing url", async () => {
    const fetchMock = vi.fn(() => okResponse());
    vi.stubGlobal("fetch", fetchMock);
    expect(await getBackgroundImage(null)).toBeNull();
    expect(await getBackgroundImage("")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
