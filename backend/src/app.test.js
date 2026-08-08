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
    order: vi.fn().mockReturnThis(),
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

// Domain proofs: the DNS side has its own tests, so these mocks isolate the
// authorisation gate — who may attach which domain to which entity.
let mockApiKeyEntity = null;
vi.mock("./services/apiKeys.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getByPlainKey: vi.fn(async () => mockApiKeyEntity),
}));

const mockDeclareProof = vi.fn(async (entityId, domain) => ({
  id: "proof-1",
  resource: domain,
  verified: false,
  expected_record: "hashproof-verification=deadbeef",
}));
vi.mock("./services/entityProofs.js", async (importOriginal) => ({
  ...(await importOriginal()),
  declareProof: (...args) => mockDeclareProof(...args),
  verifyEntityProofs: vi.fn(async () => []),
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

// The success path of GET /verify/:id had no coverage at all, which is how a
// reference-before-initialisation in its own handler got past a green suite —
// on the most important endpoint in the API, and the one integrators read.
let mockCredential = null;
vi.mock("./services/getCredential.js", () => ({
  getCredentialById: vi.fn(async () => mockCredential),
}));

vi.mock("./services/verifyPipeline.js", () => ({
  runVerificationPipeline: vi.fn(async () => ({
    effectiveStatus: "active",
    statusSource: "contract",
    report: {
      contract: { available: true, status: "active" },
      ipfs: { available: true, status: "ok", matchesDatabaseJson: true },
      database: { available: true, status: "ok" },
    },
  })),
  verifyContractOnly: vi.fn(async () => ({ contract: {} })),
  verifyIpfsOnly: vi.fn(async () => ({ contract: {}, ipfs: {} })),
}));

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

  describe("GET /verify/:id", () => {
    beforeEach(() => {
      mockCredential = {
        id: "cred-1",
        issuer_entity_id: "e1",
        platform_entity_id: "e1",
        credential_json: {
          name: "Certificado de Asistencia",
          credentialSubject: { full_name: "Magda Carolina Buitrago Rojas", extra: "1049640988" },
        },
        credential_type: "attendance",
        created_at: "2026-08-08T01:10:14.633202+00:00",
        tx_hash: "0xabc",
        ipfs_cid: "bafy",
        issuer: [{ display_name: "Peewah", status: "organization_verified" }],
        platform: [{ display_name: "Peewah", status: "organization_verified" }],
        contexts: [{ title: "V Simposio" }],
        templates: [{ page_width: 1056, page_height: 816 }],
      };
    });

    it("answers, and keeps the fields integrators read", async () => {
      const { verifyEntityProofs } = await import("./services/entityProofs.js");
      verifyEntityProofs.mockResolvedValue([]);

      const res = await request(app).get("/verify/cred-1");

      expect(res.status).toBe(200);
      // The subject stays in the clear here — only the pinned copy is reduced.
      expect(res.body.credential.credentialSubject.full_name).toBe("Magda Carolina Buitrago Rojas");
      expect(res.body.status).toBe("active");
      expect(res.body.verification_report.ipfs.matchesDatabaseJson).toBe(true);
      expect(res.body.tx_hash).toBe("0xabc");
    });

    it("withholds the issuer badge while the domain is unproven", async () => {
      const { verifyEntityProofs } = await import("./services/entityProofs.js");
      verifyEntityProofs.mockResolvedValue([]);

      const res = await request(app).get("/verify/cred-1");

      expect(res.body.issuer_verified).toBe(false);
      expect(res.body.issuer_verification_level).toBe("reviewed");
      expect(res.body.issuer_proofs).toEqual([]);
    });

    it("grants it once the domain holds, and reuses the lookup when issuer and platform match", async () => {
      const { verifyEntityProofs } = await import("./services/entityProofs.js");
      verifyEntityProofs.mockClear();
      verifyEntityProofs.mockResolvedValue([{ resource: "peewah.co", verified: true }]);

      const res = await request(app).get("/verify/cred-1");

      expect(res.body.issuer_verified).toBe(true);
      expect(res.body.platform_verified).toBe(true);
      expect(res.body.issuer_verification_level).toBe("verified");
      expect(verifyEntityProofs).toHaveBeenCalledTimes(1);
    });

    it("returns 404 for an unknown credential", async () => {
      mockCredential = null;
      const res = await request(app).get("/verify/nope");
      expect(res.status).toBe(404);
    });
  });

  describe("issuer verification level", () => {
    // Paying for a review used to be enough for the badge, which put it back on
    // our word. It now also needs a domain proof — the half a reader can check.
    it("does not call an issuer verified on the review alone", async () => {
      const { verifyEntityProofs } = await import("./services/entityProofs.js");
      verifyEntityProofs.mockResolvedValue([]);
      mockEntityById = { id: "e1", status: "organization_verified" };

      const res = await request(app).get("/entities/e1");
      expect(res.body.is_verified).toBe(false);
      expect(res.body.verification_level).toBe("reviewed");
    });

    it("calls it verified once a domain proof holds too", async () => {
      const { verifyEntityProofs } = await import("./services/entityProofs.js");
      verifyEntityProofs.mockResolvedValue([{ resource: "peewah.co", verified: true }]);
      mockEntityById = { id: "e1", status: "organization_verified" };

      const res = await request(app).get("/entities/e1");
      expect(res.body.is_verified).toBe(true);
      expect(res.body.verification_level).toBe("verified");
    });

    it("stays at none when there was never a review, proof or not", async () => {
      const { verifyEntityProofs } = await import("./services/entityProofs.js");
      verifyEntityProofs.mockResolvedValue([{ resource: "peewah.co", verified: true }]);
      mockEntityById = { id: "e1", status: "unverified" };

      const res = await request(app).get("/entities/e1");
      expect(res.body.is_verified).toBe(false);
      expect(res.body.verification_level).toBe("none");
    });
  });

  describe("POST /entities/:id/proofs", () => {
    beforeEach(() => {
      mockApiKeyEntity = null;
      mockDeclareProof.mockClear();
      mockEntityById = { id: "peewah-uuid", slug: "peewah", website: "https://peewah.co" };
    });

    it("lets anyone confirm the domain already on record, with no credentials", async () => {
      const res = await request(app).post("/entities/peewah-uuid/proofs").send({ domain: "peewah.co" });
      expect(res.status).toBe(201);
      expect(mockDeclareProof).toHaveBeenCalledWith("peewah-uuid", "peewah.co");
    });

    it("accepts the same domain written as a URL or with www", async () => {
      for (const variant of ["https://www.peewah.co/x", "WWW.PEEWAH.CO"]) {
        const res = await request(app).post("/entities/peewah-uuid/proofs").send({ domain: variant });
        expect(res.status).toBe(201);
      }
    });

    it("refuses to hang someone else's domain off an issuer without credentials", async () => {
      const res = await request(app)
        .post("/entities/peewah-uuid/proofs")
        .send({ domain: "attacker-controlled.com" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("domain_not_authorized");
      expect(mockDeclareProof).not.toHaveBeenCalled();
    });

    it("allows a different domain when the entity's own API key is presented", async () => {
      mockApiKeyEntity = { id: "key-1", entity_id: "peewah-uuid" };
      const res = await request(app)
        .post("/entities/peewah-uuid/proofs")
        .set("Authorization", "Bearer some-key")
        .send({ domain: "peewah.io" });

      expect(res.status).toBe(201);
    });

    it("refuses another entity's API key", async () => {
      mockApiKeyEntity = { id: "key-2", entity_id: "someone-else" };
      const res = await request(app)
        .post("/entities/peewah-uuid/proofs")
        .set("Authorization", "Bearer other-key")
        .send({ domain: "attacker-controlled.com" });

      expect(res.status).toBe(403);
    });

    it("requires credentials for any domain when the issuer has no website on record", async () => {
      mockEntityById = { id: "peewah-uuid", slug: "peewah", website: null };
      const res = await request(app).post("/entities/peewah-uuid/proofs").send({ domain: "peewah.co" });
      expect(res.status).toBe(403);
    });

    it("rejects a malformed domain before anything else", async () => {
      const res = await request(app).post("/entities/peewah-uuid/proofs").send({ domain: "not a domain" });
      expect(res.status).toBe(400);
    });

    it("returns 404 for an unknown entity", async () => {
      mockEntityById = null;
      const res = await request(app).post("/entities/nope/proofs").send({ domain: "peewah.co" });
      expect(res.status).toBe(404);
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
