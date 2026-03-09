import { describe, it, expect, beforeEach, vi } from "vitest";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://xxx.supabase.co";
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "mock-key";
import request from "supertest";
import { createApp } from "./app.js";

// Mock Supabase so we don't need real credentials for API tests
vi.mock("./supabase.js", () => ({
  supabase: {
    rpc: vi.fn().mockRejectedValue(new Error("mock")),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "not found" },
      }),
    })),
  },
}));

describe("HashProof API", () => {
  let app;

  beforeEach(() => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://xxx.supabase.co";
    process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "mock-key";
    app = createApp({ skipPayment: true });
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
