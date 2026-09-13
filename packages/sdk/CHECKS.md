# Check ids emitted by `@rwa-verify/sdk`

Every check returns a `CheckResult` (`packages/core`) with `evidence.blockNumber` (all reads in a
check are pinned to one block) and a `reproduce` string of the form
`rwa-verify check <id> --chain <chainId> --token <address> [--token-id <n>] [hints] [--rpc <url>]`.
Hints a check used are echoed into its reproduce string (see `HINT_FLAGS` in `src/checks/context.ts`).

Status semantics shared by all checks (ADR-004):

- `unsupported` — the token does not declare / expose what the check needs, or (for 8326/8328/8330)
  no contract address was supplied. Never a failure, never a pass.
- `unknown` — could not determine: RPC failure, missing stream key (`--subject`, `--currency`, `--role`),
  unconfigured thresholds, no events.
- `fail` / `stale` / `pass` — spec semantics, see per-check rows.
- A revert from a contract that *declares* the interface is `fail` (non-conformance); a non-revert RPC
  error is `unknown`.

## Baseline (`VerificationReport.baseline`, always populated)

| id | ERC | pass | fail | unsupported | notes |
|---|---|---|---|---|---|
| `erc20.metadata` | 20 | `name()` and `symbol()` both return | — | `name()` or `symbol()` reverts | evidence `{ name, symbol, decimals, totalSupply }`; `decimals`/`totalSupply` recorded when present. Both getters are optional in ERC-20, so a contract answering only one is not treated as an ERC-20. RPC error → `unknown`. ERC-20 is not in core's `ERC` const; `specRef.erc` is the literal `20` |
| `erc165.detect` | 165 | token answers ERC-165 (true for `0x01ffc9a7`, false for `0xffffffff`) | — | not ERC-165 | evidence lists every known interface ID and the token's answer |
| `erc3643.paused` | 3643 | `paused() == false` | `paused() == true` | `paused()` reverts | ERC-3643 has no ERC-165 ID in the spec; probed by call. `declaresIERC3643` in evidence is the computed-ID answer |
| `erc3643.identityRegistry` | 3643 | non-zero address | zero address | reverts | |
| `erc3643.compliance` | 3643 | non-zero address | zero address | reverts | |
| `erc3643.onchainID` | 3643 | non-zero address | zero address | reverts | the token's own ONCHAINID |
| `erc3643.version` | 3643 | non-empty string | empty string | no `version()` (older T-REX) | evidence has the string |
| `erc3643.registryWiring` | 3643 | `identityStorage()`, `issuersRegistry()`, `topicsRegistry()` of the identity registry all non-zero | any zero | any of the three reverts (T-REX 1.x has no `identityStorage()`) | evidence has the three addresses, or `function` naming the getter that reverted |
| `erc3643.claimTopics` | 3643 | `topicsRegistry().getClaimTopics()` non-empty | empty: no claim is required to hold the token | reverts | topics as decimal strings |
| `erc3643.trustedIssuers` | 3643 | `issuersRegistry().getTrustedIssuers()` non-empty | empty: nobody can attest the claim topics | `getTrustedIssuers()` or any `getTrustedIssuerClaimTopics(issuer)` reverts (T-REX 1.x indexes issuers by `uint`, see `docs/spec-findings.md`) | evidence lists each issuer with its claim topics |
| `erc3643.complianceBound` | 3643 | `compliance().isTokenBound(token)`; when that reverts, `getTokenBound() == token` | `false`, or another token | both revert | evidence has whichever was read; `isTokenBoundError` on the fallback path |
| `erc3643.holder` | 3643 | `--holder` is `isVerified` in the identity registry and not `isFrozen` on the token | not verified, or frozen | a read reverts (T-REX 1.x lacks `isFrozen`/`getFrozenTokens`; `function` names it) | `unknown` with `reason: "pass --holder <address>"` when no `--holder` (the token supports it; the input is missing). Evidence: `isVerified`, `contains`, `investorCountry`, `isFrozen`, `getFrozenTokens`, `balanceOf` |
| `erc7943.canTransfer` | 7943 | call returns (any boolean) | call reverts (spec: MUST NOT revert) | none of the three 7943 IDs declared | probe `0x…dEaD`→`0x…dEaD`, amount 0, `tokenId` for NFT/multi variants; `allowed` is a recorded fact |
| `erc7943.frozenBalance` | 7943 | `getFrozenTokens(probe[, tokenId])` returns | reverts | not 7943 | uint256, or bool for the NFT variant |
| `erc4626.asset` | 4626 | non-zero address | zero address | `asset()` reverts | no ERC-165 ID exists for 4626 |
| `erc4626.totalAssets` | 4626 | returns | — | reverts | recorded fact |

