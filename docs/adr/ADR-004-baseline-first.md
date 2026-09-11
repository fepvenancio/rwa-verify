# ADR-004: Baseline-first

**Status:** Accepted — 2026-09-11

## Context

83xx adoption may be zero for a long time. A verifier that only works on 83xx tokens has no users.

## Decision

The SDK, Solidity library and explorer must be useful on ERC-3643 / ERC-7943 / ERC-4626 alone.

- `VerificationReport.baseline` is always populated.
- Every 83xx / 8320 check reports `status: "unsupported"` with ERC-165 evidence when the token does not implement the interface. `unsupported` never blocks report generation and is distinct from `fail`.
- `CollateralGate` and any protocol-facing helper must document behaviour when a check is `unsupported` and must not treat it as `pass`.

## Consequences

- The explorer is valuable on day one for the existing RWA token population.
- Check implementers write the detection path first.
