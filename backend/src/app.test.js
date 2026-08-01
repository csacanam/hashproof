import { describe, it, expect, beforeEach, vi } from "vitest";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://xxx.supabase.co";
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "mock-key";
import request from "supertest";
import { createApp } from "./app.js";

let mockTemplatesRow = null;
let mockEntityById = null;
let mockExecuteIssueCredential = vi.fn();
let mockIssuanceLoad = { pendingSends: 0, awaitingReceipt: 0 };
let mockCreateIssuanceJob = vi.fn();
let mockGetIssuanceJob = vi.fn();

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

vi.mock("./services/issueCredential.js", async () => {
  // Keep the real validator: the async path relies on it to reject bad payloads
  // up front, so stubbing it would hide exactly what those tests check.
  const actual = await vi.importActual("./services/issueCredential.js");
  return {
    executeIssueCredential: vi.fn(async (...args) => mockExecuteIssueCredential(...args)),
    getIssuanceLoad: vi.fn(() => mockIssuanceLoad),
    validateIssuancePayload: actual.validateIssuancePayload,
  };
});

vi.mock("./services/issuanceJobs.js", () => ({
  createIssuanceJob: vi.fn(async (...args) => mockCreateIssuanceJob(...args)),
  getIssuanceJob: vi.fn(async (...args) => mockGetIssuanceJob(...args)),
}));

