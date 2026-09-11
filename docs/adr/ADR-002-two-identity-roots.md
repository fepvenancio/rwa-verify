# ADR-002: Two identity roots

**Status:** Accepted — 2026-09-11

## Context

Two competing standards describe how a token is bound to an off-chain asset identity:

- ERC-8320 (Brickken): `IRegulatedAssetClaimRegistry` keyed by `assetId = getAssetId(contract, subAssetId, chainId)`, with `IRegistryAnchor.isRegistryApproved` on the token.
- ERC-8325 (Kula): `IAssetAnchorRegistry` keyed by `anchorId`, with `IAssetBoundToken.anchorRegistry()` / `anchorId()` on the token.

## Decision

Support both behind the `AssetIdentity` adapter in `packages/core`. Take no position on which wins.

- `subjectId()` returns the standard's join key (`assetId` or `anchorId`).
- Selection logic (WS2): prefer whichever standard the token declares via ERC-165. If both are declared, run both adapters and include both in `VerificationReport.identity`.
- `subjectId` is the join key across 8326 / 8328 / 8330 by Kula convention, not by spec guarantee. Readers report a `fail` check with evidence when subjects don't align rather than assuming.

## Consequences

- Adding a third identity standard is a new adapter, not a core change.
- The report is honest about ambiguity rather than resolving it.
