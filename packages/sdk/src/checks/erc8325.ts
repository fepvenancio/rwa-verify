import { keccak256, toHex } from "viem";
import { ERC, type Hex } from "@rwa-verify/core";
import { INTERFACE_IDS } from "../abi/interfaceIds.js";
import {
  assetAnchorRegistryAbi,
  assetAnchorRegistryLifecycleAbi,
  assetAnchorRegistryRecoveryAbi,
  assetBoundTokenAbi,
  assetBoundTokenIdAbi,
} from "../abi/erc8325.js";
import { read } from "../call.js";
import { supportsInterface } from "../detect.js";
import { result, sameAddress, type Check, type CheckContext } from "./context.js";

export const BINDING_SCOPE_CONTRACT = keccak256(toHex("ERC-8325:BINDING_SCOPE:CONTRACT"));
export const BINDING_SCOPE_TOKEN_ID = keccak256(toHex("ERC-8325:BINDING_SCOPE:TOKEN_ID"));

const ID = "erc8325.mutualBinding";

export interface TokenSide {
  interface: "IAssetBoundToken" | "IAssetBoundTokenId";
  anchorId: Hex;
  anchorRegistry: Hex;
}

// Reads the token-side declaration (ERC-8325 "Token Interfaces"). Token-ID bindings need a tokenId.
export async function readTokenSide(ctx: CheckContext): Promise<
  | { kind: "ok"; side: TokenSide }
  | { kind: "none" }
  | { kind: "needsTokenId" }
  | { kind: "failed"; interface: TokenSide["interface"]; error: string; rpc: boolean }
> {
  const { client, token: address, tokenId, blockNumber, detection } = ctx;
  const byId = tokenId !== undefined && detection.supports.IAssetBoundTokenId;
  if (!byId && !detection.supports.IAssetBoundToken) {
    return detection.supports.IAssetBoundTokenId ? { kind: "needsTokenId" } : { kind: "none" };
  }
  const iface = byId ? "IAssetBoundTokenId" : "IAssetBoundToken";
  const [idRead, regRead] = await Promise.all([
    byId
      ? read(client, { address, abi: assetBoundTokenIdAbi, functionName: "anchorIdOf", args: [tokenId], blockNumber })
      : read(client, { address, abi: assetBoundTokenAbi, functionName: "anchorId", blockNumber }),
    read(client, { address, abi: assetBoundTokenAbi, functionName: "anchorRegistry", blockNumber }),
  ]);
  if (!idRead.ok) return { kind: "failed", interface: iface, error: idRead.message, rpc: idRead.kind === "error" };
  if (!regRead.ok) return { kind: "failed", interface: iface, error: regRead.message, rpc: regRead.kind === "error" };
  return { kind: "ok", side: { interface: iface, anchorId: idRead.value, anchorRegistry: regRead.value } };
}

