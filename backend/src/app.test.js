import { describe, it, expect, beforeEach, vi } from "vitest";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://xxx.supabase.co";
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "mock-key";
import request from "supertest";
import { createApp } from "./app.js";

let mockTemplatesRow = null;
let mockEntityById = null;
let mockExecuteIssueCredential = vi.fn();

function makeThenableBuilder({ data, error }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "not found" },
    }),
    // Awaiting the builder should yield { data, error }
    then: (resolve) => resolve({ data, error }),
  };
}

// Mock Supabase so we don't need real credentials for API tests
vi.mock("./supabase.js", () => ({
  supabase: {
    rpc: vi.fn().mockRejectedValue(new Error("mock")),
    from: vi.fn((table) => {
      if (table === "templates") {
        return makeThenableBuilder({
          data: mockTemplatesRow ? [mockTemplatesRow] : [],
          error: null,
        });
      }
      if (table === "entities") {
        return makeThenableBuilder({
          data: [],
          error: { code: "PGRST116", message: "not found" },
        });
      }
      return makeThenableBuilder({ data: [], error: null });
    }),
  },
}));

vi.mock("./services/getEntity.js", () => ({
  getEntityById: vi.fn(async () => mockEntityById),
}));

vi.mock("./services/issueCredential.js", () => ({
  executeIssueCredential: vi.fn(async (...args) => mockExecuteIssueCredential(...args)),
}));

describe("HashProof API", () => {
  let app;

  beforeEach(() => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://xxx.supabase.co";
    process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "mock-key";
    app = createApp({ skipPayment: true });
    mockTemplatesRow = null;
    mockEntityById = null;
    mockExecuteIssueCredential = vi.fn().mockImplementation(async (payload) => {
      if (!payload || !payload.issuer?.display_name || !payload.issuer?.slug) {
        throw new Error("issuer.display_name and issuer.slug required");
      }
      if (!payload.platform?.display_name || !payload.platform?.slug) {
        throw new Error("platform.display_name and platform.slug required");
      }
      if (!payload.holder?.full_name) throw new Error("holder.full_name required");
      if (!payload.context?.type || !payload.context?.title) throw new Error("context.type and context.title required");
      if (!payload.credential_type || !payload.title) throw new Error("credential_type and title required");
      return { ok: true };
    });
  });

  describe("GET /", () => {
    it("returns service info", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("HashProof API");
      expect(res.body.endpoints["POST /issueCredential"]).toContain("Paid");
    });
  });

  describe("POST /issueCredential", () => {
    it("returns 400 when body is empty", async () => {
      const res = await request(app).post("/issueCredential").send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("returns 400 when issuer is missing", async () => {
      const res = await request(app)
        .post("/issueCredential")
        .send({
          platform: { display_name: "P", slug: "p" },
          holder: { full_name: "Juan" },
          context: { type: "event", title: "E" },
          template_slug: "x",
          credential_type: "attendance",
          title: "T",
          values: {},
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/);
    });

    it("returns 400 when issuer_entity_id does not match issuer.slug", async () => {
      mockEntityById = { id: "issuer-uuid", slug: "hashproof" };
      const res = await request(app)
        .post("/issueCredential")
        .send({
          issuer_entity_id: "issuer-uuid",
          issuer: { display_name: "Issuer B", slug: "issuer-b" },
          platform: { display_name: "Issuer B", slug: "issuer-b" },
          holder: { full_name: "Diana Prieto" },
          context: { type: "event", title: "Mismatch" },
          credential_type: "attendance",
          title: "T",
          values: { holder_name: "Diana Prieto" },
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("issuer_entity_id does not match issuer.slug");
    });

    it("accepts authorized wallet even if stored with checksum case", async () => {
      mockEntityById = {
        id: "issuer-uuid",
        slug: "hashproof",
        status: "organization_verified",
        authorized_wallets: ["0xAbCdEf0000000000000000000000000000000000"],
      };

      const xPayment = Buffer.from(
        JSON.stringify({ payload: { authorization: { from: "0xabcdef0000000000000000000000000000000000" } } }),
        "utf8"
      ).toString("base64");

      const res = await request(app)
        .post("/issueCredential")
        .set("X-PAYMENT", xPayment)
        .send({
          issuer_entity_id: "issuer-uuid",
          issuer: { display_name: "HashProof", slug: "hashproof" },
          platform: { display_name: "HashProof", slug: "hashproof" },
          holder: { full_name: "Diana Prieto" },
          context: { type: "event", title: "Auth wallet test" },
          credential_type: "attendance",
          title: "T",
          values: { holder_name: "Diana Prieto" },
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe("GET /templates/:ref/requirements", () => {
    it("returns 200 for public template without auth", async () => {
      mockTemplatesRow = {
        id: "00000000-0000-0000-0000-000000000123",
        entity_id: "issuer-uuid",
        name: "Public Template",
        slug: "public-template",
        visibility: "public",
        fields_json: [{ key: "holder_name", required: true }],
      };

      const res = await request(app).get("/templates/public-template/requirements");
      expect(res.status).toBe(200);
      expect(res.body.required_keys).toEqual(["holder_name"]);
      expect(res.body.visibility).toBe("public");
      expect(res.body.slug).toBe("public-template");
      expect(res.body.id).toBe("00000000-0000-0000-0000-000000000123");
    });

    it("returns 403 for private template without auth", async () => {
      mockTemplatesRow = {
        id: "00000000-0000-0000-0000-000000000124",
        entity_id: "issuer-uuid",
        name: "Private Template",
        slug: "private-template",
        visibility: "private",
        fields_json: [{ key: "holder_name", required: true }],
      };
      mockEntityById = {
        id: "issuer-uuid",
        slug: "hashproof",
        authorized_wallets: ["0xabc"],
      };

      const res = await request(app).get("/templates/private-template/requirements");
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not authorized/i);
    });
  });

  describe("GET /verify/:id", () => {
    it("returns 404 when credential not found", async () => {
      const res = await request(app).get("/verify/00000000-0000-0000-0000-000000000000");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Credential not found");
    });
  });

  describe("GET /verify/:id/pdf", () => {
    it("returns 404 when credential not found", async () => {
      const res = await request(app).get("/verify/00000000-0000-0000-0000-000000000000/pdf");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Credential not found");
    });
  });
});
