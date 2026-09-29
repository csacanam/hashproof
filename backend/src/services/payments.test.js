import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";

// A tiny in-memory credit_purchases + api_keys, with complete_credit_purchase
// behaving like the SQL function: only a pending row credits.
let purchases;
let balances;
vi.mock("../supabase.js", () => {
  const q = (table) => {
    const f = {};
    const b = {
      select: () => b,
      eq: (k, v) => ((f[k] = v), b),
      order: () => b,
      limit: () => b,
      maybeSingle: async () => ({ data: table === "credit_purchases" ? purchases.find((p) => p.method === f.method && p.external_ref === f.external_ref) ?? null : null, error: null }),
      single: async () => ({ data: purchases.find((p) => p.method === f.method && p.external_ref === f.external_ref), error: null }),
      insert: (row) => {
        const dup = purchases.find((p) => p.method === row.method && p.external_ref === row.external_ref);
        const r = dup ? null : { id: `p${purchases.length + 1}`, ...row };
        if (r) purchases.push(r);
        return { select: () => ({ single: async () => (dup ? { data: null, error: { code: "23505" } } : { data: r, error: null }) }) };
      },
    };
    return b;
  };
  return {
    supabase: {
      from: q,
      rpc: async (fn, { p_purchase_id }) => {
        const p = purchases.find((x) => x.id === p_purchase_id);
        if (p.status !== "pending") return { data: { ok: true, credited: false }, error: null };
        p.status = "completed";
        balances[p.entity_id] = (balances[p.entity_id] || 0) + p.credits;
        return { data: { ok: true, credited: true }, error: null };
      },
    },
  };
});
vi.mock("../utils/notify.js", () => ({ sendTelegramAlert: vi.fn(async () => true) }));

process.env.STRIPE_SECRET_KEY = "sk_test_x";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
const { handleStripeWebhook, syncVoultiInvoice, verifyVoultiSignature } = await import("./payments.js");
const stripe = new Stripe("sk_test_x");

function signed(session, type = "checkout.session.completed") {
  const payload = JSON.stringify({ id: "evt_1", object: "event", type, data: { object: session } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test" });
  return [Buffer.from(payload), header];
}

const SESSION = {
  id: "cs_test_1",
  payment_status: "paid",
  amount_total: 2500,
  metadata: { product: "hashproof", entity_id: "e1", user_id: "u1", credits: "100" },
};

describe("handleStripeWebhook", () => {
  beforeEach(() => {
    purchases = [];
    balances = {};
  });

  it("credits a paid checkout once, however many times Stripe delivers it", async () => {
    expect(await handleStripeWebhook(...signed(SESSION))).toEqual({ handled: true, credited: true });
    expect(await handleStripeWebhook(...signed(SESSION))).toEqual({ handled: true, credited: false });
    expect(balances.e1).toBe(100);
  });

  it("completes the pending row created at checkout instead of adding another", async () => {
    purchases.push({ id: "p0", method: "stripe", external_ref: "cs_test_1", status: "pending", credits: 100, entity_id: "e1" });
    await handleStripeWebhook(...signed(SESSION));
    expect(purchases).toHaveLength(1);
    expect(balances.e1).toBe(100);
  });

  it("ignores other products' checkouts on the shared account, even when paid", async () => {
    const other = { ...SESSION, metadata: { ...SESSION.metadata, product: "peewah" } };
    expect(await handleStripeWebhook(...signed(other))).toEqual({ handled: false, ignored: "other_product" });
    const untagged = { ...SESSION, metadata: {} };
    expect((await handleStripeWebhook(...signed(untagged))).ignored).toBe("other_product");
    expect(balances.e1).toBeUndefined();
  });

  it("refuses a bad signature", async () => {
    const [body] = signed(SESSION);
    await expect(handleStripeWebhook(body, "t=1,v1=deadbeef")).rejects.toMatchObject({
      type: "StripeSignatureVerificationError",
    });
    expect(balances.e1).toBeUndefined();
  });

  it("never credits more than was charged", async () => {
    const out = await handleStripeWebhook(...signed({ ...SESSION, amount_total: 100 }));
    expect(out.handled).toBe(false);
    expect(balances.e1).toBeUndefined();
  });

  it("ignores unpaid sessions and other events", async () => {
    expect((await handleStripeWebhook(...signed({ ...SESSION, payment_status: "unpaid" }))).handled).toBe(false);
    expect((await handleStripeWebhook(...signed(SESSION, "payment_intent.created"))).handled).toBe(false);
  });
});

describe("Voulti", () => {
  beforeEach(() => {
    purchases = [{ id: "pv", method: "voulti", external_ref: "inv_1", status: "pending", credits: 100, entity_id: "e1", amount_usd_cents: 2250 }];
    balances = {};
  });

  const invoice = (fields) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "inv_1", fiat_currency: "USD", amount_fiat: 22.5, ...fields })));

  it("credits the organization once the invoice is Paid, and only once", async () => {
    invoice({ status: "Paid" });
    expect(await syncVoultiInvoice("inv_1")).toEqual({ status: "Paid", credited: true });
    expect(await syncVoultiInvoice("inv_1")).toEqual({ status: "Paid", credited: false });
    expect(balances.e1).toBe(100);
  });

  it("credits nothing while pending, expired or refunded", async () => {
    for (const status of ["Pending", "Expired", "Refunded"]) {
      invoice({ status });
      expect((await syncVoultiInvoice("inv_1")).credited).toBe(false);
    }
    expect(balances.e1).toBeUndefined();
  });

  it("refuses a paid invoice whose amount is not the price of the credits", async () => {
    invoice({ status: "Paid", amount_fiat: 1 });
    expect(await syncVoultiInvoice("inv_1")).toEqual({ status: "mismatch", credited: false });
    invoice({ status: "Paid", fiat_currency: "COP" });
    expect((await syncVoultiInvoice("inv_1")).credited).toBe(false);
    expect(balances.e1).toBeUndefined();
  });

  it("ignores invoices that are not ours", async () => {
    invoice({ status: "Paid" });
    expect(await syncVoultiInvoice("inv_other")).toEqual({ status: "unknown", credited: false });
  });

  it("verifies the webhook signature on the raw body, within five minutes", async () => {
    const crypto = await import("node:crypto");
    const raw = '{"invoice_id":"inv_1","status":"Paid"}';
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac("sha256", "vsec").update(`${t}.${raw}`).digest("hex");
    expect(verifyVoultiSignature(raw, `t=${t},v1=${v1}`, "vsec")).toBe(true);
    expect(verifyVoultiSignature(raw + " ", `t=${t},v1=${v1}`, "vsec")).toBe(false);
    expect(verifyVoultiSignature(raw, `t=${t},v1=${v1}`, "other")).toBe(false);
    expect(verifyVoultiSignature(raw, `t=${t - 600},v1=${v1}`, "vsec")).toBe(false);
    expect(verifyVoultiSignature(raw, undefined, "vsec")).toBe(false);
  });
});
