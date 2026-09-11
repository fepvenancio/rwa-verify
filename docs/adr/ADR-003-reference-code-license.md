# ADR-003: Reference-code license

**Status:** Accepted — 2026-09-11

## Context

Differential tests against a reference implementation are mandatory for hashing and lifecycle logic (see CLAUDE.md). Kula's reference implementation for ERC-8325 / 8326 / 8328 / 8330 shows no license on GitHub as of 2026-09-11. The audited commit is `caa9b05`.

ERC text in `ethereum/ERCs` is CC0.

Verified on 2026-09-11 at the pinned commit: `ethereum/ERCs/assets/` contains a Foundry reference implementation for **ERC-8320 only** (`assets/erc-8320/contracts`, `assets/erc-8320/test`). ERC-8325 through 8330 have no `assets/` directory upstream.

## Decision

- Kula contracts are used **only as black-box test targets**: deployed to a local Anvil profile and called over RPC from differential tests. They are not vendored, copied, or imported in any package.
- The Kula repository is consumed as a git submodule pinned to `caa9b05` at `fixtures/kula/`. A submodule is a pointer, not a copy, so nothing from it is redistributed, and differential tests stay reproducible offline. Nothing from it ends up in a published artefact.
- ERC-8320's upstream reference implementation lives in `ethereum/ERCs` under CC0 and may be vendored for differential tests.
- If Kula publishes a license permitting redistribution, this ADR is superseded and vendoring becomes allowed.

Repository URL: `<KULA_REPO_URL>` — fill in before Phase 1 (not discoverable via GitHub search on 2026-09-11).

## Consequences

- Phase 0 must set up the Anvil profile before WS1 / WS3 can run differential tests.
- Published npm and Foundry packages contain only our own code plus CC0 spec-derived interfaces.
