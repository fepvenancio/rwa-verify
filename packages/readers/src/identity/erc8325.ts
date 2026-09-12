import type { AssetIdentity } from "@rwa-verify/core";
import { assetBoundTokenAbi } from "../abi/erc8325.js";
import { read } from "../call.js";
import type { CheckContext } from "../checks/context.js";
import { mutualBinding, readTokenSide } from "../checks/erc8325.js";

// ERC-8325 identity: subjectId is the anchorId the token declares.
export function erc8325Identity(ctx: CheckContext): AssetIdentity {
  return {
    standard: "erc8325",
    async subjectId() {
      const side = await readTokenSide(ctx);
      if (side.kind !== "ok") throw new Error(`erc8325: token-side anchorId unavailable (${side.kind})`);
      return side.side.anchorId;
    },
    async registries() {
      const r = await read(ctx.client, { address: ctx.token, abi: assetBoundTokenAbi, functionName: "anchorRegistry", blockNumber: ctx.blockNumber });
      if (!r.ok) throw new Error(`erc8325: anchorRegistry() failed: ${r.message}`);
      return [r.value];
    },
    isBound: () => mutualBinding(ctx),
  };
}
