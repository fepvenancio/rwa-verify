# @rwa-verify/solidity (WS3)

`RwaVerify` view library, `BundleHashLib` (ERC-8326 bundle hash) and the `CollateralGate` example. Pure/view only, OpenZeppelin v5 only, no Solady, no storage, no upgradeability. Interfaces in `src/interfaces/` are transcribed from the pinned spec text (`ethereum/ERCs` @ `84b46e7d`, see `specs/PINNED.md`).

```bash
forge build --sizes
forge test -vvv          # default profile; skips test/diff
forge snapshot           # refresh .gas-snapshot
forge test --profile diff   # FFI differential: BundleHashLib vs packages/canon CLI (needs pnpm + tsx)
```

`test/Erc8320Reference.t.sol` deploys the vendored CC0 ERC-8320 reference (`fixtures/erc8320`) and runs `hasActiveClaim` through the real signed lifecycle. That reference requires solc `^0.8.35`, which is why `foundry.toml` pins `0.8.35`.

## RwaVerify

Every function returns a struct whose first field is a `Status` mirroring `CheckStatus` in `packages/core`. Nothing here reverts because of the target: every read is a raw `staticcall` with length- and range-checked return data.

| Status | Meaning |
|---|---|
| `Pass` | Every applicable spec condition holds. The only positive answer. |
| `Fail` | A condition does not hold, the target reverted, or its return data was malformed. |
| `Unsupported` | The target does not advertise the interface via ERC-165. Nothing else was read. Never treat as `Pass` (ADR-004). |
| `Stale` | `navFresh` only: a current snapshot exists but `isPublishStale` or `isValuationStale` is set. Values are still returned. |
| `Unknown` | `navFresh` only: `heartbeat` or `maxValuationAge` is unconfigured (zero), so staleness cannot be evaluated. The zero values are in the result. |

| Function | Reads | Returns |
|---|---|---|
| `bindingValid(token, tokenId, useTokenId, registry, anchorId)` | ERC-8325 "Complete Binding Verification", all six conditions. Condition 4 (`isBindingValid`) only when the registry advertises `IAssetAnchorRegistryRecovery`; conditions 5/6 through `IAssetBoundToken` or `IAssetBoundTokenId` as selected by `useTokenId`. | `Binding`: status, three ERC-165 flags, the registry record tuple, `isBound` / `isActive` / `isBindingValid`, and the token's declared registry and anchor. A registry-side binding to a token without the token-side interface is `Fail` with both sides in evidence. A registry missing either mandatory registry interface is `Unsupported`. |
| `navFresh(oracle, subjectId, currency)` | `heartbeat` and `maxValuationAge` first, then `latestNAVStatus`. | `Nav`: status, both thresholds, the snapshot fields and both staleness flags. Unconfigured threshold: `Unknown`. `latestNAVStatus` revert with thresholds set (no current snapshot): `Fail`. Either flag: `Stale`. |
| `hasActiveClaim(registry, asset, assetId, claimType)` | `getActiveClaims(assetId, claimType)` (only the array length is decoded); if `asset` advertises `IRegistryAnchor`, also `asset.isRegistryApproved(registry)`. | `Claim`: status, `anchorChecked` (asset-side approval was required), `registryApproved`, `activeClaimCount`. `anchorChecked == false` means trust is registry-level only. |
| `latestCurrentEvent(log, subjectId, eventType)` | `lastRecordedEventByType`, `currentEventIndex`, `isEventCurrent`, `getEvent` on the terminal index. | `Event`: status, `lastIndex`, `currentIndex`, `isCurrent`, and the terminal event's static fields (`eventType`, `outcome`, `actor`, `authority`, `evidenceHash`, `occurredAt`, `recordedAt`, `correctsIndex`). The terminal event of a corrected chain is an `EVT_CORRECTION` event. Dynamic fields are not decoded; call `getEvent(subjectId, currentIndex)` for them. No event of that type: `Fail`. |

Gas griefing by a target (burning forwarded gas, huge return data) is not defended in the library; wrap calls with an explicit gas limit if that matters.

## BundleHashLib

ERC-8326 derivation from the spec text, used as the differential target for the TypeScript canonicaliser.

- `computeBundleHash(entries)`: requires canonical order (`role`, `filenameHash`, `contentHash`, `mimeTypeHash`, `normProfileId`, ascending on raw `bytes32`); reverts `UnsortedEntries(i)` otherwise and `EmptyBundle()` on empty input.
- `computeCanonicalBundleHash(entries)`: sorts `entries` in place (insertion sort), then hashes.
- `leaf = keccak256(abi.encodePacked(contentHash, role, mimeTypeHash, filenameHash, normProfileId))`, `bundleHash = keccak256(abi.encodePacked(SCHEMA_V1, leaves...))`. Duplicates are retained.

## Gas (happy path against mocks, `test/RwaVerify.gas.t.sol`)

| Function | Gas |
|---|---|
| `bindingValid` | ~99k |
| `navFresh` | ~43k |
| `hasActiveClaim` | ~39k |
| `latestCurrentEvent` | ~80k |

Most of it is ERC-165 probing (`ERC165Checker` issues two probes per target plus one per interface id) and cold external calls.
