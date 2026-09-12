import {
  CallExecutionError,
  ExecutionRevertedError,
  decodeFunctionResult,
  encodeFunctionData,
  type Abi,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type ContractFunctionReturnType,
  type PublicClient,
} from "viem";
import type { Hex } from "@rwa-verify/core";

// A read either succeeds, or the target did not answer as a contract implementing the
// function would ("revert": reverted, returned no data, or returned undecodable data), or the
// RPC itself failed ("error"). Checks map "revert" to spec semantics and "error" to `unknown`.
export type ReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: "revert" | "error"; message: string };

export interface ReadParams<abi extends Abi, fn extends ContractFunctionName<abi, "pure" | "view">> {
  address: Hex;
  abi: abi;
  functionName: fn;
  args?: ContractFunctionArgs<abi, "pure" | "view", fn>;
  blockNumber: bigint;
}

export async function read<const abi extends Abi, fn extends ContractFunctionName<abi, "pure" | "view">>(
  client: PublicClient,
  params: ReadParams<abi, fn>,
): Promise<ReadResult<ContractFunctionReturnType<abi, "pure" | "view", fn>>> {
  const { address, abi, functionName, args, blockNumber } = params;
  const data = encodeFunctionData({ abi, functionName, args } as never);
  let raw: Hex | undefined;
  try {
    raw = (await client.call({ to: address, data, blockNumber })).data;
  } catch (err) {
    const revert = err instanceof CallExecutionError && err.cause instanceof ExecutionRevertedError;
    return { ok: false, kind: revert ? "revert" : "error", message: shortMessage(err) };
  }
  if (raw === undefined || raw === "0x") return { ok: false, kind: "revert", message: "no return data" };
  try {
    const value = decodeFunctionResult({ abi, functionName, data: raw } as never);
    return { ok: true, value: value as ContractFunctionReturnType<abi, "pure" | "view", fn> };
  } catch (err) {
    return { ok: false, kind: "revert", message: `undecodable return data: ${shortMessage(err)}` };
  }
}

function shortMessage(err: unknown): string {
  if (err && typeof err === "object" && "shortMessage" in err && typeof err.shortMessage === "string") {
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}
