import { erc20Abi } from "viem";
import { SPEC_COMMIT, type CheckResult } from "@rwa-verify/core";
import { read } from "../call.js";
import { reproduceFor, type Check } from "./context.js";

const ID = "erc20.metadata";

// erc20.metadata — name/symbol/decimals/totalSupply for any token. pass when name and symbol both
// read (decimals / totalSupply are recorded when present); unsupported otherwise (name and symbol
// are optional in ERC-20, so a contract answering only one is not treated as one); unknown on RPC error. ERC-20 is not in core's `ERC` const, so the specRef is built here.
export const erc20Metadata: Check = async (ctx) => {
  const { client, token: address, blockNumber } = ctx;
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    read(client, { address, abi: erc20Abi, functionName: "name", blockNumber }),
    read(client, { address, abi: erc20Abi, functionName: "symbol", blockNumber }),
    read(client, { address, abi: erc20Abi, functionName: "decimals", blockNumber }),
    read(client, { address, abi: erc20Abi, functionName: "totalSupply", blockNumber }),
  ]);
  const reads = { name, symbol, decimals, totalSupply };
  const evidence: Record<string, unknown> = { blockNumber };
  for (const [k, r] of Object.entries(reads)) evidence[k] = r.ok ? r.value : undefined;
  const rpcError = Object.values(reads).find((r) => !r.ok && r.kind === "error");
  if (rpcError && !rpcError.ok) evidence.error = rpcError.message;
  const status = rpcError ? "unknown" : name.ok && symbol.ok ? "pass" : "unsupported";
  return { id: ID, status, evidence, reproduce: reproduceFor(ctx, ID), specRef: { erc: 20, commit: SPEC_COMMIT } } satisfies CheckResult;
};
