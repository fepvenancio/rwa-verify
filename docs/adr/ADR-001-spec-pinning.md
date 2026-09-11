# ADR-001: Spec pinning

**Status:** Accepted — 2026-09-11

## Context

ERC-8325 through 8330 are in Review (moved 2026-07-21); ERC-8320 is in Draft. All may change while we implement against them.

## Decision

All 83xx / 8320 behaviour targets a single pinned `ethereum/ERCs` commit. The ERC markdown is vendored verbatim into `specs/` and the SHA is recorded in `specs/PINNED.md` and `packages/core/src/spec.ts`.

Current pin: `84b46e7d69d08dbd8876503e435fd299211c26b8` (2026-09-11).

Bumping the pin is an explicit PR that:

1. Runs `scripts/pin-specs.sh <sha>`.
2. Updates `specs/PINNED.md` and `SPEC_COMMIT` in `packages/core`.
3. Lists every behavioural diff in the PR description and, where relevant, in `docs/spec-findings.md`.
4. Supersedes this ADR's "Current pin" line.

Every `CheckResult.specRef` carries the pinned commit so reports are reproducible against a known text.

## Consequences

- Reports never silently change meaning when upstream edits a spec.
- WS6 owns tracking upstream threads and proposing bumps.
