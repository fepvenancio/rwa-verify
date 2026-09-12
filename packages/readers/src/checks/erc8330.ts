import { ERC } from "@rwa-verify/core";
import { navSnapshotOracleAbi } from "../abi/erc8330.js";
import { INTERFACE_IDS } from "../abi/interfaceIds.js";
import { read } from "../call.js";
import { supportsInterface } from "../detect.js";
import { result, type Check } from "./context.js";

const ID = "erc8330.navFresh";

// erc8330.navFresh — latestNAVStatus with both staleness flags (ERC-8330 "Staleness Semantics").
//   heartbeat or maxValuationAge == 0  -> unknown (thresholds unconfigured; latestNAVStatus would revert)
//   latestNAVStatus reverts            -> fail (no current snapshot)
//   either flag set                    -> stale
export const navFresh: Check = async (ctx) => {
  const { client, blockNumber, hints } = ctx;
  const { navOracle: oracle, subjectId, currency } = hints;
  const used = { navOracle: oracle, subjectId, currency };
  if (!oracle) {
    return result(ctx, ID, ERC.NAV_SNAPSHOT_ORACLE, "unsupported", { reason: "no NAV oracle address supplied; ERC-8330 has no token-side discovery" }, used);
  }
  if (!subjectId || !currency) {
    return result(ctx, ID, ERC.NAV_SNAPSHOT_ORACLE, "unknown", { oracle, reason: !subjectId ? "no subjectId" : "no currency supplied" }, used);
  }
  if (!(await supportsInterface(client, oracle, INTERFACE_IDS.INAVSnapshotOracle, blockNumber))) {
    return result(ctx, ID, ERC.NAV_SNAPSHOT_ORACLE, "unsupported", { oracle, reason: "contract does not declare INAVSnapshotOracle via ERC-165" }, used);
  }
  const stream = { oracle, subjectId, currency };
  const [hb, mva] = await Promise.all([
    read(client, { address: oracle, abi: navSnapshotOracleAbi, functionName: "heartbeat", args: [subjectId, currency], blockNumber }),
    read(client, { address: oracle, abi: navSnapshotOracleAbi, functionName: "maxValuationAge", args: [subjectId, currency], blockNumber }),
  ]);
  if (!hb.ok || !mva.ok) {
    return result(ctx, ID, ERC.NAV_SNAPSHOT_ORACLE, "unknown", { ...stream, errors: { heartbeat: hb.ok ? undefined : hb.message, maxValuationAge: mva.ok ? undefined : mva.message } }, used);
  }
  const thresholds = { heartbeat: hb.value, maxValuationAge: mva.value };
  if (hb.value === 0n || mva.value === 0n) {
    return result(ctx, ID, ERC.NAV_SNAPSHOT_ORACLE, "unknown", { ...stream, ...thresholds, reason: "staleness thresholds unconfigured" }, used);
  }
  const st = await read(client, { address: oracle, abi: navSnapshotOracleAbi, functionName: "latestNAVStatus", args: [subjectId, currency], blockNumber });
  if (!st.ok) {
    return result(ctx, ID, ERC.NAV_SNAPSHOT_ORACLE, st.kind === "error" ? "unknown" : "fail", {
      ...stream,
      ...thresholds,
      error: st.message,
      reason: st.kind === "revert" ? "latestNAVStatus reverted with thresholds configured: no current snapshot" : undefined,
    }, used);
  }
  const [nav, decimals, navBasis, valuationTimestamp, publishedAt, provider, isPublishStale, isValuationStale] = st.value;
  return result(ctx, ID, ERC.NAV_SNAPSHOT_ORACLE, isPublishStale || isValuationStale ? "stale" : "pass", {
    ...stream,
    ...thresholds,
    nav,
    decimals,
    navBasis,
    valuationTimestamp,
    publishedAt,
    provider,
    isPublishStale,
    isValuationStale,
  }, used);
};
