import { ponder, type Context, type Event } from "ponder:registry";
import schema from "ponder:schema";
import { regulatedAssetClaimRegistryAbi } from "@rwa-verify/sdk";
import { NO_CORRECTED_BY, NO_CORRECTION } from "./chain.js";

// ---------------------------------------------------------------- ERC-8330

ponder.on("NavOracle:NAVPublished", async ({ event, context }) => {
  const { subjectId, currency, provider, snapshotIndex, nav, decimals, navBasis, valuationTimestamp, methodologyHash, correctsIndex } = event.args;
  const oracle = event.log.address;
  await context.db.insert(schema.navSnapshot).values({
    oracle,
    subjectId,
    currency,
    index: snapshotIndex,
    provider,
    nav,
    decimals,
    navBasis,
    valuationTimestamp,
    publishedAt: event.block.timestamp,
    methodologyHash,
    correctsIndex,
    correctedByIndex: NO_CORRECTED_BY,
    invalidated: false,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
  if (correctsIndex !== NO_CORRECTION) {
    await context.db.update(schema.navSnapshot, { oracle, subjectId, currency, index: correctsIndex }).set({ correctedByIndex: snapshotIndex });
  }
});

ponder.on("NavOracle:NAVSnapshotInvalidated", async ({ event, context }) => {
  const { subjectId, currency, snapshotIndex } = event.args;
  const key = { oracle: event.log.address, subjectId, currency, index: snapshotIndex };
  const snap = await context.db.find(schema.navSnapshot, key);
  if (!snap) throw new Error(`NAVSnapshotInvalidated for unknown snapshot ${snapshotIndex} (${subjectId}, ${currency})`);
  await context.db.update(schema.navSnapshot, key).set({ invalidated: true });
  // Spec "Invalidation": an invalidated correction's direct predecessor becomes terminal again.
  if (snap.correctsIndex !== NO_CORRECTION) {
    await context.db.update(schema.navSnapshot, { ...key, index: snap.correctsIndex }).set({ correctedByIndex: NO_CORRECTED_BY });
  }
});

// ---------------------------------------------------------------- ERC-8328

ponder.on("EventLog:ComplianceEventRecorded", async ({ event, context }) => {
  const { subjectId, eventType, actor, eventIndex, outcome, authority, occurredAt, correctsIndex } = event.args;
  const log = event.log.address;
  await context.db.insert(schema.complianceEvent).values({
    log,
    subjectId,
    index: eventIndex,
    eventType,
    actor,
    outcome,
    authority,
    occurredAt,
    recordedAt: event.block.timestamp,
    correctsIndex,
    correctedByIndex: NO_CORRECTED_BY,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
  if (correctsIndex !== NO_CORRECTION) {
    await context.db.update(schema.complianceEvent, { log, subjectId, index: correctsIndex }).set({ correctedByIndex: eventIndex });
  }
});

// ---------------------------------------------------------------- ERC-8326

ponder.on("DocumentAnchor:BundleAnchored", async ({ event, context }) => {
  const { bundleHash, subjectId, role, documentCount } = event.args;
  await context.db.insert(schema.bundleAnchor).values({
    anchor: event.log.address,
    bundleHash,
    subjectId,
    role,
    anchoredBy: event.transaction.from,
    anchoredAt: event.block.timestamp,
    documentCount,
    superseded: false,
    supersededBy: null,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("DocumentAnchor:BundleSuperseded", async ({ event, context }) => {
  const { oldBundleHash, newBundleHash, subjectId, role } = event.args;
  await context.db
    .update(schema.bundleAnchor, { anchor: event.log.address, bundleHash: oldBundleHash, subjectId, role })
    .set({ superseded: true, supersededBy: newBundleHash });
});

// ---------------------------------------------------------------- ERC-8320

// Stored ClaimState ordinals. EXPIRED (3) is time-derived and never stored (see ponder.schema.ts).
const PROPOSED = 0;
const VALID = 1;
const ACTIVE = 2;
const REVOKED = 4;

// Lifecycle events carry only (assetId, claimType, version); the claim body is read once at proposal time.
ponder.on("ClaimRegistry:ClaimProposed", async ({ event, context }) => {
  const { assetId, claimType, version } = event.args;
  const registry = event.log.address;
  const c = await context.client.readContract({
    abi: regulatedAssetClaimRegistryAbi,
    address: registry,
    functionName: "getClaim",
    args: [assetId, claimType, version],
  });
  await context.db.insert(schema.claim).values({
    registry,
    assetId,
    claimType,
    version,
    state: PROPOSED,
    validFrom: c.validFrom,
    validUntil: c.validUntil,
    author: c.author,
    schemaId: c.schemaId,
    contentHash: c.contentHash,
    uri: c.uri,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

type Transition =
  | Event<"ClaimRegistry:ClaimValidated">
  | Event<"ClaimRegistry:ClaimActivated">
  | Event<"ClaimRegistry:ClaimSuspended">
  | Event<"ClaimRegistry:ClaimRevoked">;

async function transition(context: Context, event: Transition, state: number) {
  const { assetId, claimType, version } = event.args;
  await context.db
    .update(schema.claim, { registry: event.log.address, assetId, claimType, version })
    .set({ state, blockNumber: event.block.number, txHash: event.transaction.hash });
}

ponder.on("ClaimRegistry:ClaimValidated", ({ event, context }) => transition(context, event, VALID));
ponder.on("ClaimRegistry:ClaimActivated", ({ event, context }) => transition(context, event, ACTIVE));
ponder.on("ClaimRegistry:ClaimSuspended", ({ event, context }) => transition(context, event, VALID)); // spec: ACTIVE -> VALID
ponder.on("ClaimRegistry:ClaimRevoked", ({ event, context }) => transition(context, event, REVOKED));
