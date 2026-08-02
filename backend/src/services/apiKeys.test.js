import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const from = vi.fn();

vi.mock("../supabase.js", () => ({
  supabase: {
    rpc: (...args) => rpc(...args),
    from: (...args) => from(...args),
  },
}));

const { deductCredit, refundCredit, addCredits } = await import("./apiKeys.js");

describe("prepaid credit accounting", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("deductCredit", () => {
    it("spends the credit in one database call, never read-then-write", async () => {
      rpc.mockResolvedValue({ data: { ok: true, remaining: 4, reason: null }, error: null });

      const result = await deductCredit("key-1");

      expect(result).toEqual({ ok: true, remaining: 4, reason: null });
      expect(rpc).toHaveBeenCalledWith("deduct_api_credit", { p_key_id: "key-1" });
      // A SELECT here would be the race: the balance this service reads could be
      // spent by another request before it writes the decrement back.
      expect(from).not.toHaveBeenCalled();
    });

    it("refuses when the key is out of credits", async () => {
      rpc.mockResolvedValue({
        data: { ok: false, remaining: 0, reason: "insufficient_credits" },
        error: null,
      });

      const result = await deductCredit("key-1");

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("insufficient_credits");
    });

    it("distinguishes an unknown key from an empty one", async () => {
      rpc.mockResolvedValue({ data: { ok: false, remaining: 0, reason: "not_found" }, error: null });

      expect((await deductCredit("ghost")).reason).toBe("not_found");
    });

    it("fails closed when the database is unreachable", async () => {
      rpc.mockResolvedValue({ data: null, error: { message: "connection refused" } });

      const result = await deductCredit("key-1");

      // Issuing on an unreachable database would hand out a credential nobody
      // was charged for. The caller gets a retryable error instead.
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("unavailable");
    });
  });

  describe("refundCredit", () => {
    it("returns the credit through the atomic function", async () => {
      rpc.mockResolvedValue({ data: { ok: true, remaining: 5 }, error: null });

      expect(await refundCredit("key-1")).toEqual({ ok: true, remaining: 5 });
      expect(rpc).toHaveBeenCalledWith("refund_api_credit", { p_key_id: "key-1" });
    });

    it("never throws, because it runs while another error is being handled", async () => {
      rpc.mockResolvedValue({ data: null, error: { message: "connection refused" } });

      // Throwing here would replace the real failure the caller is reporting
      // with a refund error, hiding why the issuance failed in the first place.
      await expect(refundCredit("key-1")).resolves.toEqual({ ok: false, remaining: 0 });
      expect(console.error).toHaveBeenCalled();
    });

    it("logs the key id when the refund is lost, so it can be fixed by hand", async () => {
      rpc.mockResolvedValue({ data: { ok: false }, error: null });

      await refundCredit("key-42");

      expect(console.error.mock.calls[0].join(" ")).toContain("key-42");
    });
  });

  describe("addCredits", () => {
    it("tops up through the atomic function", async () => {
      rpc.mockResolvedValue({ data: { ok: true, remaining: 110 }, error: null });

      await addCredits("key-1", 10);

      expect(rpc).toHaveBeenCalledWith("add_api_credits", { p_key_id: "key-1", p_amount: 10 });
      expect(from).not.toHaveBeenCalled();
    });

    it("does not touch the database for a no-op amount", async () => {
      await addCredits("key-1", 0);
      await addCredits("key-1", -5);

      expect(rpc).not.toHaveBeenCalled();
    });

    it("surfaces a failed top-up to the admin instead of reporting success", async () => {
      rpc.mockResolvedValue({ data: null, error: { message: "API key not found" } });

      await expect(addCredits("key-1", 10)).rejects.toThrow("API key not found");
    });
  });
});
