import type { AssetIdentity } from "@rwa-verify/core";
import type { CheckContext } from "../checks/context.js";
import { resolveClaimRegistry } from "../checks/erc8320.js";
import { erc8320Identity } from "./erc8320.js";
import { erc8325Identity } from "./erc8325.js";

// ADR-002: prefer what the token declares; when both are declared, return both.
// ERC-8320 also applies when the caller names a claim registry for a token that declares
// nothing (registry-level trust, reported as such by the check).
export async function selectIdentity(ctx: CheckContext): Promise<AssetIdentity[]> {
  const out: AssetIdentity[] = [];
  const s = ctx.detection.supports;
  if (s.IAssetBoundToken || s.IAssetBoundTokenId) out.push(erc8325Identity(ctx));
  const { registry } = await resolveClaimRegistry(ctx);
  if (registry) out.push(erc8320Identity(ctx, registry));
  return out;
}
