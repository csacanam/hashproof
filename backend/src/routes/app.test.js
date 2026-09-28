import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const ORG = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";

let users; // token -> user
let roles; // `${userId}:${entityId}` -> role

vi.mock("../supabase.js", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async (token) =>
        users[token] ? { data: { user: users[token] }, error: null } : { data: null, error: { message: "bad jwt" } },
      ),
    },
  },
}));
vi.mock("../services/getEntity.js", () => ({
  getEntityById: vi.fn(async (id) => ({ id, display_name: "Acme", slug: "acme", status: "unverified", authorized_wallets: ["0xsecret"] })),
}));
vi.mock("../services/accounts.js", () => ({
  MANAGER_ROLES: ["owner", "admin"],
  getMembership: vi.fn(async (u, e) => roles[`${u}:${e}`] ?? null),
  listMemberships: vi.fn(async () => []),
  createOrganization: vi.fn(),
  getPanelKey: vi.fn(async () => ({ id: "panel", credits_balance: 7 })),
  listMembers: vi.fn(async () => []),
  addMember: vi.fn(),
  removeMember: vi.fn(),
}));
vi.mock("../services/listCredentials.js", () => ({
  listCredentials: vi.fn(async () => ({ total: 3, credentials: [] })),
}));
vi.mock("../services/revokeCredential.js", () => ({ revokeCredential: vi.fn(async () => ({ status: "revoked" })) }));
const issueFromDashboard = vi.fn(async () => ({ job_id: "j1", status: "queued", created: true, remaining: 6 }));
vi.mock("../services/dashboardIssuance.js", async (orig) => ({
  ...(await orig()),
  issueFromDashboard: (...a) => issueFromDashboard(...a),
}));
vi.mock("../services/issueCredential.js", () => ({ validateIssuancePayload: () => {} }));
vi.mock("../services/issuanceJobs.js", () => ({ createIssuanceJob: vi.fn() }));
vi.mock("../services/apiKeys.js", () => ({ deductCredit: vi.fn(), refundCredit: vi.fn() }));
vi.mock("../services/dashboardTemplates.js", () => ({
  listTemplates: vi.fn(async () => []),
  createTemplate: vi.fn(async () => ({ id: "t1" })),
  updateTemplate: vi.fn(),
  uploadBackground: vi.fn(),
}));
const createEntityKey = vi.fn(async () => ({ id: KEY, api_key: "hp_new" }));
vi.mock("../services/dashboardKeys.js", () => ({
  listEntityKeys: vi.fn(async () => [{ kind: "api", credits_balance: 5, revoked_at: null }]),
  createEntityKey: (...a) => createEntityKey(...a),
  getEntityKey: vi.fn(async (e, k) => ({ id: k, entity_id: e, name: "prod", credits_balance: 10, revoked_at: null })),
  revokeEntityKey: vi.fn(),
  transferCredits: vi.fn(),
}));
const completeX402Purchase = vi.fn(async () => ({ credited: true, purchase_id: "p1" }));
vi.mock("../services/payments.js", async (orig) => ({
  ...(await orig()),
  completeX402Purchase: (...a) => completeX402Purchase(...a),
  listPurchases: vi.fn(async () => []),
}));

const { createAppRouter } = await import("./app.js");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/app", createAppRouter({ baseUrl: "https://hashproof.dev", frontendUrl: "https://hashproof.dev", skipPayment: true }));
  return app;
}