The seven deeper ERC-3643 checks (`onchainID` … `holder`) probe `identityRegistry()` first: a token that does not
answer it is not ERC-3643 and every one of them is `unsupported`. A revert further down (a registry or token lacking
the function, as in older T-REX releases) is also `unsupported`, never `fail`; only an RPC error is `unknown`.

## Identity (`VerificationReport.identity`)

| id | ERC | pass | fail | unsupported | unknown |
|---|---|---|---|---|---|
| `erc8325.mutualBinding` | 8325 | all applicable conditions of "Complete Binding Verification" hold: (1) `getAnchor` matches token/scope/tokenId, (2) `isBound`, (3) `isActive`, (4) `isBindingValid` **only if** the registry declares `IAssetAnchorRegistryRecovery`, (5) token declares `IAssetBoundToken`/`IAssetBoundTokenId`, (6) token reports the same registry and anchor | any applicable condition false; registry not an `IAssetAnchorRegistry`; registry reverts (unknown anchor); registry-side-only binding (with `--anchor-registry` + `--anchor-id`) | token declares no token-side interface and no hints | token declares `IAssetBoundTokenId` but no `--token-id` |
| `erc8320.activeClaim` | 8320 | `getActiveClaims(getAssetId(token, tokenId ?? 0, chainId), claimType)` non-empty, and — when the asset declares `IRegistryAnchor` — `isRegistryApproved(registry)` | no active claim; asset declares `IRegistryAnchor` but approves no registry / not this registry | asset declares nothing and no `--claim-registry`; hinted contract is not an `IRegulatedAssetClaimRegistry` | RPC error |
| `identity.subjectMismatch` | 8325 | — (only emitted when it fails) | the 8325 and 8320 adapters return different `subjectId`s; both are in evidence and 8326/8328/8330 run once per subject (ADR-002) | — | — |

Registry selection for 8320: `--claim-registry`, else the first registry the asset approves among
`IRegistryAnchor.getRegistries()`. `--claim-type` defaults to `0` (IDENTITY). Trust level is in
evidence: `asset-approved` or `registry-level`.

## Documents / valuation / compliance (run per subject)

These standards have no token-side discovery; the contract address must be supplied. Without it the
check is `unsupported` (baseline-only report). The join key is the identity adapter's `subjectId`
(ERC-8325 `anchorId` or ERC-8320 `assetId`) or an explicit `--subject`; this is Kula convention,
not a spec guarantee (ADR-002).

| id | ERC | pass | stale | fail | unknown |
|---|---|---|---|---|---|
| `erc8326.activeBundle` | 8326 | `activeBundle(subject, role)` non-zero and `getAnchor` record matches the triple, `anchoredAt > 0`, `documentCount > 0`, not superseded (Consumer Verification 1–5; step 6, reproducing the hash, is `@rwa-verify/canon`) | — | zero active bundle; record mismatch; zero count; superseded | no `--subject` or `--role` |
| `erc8330.navFresh` | 8330 | `latestNAVStatus` returns with both flags false | `isPublishStale` or `isValuationStale` | `heartbeat` and `maxValuationAge` configured but `latestNAVStatus` reverts (no current snapshot) | `heartbeat()` or `maxValuationAge()` is 0 (zeros in evidence); no `--subject` or `--currency` |
| `erc8328.latestCurrentEvent` | 8328 | last recorded event (or `lastRecordedEventByType` with `--event-type`) resolved through `currentEventIndex`; event fields in evidence, `corrected` flag | — | log reverts on count/index/getEvent | `eventCount == 0`; no event of `--event-type`; no `--subject` |

For all three, `unsupported` also covers a supplied contract that does not declare the interface via ERC-165.
