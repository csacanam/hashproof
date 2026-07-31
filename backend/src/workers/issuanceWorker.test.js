import { describe, it, expect, vi, beforeEach } from "vitest";
import { isPermanentError, backoffFor } from "../services/issuanceJobs.js";

vi.mock("../supabase.js", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

describe("issuance queue retry policy", () => {
  it("treats payload problems as permanent so they aren't retried forever", () => {
    expect(isPermanentError("holder.full_name required")).toBe(true);
    expect(isPermanentError("issuer_entity_id does not match issuer.slug")).toBe(true);
    expect(isPermanentError("Provide only one of template_id, template_slug, template.")).toBe(true);
    expect(isPermanentError("This entity is suspended and cannot issue credentials.")).toBe(true);
  });

  it("treats infrastructure problems as retryable", () => {
    // These must never be dropped: an accepted certificate has to end up sealed,
    // so a Celo or Pinata outage delays the job rather than failing it.
    expect(isPermanentError("wait for transaction timeout")).toBe(false);
    expect(isPermanentError("Pinata upload failed (500): upstream error")).toBe(false);
    expect(isPermanentError("insufficient funds for gas")).toBe(false);
    expect(isPermanentError("All Celo RPC URLs exhausted")).toBe(false);
    expect(isPermanentError("On-chain transaction reverted")).toBe(false);
  });

  it("backs off progressively and then holds steady", () => {
    expect(backoffFor(1)).toBe(5);
    expect(backoffFor(2)).toBe(15);
    expect(backoffFor(3)).toBe(45);
    // Never gives up: late attempts keep retrying on a fixed, sane interval.
    expect(backoffFor(20)).toBe(600);
    expect(backoffFor(1000)).toBe(600);
  });

  it("handles attempt counts at or below zero without falling off the table", () => {
    expect(backoffFor(0)).toBe(5);
    expect(backoffFor(-1)).toBe(5);
  });
});