describe("dashboard routes", () => {
  let app;
  beforeEach(() => {
    users = { owner: { id: "u-owner", email: "o@acme.co" }, issuer: { id: "u-issuer" }, stranger: { id: "u-x" } };
    roles = { [`u-owner:${ORG}`]: "owner", [`u-issuer:${ORG}`]: "issuer" };
    issueFromDashboard.mockClear();
    createEntityKey.mockClear();
    completeX402Purchase.mockClear();
    app = makeApp();
  });

  it("serves pricing without a session", async () => {
    const res = await request(app).get("/app/pricing");
    expect(res.status).toBe(200);
    expect(res.body.stripe.cents_per_credit).toBe(20);
    expect(res.body.x402.cents_per_credit).toBe(10);
  });

  it("requires a session", async () => {
    expect((await request(app).get("/app/me")).status).toBe(401);
    expect((await request(app).get("/app/me").set("Authorization", "Bearer nope")).status).toBe(401);
  });

  it("does not accept an API key as a session", async () => {
    const res = await request(app).get("/app/me").set("Authorization", "Bearer hp_somekey");
    expect(res.status).toBe(401);
  });

  it("answers 404 to a non-member, the same as a missing organization", async () => {
    const res = await request(app).get(`/app/organizations/${ORG}`).set("Authorization", "Bearer stranger");
    expect(res.status).toBe(404);
  });

  it("shows members the overview without internal fields", async () => {
    const res = await request(app).get(`/app/organizations/${ORG}`).set("Authorization", "Bearer issuer");
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(7);
    expect(res.body.entity).not.toHaveProperty("authorized_wallets");
  });

  it("lets any member issue, always as the organization", async () => {
    const res = await request(app)
      .post(`/app/organizations/${ORG}/issue`)
      .set("Authorization", "Bearer issuer")
      .send({ input: { holder_name: "Ana" }, idempotency_key: "row-1" });
    expect(res.status).toBe(202);
    expect(issueFromDashboard.mock.calls[0][0].entity.id).toBe(ORG);
    expect(res.body.status_url).toBe("https://hashproof.dev/issuanceJobs/j1");
  });

  it("keeps key management to owners and admins", async () => {
    const denied = await request(app).post(`/app/organizations/${ORG}/keys`).set("Authorization", "Bearer issuer").send({});
    expect(denied.status).toBe(403);
    const ok = await request(app).post(`/app/organizations/${ORG}/keys`).set("Authorization", "Bearer owner").send({ name: "prod" });
    expect(ok.status).toBe(201);
    expect(ok.body.api_key).toBe("hp_new");
  });

  it("asks for confirmation before revoking", async () => {
    const res = await request(app)
      .post(`/app/organizations/${ORG}/credentials/abc/revoke`)
      .set("Authorization", "Bearer issuer")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("confirmation_required");
  });

  it("validates a whole batch without charging", async () => {
    const res = await request(app)
      .post(`/app/organizations/${ORG}/issue/validate`)
      .set("Authorization", "Bearer issuer")
      .send({ rows: [{ holder_name: "Ana", context_title: "X", title: "T" }, { holder_name: "" }] });
    expect(res.body.valid).toBe(1);
    expect(res.body.errors).toEqual([{ row: 1, error: "holder_name is required" }]);
    expect(issueFromDashboard).not.toHaveBeenCalled();
  });

  it("buys credits over x402 for the amount in the body", async () => {
    const res = await request(app)
      .post(`/app/organizations/${ORG}/keys/${KEY}/x402`)
      .set("Authorization", "Bearer owner")
      .send({ credits: 25 });
    expect(res.status).toBe(200);
    expect(completeX402Purchase.mock.calls[0][0]).toMatchObject({ credits: 25 });
  });

  it("rejects an x402 purchase under the minimum before any payment", async () => {
    const res = await request(app)
      .post(`/app/organizations/${ORG}/keys/${KEY}/x402`)
      .set("Authorization", "Bearer owner")
      .send({ credits: 3 });
    expect(res.status).toBe(400);
    expect(completeX402Purchase).not.toHaveBeenCalled();
  });

  it("says card payments are unavailable until Stripe is configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await request(app)
      .post(`/app/organizations/${ORG}/keys/${KEY}/checkout`)
      .set("Authorization", "Bearer owner")
      .send({ credits: 100 });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("stripe_unavailable");
  });
});
