import { db } from "ponder:api";
import schema from "ponder:schema";
import { and, eq } from "ponder";
import { Hono } from "hono";
import { byIndex, claimIsLive, isCurrent, latestCurrent, terminalIndex } from "../chain.js";

// Query API over the indexed history. Every response is JSON; bigints are serialised as decimal strings.
// Routes take the stream keys the readers need out of band (currency, role, claimType, event type) as query
// parameters, and the subject / asset id in the path.
const app = new Hono();

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)), {
    status,
    headers: { "content-type": "application/json" },
  });

const hex = (v: string | undefined): `0x${string}` | undefined =>
  v !== undefined && /^0x[0-9a-fA-F]*$/.test(v) ? (v.toLowerCase() as `0x${string}`) : undefined;

const uint = (v: string | undefined): bigint | undefined => (v !== undefined && /^\d+$/.test(v) ? BigInt(v) : undefined);

// GET /subjects/:subjectId/current-snapshot?currency=<bytes32>  -> latestNAV, or snapshot: null when none is current
app.get("/subjects/:subjectId/current-snapshot", async (c) => {
  const subjectId = hex(c.req.param("subjectId"));
  const currency = hex(c.req.query("currency"));
  if (!subjectId || !currency) return json({ error: "subjectId (path) and currency (query) must be hex" }, 400);
  const rows = await db
    .select()
    .from(schema.navSnapshot)
    .where(and(eq(schema.navSnapshot.subjectId, subjectId), eq(schema.navSnapshot.currency, currency)));
  return json({ subjectId, currency, snapshotCount: rows.length, snapshot: latestCurrent(rows) });
});

// GET /subjects/:subjectId/snapshots/:index/current?currency=<bytes32>
//   -> currentSnapshotIndex (null where it reverts) and isSnapshotCurrent for that index
app.get("/subjects/:subjectId/snapshots/:index/current", async (c) => {
  const subjectId = hex(c.req.param("subjectId"));
  const currency = hex(c.req.query("currency"));
  const index = uint(c.req.param("index"));
  if (!subjectId || !currency || index === undefined) return json({ error: "subjectId, index and currency required" }, 400);
  const rows = await db
    .select()
    .from(schema.navSnapshot)
    .where(and(eq(schema.navSnapshot.subjectId, subjectId), eq(schema.navSnapshot.currency, currency)));
  const nodes = byIndex(rows);
  const node = nodes.get(index);
  if (!node) return json({ error: "unknown snapshot index", index }, 404);
  const currentIndex = terminalIndex(nodes, index);
  return json({
    index,
    isCurrent: isCurrent(node),
    currentIndex,
    snapshot: node,
    current: currentIndex === null ? null : nodes.get(currentIndex),
  });
});

// GET /subjects/:subjectId/terminal-event?type=<bytes32>
//   -> lastRecordedEventByType(type) (or the last recorded event when type is omitted) resolved through
//      currentEventIndex to its terminal correction. Recording order, not occurredAt.
app.get("/subjects/:subjectId/terminal-event", async (c) => {
  const subjectId = hex(c.req.param("subjectId"));
  const type = c.req.query("type");
  const eventType = type === undefined ? undefined : hex(type);
  if (!subjectId || (type !== undefined && !eventType)) return json({ error: "subjectId and type must be hex" }, 400);
  const rows = await db.select().from(schema.complianceEvent).where(eq(schema.complianceEvent.subjectId, subjectId));
  const candidates = eventType ? rows.filter((r) => r.eventType === eventType) : rows;
  const recorded = candidates.reduce<(typeof rows)[number] | null>((m, r) => (m === null || r.index > m.index ? r : m), null);
  if (!recorded) return json({ error: "no event recorded", subjectId, eventType: eventType ?? null }, 404);
  const nodes = byIndex(rows);
  const currentIndex = terminalIndex(nodes, recorded.index);
  return json({
    subjectId,
    eventType: eventType ?? null,
    eventCount: rows.length,
    recordedIndex: recorded.index,
    currentIndex,
    corrected: currentIndex !== recorded.index,
    event: currentIndex === null ? null : nodes.get(currentIndex),
  });
});

// GET /subjects/:subjectId/active-bundle?role=<bytes32>  -> activeBundle record, or bundle: null
app.get("/subjects/:subjectId/active-bundle", async (c) => {
  const subjectId = hex(c.req.param("subjectId"));
  const role = hex(c.req.query("role"));
  if (!subjectId || !role) return json({ error: "subjectId (path) and role (query) must be hex" }, 400);
  const rows = await db
    .select()
    .from(schema.bundleAnchor)
    .where(and(eq(schema.bundleAnchor.subjectId, subjectId), eq(schema.bundleAnchor.role, role)));
  const active = rows.filter((r) => !r.superseded);
  if (active.length > 1) return json({ error: "slot has more than one active bundle", subjectId, role, active }, 500);
  return json({ subjectId, role, history: rows.length, bundle: active[0] ?? null });
});

// GET /assets/:assetId/active-claims?claimType=<0-7>&at=<unix seconds, default now>
//   -> getActiveClaims at `at`: ACTIVE and validFrom <= at < validUntil. Expiry is time-derived, so `at` matters.
app.get("/assets/:assetId/active-claims", async (c) => {
  const assetId = hex(c.req.param("assetId"));
  const claimType = uint(c.req.query("claimType"));
  const atParam = c.req.query("at");
  const at = atParam === undefined ? BigInt(Math.floor(Date.now() / 1000)) : uint(atParam);
  if (!assetId || claimType === undefined || claimType > 7n || at === undefined) {
    return json({ error: "assetId must be hex, claimType 0-7, at a unix timestamp" }, 400);
  }
  const rows = await db
    .select()
    .from(schema.claim)
    .where(and(eq(schema.claim.assetId, assetId), eq(schema.claim.claimType, Number(claimType))));
  return json({ assetId, claimType: Number(claimType), at, claims: rows.filter((r) => claimIsLive(r, at)) });
});

export default app;
