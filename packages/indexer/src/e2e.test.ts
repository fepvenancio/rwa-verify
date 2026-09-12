// Differential end-to-end test: Anvil + the Foundry fixture stack (packages/solidity/script/FixtureStack.s.sol)
// indexed by `ponder start`, then every indexer answer compared with the spec view functions on-chain via viem.
// Skipped unless `anvil` and `forge` are on PATH. `pnpm test:indexer` runs this file alone.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createTestClient, http, keccak256, toHex, type Hex, type PublicClient } from "viem";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  complianceEventLogAbi,
  documentBundleAnchorAbi,
  navSnapshotOracleAbi,
  regulatedAssetClaimRegistryAbi,
} from "@rwa-verify/readers";
import { NO_CORRECTION } from "./chain.js";
import { fixtureEnv, type FixtureStack } from "./env-from-fixture.js";

const SOL_ROOT = fileURLToPath(new URL("../../solidity/", import.meta.url));
const INDEXER_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PONDER = fileURLToPath(new URL("../node_modules/.bin/ponder", import.meta.url));
const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Anvil's first account
const EVT_CORRECTION = keccak256(toHex("ERC-8328:EVENT_TYPE:CORRECTION:V1"));

const onPath = (bin: string) => spawnSync(bin, ["--version"], { stdio: "ignore" }).status === 0;
const tools = onPath("anvil") && onPath("forge");

