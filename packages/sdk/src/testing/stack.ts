// Test fixture: a conforming ERC-3643 + 7943 + 8325 token, its anchor registry, an ERC-8330
// oracle, an ERC-8326 anchor, an ERC-8328 log and an ERC-8320 claim registry, with knobs to
// break one thing at a time. Addresses are fixed so tests can assert on them.
import { encodeAbiParameters, keccak256, toHex, type Abi, type PublicClient } from "viem";
import type { Hex } from "@rwa-verify/core";
import { erc165Abi } from "../abi/erc165.js";
import { erc3643Abi } from "../abi/erc3643.js";
import { erc4626Abi } from "../abi/erc4626.js";
import { erc7943FungibleAbi } from "../abi/erc7943.js";
import { registryAnchorAbi, regulatedAssetClaimRegistryAbi } from "../abi/erc8320.js";
import { assetAnchorRegistryAbi, assetAnchorRegistryLifecycleAbi, assetAnchorRegistryRecoveryAbi, assetBoundTokenAbi, assetBoundTokenIdAbi } from "../abi/erc8325.js";
import { documentBundleAnchorAbi } from "../abi/erc8326.js";
import { complianceEventLogAbi } from "../abi/erc8328.js";
import { navSnapshotOracleAbi } from "../abi/erc8330.js";
import { INTERFACE_IDS, type InterfaceName } from "../abi/interfaceIds.js";
import { BINDING_SCOPE_CONTRACT } from "../checks/erc8325.js";
import type { CheckContext, RegistryHints } from "../checks/context.js";
import { detect } from "../detect.js";
import { contract, fakeClient, revert, type Handler } from "./fakeChain.js";

export const A = {
  token: "0x1000000000000000000000000000000000000001",
  registry: "0x2000000000000000000000000000000000000002",
  oracle: "0x3000000000000000000000000000000000000003",
  anchor: "0x4000000000000000000000000000000000000004",
  log: "0x5000000000000000000000000000000000000005",
  claimRegistry: "0x6000000000000000000000000000000000000006",
  other: "0x9000000000000000000000000000000000000009",
  identityRegistry: "0x7000000000000000000000000000000000000007",
  compliance: "0x8000000000000000000000000000000000000008",
} as const satisfies Record<string, Hex>;

export const LEGAL_HASH = keccak256(toHex("legal"));
export const EVIDENCE_HASH = keccak256(toHex("evidence"));
export const ANCHOR_ID = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [LEGAL_HASH, EVIDENCE_HASH]));
export const USD = keccak256(toHex("ERC-8330:CURRENCY:USD"));
export const LEGAL_BASIS = keccak256(toHex("LEGAL_BASIS"));
export const BUNDLE_HASH = keccak256(toHex("bundle"));
export const ASSET_ID = keccak256(toHex("asset-id-from-8320"));
export const CHAIN_ID = 31337;
export const BLOCK = 100n;

type Record8325 = { anchorId: Hex; legalHash: Hex; evidenceHash: Hex; boundToken: Hex; bindingScope: Hex; boundTokenId: bigint; registeredAt: bigint; active: boolean };
type Nav = { nav: bigint; decimals: number; navBasis: Hex; valuationTimestamp: bigint; publishedAt: bigint; provider: Hex; isPublishStale: boolean; isValuationStale: boolean };

export interface StackConfig {
  tokenDeclares: InterfaceName[];
  tokenAnchorId: Hex;
  tokenRegistry: Hex;
  paused: boolean;
  registryDeclares: InterfaceName[];
  record: Record8325;
  isBound: boolean;
  isActive: boolean;
  isBindingValid: boolean;
  heartbeat: bigint;
  maxValuationAge: bigint;
  nav: Nav | null; // null -> latestNAVStatus reverts (no current snapshot)
  activeBundle: Hex;
  superseded: boolean;
  documentCount: bigint;
  eventCount: bigint;
  approvedRegistries: Hex[]; // IRegistryAnchor.getRegistries() with isRegistryApproved == true
  knownRegistries: Hex[];
  claims: number; // active claims returned for claimType 0
  assetId: Hex;
  vaultAsset: Hex | null; // null -> asset()/totalAssets() revert (not a vault)
  canTransferReverts: boolean; // spec violation knob
}

