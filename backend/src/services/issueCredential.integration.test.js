/**
 * Integration test: requires Supabase (run schema, seed, and issue_credential function first).
 * Skips when SUPABASE_URL is not set.
 */

import { describe, it, expect } from "vitest";
import { executeIssueCredential } from "./issueCredential.js";

const hasSupabase =
  !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) &&
  !process.env.SUPABASE_URL.includes("test.supabase.co");

describe.skipIf(!hasSupabase)("executeIssueCredential integration", () => {
  it("issues a credential when payload is valid (inline template)", async () => {
    const payload = {
      issuer: {
        display_name: "Test Issuer Integration",
        slug: "test-issuer-integration",
      },
      platform: {
        display_name: "Test Platform Integration",
        slug: "test-platform-integration",
      },
      holder: { full_name: "Integration Test User" },
      context: {
        type: "event",
        title: "Integration Test Event",
      },
      template: {
        slug: "test-inline-template",
        name: "Event Attendance",
        background_url: "https://example.com/bg.png",
        page_width: 595,
        page_height: 842,
        fields_json: [
          { key: "holder_name", x: 100, y: 200, required: true },
          { key: "details", x: 100, y: 260, required: false },
        ],
      },
      credential_type: "attendance",
      title: "Asistencia",
      values: {
        holder_name: "Integration Test User",
        details: "In recognition of participation in Integration Test Event.",
      },
    };

    const result = await executeIssueCredential(payload);

    expect(result.id).toBeDefined();
    expect(result.verification_url).toContain(result.id);
    expect(result.tx_hash).toMatch(/^0x[a-f0-9]+$/);
  }, 10000);
});
