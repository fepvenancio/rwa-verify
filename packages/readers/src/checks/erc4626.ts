import { ERC } from "@rwa-verify/core";
import { erc4626Abi } from "../abi/erc4626.js";
import { read } from "../call.js";
import { ZERO_ADDRESS, result, sameAddress, type Check } from "./context.js";

// ERC-4626 has no ERC-165 ID; support is probed by calling. Revert -> unsupported.

// erc4626.asset — the underlying; fail when zero address.
export const erc4626Asset: Check = async (ctx) => {
  const id = "erc4626.asset";
  const r = await read(ctx.client, { address: ctx.token, abi: erc4626Abi, functionName: "asset", blockNumber: ctx.blockNumber });
  if (!r.ok) return result(ctx, id, ERC.VAULT, r.kind === "revert" ? "unsupported" : "unknown", { error: r.message });
  return result(ctx, id, ERC.VAULT, sameAddress(r.value, ZERO_ADDRESS) ? "fail" : "pass", { asset: r.value });
};

// erc4626.totalAssets — recorded fact.
export const erc4626TotalAssets: Check = async (ctx) => {
  const id = "erc4626.totalAssets";
  const r = await read(ctx.client, { address: ctx.token, abi: erc4626Abi, functionName: "totalAssets", blockNumber: ctx.blockNumber });
  if (!r.ok) return result(ctx, id, ERC.VAULT, r.kind === "revert" ? "unsupported" : "unknown", { error: r.message });
  return result(ctx, id, ERC.VAULT, "pass", { totalAssets: r.value });
};
