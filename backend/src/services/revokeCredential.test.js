import { describe, it, expect, beforeEach, vi } from "vitest";

const ISSUER = "11111111-1111-4111-8111-111111111111";
const PLATFORM = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const CRED = "44444444-4444-4444-8444-444444444444";

let row;
let claimWins;
const updates = [];

// Just enough of the query builder for the three statements the service runs:
// read the row, claim it (update … is revoked_at null), and follow-up updates.
vi.mock("../supabase.js", () => ({
  supabase: {
    from: () => {
      let patch = null;
      let conditional = false;
      const b = {
        select: () => b,
        eq: () => b,
        is: () => {
          conditional = true;
          return b;
        },
        update: (p) => {
          patch = p;
          return b;
        },
        maybeSingle: async () => ({ data: row, error: null }),
        then: (resolve) => {
          if (patch) updates.push(patch);
          if (patch && conditional) {
            const won = claimWins;
            if (won) Object.assign(row, patch);
            return resolve({ data: won ? [{ id: row.id }] : [], error: null });
          }
          if (patch) Object.assign(row, patch);
          return resolve({ data: null, error: null });
        },
      };
      return b;
    },
  },
}));

const revokeOnChain = vi.fn();
vi.mock("./issueCredential.js", () => ({ revokeOnChain: (...a) => revokeOnChain(...a) }));
const invalidateContractCache = vi.fn();
vi.mock("./verifyPipeline.js", () => ({ invalidateContractCache: (...a) => invalidateContractCache(...a) }));

const { revokeCredential } = await import("./revokeCredential.js");

describe("revokeCredential", () => {
  beforeEach(() => {
    row = {
      id: CRED,
      issuer_entity_id: ISSUER,
      platform_entity_id: PLATFORM,
      contract_address: "0xregistry",
      revoked_at: null,
      revocation_tx_hash: null,
    };
    claimWins = true;
    updates.length = 0;
    revokeOnChain.mockReset().mockResolvedValue("0xtx");
    invalidateContractCache.mockReset();
  });

  it("revokes on-chain in the credential's own registry and records the tx", async () => {
    const r = await revokeCredential({
      credentialId: CRED,
      caller: { kind: "api_key", entityId: ISSUER },
      reason: "  issued to the wrong person  ",
    });
    expect(revokeOnChain).toHaveBeenCalledWith({ credentialId: CRED, contractAddress: "0xregistry" });
    expect(r).toMatchObject({ status: "revoked", tx_hash: "0xtx", already_revoked: false });
    expect(row.revocation_tx_hash).toBe("0xtx");
    expect(row.revocation_reason).toBe("issued to the wrong person");
    expect(invalidateContractCache).toHaveBeenCalledWith(CRED);
  });

  it("lets the platform that issued revoke too", async () => {
    await revokeCredential({ credentialId: CRED, caller: { kind: "api_key", entityId: PLATFORM } });
    expect(revokeOnChain).toHaveBeenCalledOnce();
  });

  it("answers another entity exactly as if the id did not exist", async () => {
    await expect(
      revokeCredential({ credentialId: CRED, caller: { kind: "api_key", entityId: OTHER } }),
    ).rejects.toThrow("Credential not found");
    expect(revokeOnChain).not.toHaveBeenCalled();
  });

  it("is idempotent: an already revoked credential sends nothing", async () => {
    row.revoked_at = "2026-09-01T00:00:00.000Z";
    row.revocation_tx_hash = "0xold";
    const r = await revokeCredential({ credentialId: CRED, caller: { kind: "admin" } });
    expect(r).toMatchObject({ already_revoked: true, tx_hash: "0xold" });
    expect(revokeOnChain).not.toHaveBeenCalled();
  });

  it("gives the row back when the chain refuses, so the database never claims a revocation that did not happen", async () => {
    revokeOnChain.mockRejectedValue(new Error("could not coalesce error"));
    await expect(
      revokeCredential({ credentialId: CRED, caller: { kind: "api_key", entityId: ISSUER } }),
    ).rejects.toMatchObject({ code: "revoke_chain_failed" });
    expect(row.revoked_at).toBeNull();
  });

  it("keeps the revocation when the chain says it was already revoked (done by hand earlier)", async () => {
    revokeOnChain.mockRejectedValue(new Error('execution reverted: custom error "AlreadyRevoked()"'));
    const r = await revokeCredential({ credentialId: CRED, caller: { kind: "api_key", entityId: ISSUER } });
    expect(r).toMatchObject({ status: "revoked", tx_hash: null });
    expect(row.revoked_at).not.toBeNull();
  });

  it("rejects ids that are not UUIDs before touching the database", async () => {
    await expect(
      revokeCredential({ credentialId: "abc", caller: { kind: "admin" } }),
    ).rejects.toThrow("Credential not found");
  });
});
