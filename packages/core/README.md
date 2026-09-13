# @rwa-verify/core

Shared types for the rwa-verify toolkit: `CheckResult`, `CheckStatus`, `VerificationReport`, the `AssetIdentity` adapter interface, and `SPEC_COMMIT` / `specRef()` pinning every check to a fixed `ethereum/ERCs` commit.

Status semantics: `pass` | `fail` | `unsupported` (token does not declare the standard) | `stale` (ERC-8330 staleness flag set) | `unknown` (cannot be determined, e.g. thresholds unconfigured).

Repository and docs: https://github.com/fepvenancio/rwa-verify
