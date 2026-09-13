import { ERC } from "@rwa-verify/core";
import { complianceEventLogAbi } from "../abi/erc8328.js";
import { INTERFACE_IDS } from "../abi/interfaceIds.js";
import { read } from "../call.js";
import { supportsInterface } from "../detect.js";
import { result, type Check } from "./context.js";

const ID = "erc8328.latestCurrentEvent";

// erc8328.latestCurrentEvent — the last recorded event for the subject (or for --event-type),
// resolved through currentEventIndex to its terminal correction. Recording order, not occurredAt.
export const latestCurrentEvent: Check = async (ctx) => {
  const { client, blockNumber, hints } = ctx;
  const { eventLog: log, subjectId, eventType } = hints;
  const used = { eventLog: log, subjectId, eventType };
  if (!log) {
    return result(ctx, ID, ERC.COMPLIANCE_EVENT_LOG, "unsupported", { reason: "no event log address supplied; ERC-8328 has no token-side discovery" }, used);
  }
  if (!subjectId) return result(ctx, ID, ERC.COMPLIANCE_EVENT_LOG, "unknown", { log, reason: "no subjectId" }, used);
  if (!(await supportsInterface(client, log, INTERFACE_IDS.IComplianceEventLog, blockNumber))) {
    return result(ctx, ID, ERC.COMPLIANCE_EVENT_LOG, "unsupported", { log, reason: "contract does not declare IComplianceEventLog via ERC-165" }, used);
  }
  const count = await read(client, { address: log, abi: complianceEventLogAbi, functionName: "eventCount", args: [subjectId], blockNumber });
  if (!count.ok) return result(ctx, ID, ERC.COMPLIANCE_EVENT_LOG, count.kind === "error" ? "unknown" : "fail", { log, subjectId, error: count.message }, used);
  if (count.value === 0n) return result(ctx, ID, ERC.COMPLIANCE_EVENT_LOG, "unknown", { log, subjectId, eventCount: 0n, reason: "no events recorded for subject" }, used);

  let recordedIndex: bigint;
  if (eventType) {
    const last = await read(client, { address: log, abi: complianceEventLogAbi, functionName: "lastRecordedEventByType", args: [subjectId, eventType], blockNumber });
    if (!last.ok) {
      return result(ctx, ID, ERC.COMPLIANCE_EVENT_LOG, "unknown", { log, subjectId, eventCount: count.value, eventType, error: last.message, reason: "no event of that type" }, used);
    }
    recordedIndex = last.value;
  } else {
    recordedIndex = count.value - 1n;
  }
  const current = await read(client, { address: log, abi: complianceEventLogAbi, functionName: "currentEventIndex", args: [subjectId, recordedIndex], blockNumber });
  if (!current.ok) return result(ctx, ID, ERC.COMPLIANCE_EVENT_LOG, current.kind === "error" ? "unknown" : "fail", { log, subjectId, recordedIndex, error: current.message }, used);
  const ev = await read(client, { address: log, abi: complianceEventLogAbi, functionName: "getEvent", args: [subjectId, current.value], blockNumber });
  if (!ev.ok) return result(ctx, ID, ERC.COMPLIANCE_EVENT_LOG, ev.kind === "error" ? "unknown" : "fail", { log, subjectId, recordedIndex, currentIndex: current.value, error: ev.message }, used);
  const { parties: _parties, payload: _payload, ...fields } = ev.value;
  return result(ctx, ID, ERC.COMPLIANCE_EVENT_LOG, "pass", {
    log,
    subjectId,
    eventCount: count.value,
    recordedIndex,
    currentIndex: current.value,
    corrected: current.value !== recordedIndex,
    event: fields,
  }, used);
};