describe("HashProof API", () => {
  let app;

  beforeEach(() => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://xxx.supabase.co";
    process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "mock-key";
    app = createApp({ skipPayment: true });
    mockTemplatesRow = null;
    mockEntityById = null;
    mockIssuanceLoad = { pendingSends: 0, awaitingReceipt: 0 };
    mockCreateIssuanceJob = vi.fn(async () => ({
      job: { id: "job-uuid", status: "queued" },
      created: true,
    }));
    mockGetIssuanceJob = vi.fn(async () => null);
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

  const validAsyncPayload = {
    issuer: { display_name: "HashProof", slug: "hashproof" },
    platform: { display_name: "HashProof", slug: "hashproof" },
    holder: { full_name: "Diana Prieto" },
    context: { type: "event", title: "Evento" },
    credential_type: "attendance",
    title: "Asistencia",
    values: { holder_name: "Diana Prieto" },
  };

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

    it("sheds with 429 + Retry-After when the issuance queue is full, without issuing", async () => {
      mockIssuanceLoad = { pendingSends: 180, awaitingReceipt: 3 };

      const res = await request(app)
        .post("/issueCredential")
        .send({
          issuer: { display_name: "HashProof", slug: "hashproof" },
          platform: { display_name: "HashProof", slug: "hashproof" },
          holder: { full_name: "Diana Prieto" },
          context: { type: "event", title: "Burst" },
          credential_type: "attendance",
          title: "T",
          values: { holder_name: "Diana Prieto" },
        });

      expect(res.status).toBe(429);
      expect(res.headers["retry-after"]).toBe("10");
      expect(res.body.queued).toBe(180);
      // Must reject before doing any work — a shed request is never charged.
      expect(mockExecuteIssueCredential).not.toHaveBeenCalled();
    });

    // Peewah issues one credential per attendee click and reads the response
    // inline. That call must keep behaving exactly as before — async is opt-in,
    // and an existing integration that changes nothing must not notice.
    it("keeps the synchronous contract for clients that send no new fields", async () => {
      mockExecuteIssueCredential = vi.fn(async () => ({
        id: "cred-uuid",
        verification_url: "https://hashproof.dev/verify/cred-uuid",
        tx_hash: "0xabc",
        ipfs_cid: "bafy",
        ipfs_uri: "https://gateway.pinata.cloud/ipfs/bafy",
      }));

      const res = await request(app).post("/issueCredential").send(validAsyncPayload);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: "cred-uuid",
        verification_url: "https://hashproof.dev/verify/cred-uuid",
        tx_hash: "0xabc",
        ipfs_cid: "bafy",
        ipfs_uri: "https://gateway.pinata.cloud/ipfs/bafy",
      });
      // Issued inline, not queued: the caller gets a finished credential.
      expect(mockExecuteIssueCredential).toHaveBeenCalledTimes(1);
      expect(mockCreateIssuanceJob).not.toHaveBeenCalled();
    });

    it("treats async:false the same as not sending it at all", async () => {
      const res = await request(app)
        .post("/issueCredential")
        .send({ ...validAsyncPayload, async: false });

      expect(res.status).toBe(200);
      expect(mockCreateIssuanceJob).not.toHaveBeenCalled();
    });

    it("returns an actionable error instead of an internal one when the chain fails", async () => {
      // The literal string a client received during load testing.
      mockExecuteIssueCredential = vi.fn(async () => {
        throw new Error("wait for transaction timeout (code=TIMEOUT, version=6.16.0)");
      });

      const res = await request(app).post("/issueCredential").send(validAsyncPayload);

      expect(res.status).toBe(503);
      expect(res.body.code).toBe("chain_unavailable");
      expect(res.body.retryable).toBe(true);
      expect(res.headers["retry-after"]).toBeDefined();
      // `error` stays a plain string so integrations reading it keep working.
      expect(typeof res.body.error).toBe("string");
      expect(res.body.error).not.toMatch(/6\.16\.0|TIMEOUT/);
      // Correlates the client's report with the server log line.
      expect(res.body.request_id).toMatch(/^r_/);
      expect(res.headers["x-request-id"]).toBe(res.body.request_id);
    });

    it("keeps a bad payload as a non-retryable 400 with the specific reason", async () => {
      const res = await request(app)
        .post("/issueCredential")
        .send({ ...validAsyncPayload, holder: {} });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("invalid_payload");
      expect(res.body.retryable).toBe(false);
      expect(res.body.error).toMatch(/holder.full_name required/);
    });

    it("returns 202 immediately without issuing when async is requested", async () => {
      const res = await request(app)
        .post("/issueCredential")
        .send({ ...validAsyncPayload, async: true });

      expect(res.status).toBe(202);
      expect(res.body.job_id).toBe("job-uuid");
      expect(res.body.status).toBe("queued");
      expect(res.body.status_url).toContain("/issuanceJobs/job-uuid");
      // The whole point: nothing waits on the chain while the caller is on the line.
      expect(mockExecuteIssueCredential).not.toHaveBeenCalled();
    });

    it("accepts the Prefer: respond-async header as well as the body flag", async () => {
      const res = await request(app)
        .post("/issueCredential")
        .set("Prefer", "respond-async")
        .send(validAsyncPayload);

      expect(res.status).toBe(202);
      expect(mockExecuteIssueCredential).not.toHaveBeenCalled();
    });

    it("rejects a malformed payload up front instead of queueing it", async () => {
      const res = await request(app)
        .post("/issueCredential")
        .send({ ...validAsyncPayload, holder: {}, async: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/holder.full_name required/);
      expect(mockCreateIssuanceJob).not.toHaveBeenCalled();
    });

    it("passes the idempotency key through so repeat clicks collapse onto one job", async () => {
      await request(app)
        .post("/issueCredential")
        .set("Idempotency-Key", "attendee-42-event-7")
        .send({ ...validAsyncPayload, async: true });

      expect(mockCreateIssuanceJob).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: "attendee-42-event-7" }),
      );
    });

    it("does not charge again when a repeat click reuses an existing job", async () => {
      // created:false means the key matched an existing job — the user clicked
      // twice, which must not cost two credits.
      mockCreateIssuanceJob = vi.fn(async () => ({
        job: { id: "job-uuid", status: "processing" },
        created: false,
      }));

      const res = await request(app)
        .post("/issueCredential")
        .set("Idempotency-Key", "attendee-42-event-7")
        .send({ ...validAsyncPayload, async: true });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe("processing");
    });

    it("does not shed while the queue is below the limit", async () => {
      mockIssuanceLoad = { pendingSends: 179, awaitingReceipt: 40 };

      const res = await request(app)
        .post("/issueCredential")
        .send({
          issuer: { display_name: "HashProof", slug: "hashproof" },
          platform: { display_name: "HashProof", slug: "hashproof" },
          holder: { full_name: "Diana Prieto" },
          context: { type: "event", title: "Burst" },
          credential_type: "attendance",
          title: "T",
          values: { holder_name: "Diana Prieto" },
        });

      expect(res.status).toBe(200);
    });
  });

  describe("GET /issuanceJobs/:id", () => {
    it("reports work still in progress without download links", async () => {
      mockGetIssuanceJob = vi.fn(async () => ({
        id: "job-uuid",
        status: "processing",
        credential_id: null,
        attempts: 1,
      }));

      const res = await request(app).get("/issuanceJobs/job-uuid");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("processing");
      // A spinner must not be handed a download link before the seal exists.
      expect(res.body.credential).toBeUndefined();
    });

    it("exposes the download links once the credential is sealed", async () => {
      mockGetIssuanceJob = vi.fn(async () => ({
        id: "job-uuid",
        status: "completed",
        credential_id: "cred-uuid",
        attempts: 1,
      }));

      const res = await request(app).get("/issuanceJobs/job-uuid");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("completed");
      expect(res.body.credential.id).toBe("cred-uuid");
      expect(res.body.credential.verification_url).toContain("/verify/cred-uuid");
      expect(res.body.credential.pdf_url).toContain("/verify/cred-uuid/pdf");
    });

    it("surfaces the reason when a job failed permanently", async () => {
      mockGetIssuanceJob = vi.fn(async () => ({
        id: "job-uuid",
        status: "failed",
        credential_id: null,
        attempts: 1,
        last_error: "holder.full_name required",
      }));

      const res = await request(app).get("/issuanceJobs/job-uuid");
      expect(res.body.status).toBe("failed");
      expect(res.body.error).toBe("holder.full_name required");
    });

    it("signals that retries are under way so a client can tell working from stuck", async () => {
      mockGetIssuanceJob = vi.fn(async () => ({
        id: "job-uuid",
        status: "queued",
        credential_id: null,
        attempts: 4,
        last_error: "All Celo RPC URLs exhausted",
      }));

      const res = await request(app).get("/issuanceJobs/job-uuid");
      expect(res.body.status).toBe("queued");
      expect(res.body.attempts).toBe(4);
    });

    it("returns 404 for an unknown job", async () => {
      mockGetIssuanceJob = vi.fn(async () => null);
      const res = await request(app).get("/issuanceJobs/nope");
      expect(res.status).toBe(404);
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

    it("returns 200 for private template without auth", async () => {
      mockTemplatesRow = {
        id: "00000000-0000-0000-0000-000000000124",
        entity_id: "issuer-uuid",
        name: "Private Template",
        slug: "private-template",
        visibility: "private",
        fields_json: [{ key: "holder_name", required: true }],
      };

      const res = await request(app).get("/templates/private-template/requirements");
      expect(res.status).toBe(200);
      expect(res.body.required_keys).toEqual(["holder_name"]);
      expect(res.body.visibility).toBe("private");
    });
  });


  describe("POST /template-previews", () => {
    it("returns 400 when fields_json is missing", async () => {
      const res = await request(app)
        .post("/template-previews")
        .send({ page_width: 3508, page_height: 2480 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/fields_json/);
    });

    it("returns 400 when page dimensions are out of range", async () => {
      const res = await request(app)
        .post("/template-previews")
        .send({ page_width: 10, page_height: 2480, fields_json: [{ key: "holder_name", x: 0, y: 0 }] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/page_width/);
    });

    it("renders a PDF from an inline template without touching the database", async () => {
      const res = await request(app)
        .post("/template-previews")
        .send({
          page_width: 842,
          page_height: 595,
          fields_json: [
            { key: "holder_name", x: 100, y: 250, width: 642, font_size: 40, align: "center", bold: true },
            { key: "details", x: 100, y: 320, width: 642, font_size: 16, align: "center" },
          ],
          values: { holder_name: "Jane Doe", details: "For testing inline previews." },
        });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.body.length).toBeGreaterThan(1000);
      expect(res.body.slice(0, 5).toString()).toBe("%PDF-");
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
