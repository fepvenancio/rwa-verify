import { createConfig } from "ponder";
import {
  complianceEventLogAbi,
  documentBundleAnchorAbi,
  navSnapshotOracleAbi,
  regulatedAssetClaimRegistryAbi,
} from "@rwa-verify/readers";

// One contract per standard, all read from the environment (documented in README.md):
//   RPC_URL, CHAIN_ID, START_BLOCK, NAV_ORACLE, EVENT_LOG, DOCUMENT_ANCHOR, CLAIM_REGISTRY, PGLITE_DIR (optional).
// `pnpm exec tsx packages/indexer/src/env-from-fixture.ts` prints them for the local Anvil fixture stack.

function address(name: string): `0x${string}` {
  const value = process.env[name];
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be set to a 0x-prefixed address (see packages/indexer/README.md)`);
  }
  return value as `0x${string}`;
}

const chainId = Number(process.env.CHAIN_ID ?? 31337);
const startBlock = Number(process.env.START_BLOCK ?? 0);
const pgliteDir = process.env.PGLITE_DIR;

export default createConfig({
  ...(pgliteDir ? { database: { kind: "pglite" as const, directory: pgliteDir } } : {}),
  chains: {
    local: {
      id: chainId,
      rpc: process.env.RPC_URL ?? "http://127.0.0.1:8545",
      // A restarted Anvil reuses block numbers with different contents; never serve them from the RPC cache.
      disableCache: chainId === 31337,
    },
  },
  contracts: {
    NavOracle: { chain: "local", abi: navSnapshotOracleAbi, address: address("NAV_ORACLE"), startBlock },
    EventLog: { chain: "local", abi: complianceEventLogAbi, address: address("EVENT_LOG"), startBlock },
    DocumentAnchor: { chain: "local", abi: documentBundleAnchorAbi, address: address("DOCUMENT_ANCHOR"), startBlock },
    ClaimRegistry: { chain: "local", abi: regulatedAssetClaimRegistryAbi, address: address("CLAIM_REGISTRY"), startBlock },
  },
});
