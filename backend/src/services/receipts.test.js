import { describe, it, expect, vi } from "vitest";

vi.mock("../supabase.js", () => ({ supabase: {} }));
const { renderBillingDocument, documentNumber, getBillingDocument } = await import("./receipts.js");

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

describe("invoices and receipts", () => {
  it("numbers each document from its purchase id", () => {
    expect(documentNumber("invoice", PURCHASE.id)).toBe("INV-95491473");
    expect(documentNumber("receipt", PURCHASE.id)).toBe("RCT-95491473");
  });

  it("renders both documents in either language, with or without a refund", async () => {
    for (const kind of ["invoice", "receipt"]) {
      for (const locale of ["es", "en"]) {
        for (const refunded_credits of [0, 40]) {
          const pdf = await renderBillingDocument({
            kind,
            purchase: { ...PURCHASE, refunded_credits },
            entity: { display_name: "Acme" },
            buyer: "a@acme.co",
            locale,
          });
          expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
        }
      }
    }
  });

  it("knows no other kind of document", async () => {
    expect(await getBillingDocument({ entity: { id: "e" }, purchaseId: PURCHASE.id, kind: "quote", locale: "en" })).toBeNull();
  });
});