export const DEFAULTS: StackConfig = {
  tokenDeclares: ["IERC165", "IERC3643", "IERC7943Fungible", "IAssetBoundToken"],
  tokenAnchorId: ANCHOR_ID,
  tokenRegistry: A.registry,
  paused: false,
  registryDeclares: ["IERC165", "IAssetAnchorRegistry", "IAssetAnchorRegistryLifecycle"],
  record: { anchorId: ANCHOR_ID, legalHash: LEGAL_HASH, evidenceHash: EVIDENCE_HASH, boundToken: A.token, bindingScope: BINDING_SCOPE_CONTRACT, boundTokenId: 0n, registeredAt: 1n, active: true },
  isBound: true,
  isActive: true,
  isBindingValid: true,
  heartbeat: 3600n,
  maxValuationAge: 86400n,
  nav: { nav: 1_000_000n, decimals: 6, navBasis: keccak256(toHex("basis")), valuationTimestamp: 1_700_000_000n, publishedAt: 1_700_000_100n, provider: A.other, isPublishStale: false, isValuationStale: false },
  activeBundle: BUNDLE_HASH,
  superseded: false,
  documentCount: 3n,
  eventCount: 2n,
  approvedRegistries: [A.claimRegistry],
  knownRegistries: [A.claimRegistry],
  claims: 1,
  assetId: ASSET_ID,
  vaultAsset: null,
  canTransferReverts: false,
};

function must<T>(v: T | null, what: string): T {
  if (v === null) throw new Error(what);
  return v;
}

function erc165(declares: InterfaceName[]) {
  const ids = new Set(declares.map((n) => INTERFACE_IDS[n].toLowerCase()));
  return { supportsInterface: (id: string) => ids.has(id.toLowerCase()) };
}

const claim = { assetId: ASSET_ID, claimType: 0, schemaId: keccak256(toHex("schema")), schemaHash: keccak256(toHex("schemahash")), version: 1n, validFrom: 1n, validUntil: 0n, claimState: 2, tags: [] as Hex[], contentHash: keccak256(toHex("content")), author: A.other, uri: "ipfs://claim" };

