// Test-only fake chain: a viem PublicClient over a `custom` transport that answers
// eth_chainId, eth_blockNumber and eth_call by dispatching on the target address, then on the
// 4-byte selector, to hand-coded handlers. No live chain needed.
import {
  RpcRequestError,
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  toHex,
  type Abi,
  type Hex,
  type PublicClient,
} from "viem";

export type Handler = (data: Hex) => Hex; // throw to revert

export interface FakeChain {
  chainId: number;
  blockNumber: bigint;
  contracts: Record<string, Handler>; // lowercase address -> handler
}

// What viem's http transport throws for a node-side revert (code 3); not retried.
export function revert(reason = "execution reverted"): never {
  throw new RpcRequestError({ body: {}, error: { code: 3, message: reason, data: "0x" }, url: "fake" });
}

// A non-revert RPC failure (e.g. node unavailable), for `unknown` paths.
export function rpcError(message = "rpc failure"): never {
  throw new RpcRequestError({ body: {}, error: { code: -32000, message }, url: "fake" });
}

// Build a handler from an ABI and per-function implementations. Unimplemented or unknown
// selectors revert, like a contract without that function.
export function contract(abi: Abi, impl: Record<string, (...args: never[]) => unknown>): Handler {
  return (data) => {
    let functionName: string;
    let args: readonly unknown[];
    try {
      const decoded = decodeFunctionData({ abi, data });
      functionName = decoded.functionName;
      args = decoded.args ?? [];
    } catch {
      return revert("unknown selector");
    }
    const fn = impl[functionName];
    if (!fn) return revert(`${functionName} not implemented`);
    let result: unknown;
    try {
      result = fn(...(args as never[]));
    } catch (err) {
      // Any throw inside an implementation is a contract revert, as on a real node.
      if (err instanceof RpcRequestError) throw err;
      return revert(err instanceof Error ? err.message : String(err));
    }
    return encodeFunctionResult({ abi, functionName, result } as never);
  };
}

// A contract that answers every call with the same bytes (e.g. garbage for non-ERC-165 probes).
export function constantReturn(bytes: Hex): Handler {
  return () => bytes;
}

export function fakeClient(chain: FakeChain): PublicClient {
  const contracts = Object.fromEntries(Object.entries(chain.contracts).map(([a, h]) => [a.toLowerCase(), h]));
  return createPublicClient({
    transport: custom({
      async request({ method, params }: { method: string; params?: unknown }) {
        switch (method) {
          case "eth_chainId":
            return toHex(chain.chainId);
          case "eth_blockNumber":
            return toHex(chain.blockNumber);
          case "eth_call": {
            const [{ to, data }] = params as [{ to: Hex; data: Hex }];
            const handler = contracts[to.toLowerCase()];
            return handler ? handler(data) : "0x"; // no code at address
          }
          default:
            throw { code: -32601, message: `unsupported method ${method}` };
        }
      },
    }),
  });
}
