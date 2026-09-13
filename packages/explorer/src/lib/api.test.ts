import { describe, expect, it } from "vitest";
import { CHECKS, runCli } from "@rwa-verify/sdk";
import { erc165Abi } from "../../../sdk/src/abi/erc165.js";
import { contract, fakeClient } from "../../../sdk/src/testing/fakeChain.js";
import { A, ANCHOR_ID, BLOCK, CHAIN_ID, LEGAL_BASIS, USD, stack } from "../../../sdk/src/testing/stack.js";
import { run, toResponse } from "./api";

const RPC = "http://127.0.0.1:1"; // never contacted: the fake client is injected
const sections = ["baseline", "identity", "documents", "valuation", "compliance"] as const;
const q = (params: Record<string, string>) => new URLSearchParams(params);
const full = { chain: String(CHAIN_ID), token: A.token, rpc: RPC, navOracle: A.oracle, currency: USD, documentAnchor: A.anchor, role: LEGAL_BASIS, eventLog: A.log };

describe("GET /api/v1/verify", () => {
  it("returns a well-formed report for the fake stack, bigints as strings", async () => {
    const { client } = stack();
    const r = await run(q(full), undefined, { client });
    expect(r.status).toBe(200);
    const report = JSON.parse(r.body);
    expect(report).toMatchObject({ chainId: CHAIN_ID, token: A.token });
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    for (const s of sections) expect(Array.isArray(report[s]), s).toBe(true);
    expect(report.baseline.map((c: { id: string }) => c.id)).toEqual(Object.keys(CHECKS).filter((id) => id.startsWith("erc20.") || id.startsWith("erc3643.") || id.startsWith("erc7943.") || id.startsWith("erc4626.") || id === "erc165.detect"));
    const statuses = Object.fromEntries(sections.flatMap((s) => report[s].map((c: { id: string; status: string }) => [c.id, c.status])));
    expect(statuses).toMatchObject({ "erc8325.mutualBinding": "pass", "erc8330.navFresh": "pass", "erc8326.activeBundle": "pass", "erc8328.latestCurrentEvent": "pass" });
    expect(report.baseline[0].evidence.blockNumber).toBe(BLOCK.toString());
  });

  it("baseline-first: a plain ERC-20 with nothing detected still gets a report, everything unsupported", async () => {
    const client = fakeClient({ chainId: CHAIN_ID, blockNumber: BLOCK, contracts: { [A.token]: contract(erc165Abi, {}) } });
    const r = await run(q({ chain: String(CHAIN_ID), token: A.token, rpc: RPC }), undefined, { client });
    expect(r.status).toBe(200);
    const report = JSON.parse(r.body);
    for (const s of sections) for (const c of report[s]) expect(c.status, c.id).toBe("unsupported");
  });

  it("reproduce strings equal what the CLI emits when re-run", async () => {
    const { client } = stack();
    const report = JSON.parse((await run(q({ ...full, tokenId: "7" }), undefined, { client })).body);
    for (const c of sections.flatMap((s) => report[s] as { id: string; status: string; reproduce: string }[])) {
      const [bin, ...argv] = c.reproduce.split(" ");
      expect(bin).toBe("rwa-verify");
      expect(argv).toContain(RPC);
      const cli = await runCli(argv, { client });
      expect(JSON.parse(cli.output)).toMatchObject({ id: c.id, status: c.status, reproduce: c.reproduce });
    }
  });

  it("400: missing/invalid chain, missing token, bad hint, unknown param, non-http rpc, no rpc", async () => {
    const { client } = stack();
    const cases: [Record<string, string>, RegExp][] = [
      [{ token: A.token, rpc: RPC }, /chain must be a numeric chain id/],
      [{ chain: "x", token: A.token, rpc: RPC }, /chain must be a numeric chain id/],
      [{ chain: "1", rpc: RPC }, /token is required/],
      [{ chain: "1", token: "nope", rpc: RPC }, /must be an address/],
      [{ chain: "1", token: A.token, rpc: RPC, navOracle: "0x12" }, /--nav-oracle must be an address/],
      [{ chain: "1", token: A.token, rpc: RPC, claimType: "9" }, /--claim-type must be 0-7/],
      [{ chain: "1", token: A.token, rpc: RPC, tokenId: "-1" }, /--token-id must be a non-negative integer/],
      [{ chain: "1", token: A.token, rpc: RPC, anchorregistry: A.registry }, /unknown query parameter: anchorregistry/],
      [{ chain: "1", token: A.token, rpc: "file:///etc/passwd" }, /rpc must be an http\(s\) URL/],
      [{ chain: "1", token: A.token, rpc: "not a url" }, /rpc must be an http\(s\) URL/],
      [{ chain: "424242", token: A.token }, /no RPC for chain 424242: pass rpc=<url> or set RPC_URL_424242 or ALCHEMY_API_KEY/],
    ];
    for (const [params, msg] of cases) {
      const r = await run(q(params), undefined, { client });
      expect(r.status, JSON.stringify(params)).toBe(400);
      expect(JSON.parse(r.body).error).toMatch(msg);
    }
  });

  it("400 when the RPC reports a different chain id", async () => {
    const { client } = stack();
    const r = await run(q({ ...full, chain: "1" }), undefined, { client });
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error).toBe(`--chain 1 but the RPC reports chain ${CHAIN_ID}`);
  });

  it("RPC_URL_<chainId> is used when rpc is absent and is redacted to a placeholder in the response", async () => {
    process.env[`RPC_URL_${CHAIN_ID}`] = "https://rpc.example/v2/secret-key";
    try {
      const { client } = stack();
      const r = await run(q({ chain: String(CHAIN_ID), token: A.token }), undefined, { client });
      expect(r.body).not.toContain("secret-key");
      expect(JSON.parse(r.body).baseline[0].reproduce).toContain(`--rpc $RPC_URL_${CHAIN_ID}`);
    } finally {
      delete process.env[`RPC_URL_${CHAIN_ID}`];
    }
  });

  it("ALCHEMY_API_KEY builds the URL for known chains and never appears in the response", async () => {
    process.env.ALCHEMY_API_KEY = "alchemy-secret";
    try {
      const { client } = stack();
      const r = await run(q({ chain: "1", token: A.token }), undefined, { client });
      expect(r.body).not.toContain("alchemy-secret");
      // chain-id mismatch with the fake stack is expected; what matters is that the Alchemy URL was resolved
      expect(r.status).toBe(400);
      expect(JSON.parse(r.body).error).toContain("--chain 1 but the RPC reports chain");
      const unknown = await run(q({ chain: "424242", token: A.token }), undefined, { client });
      expect(JSON.parse(unknown.body).error).toMatch(/no RPC for chain 424242/);
    } finally {
      delete process.env.ALCHEMY_API_KEY;
    }
  });

  it("toResponse: JSON, no-store", async () => {
    const res = toResponse({ status: 200, body: "{}" });
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({});
  });
});

describe("GET /api/v1/check/:id", () => {
  it("runs one check and returns its CheckResult (a single check takes the join key as subjectId=)", async () => {
    const { client } = stack();
    const r = await run(q({ ...full, subjectId: ANCHOR_ID }), "erc8330.navFresh", { client });
    expect(r.status).toBe(200);
    const c = JSON.parse(r.body);
    expect(c).toMatchObject({ id: "erc8330.navFresh", status: "pass", specRef: { erc: 8330 } });
    expect(c.reproduce).toBe(`rwa-verify check erc8330.navFresh --chain ${CHAIN_ID} --token ${A.token} --nav-oracle ${A.oracle} --subject ${ANCHOR_ID} --currency ${USD} --rpc ${RPC}`);
  });

  it("200 for a failing check (HTTP status is not the check status)", async () => {
    const { client } = stack({ paused: true });
    const r = await run(q(full), "erc3643.paused", { client });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).status).toBe("fail");
  });

  it("400 for an unknown check id", async () => {
    const { client } = stack();
    const r = await run(q(full), "erc9999.nope", { client });
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error).toBe("unknown check id: erc9999.nope");
  });
});
