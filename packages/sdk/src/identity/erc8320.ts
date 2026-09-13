import type { AssetIdentity, Hex } from "@rwa-verify/core";
import { registryAnchorAbi, regulatedAssetClaimRegistryAbi } from "../abi/erc8320.js";
import { read } from "../call.js";
import type { CheckContext } from "../checks/context.js";
import { activeClaim } from "../checks/erc8320.js";

// ERC-8320 identity: subjectId is assetId = registry.getAssetId(token, tokenId ?? 0, chainId).
export function erc8320Identity(ctx: CheckContext, registry: Hex): AssetIdentity {
  const withRegistry: CheckContext = { ...ctx, hints: { ...ctx.hints, claimRegistry: registry } };
  return {
    standard: "erc8320",
    async subjectId() {
      const r = await read(ctx.client, {
        address: registry,
        abi: regulatedAssetClaimRegistryAbi,
        functionName: "getAssetId",
        args: [ctx.token, ctx.tokenId ?? 0n, BigInt(ctx.chainId)],
        blockNumber: ctx.blockNumber,
      });
      if (!r.ok) throw new Error(`erc8320: getAssetId failed: ${r.message}`);
      return r.value;
    },
    async registries() {
      if (!ctx.detection.supports.IRegistryAnchor) return [registry];
      const r = await read(ctx.client, { address: ctx.token, abi: registryAnchorAbi, functionName: "getRegistries", blockNumber: ctx.blockNumber });
      if (!r.ok) throw new Error(`erc8320: getRegistries failed: ${r.message}`);
      return [...r.value];
    },
    isBound: () => activeClaim(withRegistry),
  };
}
