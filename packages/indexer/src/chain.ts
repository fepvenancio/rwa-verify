// Pure lifecycle logic shared by the API and its unit tests: ERC-8328 / ERC-8330 correction chains, the ERC-8330
// latest-NAV ordering and the ERC-8320 live-claim window. Mirrors the spec's view functions so the indexer can be
// differentially tested against them (src/e2e.test.ts).

export const NO_CORRECTION = (1n << 256n) - 1n; // correctsIndex of an original
export const NO_CORRECTED_BY = 0n; // correctedByIndex of a terminal

export interface ChainNode {
  index: bigint;
  correctedByIndex: bigint;
  invalidated?: boolean; // ERC-8330 only; ERC-8328 has no invalidation
}

export function byIndex<T extends ChainNode>(nodes: readonly T[]): Map<bigint, T> {
  return new Map(nodes.map((n) => [n.index, n]));
}

/** `isSnapshotCurrent` / `isEventCurrent`: terminal and not invalidated. */
export function isCurrent(node: ChainNode): boolean {
  return node.correctedByIndex === NO_CORRECTED_BY && !node.invalidated;
}

/**
 * `currentSnapshotIndex` / `currentEventIndex`: follows correctedByIndex to the terminal. Returns null where the
 * chain function reverts: unknown index, or a terminal that has been invalidated. A conforming chain is linear
 * and strictly increasing, so the walk is bounded by the number of nodes.
 */
export function terminalIndex(nodes: ReadonlyMap<bigint, ChainNode>, index: bigint): bigint | null {
  let node = nodes.get(index);
  if (!node) return null;
  for (let hops = 0; node.correctedByIndex !== NO_CORRECTED_BY; hops++) {
    if (hops >= nodes.size) return null; // malformed (cyclic) chain
    node = nodes.get(node.correctedByIndex);
    if (!node) return null;
  }
  return node.invalidated ? null : node.index;
}

export interface SnapshotNode extends ChainNode {
  valuationTimestamp: bigint;
  publishedAt: bigint;
}

/**
 * `latestNAV`: the current snapshot with the greatest valuationTimestamp; ties go to the most recently published,
 * then to the greater index. A late correction to an older valuation therefore never displaces a newer valuation.
 * Returns null when no current snapshot exists (latestNAV reverts).
 */
export function latestCurrent<T extends SnapshotNode>(snapshots: readonly T[]): T | null {
  let best: T | null = null;
  for (const s of snapshots) {
    if (!isCurrent(s)) continue;
    if (
      best === null ||
      s.valuationTimestamp > best.valuationTimestamp ||
      (s.valuationTimestamp === best.valuationTimestamp &&
        (s.publishedAt > best.publishedAt || (s.publishedAt === best.publishedAt && s.index > best.index)))
    ) {
      best = s;
    }
  }
  return best;
}

export const CLAIM_ACTIVE = 2; // ClaimState.ACTIVE

export interface ClaimWindow {
  state: number;
  validFrom: bigint;
  validUntil: bigint; // 0 = no expiry
}

/** `getActiveClaims` membership at time `at`: ACTIVE and validFrom <= at < validUntil (validUntil 0 = open). */
export function claimIsLive(c: ClaimWindow, at: bigint): boolean {
  return c.state === CLAIM_ACTIVE && at >= c.validFrom && (c.validUntil === 0n || at < c.validUntil);
}
