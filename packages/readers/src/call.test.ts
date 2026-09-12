import { describe, expect, it } from "vitest";
import { erc4626Abi } from "./abi/erc4626.js";
import { read } from "./call.js";
import { constantReturn, contract, fakeClient, rpcError } from "./testing/fakeChain.js";

const A = "0x2000000000000000000000000000000000000002";
const base = { address: A, abi: erc4626Abi, functionName: "totalAssets", blockNumber: 1n } as const;

describe("read", () => {
  it("decodes a successful call", async () => {
    const client = fakeClient({ chainId: 1, blockNumber: 1n, contracts: { [A]: contract(erc4626Abi, { totalAssets: () => 5n }) } });
    expect(await read(client, base)).toEqual({ ok: true, value: 5n });
  });

  it("classifies a revert", async () => {
    const client = fakeClient({ chainId: 1, blockNumber: 1n, contracts: { [A]: contract(erc4626Abi, {}) } });
    expect(await read(client, base)).toMatchObject({ ok: false, kind: "revert" });
  });

  it("classifies empty and undecodable return data as revert", async () => {
    const empty = fakeClient({ chainId: 1, blockNumber: 1n, contracts: {} });
    expect(await read(empty, base)).toMatchObject({ ok: false, kind: "revert", message: "no return data" });
    const garbage = fakeClient({ chainId: 1, blockNumber: 1n, contracts: { [A]: constantReturn("0x12") } });
    expect(await read(garbage, base)).toMatchObject({ ok: false, kind: "revert" });
  });

  it("classifies a non-revert RPC failure as error", async () => {
    const client = fakeClient({ chainId: 1, blockNumber: 1n, contracts: { [A]: () => rpcError("node down") } });
    expect(await read(client, base)).toMatchObject({ ok: false, kind: "error" });
  });
});
