import { ERC } from "@rwa-verify/core";
import { documentBundleAnchorAbi } from "../abi/erc8326.js";
import { INTERFACE_IDS } from "../abi/interfaceIds.js";
import { read } from "../call.js";
import { supportsInterface } from "../detect.js";
import { ZERO_BYTES32, result, type Check } from "./context.js";

const ID = "erc8326.activeBundle";

// erc8326.activeBundle — ERC-8326 "Consumer Verification" steps 1-5 for the slot (subjectId, role).
// Step 6 (reproducing the bundle hash off-chain) belongs to @rwa-verify/canon.
export const activeBundle: Check = async (ctx) => {
  const { client, blockNumber, hints } = ctx;
  const { documentAnchor: anchor, subjectId, role } = hints;
  const used = { documentAnchor: anchor, subjectId, role };
  if (!anchor) {
    return result(ctx, ID, ERC.DOCUMENT_BUNDLE_ANCHOR, "unsupported", { reason: "no document anchor address supplied; ERC-8326 has no token-side discovery" }, used);
  }
  if (!subjectId || !role) {
    return result(ctx, ID, ERC.DOCUMENT_BUNDLE_ANCHOR, "unknown", { anchor, reason: !subjectId ? "no subjectId" : "no role supplied" }, used);
  }
  if (!(await supportsInterface(client, anchor, INTERFACE_IDS.IDocumentBundleAnchor, blockNumber))) {
    return result(ctx, ID, ERC.DOCUMENT_BUNDLE_ANCHOR, "unsupported", { anchor, reason: "contract does not declare IDocumentBundleAnchor via ERC-165" }, used);
  }
  const active = await read(client, { address: anchor, abi: documentBundleAnchorAbi, functionName: "activeBundle", args: [subjectId, role], blockNumber });
  if (!active.ok) {
    return result(ctx, ID, ERC.DOCUMENT_BUNDLE_ANCHOR, active.kind === "error" ? "unknown" : "fail", { anchor, subjectId, role, error: active.message }, used);
  }
  const bundleHash = active.value;
  if (bundleHash === ZERO_BYTES32) {
    return result(ctx, ID, ERC.DOCUMENT_BUNDLE_ANCHOR, "fail", { anchor, subjectId, role, bundleHash, reason: "slot has never been occupied" }, used);
  }
  const rec = await read(client, { address: anchor, abi: documentBundleAnchorAbi, functionName: "getAnchor", args: [bundleHash, subjectId, role], blockNumber });
  if (!rec.ok) {
    return result(ctx, ID, ERC.DOCUMENT_BUNDLE_ANCHOR, rec.kind === "error" ? "unknown" : "fail", { anchor, subjectId, role, bundleHash, error: rec.message }, used);
  }
  const r = rec.value;
  const checks = {
    fieldsMatch: r.bundleHash.toLowerCase() === bundleHash.toLowerCase() && r.subjectId.toLowerCase() === subjectId.toLowerCase() && r.role.toLowerCase() === role.toLowerCase(),
    anchoredAtNonzero: r.anchoredAt > 0n,
    documentCountNonzero: r.documentCount > 0n,
    notSuperseded: !r.superseded,
  };
  const ok = Object.values(checks).every(Boolean);
  return result(ctx, ID, ERC.DOCUMENT_BUNDLE_ANCHOR, ok ? "pass" : "fail", { anchor, subjectId, role, bundleHash, record: r, checks }, used);
};
