# rwa-verify — agent operating rules

Read `PLAN.md` and `packages/core/src` before writing code. This file holds the rules that are not derivable from the code.

## Hard rules

- **Core is frozen.** Do not change `packages/core` (types, `SPEC_COMMIT`) without an ADR PR first. The coordinator rejects PRs that touch shared types without one.
- **No deployments.** No registry deployments, no admin keys, no canonical contracts of ours. We read; we never become an authority.
- **Spec is the source of truth.** Behaviour targets the vendored text in `specs/` at the SHA in `specs/PINNED.md` (ADR-001). When a reference implementation disagrees with the spec, implement the spec and add a row to `docs/spec-findings.md`.
- **Differential tests are mandatory** for any hashing or lifecycle logic (bundle hash, correction chains, supersession, claim lifecycle). Reference implementations are black-box Anvil targets only, never vendored (ADR-003).
- **Every check emits `reproduce`.** A `CheckResult.reproduce` string is a CLI command that re-runs that check and must pass in CI.
- **Baseline first.** Missing 83xx support reports `unsupported`, never blocks a report, and is never treated as `pass` (ADR-004).
- **Clean room.** No code, docs or fixtures from employer projects (ADR-005). Public sources only.
- **Solidity:** OpenZeppelin v5 only. No Solady. Library is pure/view, no upgradeability, no storage.
- **PRs:** terse descriptions, no unsolicited refactors, surgical diffs.

## Verification (must pass before claiming done)

```bash
pnpm install && pnpm typecheck && pnpm test   # TS packages
pnpm test:sol                                  # Foundry
```

CI runs both (`.github/workflows/ci.yml`). Phase exit criteria are in `PLAN.md §3`.

## Spec details that are easy to get wrong

Verified against the pinned text on 2026-09-11.

**ERC-8326 bundle hash** (`packages/canon`, `packages/solidity`)
- Entry sort is lexicographic on raw `bytes32`, keys in order: `role`, `filenameHash`, `contentHash`, `mimeTypeHash`, `normProfileId`. Duplicates are retained. Empty bundle reverts.
- `leaf = keccak256(abi.encodePacked(contentHash, role, mimeTypeHash, filenameHash, normProfileId))` — note the leaf field order differs from the sort key order.
- `bundleHash = keccak256(abi.encodePacked(SCHEMA_V1, leaf0..leafN))`, `SCHEMA_V1 = keccak256("ERC-8326:BUNDLE:V1")`.
- `filenameHash`: take substring after last `/` or `\`, ASCII-lowercase A–Z only, Unicode NFC, UTF-8, keccak256.
- `mimeTypeHash`: keccak256 of lowercase IANA media type with parameters stripped.
- `PROFILE_JSON_RFC8785`: RFC 8785 plus I-JSON. Reject duplicate keys, invalid Unicode, lone surrogates, numbers outside the interoperable range. Do not NFC-normalise JSON string values.
- `PROFILE_XML_C14N11`: Canonical XML 1.1 without comments, external entity resolution disabled. Not Exclusive C14N.
- `computeBundleHash` requires pre-sorted input and reverts otherwise; `computeCanonicalBundleHash` sorts first.

**ERC-8325 mutual binding** (`bindingValid`)
- Spec §"Complete Binding Verification" lists six conditions. All applicable ones must hold, else the binding is not mutually declared:
  1. `getAnchor(anchorId)` returns the expected `boundToken`, `bindingScope`, `boundTokenId`.
  2. `isBound(anchorId)` is `true`.
  3. `isActive(anchorId)` is `true` (lifecycle interface is mandatory for registries).
  4. `isBindingValid(anchorId)` is `true` **only when** the registry supports `IAssetAnchorRegistryRecovery` via ERC-165. Recovery is optional; do not call it blind.
  5. Token supports the applicable token-side interface via ERC-165: `IAssetBoundToken` (`anchorId()`, `anchorRegistry()`, `isAnchorActive()`) or `IAssetBoundTokenId` (`anchorIdOf(tokenId)`, `anchorRegistry()`, `isAnchorActiveFor(tokenId)`).
  6. Token reports the same registry and anchor as the registry record.
- A registry may bind a token that has no token-side interface. That is a registry-side binding only. Report it as `fail` for the mutual check with both sides in evidence.
- `isBound` stays `true` after deactivation or recovery invalidation. Never use it alone.

**ERC-8330 NAV** (`navFresh`)
- `latestNAV` already resolves the correction chain: it returns the current (terminal, non-invalidated) snapshot with the greatest `valuationTimestamp`, tie-break most recently published, then greater index. Do not re-walk the chain to find "latest".
- `latestNAVStatus` returns the same snapshot plus two independent flags: `isPublishStale = now > publishedAt + heartbeat`, `isValuationStale = now > valuationTimestamp + maxValuationAge`. Boundary is not stale. Evaluate both; either flag set means `status: "stale"`, not `"fail"`.
- `latestNAVStatus` reverts when either threshold is unconfigured (`heartbeat()` or `maxValuationAge()` returns 0) or when no current snapshot exists. Check thresholds first; report unconfigured as `unknown` with the zero values in evidence, and no current snapshot as `fail`.
- Chain helpers for history and indexing: `currentSnapshotIndex` follows `correctedByIndex` to the terminal and reverts if it is invalidated; `isSnapshotCurrent` is true only for terminal and non-invalidated. `getSnapshot` and `snapshotCount` include corrected and invalidated records.
- Sentinels: `correctsIndex == type(uint256).max` means original; `correctedByIndex == 0` means no successor.

**ERC-8320 claims** (`hasActiveClaim`)
- `assetId = getAssetId(contract, subAssetId, chainId)`. `getActiveClaims(assetId, claimType)` already filters to ACTIVE and inside `[validFrom, validUntil)`; EXPIRED is time-derived with no transaction, so never trust a cached `claimState`.
- If the asset contract supports `IRegistryAnchor` via ERC-165, a claim counts only if `isRegistryApproved(registry)` is `true` on the asset for the registry that holds the claim. Otherwise trust is registry-level; report that in evidence.

**ERC-8328 events** (`latestCurrentEvent`)
- Use `lastRecordedEventByType`, `isEventCurrent`, `currentEventIndex`. `subjectType` constants are namespaced (`ERC-8328:SUBJECT_TYPE:*`).

**Identity join key** — none of 8326, 8328 or 8330 mention ERC-8325 or `anchorId`; `subjectId` is opaque in all three. ERC-8328 says equal subject identifiers from independent logs MUST NOT be assumed to have equal meaning without explicit coordination. Joining on `anchorId`/`assetId` is Kula convention only. Report misaligned or unverifiable subjects; never assume (ADR-002).

## Layout

`packages/{core,canon,readers,solidity,indexer,explorer}` map to WS0–WS5 in `PLAN.md §1`. `specs/` is vendored spec text, `fixtures/` is test vectors with provenance, `docs/adr/` is decisions, `docs/spec-findings.md` is upstream feedback for WS6.
