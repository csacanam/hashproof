import { describe, it, expect, vi } from "vitest";

vi.mock("../supabase.js", () => ({ supabase: {} }));
const { renderReceipt, receiptNumber } = await import("./receipts.js");

const PURCHASE = {
  id: "95491473-dabd-44f4-ba1f-a68a3d6aab16",
  method: "stripe",
  credits: 100,
  amount_usd_cents: 2500,
  external_ref: "cs_live_1",
  payment_ref: "pi_1",
  completed_at: "2026-09-30T15:00:00Z",
  refunded_credits: 40,
  refunded_at: "2026-10-01T15:00:00Z",
};

describe("receipts", () => {
  it("numbers a receipt from its purchase id", () => {
    expect(receiptNumber(PURCHASE.id)).toBe("HP-95491473");
  });

  it("renders a PDF in either language, with or without a refund", async () => {
    for (const locale of ["es", "en"]) {
      for (const refunded_credits of [0, 40]) {
        const pdf = await renderReceipt({ purchase: { ...PURCHASE, refunded_credits }, entity: { display_name: "Acme" }, buyer: "a@acme.co", locale });
        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      }
    }
  });
});
