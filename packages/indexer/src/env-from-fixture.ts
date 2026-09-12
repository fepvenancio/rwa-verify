// Prints the indexer's environment for the local Anvil fixture stack (scripts/fixture-stack.sh writes
// packages/solidity/out/fixture-stack.json). Usage, from the repo root:
//   eval "$(pnpm exec tsx packages/indexer/src/env-from-fixture.ts [path/to/fixture-stack.json])"
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface FixtureStack {
  chainId: number;
  navOracle: string;
  eventLog: string;
  documentAnchor: string;
  claimRegistry: string;
}

export function fixtureEnv(fx: FixtureStack, rpc: string): Record<string, string> {
  return {
    RPC_URL: rpc,
    CHAIN_ID: String(fx.chainId),
    START_BLOCK: "0",
    NAV_ORACLE: fx.navOracle,
    EVENT_LOG: fx.eventLog,
    DOCUMENT_ANCHOR: fx.documentAnchor,
    CLAIM_REGISTRY: fx.claimRegistry,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.argv[2] ?? fileURLToPath(new URL("../../solidity/out/fixture-stack.json", import.meta.url));
  const fx = JSON.parse(readFileSync(path, "utf8")) as FixtureStack;
  for (const [k, v] of Object.entries(fixtureEnv(fx, process.env.RPC_URL ?? "http://127.0.0.1:8545"))) console.log(`export ${k}=${v}`);
}