type Fixture = FixtureStack & { subjectId: Hex; assetId: Hex; currency: Hex; role: Hex; eventType: Hex; claimType: number };
type Json = Record<string, any>;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function until(check: () => Promise<boolean>, timeoutMs: number, context: () => string) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out after ${timeoutMs}ms\n${context()}`);
}

const lower = (s: string) => s.toLowerCase();
const str = (v: bigint | number) => v.toString();

describe.skipIf(!tools)(tools ? "e2e: indexer vs fixture stack on Anvil" : "e2e: indexer (skipped: anvil and forge must be on PATH)", () => {
  let anvil: ChildProcess;
  let ponder: ChildProcess;
  let ponderLog = "";
  let rpc: string;
  let api: string;
  let dbDir: string;
  let client: PublicClient;
  let fx: Fixture;
  let oracle: Hex;
  let log: Hex;
  let anchor: Hex;
  let registry: Hex;

  const get = async (path: string, expectStatus = 200): Promise<Json> => {
    const res = await fetch(api + path);
    const body = (await res.json()) as Json;
    expect(res.status, `${path}\n${JSON.stringify(body)}`).toBe(expectStatus);
    return body;
  };

  beforeAll(async () => {
    const anvilPort = await freePort();
    rpc = `http://127.0.0.1:${anvilPort}`;
    anvil = spawn("anvil", ["--port", String(anvilPort), "--silent"], { stdio: "ignore" });
    client = createPublicClient({ transport: http(rpc) });
    await until(() => client.getChainId().then(() => true), 10_000, () => "anvil did not start");

    const forge = spawnSync(
      "forge",
      ["script", "script/FixtureStack.s.sol", "--rpc-url", rpc, "--broadcast", "--private-key", ANVIL_KEY],
      { cwd: SOL_ROOT, env: { ...process.env, FOUNDRY_PROFILE: "fixture" }, encoding: "utf8" },
    );
    if (forge.status !== 0) throw new Error(`forge script failed:\n${forge.stdout}\n${forge.stderr}`);
    fx = JSON.parse(readFileSync(`${SOL_ROOT}out/fixture-stack.json`, "utf8")) as Fixture;
    oracle = fx.navOracle as Hex;
    log = fx.eventLog as Hex;
    anchor = fx.documentAnchor as Hex;
    registry = fx.claimRegistry as Hex;

    dbDir = mkdtempSync(join(tmpdir(), "rwa-verify-indexer-"));
    const apiPort = await freePort();
    api = `http://127.0.0.1:${apiPort}`;
    ponder = spawn(
      PONDER,
      ["start", "--port", String(apiPort), "--hostname", "127.0.0.1", "--schema", "public", "--log-level", "warn"],
      { cwd: INDEXER_ROOT, env: { ...process.env, ...fixtureEnv(fx, rpc), PGLITE_DIR: dbDir }, stdio: ["ignore", "pipe", "pipe"] },
    );
    ponder.stdout!.on("data", (d) => (ponderLog += d));
    ponder.stderr!.on("data", (d) => (ponderLog += d));
    const exited = new Promise<never>((_, reject) => ponder.on("exit", (code) => reject(new Error(`ponder exited (${code})\n${ponderLog}`))));

    // Ready = historical sync done; then wait until the realtime checkpoint has reached the last fixture block.
    const head = Number(await client.getBlockNumber());
    await Promise.race([
      until(async () => (await fetch(`${api}/ready`)).status === 200, 150_000, () => ponderLog),
      exited,
    ]);
    await Promise.race([
      until(async () => {
        const status = (await (await fetch(`${api}/status`)).json()) as Json;
        return status.local?.block?.number >= head;
      }, 60_000, () => ponderLog),
      exited,
    ]);
  }, 240_000);

  afterAll(() => {
    ponder?.kill();
    anvil?.kill();
    if (dbDir) rmSync(dbDir, { recursive: true, force: true });
  });

  // ---------- ERC-8330 ----------

  it("every snapshot index resolves like currentSnapshotIndex / isSnapshotCurrent (revert <-> null)", async () => {
    const count = await client.readContract({ address: oracle, abi: navSnapshotOracleAbi, functionName: "snapshotCount", args: [fx.subjectId, fx.currency] });
    expect(count).toBeGreaterThanOrEqual(5n);
    let invalidatedTerminals = 0;
    let correctOfCorrect = 0;
    for (let i = 0n; i < count; i++) {
      const chainCurrent = await client
        .readContract({ address: oracle, abi: navSnapshotOracleAbi, functionName: "currentSnapshotIndex", args: [fx.subjectId, fx.currency, i] })
        .then((v) => v.toString(), () => null);
      const chainIsCurrent = await client.readContract({ address: oracle, abi: navSnapshotOracleAbi, functionName: "isSnapshotCurrent", args: [fx.subjectId, fx.currency, i] });
      const invalidated = await client.readContract({ address: oracle, abi: navSnapshotOracleAbi, functionName: "isSnapshotInvalidated", args: [fx.subjectId, fx.currency, i] });
      const s = await client.readContract({ address: oracle, abi: navSnapshotOracleAbi, functionName: "getSnapshot", args: [fx.subjectId, fx.currency, i] });

      const r = await get(`/subjects/${fx.subjectId}/snapshots/${i}/current?currency=${fx.currency}`);
      expect(r.currentIndex, `currentSnapshotIndex(${i})`).toBe(chainCurrent);
      expect(r.isCurrent, `isSnapshotCurrent(${i})`).toBe(chainIsCurrent);
      expect(r.snapshot).toMatchObject({
        index: str(i),
        provider: lower(s.provider),
        nav: str(s.nav),
        decimals: s.decimals,
        navBasis: s.navBasis,
        valuationTimestamp: str(s.valuationTimestamp),
        publishedAt: str(s.publishedAt),
        methodologyHash: s.methodologyHash,
        correctsIndex: str(s.correctsIndex),
        correctedByIndex: str(s.correctedByIndex),
        invalidated,
      });

      if (chainCurrent === null) invalidatedTerminals++;
      // Terminal reached through at least two hops: the terminal does not correct `i` directly.
      if (chainCurrent !== null && chainCurrent !== str(i)) {
        const terminal = await client.readContract({ address: oracle, abi: navSnapshotOracleAbi, functionName: "getSnapshot", args: [fx.subjectId, fx.currency, BigInt(chainCurrent)] });
        if (terminal.correctsIndex !== i) correctOfCorrect++;
      }
    }
    expect(invalidatedTerminals, "fixture must contain an invalidated terminal").toBeGreaterThan(0);
    expect(correctOfCorrect, "fixture must contain a correct-of-correct chain").toBeGreaterThan(0);
    await get(`/subjects/${fx.subjectId}/snapshots/${count}/current?currency=${fx.currency}`, 404);
  });

  it("current-snapshot equals latestNAV, and a late correction to an older valuation did not win", async () => {
    const [nav, decimals, navBasis, valuationTimestamp, publishedAt, provider] = await client.readContract({ address: oracle, abi: navSnapshotOracleAbi, functionName: "latestNAV", args: [fx.subjectId, fx.currency] });
    const r = await get(`/subjects/${fx.subjectId}/current-snapshot?currency=${fx.currency}`);
    expect(r.snapshot).toMatchObject({ nav: str(nav), decimals, navBasis, valuationTimestamp: str(valuationTimestamp), publishedAt: str(publishedAt), provider: lower(provider) });

    // The greatest current index is a late correction (correctsIndex set) of an older valuation than the latest.
    const count = Number(r.snapshotCount);
    let lastCurrent: Json | null = null;
    for (let i = count - 1; i >= 0 && !lastCurrent; i--) {
      const s = await get(`/subjects/${fx.subjectId}/snapshots/${i}/current?currency=${fx.currency}`);
      if (s.isCurrent) lastCurrent = s.snapshot;
    }
    expect(lastCurrent!.correctsIndex).not.toBe(NO_CORRECTION.toString());
    expect(BigInt(lastCurrent!.valuationTimestamp)).toBeLessThan(valuationTimestamp);
    expect(r.snapshot.index).not.toBe(lastCurrent!.index);
  });

  // ---------- ERC-8328 ----------

  it("terminal-event equals lastRecordedEventByType + currentEventIndex + getEvent", async () => {
    const count = await client.readContract({ address: log, abi: complianceEventLogAbi, functionName: "eventCount", args: [fx.subjectId] });
    expect(count).toBeGreaterThanOrEqual(4n);
    for (const type of [fx.eventType, EVT_CORRECTION, undefined]) {
      const recorded =
        type === undefined
          ? count - 1n
          : await client.readContract({ address: log, abi: complianceEventLogAbi, functionName: "lastRecordedEventByType", args: [fx.subjectId, type] });
      const current = await client.readContract({ address: log, abi: complianceEventLogAbi, functionName: "currentEventIndex", args: [fx.subjectId, recorded] });
      const isCurrent = await client.readContract({ address: log, abi: complianceEventLogAbi, functionName: "isEventCurrent", args: [fx.subjectId, current] });
      const ev = await client.readContract({ address: log, abi: complianceEventLogAbi, functionName: "getEvent", args: [fx.subjectId, current] });
      expect(isCurrent).toBe(true);

      const r = await get(`/subjects/${fx.subjectId}/terminal-event${type ? `?type=${type}` : ""}`);
      expect(r, `type ${type}`).toMatchObject({ eventCount: Number(count), recordedIndex: str(recorded), currentIndex: str(current), corrected: recorded !== current });
      expect(r.event).toMatchObject({
        index: str(current),
        eventType: ev.eventType,
        actor: lower(ev.actor),
        outcome: ev.outcome,
        authority: ev.authority,
        occurredAt: str(ev.occurredAt),
        recordedAt: str(ev.recordedAt),
        correctsIndex: str(ev.correctsIndex),
        correctedByIndex: str(ev.correctedByIndex),
      });
    }
    const hint = await get(`/subjects/${fx.subjectId}/terminal-event?type=${fx.eventType}`);
    expect(hint.corrected, "fixture's hinted event type must be corrected").toBe(true);
    expect(hint.event.eventType).toBe(EVT_CORRECTION);
    await get(`/subjects/${fx.subjectId}/terminal-event?type=${keccak256(toHex("never"))}`, 404);
  });

  // ---------- ERC-8326 ----------

  it("active-bundle equals activeBundle + getAnchor, and the superseded record is kept", async () => {
    const active = await client.readContract({ address: anchor, abi: documentBundleAnchorAbi, functionName: "activeBundle", args: [fx.subjectId, fx.role] });
    const rec = await client.readContract({ address: anchor, abi: documentBundleAnchorAbi, functionName: "getAnchor", args: [active, fx.subjectId, fx.role] });
    const r = await get(`/subjects/${fx.subjectId}/active-bundle?role=${fx.role}`);
    expect(r.bundle).toMatchObject({
      bundleHash: active,
      anchoredBy: lower(rec.anchoredBy),
      anchoredAt: str(rec.anchoredAt),
      documentCount: str(rec.documentCount),
      superseded: false,
      supersededBy: null,
    });
    expect(r.history, "fixture must contain a superseded bundle").toBe(2);

    const old = keccak256(toHex("bundle-v1"));
    const oldRec = await client.readContract({ address: anchor, abi: documentBundleAnchorAbi, functionName: "getAnchor", args: [old, fx.subjectId, fx.role] });
    expect(oldRec.superseded).toBe(true);
    expect(oldRec.supersededBy).toBe(active);
    await get(`/subjects/${fx.subjectId}/active-bundle?role=${keccak256(toHex("EVIDENCE"))}`).then((e) => expect(e.bundle).toBeNull());
  });

  // ---------- ERC-8320 ----------

  it("active-claims equals getActiveClaims before and after the short validUntil passes", async () => {
    const versions = (claims: readonly { version: bigint | string }[]) => claims.map((c) => c.version.toString()).sort();
    const compare = async () => {
      const block = await client.getBlock();
      const chain = await client.readContract({ address: registry, abi: regulatedAssetClaimRegistryAbi, functionName: "getActiveClaims", args: [fx.assetId, fx.claimType], blockNumber: block.number });
      const r = await get(`/assets/${fx.assetId}/active-claims?claimType=${fx.claimType}&at=${block.timestamp}`);
      expect(versions(r.claims)).toEqual(versions(chain));
      for (const c of chain) {
        expect(r.claims.find((x: Json) => x.version === str(c.version))).toMatchObject({
          state: 2,
          validFrom: str(c.validFrom),
          validUntil: str(c.validUntil),
          author: lower(c.author),
          schemaId: c.schemaId,
          contentHash: c.contentHash,
          uri: c.uri,
        });
      }
      return versions(chain);
    };

    const before = await compare();
    expect(before).toEqual(["1", "2"]); // v3 is REVOKED and never returned

    const anvilClient = createTestClient({ mode: "anvil", transport: http(rpc) });
    await anvilClient.increaseTime({ seconds: 3601 });
    await anvilClient.mine({ blocks: 1 });

    const after = await compare();
    expect(after).toEqual(["1"]); // v2 expired (validUntil = T + 30min) without any transaction
  });
});
