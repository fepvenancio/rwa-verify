// End-to-end against a real chain: Anvil + the Foundry fixture stack (packages/solidity/script/FixtureStack.s.sol).
// Skipped unless `anvil` and `forge` are on PATH. `pnpm test:e2e` runs this file alone.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { createPublicClient, createTestClient, http, type PublicClient } from "viem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CheckResult, Hex, VerificationReport } from "@rwa-verify/core";
import type { RegistryHints } from "./checks/context.js";
import { runCli } from "./cli.js";
import { verify } from "./verify.js";

const SOL_ROOT = fileURLToPath(new URL("../../solidity/", import.meta.url));
const TSX = fileURLToPath(new URL("../../../node_modules/.bin/tsx", import.meta.url));
const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Anvil's first account

const onPath = (bin: string) => spawnSync(bin, ["--version"], { stdio: "ignore" }).status === 0;
const tools = onPath("anvil") && onPath("forge");

type Fixture = RegistryHints & { chainId: number; token: Hex; assetId: Hex };
const sections = ["baseline", "identity", "documents", "valuation", "compliance"] as const;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

// Reproduce strings start with the `rwa-verify` binary name; the rest is the CLI argv.
function reproduceArgv(c: CheckResult): string[] {
  const [bin, ...argv] = c.reproduce.split(" ");
  expect(bin).toBe("rwa-verify");
  return argv;
}

describe.skipIf(!tools)(tools ? "e2e: fixture stack on Anvil" : "e2e: fixture stack on Anvil (skipped: anvil and forge must be on PATH)", () => {
  let anvil: ChildProcess;
  let rpc: string;
  let client: PublicClient;
  let fx: Fixture;
  let report: VerificationReport;

  beforeAll(async () => {
    const port = await freePort();
    rpc = `http://127.0.0.1:${port}`;
    anvil = spawn("anvil", ["--port", String(port), "--silent"], { stdio: "ignore" });
    client = createPublicClient({ transport: http(rpc) });
    for (let i = 0; ; i++) {
      try {
        await client.getChainId();
        break;
      } catch (err) {
        if (i === 50) throw err;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const forge = spawnSync(
      "forge",
      ["script", "script/FixtureStack.s.sol", "--rpc-url", rpc, "--broadcast", "--private-key", ANVIL_KEY],
      { cwd: SOL_ROOT, env: { ...process.env, FOUNDRY_PROFILE: "fixture" }, encoding: "utf8" },
    );
    if (forge.status !== 0) throw new Error(`forge script failed:\n${forge.stdout}\n${forge.stderr}`);
    fx = JSON.parse(readFileSync(`${SOL_ROOT}out/fixture-stack.json`, "utf8")) as Fixture;
    const { chainId, token, assetId: _assetId, ...hints } = fx;
    report = await verify({ client, chainId, token, registryHints: hints, rpc });
  }, 180_000);

  afterAll(() => {
    anvil?.kill();
  });

  it("every 83xx check passes; baseline 3643/7943/4626 are unsupported", () => {
    const statuses = Object.fromEntries(sections.flatMap((s) => report[s].map((c) => [c.id, c.status])));
    expect(statuses).toEqual({
      "erc165.detect": "pass",
      "erc3643.paused": "unsupported",
      "erc3643.identityRegistry": "unsupported",
      "erc3643.compliance": "unsupported",
      "erc7943.canTransfer": "unsupported",
      "erc7943.frozenBalance": "unsupported",
      "erc4626.asset": "unsupported",
      "erc4626.totalAssets": "unsupported",
      "erc8325.mutualBinding": "pass",
      "erc8320.activeClaim": "pass",
      "erc8326.activeBundle": "pass",
      "erc8330.navFresh": "pass",
      "erc8328.latestCurrentEvent": "pass",
    });
  });

  it("8320 claim comes from the reference registry the token approves; 8326/8328/8330 join on the anchorId", () => {
    const claim = report.identity.find((c) => c.id === "erc8320.activeClaim")!;
    expect(claim.evidence).toMatchObject({ trust: "asset-approved", registry: fx.claimRegistry, assetId: fx.assetId, claimType: fx.claimType });
    for (const s of ["documents", "valuation", "compliance"] as const) expect(report[s][0]!.evidence.subjectId).toBe(fx.subjectId);
  });

  it("every reproduce string re-runs through the CLI with the same id and status", async () => {
    for (const c of sections.flatMap((s) => report[s])) {
      const r = await runCli(reproduceArgv(c));
      expect(r.exitCode, c.reproduce).toBe(0);
      expect(JSON.parse(r.output)).toMatchObject({ id: c.id, status: c.status });
    }
  }, 60_000);

  it("past the heartbeat, navFresh reports stale and its reproduce exits 1", async () => {
    const nav = report.valuation.find((c) => c.id === "erc8330.navFresh")!;
    const anvilClient = createTestClient({ mode: "anvil", transport: http(rpc) });
    await anvilClient.increaseTime({ seconds: 3601 });
    await anvilClient.mine({ blocks: 1 });

    const r = await runCli(reproduceArgv(nav));
    expect(r.exitCode).toBe(1);
    expect(JSON.parse(r.output)).toMatchObject({ id: nav.id, status: "stale", evidence: { isPublishStale: true, isValuationStale: false } });

    const proc = spawnSync(TSX, ["src/cli.ts", ...reproduceArgv(nav)], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
    expect(proc.status, proc.stderr).toBe(1);
    expect(JSON.parse(proc.stdout)).toMatchObject({ id: nav.id, status: "stale" });
  }, 60_000);
});
