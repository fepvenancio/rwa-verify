#!/usr/bin/env bash
# Re-vendor spec texts at a given ethereum/ERCs SHA. Update specs/PINNED.md and packages/core/src/spec.ts afterwards.
set -euo pipefail
SHA="${1:?usage: pin-specs.sh <ethereum/ERCs sha>}"
cd "$(dirname "$0")/../specs"
for n in 3643 4626 7943 8320 8325 8326 8327 8328 8329 8330; do
  curl -sfL "https://raw.githubusercontent.com/ethereum/ERCs/$SHA/ERCS/erc-$n.md" -o "erc-$n.md"
  echo "erc-$n: $(grep -m1 '^status:' erc-$n.md)"
done
echo "Pinned $SHA. Now update specs/PINNED.md and packages/core/src/spec.ts."
