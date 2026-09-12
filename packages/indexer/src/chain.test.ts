import { describe, expect, it } from "vitest";
import { NO_CORRECTED_BY, NO_CORRECTION, byIndex, claimIsLive, isCurrent, latestCurrent, terminalIndex } from "./chain.js";

const snap = (index: number, o: { corrects?: number; correctedBy?: number; invalidated?: boolean; ts: number; at: number }) => ({
  index: BigInt(index),
  correctsIndex: o.corrects === undefined ? NO_CORRECTION : BigInt(o.corrects),
  correctedByIndex: o.correctedBy === undefined ? NO_CORRECTED_BY : BigInt(o.correctedBy),
  invalidated: o.invalidated ?? false,
  valuationTimestamp: BigInt(o.ts),
  publishedAt: BigInt(o.at),
});

describe("terminalIndex / isCurrent", () => {
  it("correct-of-correct resolves every member to the terminal", () => {
    const nodes = byIndex([
      snap(0, { correctedBy: 1, ts: 100, at: 1000 }),
      snap(1, { corrects: 0, correctedBy: 2, ts: 100, at: 1001 }),
      snap(2, { corrects: 1, ts: 100, at: 1002 }),
    ]);
    expect(terminalIndex(nodes, 0n)).toBe(2n);
    expect(terminalIndex(nodes, 1n)).toBe(2n);
    expect(terminalIndex(nodes, 2n)).toBe(2n);
    expect([0n, 1n, 2n].map((i) => isCurrent(nodes.get(i)!))).toEqual([false, false, true]);
  });

  it("invalidated terminal: null for the whole chain until the predecessor is restored", () => {
    // After NAVSnapshotInvalidated(2) the handler resets 1.correctedByIndex to NO_CORRECTED_BY.
    const dead = byIndex([snap(0, { correctedBy: 1, ts: 1, at: 1 }), snap(1, { corrects: 0, correctedBy: 2, ts: 1, at: 1 }), snap(2, { corrects: 1, invalidated: true, ts: 1, at: 1 })]);
    expect(terminalIndex(dead, 0n)).toBeNull();
    expect(terminalIndex(dead, 2n)).toBeNull();
    const restored = byIndex([snap(0, { correctedBy: 1, ts: 1, at: 1 }), snap(1, { corrects: 0, ts: 1, at: 1 }), snap(2, { corrects: 1, invalidated: true, ts: 1, at: 1 })]);
    expect(terminalIndex(restored, 0n)).toBe(1n);
    expect(terminalIndex(restored, 1n)).toBe(1n);
    expect(terminalIndex(restored, 2n)).toBeNull();
    expect(isCurrent(restored.get(1n)!)).toBe(true);
    expect(isCurrent(restored.get(2n)!)).toBe(false);
  });

  it("invalidated original with no successor is not current", () => {
    const nodes = byIndex([snap(0, { invalidated: true, ts: 1, at: 1 })]);
    expect(terminalIndex(nodes, 0n)).toBeNull();
    expect(isCurrent(nodes.get(0n)!)).toBe(false);
  });

  it("unknown index and malformed chains resolve to null", () => {
    expect(terminalIndex(byIndex([]), 0n)).toBeNull();
    expect(terminalIndex(byIndex([snap(0, { correctedBy: 5, ts: 1, at: 1 })]), 0n)).toBeNull();
    // Index 0 is the NO_CORRECTED_BY sentinel, so a cycle needs indices >= 1.
    const cyclic = byIndex([snap(1, { correctedBy: 2, ts: 1, at: 1 }), snap(2, { correctedBy: 1, ts: 1, at: 1 })]);
    expect(terminalIndex(cyclic, 1n)).toBeNull();
  });
});

describe("latestCurrent", () => {
  it("greatest valuation timestamp wins; a late correction to an older valuation does not replace it", () => {
    const rows = [
      snap(0, { correctedBy: 2, ts: 100, at: 1000 }),
      snap(1, { ts: 200, at: 1001 }),
      snap(2, { corrects: 0, ts: 100, at: 1999 }), // published last, older valuation
    ];
    expect(latestCurrent(rows)?.index).toBe(1n);
  });

  it("ties: most recently published, then greater index", () => {
    expect(latestCurrent([snap(0, { ts: 100, at: 1000 }), snap(1, { ts: 100, at: 1010 })])?.index).toBe(1n);
    expect(latestCurrent([snap(0, { ts: 100, at: 1010 }), snap(1, { ts: 100, at: 1000 })])?.index).toBe(0n);
    expect(latestCurrent([snap(0, { ts: 100, at: 1000 }), snap(1, { ts: 100, at: 1000 })])?.index).toBe(1n);
    expect(latestCurrent([snap(1, { ts: 100, at: 1000 }), snap(0, { ts: 100, at: 1000 })])?.index).toBe(1n);
  });

  it("skips corrected and invalidated snapshots; null when none is current", () => {
    expect(latestCurrent([snap(0, { correctedBy: 1, ts: 300, at: 1 }), snap(1, { corrects: 0, invalidated: true, ts: 300, at: 2 }), snap(2, { ts: 100, at: 3 })])?.index).toBe(2n);
    expect(latestCurrent([snap(0, { invalidated: true, ts: 1, at: 1 })])).toBeNull();
    expect(latestCurrent([])).toBeNull();
  });
});

describe("claimIsLive", () => {
  const active = { state: 2, validFrom: 100n, validUntil: 200n };
  it("ACTIVE inside [validFrom, validUntil)", () => {
    expect(claimIsLive(active, 99n)).toBe(false);
    expect(claimIsLive(active, 100n)).toBe(true);
    expect(claimIsLive(active, 199n)).toBe(true);
    expect(claimIsLive(active, 200n)).toBe(false); // expired: time-derived, no transaction
  });
  it("validUntil 0 means no expiry; non-ACTIVE states are never live", () => {
    expect(claimIsLive({ ...active, validUntil: 0n }, 10n ** 12n)).toBe(true);
    for (const state of [0, 1, 3, 4]) expect(claimIsLive({ ...active, state }, 150n)).toBe(false);
  });
});
