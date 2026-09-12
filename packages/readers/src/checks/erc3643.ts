import { ERC } from "@rwa-verify/core";
import { erc3643Abi } from "../abi/erc3643.js";
import { read } from "../call.js";
import { ZERO_ADDRESS, result, sameAddress, type Check, type CheckContext } from "./context.js";

// ERC-3643 defines no ERC-165 ID in the spec text, so support is probed by calling. A revert
// means the token does not expose the function: `unsupported`. `declaresIERC3643` is the
// ERC-165 answer for the computed IERC3643 ID, evidence only.
async function fact<T>(
  ctx: CheckContext,
  id: string,
  functionName: "paused" | "identityRegistry" | "compliance",
  judge: (value: T) => boolean,
) {
  const r = await read(ctx.client, { address: ctx.token, abi: erc3643Abi, functionName, blockNumber: ctx.blockNumber });
  const declaresIERC3643 = ctx.detection.supports.IERC3643;
  if (!r.ok) {
    return result(ctx, id, ERC.TREX, r.kind === "revert" ? "unsupported" : "unknown", { declaresIERC3643, error: r.message });
  }
  const value = r.value as T;
  return result(ctx, id, ERC.TREX, judge(value) ? "pass" : "fail", { declaresIERC3643, [functionName]: value });
}

// erc3643.paused — fail while the token is paused (all transfers blocked).
export const erc3643Paused: Check = (ctx) => fact<boolean>(ctx, "erc3643.paused", "paused", (paused) => !paused);

// erc3643.identityRegistry — fail when unset (zero address).
export const erc3643IdentityRegistry: Check = (ctx) =>
  fact<string>(ctx, "erc3643.identityRegistry", "identityRegistry", (a) => !sameAddress(a, ZERO_ADDRESS));

// erc3643.compliance — fail when unset (zero address).
export const erc3643Compliance: Check = (ctx) =>
  fact<string>(ctx, "erc3643.compliance", "compliance", (a) => !sameAddress(a, ZERO_ADDRESS));
