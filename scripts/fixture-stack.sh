#!/usr/bin/env bash
# Starts Anvil and deploys the conforming fixture stack (packages/solidity/script/FixtureStack.s.sol).
#   scripts/fixture-stack.sh                 # leaves anvil running, prints the JSON path and anvil's PID
#   scripts/fixture-stack.sh --run <cmd...>  # runs <cmd> against the stack, then stops anvil
# ANVIL_PORT overrides the port (default 8545). Broadcasts from Anvil's default first account.
set -euo pipefail

PORT="${ANVIL_PORT:-8545}"
RPC="http://127.0.0.1:$PORT"
SOL="$(cd "$(dirname "$0")/../packages/solidity" && pwd)"
KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

anvil --port "$PORT" --silent >/dev/null 2>&1 &
ANVIL_PID=$!
trap 'kill "$ANVIL_PID"' EXIT
until cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; do sleep 0.2; done

(cd "$SOL" && FOUNDRY_PROFILE=fixture forge script script/FixtureStack.s.sol --rpc-url "$RPC" --broadcast --private-key "$KEY" >/dev/null)
echo "$SOL/out/fixture-stack.json"

if [[ "${1:-}" == "--run" ]]; then
  shift
  "$@"
else
  trap - EXIT
  echo "anvil running on $RPC (pid $ANVIL_PID)"
fi
