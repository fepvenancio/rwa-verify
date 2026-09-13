import type { PublicClient } from "viem";
import { specRef, type CheckResult, type CheckStatus, type ErcNumber, type Hex } from "@rwa-verify/core";
import type { Detection } from "../detect.js";

// Addresses and stream keys the token cannot tell us about. None of ERC-8326/8328/8330 have
// token-side discovery, so these come from the caller (CLI flags / API input).
export interface RegistryHints {
  subjectId?: Hex; // explicit join key; overrides identity adapters
  anchorRegistry?: Hex; // ERC-8325 registry expected to hold the binding
  anchorId?: Hex; // ERC-8325 anchor expected (only needed when the token has no token-side interface)
  claimRegistry?: Hex; // ERC-8320 claim registry
  claimType?: number; // ERC-8320 ClaimType enum ordinal, default 0 (IDENTITY)
  documentAnchor?: Hex; // ERC-8326 anchor contract
  role?: Hex; // ERC-8326 slot role
  navOracle?: Hex; // ERC-8330 oracle
  currency?: Hex; // ERC-8330 stream currency
  eventLog?: Hex; // ERC-8328 log
  eventType?: Hex; // ERC-8328 event type (optional; default = last recorded event)
  holder?: Hex; // ERC-3643 holder to check (erc3643.holder)
}

// Hint key -> CLI flag. Single source of truth for reproduce strings and the CLI parser.
export const HINT_FLAGS: Record<keyof RegistryHints, string> = {
  subjectId: "--subject",
  anchorRegistry: "--anchor-registry",
  anchorId: "--anchor-id",
  claimRegistry: "--claim-registry",
  claimType: "--claim-type",
  documentAnchor: "--document-anchor",
  role: "--role",
  navOracle: "--nav-oracle",
  currency: "--currency",
  eventLog: "--event-log",
  eventType: "--event-type",
  holder: "--holder",
};

// Hints a check actually used, echoed into its reproduce string. Values may be undefined.
export type UsedHints = { [K in keyof RegistryHints]?: RegistryHints[K] | undefined };

export interface CheckContext {
  client: PublicClient;
  chainId: number;
  token: Hex;
  tokenId?: bigint;
  blockNumber: bigint; // all reads in a check are pinned to this block
  detection: Detection; // ERC-165 detection of the token
  hints: RegistryHints;
  rpc?: string; // included in reproduce strings when known
}

export type Check = (ctx: CheckContext) => Promise<CheckResult>;

export function reproduceFor(ctx: CheckContext, id: string, used: UsedHints = {}): string {
  const parts = ["rwa-verify", "check", id, "--chain", String(ctx.chainId), "--token", ctx.token];
  if (ctx.tokenId !== undefined) parts.push("--token-id", ctx.tokenId.toString());
  for (const [key, value] of Object.entries(used) as [keyof RegistryHints, unknown][]) {
    if (value !== undefined) parts.push(HINT_FLAGS[key], String(value));
  }
  if (ctx.rpc) parts.push("--rpc", ctx.rpc);
  return parts.join(" ");
}

export function result(
  ctx: CheckContext,
  id: string,
  erc: ErcNumber,
  status: CheckStatus,
  evidence: Record<string, unknown>,
  used: UsedHints = {},
): CheckResult {
  return {
    id,
    status,
    evidence: { blockNumber: ctx.blockNumber, ...evidence },
    reproduce: reproduceFor(ctx, id, used),
    specRef: specRef(erc),
  };
}

export const ZERO_ADDRESS: Hex = "0x0000000000000000000000000000000000000000";
export const ZERO_BYTES32: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";

export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
