import { describe, expect, it } from "vitest";
import { CHECKS } from "./checks/index.js";
import { parseArgs, runCli } from "./cli.js";
import { A, ANCHOR_ID, CHAIN_ID, LEGAL_BASIS, USD, stack } from "./testing/stack.js";
import { verify } from "./verify.js";

describe("parseArgs", () => {
  it("parses the verify form", () => {
    expect(parseArgs([A.token, "--chain", "1", "--rpc", "http://x", "--token-id", "5", "--currency", USD])).toEqual({
      command: "verify",
      token: A.token,
      chainId: 1,
      rpc: "http://x",
      tokenId: 5n,
      hints: { currency: USD },
    });
  });

  it("parses the check form", () => {
    const args = parseArgs(["check", "erc8330.navFresh", "--chain", "31337", "--token", A.token, "--nav-oracle", A.oracle, "--subject", ANCHOR_ID, "--claim-type", "3"]);
    expect(args).toMatchObject({ command: "check", checkId: "erc8330.navFresh", chainId: 31337, hints: { navOracle: A.oracle, subjectId: ANCHOR_ID, claimType: 3 } });
  });

  it.each([
    [["check", "nope", "--chain", "1", "--token", A.token], /unknown check id/],
    [[A.token], /--chain/],
    [["--chain", "1"], /exactly one <token>/],
    [[A.token, "--chain", "1", "--bogus", "x"], /unknown flag/],
    [[A.token, "--chain", "1", "--role", "0x12"], /bytes32/],
    [[A.token, "--chain", "1", "--nav-oracle", "0x12"], /address/],
    [[A.token, "--chain", "1", "--claim-type", "9"], /0-7/],
    [[A.token, "--chain", "1", "--rpc"], /needs a value/],
    [["check", "erc165.detect", "--chain", "1"], /must be an address/],
  ])("rejects %j", (argv, msg) => {
    expect(() => parseArgs(argv)).toThrow(msg);
  });
});

describe("runCli", () => {
  it("usage error -> exit 2 with usage text", async () => {
    const r = await runCli([]);
    expect(r.exitCode).toBe(2);
    expect(r.output).toMatch(/usage:/);
  });

  it("--rpc required without an injected client", async () => {
    expect((await runCli([A.token, "--chain", "1"])).exitCode).toBe(2);
  });

  it("chain mismatch between --chain and the RPC -> exit 2", async () => {
    const r = await runCli([A.token, "--chain", "1"], { client: stack().client });
    expect(r.exitCode).toBe(2);
    expect(r.output).toMatch(/reports chain 31337/);
  });

  it("check exit codes: 0 for pass/unsupported/unknown, 1 for fail/stale", async () => {
    const chain = String(CHAIN_ID);
    const pass = await runCli(["check", "erc8325.mutualBinding", "--chain", chain, "--token", A.token], { client: stack().client });
    expect(pass.exitCode).toBe(0);
    expect(JSON.parse(pass.output)).toMatchObject({ id: "erc8325.mutualBinding", status: "pass", evidence: { blockNumber: "100" } });
    const fail = await runCli(["check", "erc8325.mutualBinding", "--chain", chain, "--token", A.token], { client: stack({ isBound: false }).client });
    expect(fail.exitCode).toBe(1);
    const stale = await runCli(["check", "erc8330.navFresh", "--chain", chain, "--token", A.token, "--nav-oracle", A.oracle, "--subject", ANCHOR_ID, "--currency", USD], {
      client: stack({ nav: { ...stack().cfg.nav!, isValuationStale: true } }).client,
    });
    expect(stale.exitCode).toBe(1);
    const unsupported = await runCli(["check", "erc4626.asset", "--chain", chain, "--token", A.token], { client: stack().client });
    expect(unsupported.exitCode).toBe(0);
  });

  it("verify prints the report; exit 1 when any check fails", async () => {
    const ok = await runCli([A.token, "--chain", String(CHAIN_ID)], { client: stack().client });
    expect(ok.exitCode).toBe(0);
    expect(JSON.parse(ok.output)).toMatchObject({ chainId: CHAIN_ID, token: A.token });
    const bad = await runCli([A.token, "--chain", String(CHAIN_ID)], { client: stack({ paused: true }).client });
    expect(bad.exitCode).toBe(1);
  });
});

describe("reproduce strings", () => {
  it("every emitted reproduce string parses with the CLI parser and re-runs to the same status", async () => {
    const { client } = stack({ tokenDeclares: ["IERC165", "IERC3643", "IERC7943Fungible", "IAssetBoundToken", "IRegistryAnchor"], vaultAsset: A.other });
    const report = await verify({
      client,
      chainId: CHAIN_ID,
      token: A.token,
      rpc: "http://127.0.0.1:8545",
      registryHints: { navOracle: A.oracle, currency: USD, documentAnchor: A.anchor, role: LEGAL_BASIS, eventLog: A.log },
    });
    const checks = [...report.baseline, ...report.identity, ...report.documents, ...report.valuation, ...report.compliance];
    expect(checks.length).toBeGreaterThanOrEqual(15); // two subjects -> 2x documents/valuation/compliance + mismatch
    for (const c of checks) {
      const argv = c.reproduce.split(" ");
      expect(argv[0]).toBe("rwa-verify");
      const args = parseArgs(argv.slice(1));
      expect(args.rpc).toBe("http://127.0.0.1:8545");
      if (c.id === "identity.subjectMismatch") {
        expect(args.command).toBe("verify");
        continue;
      }
      expect(args.command).toBe("check");
      expect(args.checkId).toBe(c.id);
      expect(c.id in CHECKS).toBe(true);
      const rerun = await runCli(argv.slice(1), { client });
      const parsed = JSON.parse(rerun.output);
      expect(parsed.id, c.reproduce).toBe(c.id);
      expect(parsed.status, c.reproduce).toBe(c.status);
    }
  });
});
