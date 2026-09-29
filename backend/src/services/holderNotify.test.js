import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

let contacts; // credential_id -> row
let credentials; // id -> row
vi.mock("../supabase.js", () => {
  const q = (table) => {
    const f = {};
    let patch = null;
    let insertRow = null;
    const b = {
      select: () => b,
      eq: (k, v) => ((f[k] = v), b),
      update: (p) => ((patch = p), b),
      insert: (row) => ((insertRow = row), b),
      maybeSingle: async () => {
        if (table === "credentials") return { data: credentials[f.id] ?? null, error: null };
        return { data: contacts[f.credential_id] ?? null, error: null };
      },
      then: (resolve) => {
        if (insertRow) contacts[insertRow.credential_id] = { ...insertRow };
        if (patch && contacts[f.credential_id]) Object.assign(contacts[f.credential_id], patch);
        return resolve({ data: null, error: null });
      },
    };
    return b;
  };
  return { supabase: { from: q } };
});
const sendCredentialEmail = vi.fn();
vi.mock("./mailer.js", () => ({ sendCredentialEmail: (...a) => sendCredentialEmail(...a) }));
vi.mock("./issueCredential.js", () => ({
  normalizeHolderEmail: (v) => (typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? v.trim().toLowerCase() : null),
}));

const { applySendgridEvents, recordSend, resendCredentialEmail, verifySendgridSignature } = await import("./holderNotify.js");

const ORG = { id: "org-1", display_name: "Acme" };
const CRED = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  contacts = { [CRED]: { credential_id: CRED, email: "ana@x.co", notify_status: null } };
  credentials = {
    [CRED]: {
      id: CRED,
      issuer_entity_id: "org-1",
      platform_entity_id: "org-1",
      revoked_at: null,
      credential_json: { credentialSubject: { full_name: "Ana" }, issuer: { display_name: "Acme" }, context: { title: "Expo" } },
    },
  };
  sendCredentialEmail.mockReset().mockResolvedValue({ ok: true, messageId: "m1", error: null });
});

describe("SendGrid signature", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const sign = (ts, body) => crypto.createSign("sha256").update(ts + body).sign(privateKey, "base64");

  it("accepts a fresh event batch signed with the account's key", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = '[{"event":"delivered"}]';
    expect(verifySendgridSignature(body, sign(ts, body), ts, pub)).toBe(true);
  });

  it("rejects tampered bodies, other keys, old timestamps and missing headers", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = '[{"event":"delivered"}]';
    const sig = sign(ts, body);
    expect(verifySendgridSignature(body + " ", sig, ts, pub)).toBe(false);
    const other = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ type: "spki", format: "der" }).toString("base64");
    expect(verifySendgridSignature(body, sig, ts, other)).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect(verifySendgridSignature(body, sign(old, body), old, pub)).toBe(false);
    expect(verifySendgridSignature(body, undefined, ts, pub)).toBe(false);
    expect(verifySendgridSignature(body, sig, ts, undefined)).toBe(false);
  });
});

describe("delivery status", () => {
  it("records a send, then moves forward with SendGrid's events", async () => {
    await recordSend(CRED, { ok: true, messageId: "m1" });
    expect(contacts[CRED].notify_status).toBe("sent");
    await applySendgridEvents([{ event: "deferred", hashproof_credential_id: CRED, timestamp: 1 }]);
    expect(contacts[CRED].notify_status).toBe("deferred");
    await applySendgridEvents([{ event: "delivered", hashproof_credential_id: CRED, timestamp: 2 }]);
    expect(contacts[CRED].notify_status).toBe("delivered");
  });

  it("never lets a late event hide a better one", async () => {
    contacts[CRED].notify_status = "delivered";
    const out = await applySendgridEvents([{ event: "deferred", hashproof_credential_id: CRED }]);
    expect(contacts[CRED].notify_status).toBe("delivered");
    expect(out).toEqual({ applied: 0, ignored: 1 });
  });

  it("keeps a bounce with SendGrid's reason", async () => {
    contacts[CRED].notify_status = "sent";
    await applySendgridEvents([{ event: "bounce", hashproof_credential_id: CRED, reason: "550 mailbox unavailable" }]);
    expect(contacts[CRED]).toMatchObject({ notify_status: "bounced", notify_detail: "550 mailbox unavailable" });
  });

  it("ignores events that are not about a credential email", async () => {
    const out = await applySendgridEvents([
      { event: "delivered", email: "someone@x.co" }, // e.g. a sign-in email
      { event: "open", hashproof_credential_id: CRED },
    ]);
    expect(out).toEqual({ applied: 0, ignored: 2 });
  });

  it("records a refusal as failed", async () => {
    await recordSend(CRED, { ok: false, error: "SendGrid 403" });
    expect(contacts[CRED]).toMatchObject({ notify_status: "failed", notify_detail: "SendGrid 403" });
  });
});

describe("resend", () => {
  const args = (extra = {}) => ({ entity: ORG, credentialId: CRED, locale: "es", baseUrl: "https://hashproof.dev", ...extra });

  it("sends to the stored address and records it", async () => {
    expect(await resendCredentialEmail(args())).toEqual({ email: "ana@x.co", status: "sent" });
    expect(sendCredentialEmail.mock.calls[0][0]).toMatchObject({ to: "ana@x.co", holder: "Ana", issuer: "Acme", context: "Expo", credentialId: CRED });
    expect(contacts[CRED].notify_status).toBe("sent");
  });

  it("replaces a wrong address with the corrected one", async () => {
    await resendCredentialEmail(args({ email: " Ana.Ruiz@X.co " }));
    expect(contacts[CRED].email).toBe("ana.ruiz@x.co");
    expect(sendCredentialEmail.mock.calls[0][0].to).toBe("ana.ruiz@x.co");
  });

  it("sends for the first time when the credential had no address", async () => {
    delete contacts[CRED];
    await resendCredentialEmail(args({ email: "new@x.co" }));
    expect(contacts[CRED].email).toBe("new@x.co");
  });

  it("refuses revoked credentials, other organizations' and bad addresses", async () => {
    await expect(resendCredentialEmail(args({ entity: { id: "other" } }))).rejects.toThrow("Credential not found");
    await expect(resendCredentialEmail(args({ email: "nope" }))).rejects.toMatchObject({ status: 400 });
    credentials[CRED].revoked_at = "2026-09-29T00:00:00Z";
    await expect(resendCredentialEmail(args())).rejects.toMatchObject({ code: "credential_revoked" });
    expect(sendCredentialEmail).not.toHaveBeenCalled();
  });

  it("reports a refused send as an error the dashboard can show", async () => {
    sendCredentialEmail.mockResolvedValue({ ok: false, messageId: null, error: "SendGrid 401" });
    await expect(resendCredentialEmail(args())).rejects.toMatchObject({ code: "email_failed" });
    expect(contacts[CRED].notify_status).toBe("failed");
  });
});
