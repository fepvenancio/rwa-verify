import { ERC, type Hex } from "@rwa-verify/core";
import { erc7943FungibleAbi, erc7943MultiTokenAbi, erc7943NonFungibleAbi } from "../abi/erc7943.js";
import { read, type ReadResult } from "../call.js";
import { result, type Check, type CheckContext } from "./context.js";

// Neutral probe account for the view checks; it holds nothing and is not allowlisted anywhere.
export const PROBE: Hex = "0x000000000000000000000000000000000000dEaD";

type Variant = "IERC7943Fungible" | "IERC7943NonFungible" | "IERC7943MultiToken";

function variantOf(ctx: CheckContext): Variant | undefined {
  const s = ctx.detection.supports;
  if (s.IERC7943Fungible) return "IERC7943Fungible";
  if (s.IERC7943NonFungible) return "IERC7943NonFungible";
  if (s.IERC7943MultiToken) return "IERC7943MultiToken";
  return undefined;
}

function unsupported(ctx: CheckContext, id: string) {
  const s = ctx.detection.supports;
  return result(ctx, id, ERC.URWA, "unsupported", {
    erc165: ctx.detection.erc165,
    declares: { IERC7943Fungible: s.IERC7943Fungible, IERC7943NonFungible: s.IERC7943NonFungible, IERC7943MultiToken: s.IERC7943MultiToken },
  });
}

// erc7943.canTransfer — the spec says canTransfer MUST NOT revert; a revert is a fail. The boolean
// answer for the probe is a recorded fact, not a judgement (a probe that is not allowlisted is
// expected to get `false`).
export const erc7943CanTransfer: Check = async (ctx) => {
  const id = "erc7943.canTransfer";
  const variant = variantOf(ctx);
  if (!variant) return unsupported(ctx, id);
  const { client, token: address, blockNumber } = ctx;
  const tokenId = ctx.tokenId ?? 0n;
  let r: ReadResult<boolean>;
  let args: readonly unknown[];
  if (variant === "IERC7943Fungible") {
    args = [PROBE, PROBE, 0n];
    r = await read(client, { address, abi: erc7943FungibleAbi, functionName: "canTransfer", args: [PROBE, PROBE, 0n], blockNumber });
  } else if (variant === "IERC7943NonFungible") {
    args = [PROBE, PROBE, tokenId];
    r = await read(client, { address, abi: erc7943NonFungibleAbi, functionName: "canTransfer", args: [PROBE, PROBE, tokenId], blockNumber });
  } else {
    args = [PROBE, PROBE, tokenId, 0n];
    r = await read(client, { address, abi: erc7943MultiTokenAbi, functionName: "canTransfer", args: [PROBE, PROBE, tokenId, 0n], blockNumber });
  }
  if (!r.ok) {
    return result(ctx, id, ERC.URWA, r.kind === "revert" ? "fail" : "unknown", { variant, args, error: r.message, reason: r.kind === "revert" ? "canTransfer MUST NOT revert" : undefined });
  }
  return result(ctx, id, ERC.URWA, "pass", { variant, args, allowed: r.value });
};

// erc7943.frozenBalance — getFrozenTokens for the probe account (uint256, or bool for the NFT variant).
export const erc7943FrozenBalance: Check = async (ctx) => {
  const id = "erc7943.frozenBalance";
  const variant = variantOf(ctx);
  if (!variant) return unsupported(ctx, id);
  const { client, token: address, blockNumber } = ctx;
  const tokenId = ctx.tokenId ?? 0n;
  let r: ReadResult<bigint | boolean>;
  let args: readonly unknown[];
  if (variant === "IERC7943Fungible") {
    args = [PROBE];
    r = await read(client, { address, abi: erc7943FungibleAbi, functionName: "getFrozenTokens", args: [PROBE], blockNumber });
  } else if (variant === "IERC7943NonFungible") {
    args = [PROBE, tokenId];
    r = await read(client, { address, abi: erc7943NonFungibleAbi, functionName: "getFrozenTokens", args: [PROBE, tokenId], blockNumber });
  } else {
    args = [PROBE, tokenId];
    r = await read(client, { address, abi: erc7943MultiTokenAbi, functionName: "getFrozenTokens", args: [PROBE, tokenId], blockNumber });
  }
  if (!r.ok) return result(ctx, id, ERC.URWA, r.kind === "revert" ? "fail" : "unknown", { variant, args, error: r.message });
  return result(ctx, id, ERC.URWA, "pass", { variant, args, frozen: r.value });
};
