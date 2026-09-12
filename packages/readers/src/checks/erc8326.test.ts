import { describe, expect, it } from "vitest";
import { activeBundle } from "./erc8326.js";
import { A, ANCHOR_ID, BUNDLE_HASH, LEGAL_BASIS, ctxFor, stack } from "../testing/stack.js";

const hints = { documentAnchor: A.anchor, subjectId: ANCHOR_ID, role: LEGAL_BASIS };

describe("erc8326.activeBundle", () => {
  it("passes for an active, non-superseded bundle with nonzero count", async () => {
    const r = await activeBundle(await ctxFor(stack().client, hints));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ bundleHash: BUNDLE_HASH, checks: { fieldsMatch: true, anchoredAtNonzero: true, documentCountNonzero: true, notSuperseded: true } });
    expect(r.reproduce).toBe(`rwa-verify check erc8326.activeBundle --chain 31337 --token ${A.token} --document-anchor ${A.anchor} --subject ${ANCHOR_ID} --role ${LEGAL_BASIS}`);
  });

  it("superseded record -> fail", async () => {
    const r = await activeBundle(await ctxFor(stack({ superseded: true }).client, hints));
    expect(r.status).toBe("fail");
    expect(r.evidence.checks).toMatchObject({ notSuperseded: false });
  });

  it("zero documentCount -> fail", async () => {
    expect((await activeBundle(await ctxFor(stack({ documentCount: 0n }).client, hints))).status).toBe("fail");
  });

  it("slot never occupied (bytes32(0)) -> fail", async () => {
    const r = await activeBundle(await ctxFor(stack({ activeBundle: `0x${"0".repeat(64)}` }).client, hints));
    expect(r.status).toBe("fail");
    expect(r.evidence.reason).toMatch(/never been occupied/);
  });

  it("no anchor address -> unsupported; no role -> unknown; wrong contract -> unsupported", async () => {
    const { client } = stack();
    expect((await activeBundle(await ctxFor(client))).status).toBe("unsupported");
    expect((await activeBundle(await ctxFor(client, { documentAnchor: A.anchor, subjectId: ANCHOR_ID }))).status).toBe("unknown");
    expect((await activeBundle(await ctxFor(client, { ...hints, documentAnchor: A.oracle }))).status).toBe("unsupported");
  });
});
