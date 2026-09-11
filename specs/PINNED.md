# Pinned spec commit

All ERC texts in this directory are vendored verbatim from `ethereum/ERCs` at:

    SHA: 84b46e7d69d08dbd8876503e435fd299211c26b8
    Pinned: 2026-09-11

| ERC | Title | Status at pin |
|---|---|---|
| 3643 | T-REX - Token for Regulated EXchanges | Final |
| 4626 | Tokenized Vaults | Final |
| 7943 | uRWA - Universal Real World Asset Interface | Final |
| 8320 | Regulated Asset Claim | Draft |
| 8325 | Asset Anchor Registry | Review |
| 8326 | Canonical Document Bundle Anchor | Review |
| 8327 | Directional Transfer Domain Registry | Review (out of scope) |
| 8328 | Subject-Linked Compliance Event Log | Review |
| 8329 | Subject-Linked Impact Snapshot Log | Review (out of scope) |
| 8330 | Subject-Linked NAV Snapshot Oracle | Review |

ERC text is CC0. Bumping the SHA requires an ADR PR (see ADR-001).
Re-fetch with:

    ./scripts/pin-specs.sh <sha>
