import { index, onchainTable, primaryKey } from "ponder";

// ERC-8330 snapshots: every published record, including corrected and invalidated ones (spec "Historical
// Queries"). correctsIndex == 2^256-1 (NO_CORRECTION) marks an original; correctedByIndex == 0 (NO_CORRECTED_BY)
// marks a terminal. Invalidating a correction resets its predecessor's correctedByIndex to 0 (spec "Invalidation").
export const navSnapshot = onchainTable(
  "nav_snapshot",
  (t) => ({
    oracle: t.hex().notNull(),
    subjectId: t.hex().notNull(),
    currency: t.hex().notNull(),
    index: t.bigint().notNull(),
    provider: t.hex().notNull(),
    nav: t.bigint().notNull(),
    decimals: t.integer().notNull(),
    navBasis: t.hex().notNull(),
    valuationTimestamp: t.bigint().notNull(),
    publishedAt: t.bigint().notNull(), // block timestamp of NAVPublished (spec: publishedAt = block.timestamp)
    methodologyHash: t.hex().notNull(),
    correctsIndex: t.bigint().notNull(),
    correctedByIndex: t.bigint().notNull(),
    invalidated: t.boolean().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.oracle, t.subjectId, t.currency, t.index] }),
    stream: index().on(t.subjectId, t.currency),
  }),
);

// ERC-8328 events: static fields from ComplianceEventRecorded; dynamic fields (parties, URI, payload) stay on-chain.
export const complianceEvent = onchainTable(
  "compliance_event",
  (t) => ({
    log: t.hex().notNull(),
    subjectId: t.hex().notNull(),
    index: t.bigint().notNull(),
    eventType: t.hex().notNull(),
    actor: t.hex().notNull(),
    outcome: t.hex().notNull(),
    authority: t.hex().notNull(),
    occurredAt: t.bigint().notNull(),
    recordedAt: t.bigint().notNull(), // block timestamp (spec: recordedAt = block.timestamp)
    correctsIndex: t.bigint().notNull(),
    correctedByIndex: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.log, t.subjectId, t.index] }),
    subject: index().on(t.subjectId),
  }),
);

// ERC-8326 anchors keyed by the (bundleHash, subjectId, role) triple; superseded records are kept.
export const bundleAnchor = onchainTable(
  "bundle_anchor",
  (t) => ({
    anchor: t.hex().notNull(),
    bundleHash: t.hex().notNull(),
    subjectId: t.hex().notNull(),
    role: t.hex().notNull(),
    anchoredBy: t.hex().notNull(), // transaction sender; equals anchoredBy (msg.sender) for direct calls
    anchoredAt: t.bigint().notNull(),
    documentCount: t.bigint().notNull(),
    superseded: t.boolean().notNull(),
    supersededBy: t.hex(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.anchor, t.bundleHash, t.subjectId, t.role] }),
    slot: index().on(t.subjectId, t.role),
  }),
);

// ERC-8320 claims: stored lifecycle state (PROPOSED 0, VALID 1, ACTIVE 2, REVOKED 4). EXPIRED (3) is time-derived
// and never stored: the API derives it from validFrom/validUntil at query time (spec "Claim Lifecycle").
export const claim = onchainTable(
  "claim",
  (t) => ({
    registry: t.hex().notNull(),
    assetId: t.hex().notNull(),
    claimType: t.integer().notNull(),
    version: t.bigint().notNull(),
    state: t.integer().notNull(),
    validFrom: t.bigint().notNull(),
    validUntil: t.bigint().notNull(), // 0 = no expiry
    author: t.hex().notNull(),
    schemaId: t.hex().notNull(),
    contentHash: t.hex().notNull(),
    uri: t.text().notNull(),
    blockNumber: t.bigint().notNull(), // block of the latest lifecycle transition
    txHash: t.hex().notNull(),
  }),
  (t) => ({
    pk: primaryKey({ columns: [t.registry, t.assetId, t.claimType, t.version] }),
    asset: index().on(t.assetId, t.claimType),
  }),
);
