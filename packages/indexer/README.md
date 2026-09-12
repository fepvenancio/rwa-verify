# @rwa-verify/indexer

Ponder indexer for the 83xx history a reader cannot get from a single call: ERC-8330 NAV corrections and
invalidations, ERC-8328 event correction chains, ERC-8326 bundle supersession and the ERC-8320 claim lifecycle.
It indexes one contract per standard and answers the `terminalEvent` / `currentSnapshot` / `activeBundle` /
`activeClaims` questions with the spec's own ordering rules (`src/chain.ts`). Nothing is deployed; it only reads.

## Environment

| Variable | Meaning | Default |
|---|---|---|
| `RPC_URL` | JSON-RPC endpoint | `http://127.0.0.1:8545` |
| `CHAIN_ID` | chain id the RPC must report | `31337` |
| `START_BLOCK` | first block to index (all four contracts) | `0` |
| `NAV_ORACLE` | ERC-8330 `INAVSnapshotOracle` address | required |
| `EVENT_LOG` | ERC-8328 `IComplianceEventLog` address | required |
| `DOCUMENT_ANCHOR` | ERC-8326 `IDocumentBundleAnchor` address | required |
| `CLAIM_REGISTRY` | ERC-8320 `IRegulatedAssetClaimRegistry` address | required |
| `PGLITE_DIR` | PGlite data directory | Ponder's `.ponder/pglite` |
| `DATABASE_SCHEMA` | database schema for `ponder start` (or `--schema`) | none (`ponder dev` uses `public`) |

Postgres instead of PGlite: set `DATABASE_URL` and unset `PGLITE_DIR` (Ponder's default resolution).
For chain id 31337 the RPC cache is disabled, because a restarted Anvil reuses block numbers.

Against the local fixture stack (`scripts/fixture-stack.sh` writes `packages/solidity/out/fixture-stack.json`):

```bash
scripts/fixture-stack.sh                                            # anvil + FixtureStack.s.sol, leaves anvil running
eval "$(pnpm exec tsx packages/indexer/src/env-from-fixture.ts)"    # exports the variables above
pnpm --filter @rwa-verify/indexer dev                               # http://localhost:42069
```

## API

JSON everywhere; `bigint`s are decimal strings, hex is lower-case. Stream keys that the standards do not expose
on-chain (currency, role, claim type, event type) are query parameters.

| Route | On-chain equivalent |
|---|---|
| `GET /subjects/:subjectId/current-snapshot?currency=` | `latestNAV`: current snapshot with the greatest `valuationTimestamp`, then most recently published, then greater index; `snapshot: null` when none is current |
| `GET /subjects/:subjectId/snapshots/:index/current?currency=` | `currentSnapshotIndex` (`currentIndex: null` where it reverts: invalidated terminal) and `isSnapshotCurrent`; 404 for an unknown index |
| `GET /subjects/:subjectId/terminal-event?type=` | `lastRecordedEventByType(type)` (or the last recorded event when `type` is omitted) resolved through `currentEventIndex`; 404 when no event matches |
| `GET /subjects/:subjectId/active-bundle?role=` | `activeBundle` + `getAnchor`; `bundle: null` for a never-occupied slot |
| `GET /assets/:assetId/active-claims?claimType=&at=` | `getActiveClaims` evaluated at unix time `at` (default: now): ACTIVE and `validFrom <= at < validUntil`. Expiry is time-derived, so pass the block timestamp you care about |

Ponder's own `/health`, `/ready`, `/status` and `/graphql` are also served.

## Notes

- One address per standard (`ponder.config.ts`); the tables carry the contract address in their primary keys.
- `NAVPublished` has no `methodologyURI`, `BundleAnchored` has no `metadataURI`: neither is indexed. `anchoredBy` is
  the transaction sender, which equals the record's `anchoredBy` (`msg.sender`) for direct calls only.
- ERC-8320 lifecycle events carry only `(assetId, claimType, version)`; the claim body is read with `getClaim` at
  the `ClaimProposed` block. `state` is the stored state; `EXPIRED` is never stored (spec) and is derived per query.
- `NAVSnapshotInvalidated` on a correction resets its predecessor's `correctedByIndex` to `0`, as the spec's
  "Invalidation" section requires, so `terminalIndex` agrees with `currentSnapshotIndex` after an unwind.
- ERC-8325 emits nothing in the fixture registry; binding events are not indexed.

## Tests

```bash
pnpm --filter @rwa-verify/indexer test       # unit tests for src/chain.ts (no chain needed)
pnpm test:indexer                            # differential e2e: anvil + fixture stack + `ponder start` vs viem reads
```

The e2e test (`src/e2e.test.ts`) compares, for every snapshot index, the indexer's `currentIndex` / `isCurrent`
with `currentSnapshotIndex` / `isSnapshotCurrent` (revert ⇔ `null`), `current-snapshot` with `latestNAV`,
`terminal-event` with `lastRecordedEventByType` + `currentEventIndex` + `getEvent`, `active-bundle` with
`activeBundle` + `getAnchor`, and `active-claims` with `getActiveClaims` before and after `evm_increaseTime`
carries the chain past a claim's `validUntil`. It is skipped when `anvil` or `forge` is missing.
