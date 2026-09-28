// Locks down what issuance does for requests shaped like the ones Peewah sends
// every day (taken from production: basic-name and basic-name-and-extra with a
// background override, an inline template, async with an idempotency key).
//
// Every outward call — database RPCs, IPFS, the registry tx — is recorded and
// compared against a snapshot taken from the code before the dashboard work.
// If this fails, an existing integration would see different behavior. Only
// update the snapshot when that change is deliberate and announced.
import { it, expect, vi } from "vitest";

const log = [];
const rec = (kind, args) => log.push({ kind, args: JSON.parse(JSON.stringify(args, (_k, v) => (typeof v === "bigint" ? `${v}n` : v))) });

vi.mock("../supabase.js", () => ({
  supabase: {
    rpc: vi.fn(async (fn, args) => {
      rec(`rpc:${fn}`, args);
      if (fn === "prepare_credential") {
        return { data: { id: "cred-1", prepared: { id: "cred-1", contract_address: "0xabc", credential_json: { credentialSubject: args.p_payload.values } } }, error: null };
      }
      return { data: { ok: true }, error: null };
    }),
    from: vi.fn((table) => { rec(`from:${table}`, {}); return { insert: async (row) => { rec(`insert:${table}`, row); return { error: null }; } }; }),
  },
}));
vi.mock("./pinata.js", () => ({
  pinJsonToIpfs: vi.fn(async (doc, name) => { rec("pin", { doc, name }); return "bafy"; }),
  unpinCid: vi.fn(),
}));
vi.mock("./credentialArtifacts.js", () => ({
  buildCredentialArtifacts: vi.fn(async (a) => { rec("artifacts", a); return { pdf: Buffer.from("pdf"), credentialJson: { ...a.credentialJson, document: { hash: "h" } } }; }),
}));
vi.mock("./pdfStore.js", () => ({ storePdf: vi.fn(async (id) => rec("storePdf", { id })) }));
vi.mock("../utils/celoProvider.js", () => ({
  getCeloProvider: () => ({ getFeeData: async () => ({ maxFeePerGas: 5n, maxPriorityFeePerGas: 1n }), getTransactionCount: async () => 7 }),
}));
vi.mock("ethers", () => ({
  Contract: vi.fn().mockImplementation((addr, abi) => ({
    register: vi.fn(async (...a) => { rec("register", { addr, a }); return { hash: "0xtx", wait: async () => ({ status: 1 }) }; }),
  })),
  Wallet: vi.fn().mockImplementation(() => ({ address: "0xw" })),
  JsonRpcProvider: vi.fn(), Network: vi.fn(), FetchRequest: vi.fn(),
}));

const base = {
  issuer: { display_name: "Peewah", slug: "peewah" },
  platform: { display_name: "Peewah", slug: "peewah" },
  context: { type: "event", title: "Latam Architecture Day" },
  credential_type: "attendance",
  title: "Certificado de Asistencia",
  background_url_override: "https://cdn.peewah.co/bg.png",
};
const payloads = [
  { ...base, holder: { full_name: "Diana Prieto" }, template_slug: "basic-name", values: { holder_name: "Diana Prieto", details: "Asistió" } },
  { ...base, holder: { full_name: "Ana Ruiz", external_id: "att-42" }, template_slug: "basic-name-and-extra", values: { holder_name: "Ana Ruiz", details: "Asistió", extra: "8 horas" } },
  { ...base, async: true, idempotency_key: "att-7-ev-3", holder: { full_name: "Luis Díaz" }, template_slug: "basic-name", values: { holder_name: "Luis Díaz", details: "x" } },
  { ...base, holder: { full_name: "Pepe" }, background_url_override: undefined, template: { slug: "peewah-prueba", name: "p", background_url: "https://x/bg.png", page_width: 1056, page_height: 816, fields_json: [{ key: "campo_1", x: 1, y: 2 }] }, values: { campo_1: "a", campo_2: "b" } },
];

it("issues Peewah-shaped requests exactly as before", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-28T22:00:00Z"));
  process.env.SKIP_CHAIN = "false";
  process.env.REGISTRY_CONTRACT_ADDRESS = "0xregistry";
  process.env.REGISTRY_PRIVATE_KEY = "0x" + "1".repeat(64);
  process.env.BASE_URL = "https://hashproof.dev";
  const { executeIssueCredential } = await import("./issueCredential.js");
  for (const p of payloads) {
    const input = JSON.stringify(p);
    try { rec("result", await executeIssueCredential(p)); } catch (e) { rec("error", { m: e.message }); }
    rec("input-unmodified", { same: JSON.stringify(p) === input });
  }
  expect(log.some((e) => e.kind.includes("credential_holder_contacts"))).toBe(false);
  await expect(JSON.stringify(log, null, 1)).toMatchFileSnapshot("./__snapshots__/issuanceCompat.json");
});