// erc8325.mutualBinding — the six conditions of ERC-8325 "Complete Binding Verification".
// Condition 4 applies only when the registry declares IAssetAnchorRegistryRecovery via ERC-165.
export const mutualBinding: Check = async (ctx) => {
  const { client, token, tokenId, blockNumber, detection, hints } = ctx;
  const used = { anchorRegistry: hints.anchorRegistry, anchorId: hints.anchorId };
  const evidence: Record<string, unknown> = {
    tokenDeclares: { IAssetBoundToken: detection.supports.IAssetBoundToken, IAssetBoundTokenId: detection.supports.IAssetBoundTokenId },
  };

  const tokenSide = await readTokenSide(ctx);
  if (tokenSide.kind === "needsTokenId") {
    return result(ctx, ID, ERC.ASSET_ANCHOR_REGISTRY, "unknown", { ...evidence, reason: "token declares IAssetBoundTokenId; --token-id is required" }, used);
  }
  if (tokenSide.kind === "failed") {
    return result(ctx, ID, ERC.ASSET_ANCHOR_REGISTRY, tokenSide.rpc ? "unknown" : "fail", {
      ...evidence,
      tokenSide: { interface: tokenSide.interface, error: tokenSide.error },
      reason: tokenSide.rpc ? undefined : "token declares the interface but its getters revert",
    }, used);
  }
  const side = tokenSide.kind === "ok" ? tokenSide.side : undefined;
  if (!side && (!hints.anchorRegistry || !hints.anchorId)) {
    return result(ctx, ID, ERC.ASSET_ANCHOR_REGISTRY, "unsupported", {
      ...evidence,
      erc165: detection.erc165,
      reason: "token declares no ERC-8325 token-side interface; pass --anchor-registry and --anchor-id to check a registry-side binding",
    }, used);
  }
  if (side) evidence.tokenSide = side;

  // Registry-side (conditions 1-4). The registry is what the token names unless a hint pins it.
  const registry: Hex = hints.anchorRegistry ?? side!.anchorRegistry;
  const anchorId: Hex = side?.anchorId ?? hints.anchorId!;
  const expectedScope = side ? (side.interface === "IAssetBoundTokenId" ? BINDING_SCOPE_TOKEN_ID : BINDING_SCOPE_CONTRACT) : tokenId !== undefined ? BINDING_SCOPE_TOKEN_ID : BINDING_SCOPE_CONTRACT;
  const expectedTokenId = expectedScope === BINDING_SCOPE_TOKEN_ID ? (tokenId ?? 0n) : 0n;
  evidence.registry = registry;
  evidence.anchorId = anchorId;
  evidence.expected = { boundToken: token, bindingScope: expectedScope, boundTokenId: expectedTokenId };

  const [isRegistry, hasLifecycle, hasRecovery] = await Promise.all([
    supportsInterface(client, registry, INTERFACE_IDS.IAssetAnchorRegistry, blockNumber),
    supportsInterface(client, registry, INTERFACE_IDS.IAssetAnchorRegistryLifecycle, blockNumber),
    supportsInterface(client, registry, INTERFACE_IDS.IAssetAnchorRegistryRecovery, blockNumber),
  ]);
  evidence.registryDeclares = { IAssetAnchorRegistry: isRegistry, IAssetAnchorRegistryLifecycle: hasLifecycle, IAssetAnchorRegistryRecovery: hasRecovery };
  if (!isRegistry) {
    return result(ctx, ID, ERC.ASSET_ANCHOR_REGISTRY, "fail", { ...evidence, reason: "registry does not declare IAssetAnchorRegistry via ERC-165" }, used);
  }

  const [record, bound, active, valid] = await Promise.all([
    read(client, { address: registry, abi: assetAnchorRegistryAbi, functionName: "getAnchor", args: [anchorId], blockNumber }),
    read(client, { address: registry, abi: assetAnchorRegistryAbi, functionName: "isBound", args: [anchorId], blockNumber }),
    read(client, { address: registry, abi: assetAnchorRegistryLifecycleAbi, functionName: "isActive", args: [anchorId], blockNumber }),
    hasRecovery
      ? read(client, { address: registry, abi: assetAnchorRegistryRecoveryAbi, functionName: "isBindingValid", args: [anchorId], blockNumber })
      : Promise.resolve(undefined),
  ]);
  const reads = { getAnchor: record, isBound: bound, isActive: active, isBindingValid: valid };
  const failedReads = Object.entries(reads).filter(([, r]) => r && !r.ok) as [string, { kind: string; message: string }][];
  if (failedReads.length > 0) {
    const rpc = failedReads.some(([, r]) => r.kind === "error");
    return result(ctx, ID, ERC.ASSET_ANCHOR_REGISTRY, rpc ? "unknown" : "fail", {
      ...evidence,
      errors: Object.fromEntries(failedReads.map(([k, r]) => [k, r.message])),
      reason: rpc ? undefined : "registry reverted (unknown anchor?)",
    }, used);
  }
  if (!record.ok || !bound.ok || !active.ok) throw new Error("unreachable");
  evidence.record = record.value;
  evidence.isBound = bound.value;
  evidence.isActive = active.value;
  if (valid) evidence.isBindingValid = valid.ok ? valid.value : undefined;

  const conditions = {
    "1_recordMatches":
      sameAddress(record.value.boundToken, token) &&
      record.value.bindingScope.toLowerCase() === expectedScope.toLowerCase() &&
      record.value.boundTokenId === expectedTokenId,
    "2_isBound": bound.value,
    "3_isActive": active.value,
    "4_isBindingValid": hasRecovery ? valid!.ok && valid!.value : ("not applicable: registry does not declare IAssetAnchorRegistryRecovery" as const),
    "5_tokenSideInterface": side !== undefined,
    "6_tokenReportsSameRegistryAndAnchor":
      side !== undefined && sameAddress(side.anchorRegistry, registry) && side.anchorId.toLowerCase() === record.value.anchorId.toLowerCase(),
  };
  evidence.conditions = conditions;
  const ok = Object.values(conditions).every((c) => c === true || typeof c === "string");
  return result(ctx, ID, ERC.ASSET_ANCHOR_REGISTRY, ok ? "pass" : "fail", side ? evidence : { ...evidence, reason: "registry-side binding only; no token-side declaration" }, used);
};
