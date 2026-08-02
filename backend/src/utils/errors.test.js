import { describe, it, expect } from "vitest";
import { classifyError, ErrorCode } from "./errors.js";

describe("error classification", () => {
  it("tells the caller a chain problem is temporary, without leaking internals", () => {
    // This exact string reached a client during load testing.
    const c = classifyError("wait for transaction timeout (code=TIMEOUT, version=6.16.0)");
    expect(c.code).toBe(ErrorCode.CHAIN_UNAVAILABLE);
    expect(c.status).toBe(503);
    expect(c.retryable).toBe(true);
    expect(c.retryAfter).toBeGreaterThan(0);
    expect(c.message).not.toMatch(/6\.16\.0|TIMEOUT/);
    expect(c.message).toMatch(/retry/i);
  });

  it("never exposes RPC endpoints or wallet internals", () => {
    for (const raw of [
      "All Celo RPC URLs exhausted",
      "capacity/rate limit on https://celo-mainnet.g.alchemy.com/v2/***",
      "insufficient funds for intrinsic transaction cost",
      "replacement transaction underpriced",
      "On-chain transaction reverted",
    ]) {
      const c = classifyError(raw);
      expect(c.retryable).toBe(true);
      expect(c.message).not.toMatch(/alchemy|http|celo-mainnet|underpriced/i);
    }
  });

  it("keeps validation messages verbatim because they are already actionable", () => {
    const c = classifyError("holder.full_name required");
    expect(c.code).toBe(ErrorCode.INVALID_PAYLOAD);
    expect(c.status).toBe(400);
    expect(c.retryable).toBe(false);
    // Retrying an invalid payload unchanged can only fail again.
    expect(c.message).toBe("holder.full_name required");
  });

  it("marks payload problems as non-retryable and infra problems as retryable", () => {
    expect(classifyError("issuer.display_name and issuer.slug required").retryable).toBe(false);
    expect(classifyError("Provide only one of template_id, template_slug, template.").retryable).toBe(false);
    expect(classifyError("This entity is suspended and cannot issue credentials.").retryable).toBe(false);

    expect(classifyError("Pinata upload failed (500): upstream").retryable).toBe(true);
    expect(classifyError("All Celo RPC URLs exhausted").retryable).toBe(true);
  });

  it("classifies IPFS problems separately from chain problems", () => {
    const c = classifyError("Pinata upload failed (502): bad gateway");
    expect(c.code).toBe(ErrorCode.STORAGE_UNAVAILABLE);
    expect(c.message).not.toMatch(/pinata|502/i);
  });

  it("flags missing configuration as not worth retrying", () => {
    const c = classifyError("REGISTRY_CONTRACT_ADDRESS missing");
    expect(c.code).toBe(ErrorCode.SERVICE_MISCONFIGURED);
    // No amount of retrying fixes an unset env var; a human has to act.
    expect(c.retryable).toBe(false);
  });

  it("falls back to a safe generic error for anything unrecognised", () => {
    const c = classifyError("TypeError: Cannot read properties of undefined (reading 'foo')");
    expect(c.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(c.status).toBe(500);
    expect(c.message).not.toMatch(/TypeError|undefined/);
    expect(c.message).toMatch(/request_id/);
  });

  it("keeps a refused credit reservation distinguishable from a database outage", () => {
    // Both messages come from the credit reservation in POST /issueCredential.
    // Collapsing them would tell an integrator whose key is fully funded to stop
    // retrying and go buy credits, because the database blinked.
    const empty = classifyError("Insufficient credits");
    expect(empty.code).toBe(ErrorCode.INSUFFICIENT_CREDITS);
    expect(empty.retryable).toBe(false);

    const outage = classifyError("database unavailable while reserving the credit");
    expect(outage.code).toBe(ErrorCode.DATABASE_UNAVAILABLE);
    expect(outage.retryable).toBe(true);
  });

  it("handles an Error object as well as a bare string", () => {
    expect(classifyError(new Error("holder.full_name required")).code).toBe(ErrorCode.INVALID_PAYLOAD);
    expect(classifyError(undefined).code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(classifyError(null).code).toBe(ErrorCode.INTERNAL_ERROR);
  });
});
