import { describe, expect, it } from "vitest";
import { navFresh } from "./erc8330.js";
import { A, ANCHOR_ID, DEFAULTS, USD, ctxFor, stack } from "../testing/stack.js";

const hints = { navOracle: A.oracle, subjectId: ANCHOR_ID, currency: USD };
const nav = (o: Partial<NonNullable<typeof DEFAULTS.nav>>) => ({ ...DEFAULTS.nav!, ...o });

describe("erc8330.navFresh", () => {
  it("passes when both staleness flags are clear", async () => {
    const r = await navFresh(await ctxFor(stack().client, hints));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ heartbeat: 3600n, maxValuationAge: 86400n, nav: 1_000_000n, decimals: 6, isPublishStale: false, isValuationStale: false });
    expect(r.reproduce).toBe(`rwa-verify check erc8330.navFresh --chain 31337 --token ${A.token} --nav-oracle ${A.oracle} --subject ${ANCHOR_ID} --currency ${USD}`);
  });

  it("publication-stale alone -> stale", async () => {
    const r = await navFresh(await ctxFor(stack({ nav: nav({ isPublishStale: true }) }).client, hints));
    expect(r.status).toBe("stale");
    expect(r.evidence).toMatchObject({ isPublishStale: true, isValuationStale: false });
  });

  it("valuation-stale alone -> stale", async () => {
    const r = await navFresh(await ctxFor(stack({ nav: nav({ isValuationStale: true }) }).client, hints));
    expect(r.status).toBe("stale");
    expect(r.evidence).toMatchObject({ isPublishStale: false, isValuationStale: true });
  });

  it("unconfigured heartbeat or maxValuationAge -> unknown with the zero in evidence", async () => {
    const hb = await navFresh(await ctxFor(stack({ heartbeat: 0n }).client, hints));
    expect(hb.status).toBe("unknown");
    expect(hb.evidence).toMatchObject({ heartbeat: 0n, maxValuationAge: 86400n });
    const mva = await navFresh(await ctxFor(stack({ maxValuationAge: 0n }).client, hints));
    expect(mva.status).toBe("unknown");
    expect(mva.evidence).toMatchObject({ heartbeat: 3600n, maxValuationAge: 0n });
  });

  it("thresholds configured but latestNAVStatus reverts (no current snapshot) -> fail", async () => {
    const r = await navFresh(await ctxFor(stack({ nav: null }).client, hints));
    expect(r.status).toBe("fail");
    expect(r.evidence.reason).toMatch(/no current snapshot/);
  });

  it("no oracle address -> unsupported; missing currency or subject -> unknown", async () => {
    const { client } = stack();
    expect((await navFresh(await ctxFor(client, {}))).status).toBe("unsupported");
    expect((await navFresh(await ctxFor(client, { navOracle: A.oracle, subjectId: ANCHOR_ID }))).status).toBe("unknown");
    expect((await navFresh(await ctxFor(client, { navOracle: A.oracle, currency: USD }))).status).toBe("unknown");
  });

  it("a contract that does not declare INAVSnapshotOracle -> unsupported", async () => {
    const r = await navFresh(await ctxFor(stack().client, { ...hints, navOracle: A.registry }));
    expect(r.status).toBe("unsupported");
  });
});
