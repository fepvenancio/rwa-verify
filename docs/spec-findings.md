# Spec findings

Implementation findings to feed back into the Magicians threads (WS6). One entry per finding. When the reference implementation and the spec text disagree, we implement the spec and log it here.

Threads:

- ERC-8320: https://ethereum-magicians.org/t/erc-8320-regulated-asset-claim/28919
- ERC-8325: https://ethereum-magicians.org/t/erc-8325-asset-anchor-registry/28934
- ERC-8326: https://ethereum-magicians.org/t/erc-8326-canonical-document-bundle-anchor/28935
- ERC-8328: https://ethereum-magicians.org/t/erc-8328-subject-linked-compliance-event-log/28937
- ERC-8330: https://ethereum-magicians.org/t/erc-8330-subject-linked-nav-snapshot-oracle/28939

## Findings

| Date | ERC | Finding | Status |
|---|---|---|---|
| 2026-09-11 | 8325–8330 | No reference implementation under `ethereum/ERCs/assets/` at the pinned commit; ERC-8320 ships one. Differential tests for 8325–8330 depend on Kula's separate repo (ADR-003). | Noted |
| 2026-09-12 | 8330 | `latestNAVStatus` MUST revert both when a threshold is unconfigured and when no current snapshot exists, with no distinguishing error defined. A consumer cannot tell the two apart from the revert; readers call `heartbeat()`/`maxValuationAge()` first (unconfigured → `unknown`) and only then treat a revert as "no current snapshot" (`fail`). Suggest distinct custom errors. | Open |
| 2026-09-12 | 8325 | "Complete Binding Verification" condition 1 says `getAnchor` must return "the expected token, scope, and token ID" but does not define where the expected scope comes from when a token declares both `IAssetBoundToken` and `IAssetBoundTokenId`. Readers take the strictest reading: TOKEN_ID scope with the supplied `tokenId` when `IAssetBoundTokenId` is declared and a `tokenId` is given, otherwise CONTRACT scope with `boundTokenId == 0`. | Open |
| 2026-09-12 | 8326, 8328, 8330 | None of the three defines how a consumer discovers the anchor / log / oracle contract for a token (no token-side getter, no registry). `subjectId` is opaque. Readers require the address out of band (`--document-anchor`, `--event-log`, `--nav-oracle`) and otherwise report `unsupported`; the same applies to the stream keys `role` and `currency`, which are never guessed. | Open |
| 2026-09-12 | 8320 | Prose says `assetId = keccak256(chainId, contract, subAssetId)` while `getAssetId(contractAddr, subAssetId, chainId)` lists the arguments in another order and the encoding (`abi.encode` vs `abi.encodePacked`) is unstated. Readers never compute `assetId` locally; they always call `getAssetId` on the registry. Two registries could disagree if they encode differently. | Open |
