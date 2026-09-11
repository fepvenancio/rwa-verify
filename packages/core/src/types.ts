// Shared contracts (PLAN.md §2). Frozen before Phase 1.
// Do not change without an ADR PR.

export type Hex = `0x${string}`;

export type CheckStatus = "pass" | "fail" | "unsupported" | "stale" | "unknown";

export interface SpecRef {
  erc: number;
  commit: string; // pinned ethereum/ERCs SHA, see spec.ts
}

export interface CheckResult {
  id: string; // e.g. "erc8325.mutualBinding"
  status: CheckStatus;
  evidence: Record<string, unknown>; // tx hashes, block, values read
  reproduce: string; // CLI command that re-runs this check
  specRef: SpecRef;
}

export interface VerificationReport {
  chainId: number;
  token: Hex;
  tokenId?: bigint;
  baseline: CheckResult[]; // 3643 / 7943 / 4626 facts
  identity: CheckResult[]; // 8320 | 8325 via AssetIdentity adapter
  documents: CheckResult[]; // 8326
  valuation: CheckResult[]; // 8330
  compliance: CheckResult[]; // 8328
  generatedAt: string;
}

// Adapter, one per identity standard (ADR-002).
export interface AssetIdentity {
  standard: "erc8320" | "erc8325";
  subjectId(): Promise<Hex>;
  isBound(): Promise<CheckResult>;
  registries(): Promise<Hex[]>;
}
