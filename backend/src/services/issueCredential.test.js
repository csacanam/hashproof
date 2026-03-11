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

vi.mock("ethers", () => {
  const Contract = vi.fn().mockImplementation(() => ({
    register: vi.fn().mockResolvedValue({
      hash: "0xmocktx",
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    }),
  }));
  const JsonRpcProvider = vi.fn();
  const Wallet = vi.fn().mockImplementation(() => ({}));
  return { Contract, JsonRpcProvider, Wallet };
});

import { supabase } from "../supabase.js";
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
    supabase.rpc.mockClear();
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

  it("passes background_url_override to prepare_credential when provided", async () => {
    const payload = {
      ...validPayload,
      background_url_override: "https://cdn.example.com/event-bg.png",
    };
    await executeIssueCredential(payload);
    const prepareCall = supabase.rpc.mock.calls.find((c) => c[0] === "prepare_credential");
    expect(prepareCall).toBeDefined();
    expect(prepareCall[1].p_payload.background_url_override).toBe(
      "https://cdn.example.com/event-bg.png"
    );
  });

  it("throws when template_id and template_slug are both provided", async () => {
    const payload = { ...validPayload, template_id: "00000000-0000-0000-0000-000000000005" };
    await expect(executeIssueCredential(payload)).rejects.toThrow(
      "Provide only one of template_id, template_slug, template."
    );
  });

  it("throws when inline template and template_slug are both provided", async () => {
    const payload = {
      ...validPayload,
      template: {
        slug: "inline-x",
        name: "Inline X",
        background_url: "https://example.com/bg.png",
        page_width: 1000,
        page_height: 1000,
        fields_json: [],
      },
    };
    await expect(executeIssueCredential(payload)).rejects.toThrow(
      "Provide only one of template_id, template_slug, template."
    );
  });

  it("does not call finalize_credential when IPFS pin fails", async () => {
    const { pinJsonToIpfs } = await import("./pinata.js");
    pinJsonToIpfs.mockRejectedValueOnce(new Error("pin failed"));

    await expect(executeIssueCredential(validPayload)).rejects.toThrow("pin failed");

    // Supabase RPC should only have been called for prepare_credential, not finalize_credential in this call
    const calls = supabase.rpc.mock.calls.map((c) => c[0]);
    expect(calls.filter((name) => name === "prepare_credential").length).toBeGreaterThanOrEqual(1);
    expect(calls.filter((name) => name === "finalize_credential").length).toBe(0);
  });

  it("unpins CID and does not finalize when on-chain registration fails", async () => {
    const { pinJsonToIpfs, unpinCid } = await import("./pinata.js");
    // Ensure chain path is used
    process.env.SKIP_CHAIN = "false";
    process.env.CELO_RPC_URL = "https://rpc.test";
    process.env.REGISTRY_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000001";
    process.env.REGISTRY_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

    pinJsonToIpfs.mockResolvedValueOnce("bafy-mock");

    const { Contract } = await import("ethers");
    // Make register() reject to simulate revert / RPC failure
    Contract.mockImplementationOnce(() => ({
      register: vi.fn().mockRejectedValue(new Error("on-chain failed")),
    }));

    await expect(executeIssueCredential(validPayload)).rejects.toThrow("on-chain failed");

    expect(unpinCid).toHaveBeenCalledWith("bafy-mock");
    const calls = supabase.rpc.mock.calls.map((c) => c[0]);
    expect(calls.filter((name) => name === "finalize_credential").length).toBe(0);
  });

  it("unpins CID when finalize_credential fails", async () => {
    const { pinJsonToIpfs, unpinCid } = await import("./pinata.js");
    process.env.SKIP_CHAIN = "true"; // avoid real chain path
    pinJsonToIpfs.mockResolvedValueOnce("bafy-finalize-fail");

    // First rpc call: prepare_credential OK, second: finalize_credential error
    supabase.rpc.mockImplementation(async (fnName) => {
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
          data: null,
          error: { message: "DB insert failed" },
        };
      }
      return { data: null, error: { message: `Unexpected rpc: ${fnName}` } };
    });

    await expect(executeIssueCredential(validPayload)).rejects.toThrow("DB insert failed");
    expect(unpinCid).toHaveBeenCalledWith("bafy-finalize-fail");
  });

  it("surfaces DB error when inline template slug already exists", async () => {
    // Simulate Postgres function rejecting inline template creation for existing slug.
    supabase.rpc.mockImplementationOnce(async (fnName) => {
      if (fnName === "prepare_credential") {
        return {
          data: null,
          error: { message: "Template already exists. Use template_slug or template_id." },
        };
      }
      return { data: null, error: { message: `Unexpected rpc: ${fnName}` } };
    });

    const payload = {
      ...validPayload,
      template_slug: undefined,
      template: {
        slug: "hashproof",
        name: "HashProof",
        background_url: "https://example.com/bg.png",
        page_width: 1000,
        page_height: 1000,
        fields_json: [{ key: "holder_name", required: true, x: 0, y: 0 }],
      },
    };

    await expect(executeIssueCredential(payload)).rejects.toThrow(
      "Template already exists. Use template_slug or template_id."
    );
  });
});
