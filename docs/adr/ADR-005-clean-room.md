# ADR-005: Clean room

**Status:** Accepted — 2026-09-11

## Decision

No code, documentation, fixtures, or test vectors from employer projects enter this repository. Separate repo, separate accounts, own time.

- Fixtures come from public sources only: vendored CC0 spec text, Kula's public test vectors (see ADR-003), and vectors we generate ourselves from the spec.
- Contributors and agents must not reference, copy, or adapt material from private repositories on the same machine.

## Consequences

- If a needed fixture only exists in a private source, regenerate it from the spec text and document the derivation.
