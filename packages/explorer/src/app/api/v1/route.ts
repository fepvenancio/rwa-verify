import { SPEC_COMMIT } from "@rwa-verify/core";
import { CHECKS, HINT_FLAGS } from "@rwa-verify/sdk";

// GET /api/v1 -> endpoint listing (OpenAPI-lite)
export function GET(): Response {
  const hints = Object.fromEntries(Object.keys(HINT_FLAGS).map((k) => [k, "optional; see packages/sdk/CHECKS.md"]));
  const common = {
    chain: "required; numeric chain id",
    token: "required; token address",
    tokenId: "optional; non-negative integer",
    rpc: "optional; http(s) JSON-RPC URL, default RPC_URL_<chain> on the server",
    ...hints,
  };
  return Response.json({
    version: "v1",
    specCommit: SPEC_COMMIT,
    endpoints: [
      { method: "GET", path: "/api/v1/verify", returns: "VerificationReport", query: common },
      { method: "GET", path: "/api/v1/check/{id}", returns: "CheckResult", query: common, ids: Object.keys(CHECKS) },
    ],
    notes: {
      bigint: "serialised as decimal strings",
      status: "200 also for fail/stale checks; 400 usage error or chain-id mismatch; 502 RPC unreachable",
      unsupported: "the token does not declare that standard; not a failure (ADR-004)",
    },
  });
}
