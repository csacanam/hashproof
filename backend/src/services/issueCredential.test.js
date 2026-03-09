import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../supabase.js", () => {
  return {
    supabase: {
      rpc: vi.fn().mockImplementation(async (fnName) => {
        if (fnName === "prepare_credential") {
          return {
            data: {
              id: "mock-id",
              verification_url: "https://example.com/verify/mock-id",
              prepared: {
                id: "mock-id",
                issuer_entity_id: "00000000-0000-0000-0000-000000000001",
                platform_entity_id: "00000000-0000-0000-0000-000000000002",
                holder_id: "00000000-0000-0000-0000-000000000003",
                context_id: "00000000-0000-0000-0000-000000000004",
                template_id: "00000000-0000-0000-0000-000000000005",
                credential_type: "attendance",
                title: "Asistencia",
                expires_at: null,
                credential_json: { name: "Test" },
                chain_name: "celo",
                chain_id: 42220,
                contract_address: "0x0000000000000000000000000000000000000000",
              },
            },
            error: null,
          };
        }
        if (fnName === "finalize_credential") {
          return {
            data: { ok: true },
            error: null,
          };
        }
        return { data: null, error: { message: `Unexpected rpc: ${fnName}` } };
      }),
    },
  };
});

vi.mock("./pinata.js", () => ({
  pinJsonToIpfs: vi.fn().mockResolvedValue("bafy-test-cid"),
  unpinCid: vi.fn().mockResolvedValue(true),
}));

import { validateTemplateValues, executeIssueCredential } from "./issueCredential.js";

describe("validateTemplateValues", () => {
  it("passes when required keys are present", () => {
    const fields = [
      { key: "holder_name", required: true },
      { key: "event_name", required: true },
    ];
    const values = { holder_name: "Juan", event_name: "Blockchain 101" };
    expect(() => validateTemplateValues(fields, values)).not.toThrow();
  });

  it("passes when field has required: false and value is missing", () => {
    const fields = [{ key: "optional_field", required: false }];
    const values = {};
    expect(() => validateTemplateValues(fields, values)).not.toThrow();
  });

  it("passes when field has no key (e.g. QR)", () => {
    const fields = [{ key: null }];
    const values = {};
    expect(() => validateTemplateValues(fields, values)).not.toThrow();
  });

  it("throws when required key is missing", () => {
    const fields = [{ key: "holder_name", required: true }];
    const values = {};
    expect(() => validateTemplateValues(fields, values)).toThrow(
      "Missing required template value for key: holder_name"
    );
  });

  it("throws when required key is empty string", () => {
    const fields = [{ key: "event_name", required: true }];
    const values = { event_name: "   " };
    expect(() => validateTemplateValues(fields, values)).toThrow(
      "Missing required template value for key: event_name"
    );
  });

  it("treats undefined required as optional (default false)", () => {
    const fields = [{ key: "date" }];
    const values = {};
    expect(() => validateTemplateValues(fields, values)).not.toThrow();
  });

  it("handles empty fields array", () => {
    expect(() => validateTemplateValues([], {})).not.toThrow();
  });

  it("handles null/undefined fieldsJson", () => {
    expect(() => validateTemplateValues(null, {})).not.toThrow();
  });
});

describe("executeIssueCredential", () => {
  const validPayload = {
    issuer: { display_name: "Test Issuer", slug: "test-issuer" },
    platform: { display_name: "Test Platform", slug: "test-platform" },
    holder: { full_name: "Juan Pérez" },
    context: { type: "event", title: "Blockchain 101" },
    template_slug: "hashproof",
    credential_type: "attendance",
    title: "Asistencia",
    values: { holder_name: "Juan Pérez", details: "In recognition of participation in Blockchain 101." },
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.SKIP_CHAIN = "true";
  });

  it("throws when issuer.display_name is missing", async () => {
    const payload = { ...validPayload, issuer: { slug: "x" } };
    await expect(executeIssueCredential(payload)).rejects.toThrow(
      "issuer.display_name and issuer.slug required"
    );
  });

  it("throws when holder.full_name is missing", async () => {
    const payload = { ...validPayload, holder: {} };
    await expect(executeIssueCredential(payload)).rejects.toThrow(
      "holder.full_name required"
    );
  });

  it("accepts payload without template (uses base template)", async () => {
    const payload = {
      ...validPayload,
      template_id: undefined,
      template_slug: undefined,
      template: undefined,
      values: { holder_name: "Juan Pérez" },
    };
    const result = await executeIssueCredential(payload);
    expect(result).toMatchObject({
      id: expect.any(String),
      verification_url: expect.any(String),
      tx_hash: expect.stringMatching(/^0x/),
      ipfs_cid: expect.any(String),
      ipfs_uri: expect.any(String),
    });
  });
});
