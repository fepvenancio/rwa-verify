import { ERC, type Hex } from "@rwa-verify/core";
import { CLAIM_TYPES, registryAnchorAbi, regulatedAssetClaimRegistryAbi } from "../abi/erc8320.js";
import { INTERFACE_IDS } from "../abi/interfaceIds.js";
import { read } from "../call.js";
import { supportsInterface } from "../detect.js";
import { result, type Check, type CheckContext } from "./context.js";

const ID = "erc8320.activeClaim";

// Which claim registry to read: the hint, else (when the asset implements IRegistryAnchor) the
// first registry the asset approves. Returns the registries seen for evidence.
export async function resolveClaimRegistry(ctx: CheckContext): Promise<{ registry: Hex | undefined; known: Hex[]; approved: Hex[] }> {
  const { client, token, blockNumber, detection, hints } = ctx;
  if (!detection.supports.IRegistryAnchor) return { registry: hints.claimRegistry, known: [], approved: [] };
  const regs = await read(client, { address: token, abi: registryAnchorAbi, functionName: "getRegistries", blockNumber });
  const known: Hex[] = regs.ok ? [...regs.value] : [];
  const approved: Hex[] = [];
  for (const r of known) {
    const a = await read(client, { address: token, abi: registryAnchorAbi, functionName: "isRegistryApproved", args: [r], blockNumber });
    if (a.ok && a.value) approved.push(r);
  }
  return { registry: hints.claimRegistry ?? approved[0], known, approved };
}

// erc8320.activeClaim — getActiveClaims(assetId, claimType) is non-empty, where
// assetId = registry.getAssetId(token, tokenId ?? 0, chainId). When the asset implements
// IRegistryAnchor the registry must be approved by the asset; otherwise trust is registry-level.
export const activeClaim: Check = async (ctx) => {
  const { client, token, tokenId, chainId, blockNumber, detection, hints } = ctx;
  const claimType = hints.claimType ?? 0;
  const anchored = detection.supports.IRegistryAnchor;
  const { registry, known, approved } = await resolveClaimRegistry(ctx);
  const used = { claimRegistry: registry, claimType };
  const base = { assetDeclaresIRegistryAnchor: anchored, registriesKnownByAsset: known, registriesApprovedByAsset: approved, trust: anchored ? "asset-approved" : "registry-level" };
  if (!registry) {
    if (anchored) return result(ctx, ID, ERC.REGULATED_ASSET_CLAIM, "fail", { ...base, reason: "asset declares IRegistryAnchor but approves no registry" }, used);
    return result(ctx, ID, ERC.REGULATED_ASSET_CLAIM, "unsupported", { ...base, erc165: detection.erc165, reason: "asset does not declare IRegistryAnchor and no --claim-registry supplied" }, used);
  }
  if (!(await supportsInterface(client, registry, INTERFACE_IDS.IRegulatedAssetClaimRegistry, blockNumber))) {
    return result(ctx, ID, ERC.REGULATED_ASSET_CLAIM, "unsupported", { ...base, registry, reason: "registry does not declare IRegulatedAssetClaimRegistry via ERC-165" }, used);
  }
  const assetId = await read(client, { address: registry, abi: regulatedAssetClaimRegistryAbi, functionName: "getAssetId", args: [token, tokenId ?? 0n, BigInt(chainId)], blockNumber });
  if (!assetId.ok) {
    return result(ctx, ID, ERC.REGULATED_ASSET_CLAIM, assetId.kind === "error" ? "unknown" : "fail", { ...base, registry, error: assetId.message }, used);
  }
  const ev: Record<string, unknown> = { ...base, registry, assetId: assetId.value, claimType, claimTypeName: CLAIM_TYPES[claimType] };
  if (anchored) {
    const ok = await read(client, { address: token, abi: registryAnchorAbi, functionName: "isRegistryApproved", args: [registry], blockNumber });
    ev.registryApproved = ok.ok ? ok.value : undefined;
    if (!ok.ok) return result(ctx, ID, ERC.REGULATED_ASSET_CLAIM, ok.kind === "error" ? "unknown" : "fail", { ...ev, error: ok.message }, used);
    if (!ok.value) return result(ctx, ID, ERC.REGULATED_ASSET_CLAIM, "fail", { ...ev, reason: "asset does not approve this registry (ERC-8320 Exposure: MUST be ignored)" }, used);
  }
  const claims = await read(client, { address: registry, abi: regulatedAssetClaimRegistryAbi, functionName: "getActiveClaims", args: [assetId.value, claimType], blockNumber });
  if (!claims.ok) return result(ctx, ID, ERC.REGULATED_ASSET_CLAIM, claims.kind === "error" ? "unknown" : "fail", { ...ev, error: claims.message }, used);
  const summary = claims.value.map((c) => ({ version: c.version, author: c.author, validFrom: c.validFrom, validUntil: c.validUntil, schemaId: c.schemaId, contentHash: c.contentHash, uri: c.uri }));
  return result(ctx, ID, ERC.REGULATED_ASSET_CLAIM, summary.length > 0 ? "pass" : "fail", { ...ev, activeClaims: summary }, used);
};
