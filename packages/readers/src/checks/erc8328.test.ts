import { keccak256, toHex } from "viem";
import { describe, expect, it } from "vitest";
import { latestCurrentEvent } from "./erc8328.js";
import { A, ANCHOR_ID, ctxFor, stack } from "../testing/stack.js";

const hints = { eventLog: A.log, subjectId: ANCHOR_ID };

describe("erc8328.latestCurrentEvent", () => {
  it("resolves the last recorded event to its terminal correction", async () => {
    const r = await latestCurrentEvent(await ctxFor(stack().client, hints));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ eventCount: 2n, recordedIndex: 1n, currentIndex: 1n, corrected: false });
    expect(r.evidence.event).not.toHaveProperty("parties");
    expect(r.reproduce).toBe(`rwa-verify check erc8328.latestCurrentEvent --chain 31337 --token ${A.token} --event-log ${A.log} --subject ${ANCHOR_ID}`);
  });

  it("with --event-type: lastRecordedEventByType then currentEventIndex (event 0 corrected by 1)", async () => {
    const eventType = keccak256(toHex("ERC-8328:EVENT_TYPE:KYC_APPROVED:V1"));
    const r = await latestCurrentEvent(await ctxFor(stack().client, { ...hints, eventType }));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ recordedIndex: 0n, currentIndex: 1n, corrected: true });
    expect(r.reproduce).toContain(`--event-type ${eventType}`);
  });

  it("no events for the subject -> unknown", async () => {
    const r = await latestCurrentEvent(await ctxFor(stack({ eventCount: 0n }).client, hints));
    expect(r.status).toBe("unknown");
    expect(r.evidence).toMatchObject({ eventCount: 0n });
  });

  it("no log address -> unsupported; no subject -> unknown", async () => {
    const { client } = stack();
    expect((await latestCurrentEvent(await ctxFor(client))).status).toBe("unsupported");
    expect((await latestCurrentEvent(await ctxFor(client, { eventLog: A.log }))).status).toBe("unknown");
  });
});
