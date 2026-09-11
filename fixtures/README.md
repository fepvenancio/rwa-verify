# Fixtures

Test vectors used by differential and property tests.

| Path | Source | Commit | License |
|---|---|---|---|
| `erc8326/` | Kula test vectors (canonicalisation examples) | `caa9b05` | Unlicensed — used as black-box targets only (ADR-003) |
| `erc8330/` | Kula test vectors (aggregation cases) | `caa9b05` | Unlicensed — as above |
| `erc8320/` | `ethereum/ERCs/assets/erc-8320` | `84b46e7d` | CC0 |
| `own/` | Generated from spec text by this repo | — | MIT |

Kula repository URL: `<KULA_REPO_URL>` (fill in with ADR-003).

Every fixture directory must contain a `SOURCE.md` naming the origin, commit and license before it is used in a test.
