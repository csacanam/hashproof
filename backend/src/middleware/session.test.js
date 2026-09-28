import { describe, it, expect } from "vitest";

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://xxx.supabase.co";
process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "mock-key";
const { signedInByEmail } = await import("./session.js");

const jwt = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
const amr = (...methods) => jwt({ amr: methods.map((method) => ({ method, timestamp: 1 })) });

describe("signedInByEmail", () => {
  it("accepts sessions from an email link or code, and from an invitation", () => {
    expect(signedInByEmail(amr("otp"))).toBe(true);
    expect(signedInByEmail(amr("magiclink"))).toBe(true);
    expect(signedInByEmail(amr("invite"))).toBe(true);
  });

  it("rejects a password session, even alongside an email proof", () => {
    expect(signedInByEmail(amr("password"))).toBe(false);
    expect(signedInByEmail(amr("otp", "password"))).toBe(false);
  });

  it("rejects tokens without amr or that cannot be read", () => {
    expect(signedInByEmail(jwt({}))).toBe(false);
    expect(signedInByEmail("garbage")).toBe(false);
  });
});
