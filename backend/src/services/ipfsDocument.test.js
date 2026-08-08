import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildIpfsDocument, isRedactedDocument, IPFS_DOC_VERSION } from "./ipfsDocument.js";

// Shaped like what production actually pins: the issuer template contributed
// `extra` (a national ID number) and `details`, and `holder_name` duplicates
// `full_name`.
const CREDENTIAL = {
  id: "cred-1",
  name: "Certificado de Asistencia",
  issuer: { display_name: "Peewah" },
  context: { title: "V Simposio Residentes" },
  issuanceDate: "2026-08-08T01:10:12.105Z",
  credentialSubject: {
    extra: "1049640988",
    details: "Attended V Simposio Residentes",
    full_name: "Magda Carolina Buitrago Rojas",
    holder_name: "Magda Carolina Buitrago Rojas",
  },
};

describe("IPFS document", () => {
  const original = process.env.CREDENTIAL_HASH_SECRET;

  beforeEach(() => {
    process.env.CREDENTIAL_HASH_SECRET = "test-secret";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CREDENTIAL_HASH_SECRET;
    else process.env.CREDENTIAL_HASH_SECRET = original;
  });

  it("keeps the national ID out of what gets published", () => {
    const doc = buildIpfsDocument(CREDENTIAL, "cred-1");
    const serialized = JSON.stringify(doc);

    expect(serialized).not.toContain("1049640988");
    expect(doc.credentialSubject.extra).toBeUndefined();
  });

  it("publishes no personal data at all, not even the name", () => {
    const doc = buildIpfsDocument(CREDENTIAL, "cred-1");
    const serialized = JSON.stringify(doc);

    expect(serialized).not.toContain("Magda Carolina Buitrago Rojas");
    expect(doc.credentialSubject.full_name).toBeUndefined();
    expect(doc.credentialSubject.holder_name).toBeUndefined();
    expect(doc.credentialSubject.details).toBeUndefined();
    expect(Object.keys(doc.credentialSubject).sort()).toEqual(["alg", "hash"]);
  });

  it("leaves everything outside credentialSubject untouched", () => {
    const doc = buildIpfsDocument(CREDENTIAL, "cred-1");

    expect(doc.name).toBe(CREDENTIAL.name);
    expect(doc.issuer).toEqual(CREDENTIAL.issuer);
    expect(doc.context).toEqual(CREDENTIAL.context);
    expect(doc.issuanceDate).toBe(CREDENTIAL.issuanceDate);
  });

  it("is deterministic, so verification can rebuild it from the database row", () => {
    const pinned = buildIpfsDocument(CREDENTIAL, "cred-1");
    const rebuilt = buildIpfsDocument(CREDENTIAL, "cred-1");

    expect(rebuilt).toEqual(pinned);
  });

  it("commits differently for the same subject under a different credential", () => {
    const a = buildIpfsDocument(CREDENTIAL, "cred-1");
    const b = buildIpfsDocument(CREDENTIAL, "cred-2");

    expect(a.credentialSubject.hash).not.toBe(b.credentialSubject.hash);
  });

  it("changes the commitment when a hidden field is tampered with", () => {
    const pinned = buildIpfsDocument(CREDENTIAL, "cred-1");
    const tampered = buildIpfsDocument(
      { ...CREDENTIAL, credentialSubject: { ...CREDENTIAL.credentialSubject, extra: "999" } },
      "cred-1"
    );

    expect(tampered.credentialSubject.hash).not.toBe(pinned.credentialSubject.hash);
  });

  it("does not depend on key order in the subject", () => {
    const reordered = {
      ...CREDENTIAL,
      credentialSubject: {
        holder_name: CREDENTIAL.credentialSubject.holder_name,
        full_name: CREDENTIAL.credentialSubject.full_name,
        details: CREDENTIAL.credentialSubject.details,
        extra: CREDENTIAL.credentialSubject.extra,
      },
    };

    expect(buildIpfsDocument(reordered, "cred-1").credentialSubject.hash).toBe(
      buildIpfsDocument(CREDENTIAL, "cred-1").credentialSubject.hash
    );
  });

  it("still redacts when no secret is configured, just without the commitment", () => {
    delete process.env.CREDENTIAL_HASH_SECRET;
    const doc = buildIpfsDocument(CREDENTIAL, "cred-1");
    const serialized = JSON.stringify(doc);

    expect(serialized).not.toContain("1049640988");
    expect(serialized).not.toContain("Magda Carolina Buitrago Rojas");
    expect(doc.credentialSubject.hash).toBeUndefined();
    expect(isRedactedDocument(doc)).toBe(true);
  });

  it("tells redacted documents apart from legacy full pins", () => {
    expect(isRedactedDocument(buildIpfsDocument(CREDENTIAL, "cred-1"))).toBe(true);
    expect(isRedactedDocument(CREDENTIAL)).toBe(false);
    expect(isRedactedDocument(null)).toBe(false);
    expect(isRedactedDocument({ credentialSubjectRedaction: "something-else" })).toBe(false);
  });

  it("marks the document with the version verification keys off", () => {
    expect(buildIpfsDocument(CREDENTIAL, "cred-1").credentialSubjectRedaction).toBe(
      IPFS_DOC_VERSION
    );
  });
});