export function buildContracts(c: StackConfig): Record<string, Handler> {
  const tokenAbi: Abi = [...erc165Abi, ...erc3643Abi, ...erc7943FungibleAbi, ...erc4626Abi, ...assetBoundTokenAbi, ...assetBoundTokenIdAbi, ...registryAnchorAbi];
  const approved = new Set(c.approvedRegistries.map((a) => a.toLowerCase()));
  return {
    [A.token]: contract(tokenAbi, {
      ...erc165(c.tokenDeclares),
      paused: () => c.paused,
      identityRegistry: () => A.identityRegistry,
      compliance: () => A.compliance,
      canTransfer: () => (c.canTransferReverts ? revert("canTransfer reverted") : false),
      getFrozenTokens: () => 0n,
      asset: () => must(c.vaultAsset, "not a vault"),
      totalAssets: () => (must(c.vaultAsset, "not a vault"), 42n),
      anchorId: () => c.tokenAnchorId,
      anchorIdOf: () => c.tokenAnchorId,
      anchorRegistry: () => c.tokenRegistry,
      isAnchorActive: () => c.isActive,
      getRegistries: () => c.knownRegistries,
      isRegistryApproved: (r: string) => approved.has(r.toLowerCase()),
    }),
    [A.registry]: contract([...erc165Abi, ...assetAnchorRegistryAbi, ...assetAnchorRegistryLifecycleAbi, ...assetAnchorRegistryRecoveryAbi], {
      ...erc165(c.registryDeclares),
      getAnchor: (id: string) => (id.toLowerCase() === c.record.anchorId.toLowerCase() ? c.record : (() => { throw new Error("unknown anchor"); })()),
      isBound: () => c.isBound,
      isActive: () => c.isActive,
      isBindingValid: () => c.isBindingValid,
    }),
    [A.oracle]: contract([...erc165Abi, ...navSnapshotOracleAbi], {
      ...erc165(["IERC165", "INAVSnapshotOracle"]),
      heartbeat: () => c.heartbeat,
      maxValuationAge: () => c.maxValuationAge,
      latestNAVStatus: () => {
        if (!c.nav || c.heartbeat === 0n || c.maxValuationAge === 0n) throw new Error("no current snapshot / unconfigured");
        const n = c.nav;
        return [n.nav, n.decimals, n.navBasis, n.valuationTimestamp, n.publishedAt, n.provider, n.isPublishStale, n.isValuationStale];
      },
    }),
    [A.anchor]: contract([...erc165Abi, ...documentBundleAnchorAbi], {
      ...erc165(["IERC165", "IDocumentBundleAnchor"]),
      activeBundle: () => c.activeBundle,
      getAnchor: (hash: string, subjectId: string, role: string) => ({ bundleHash: hash, subjectId, role, anchoredBy: A.other, anchoredAt: 1_690_000_000n, documentCount: c.documentCount, metadataURI: "ipfs://bundle", superseded: c.superseded, supersededBy: c.superseded ? keccak256(toHex("newer")) : `0x${"0".repeat(64)}` }),
    }),
    [A.log]: contract([...erc165Abi, ...complianceEventLogAbi], {
      ...erc165(["IERC165", "IComplianceEventLog"]),
      eventCount: () => c.eventCount,
      lastRecordedEventByType: () => 0n,
      currentEventIndex: (_s: string, i: bigint) => (i === 0n && c.eventCount > 1n ? 1n : i), // event 0 corrected by event 1
      getEvent: (subjectId: string, i: bigint) => ({ subjectId, subjectType: keccak256(toHex("ERC-8328:SUBJECT_TYPE:ASSET")), eventType: keccak256(toHex("ERC-8328:EVENT_TYPE:KYC_APPROVED:V1")), outcome: keccak256(toHex("ok")), actor: A.other, authority: keccak256(toHex("auth")), parties: [], evidenceHash: keccak256(toHex("ev")), evidenceURI: "", payloadProfileId: `0x${"0".repeat(64)}`, payload: "0x", operationRef: `0x${"0".repeat(64)}`, occurredAt: 1_690_000_000n, recordedAt: 1_690_000_001n, correctsIndex: i === 1n ? 0n : (1n << 256n) - 1n, correctedByIndex: 0n }),
    }),
    [A.claimRegistry]: contract([...erc165Abi, ...regulatedAssetClaimRegistryAbi], {
      ...erc165(["IERC165", "IRegulatedAssetClaimRegistry"]),
      getAssetId: () => c.assetId,
      getActiveClaims: () => Array.from({ length: c.claims }, (_, i) => ({ ...claim, version: BigInt(i + 1) })),
    }),
  };
}

export function stack(overrides: Partial<StackConfig> = {}): { cfg: StackConfig; client: PublicClient } {
  const cfg: StackConfig = { ...DEFAULTS, ...overrides, record: { ...DEFAULTS.record, ...(overrides.record ?? {}) } };
  return { cfg, client: fakeClient({ chainId: CHAIN_ID, blockNumber: BLOCK, contracts: buildContracts(cfg) }) };
}

// A CheckContext for A.token on the given client, detection included.
export async function ctxFor(client: PublicClient, hints: RegistryHints = {}, tokenId?: bigint): Promise<CheckContext> {
  return {
    client,
    chainId: CHAIN_ID,
    token: A.token,
    blockNumber: BLOCK,
    detection: await detect(client, A.token, BLOCK),
    hints,
    ...(tokenId !== undefined ? { tokenId } : {}),
  };
}
