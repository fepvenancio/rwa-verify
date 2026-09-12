import { describe, expect, it } from "vitest";
import { erc165Abi } from "./abi/erc165.js";
import { INTERFACE_IDS } from "./abi/interfaceIds.js";
import { detect } from "./detect.js";
import { constantReturn, contract, fakeClient } from "./testing/fakeChain.js";

const TOKEN = "0x1000000000000000000000000000000000000001";
const BLOCK = 42n;

function erc165(supported: string[]) {
  const ids = new Set(supported.map((s) => s.toLowerCase()));
  return contract(erc165Abi, { supportsInterface: (id: string) => ids.has(id.toLowerCase()) });
}

describe("detect", () => {
  it("reports declared interfaces for an ERC-165 contract", async () => {
    const client = fakeClient({
      chainId: 1,
      blockNumber: BLOCK,
      contracts: { [TOKEN]: erc165([INTERFACE_IDS.IERC165, INTERFACE_IDS.IAssetBoundToken]) },
    });
    const d = await detect(client, TOKEN, BLOCK);
    expect(d.erc165).toBe(true);
    expect(d.supports.IAssetBoundToken).toBe(true);
    expect(d.supports.IAssetBoundTokenId).toBe(false);
    expect(d.supports.INAVSnapshotOracle).toBe(false);
    expect(d.answers["0xffffffff"]).toBe(false);
  });

  it("a target that reverts on supportsInterface is non-ERC-165: everything false", async () => {
    const client = fakeClient({ chainId: 1, blockNumber: BLOCK, contracts: { [TOKEN]: contract(erc165Abi, {}) } });
    const d = await detect(client, TOKEN, BLOCK);
    expect(d.erc165).toBe(false);
    expect(Object.values(d.supports).every((v) => v === false)).toBe(true);
    expect(d.answers[INTERFACE_IDS.IERC165]).toBe("revert");
  });

  it("an address without code is non-ERC-165", async () => {
    const client = fakeClient({ chainId: 1, blockNumber: BLOCK, contracts: {} });
    expect((await detect(client, TOKEN, BLOCK)).erc165).toBe(false);
  });

  it("garbage return data is not `true`", async () => {
    const client = fakeClient({ chainId: 1, blockNumber: BLOCK, contracts: { [TOKEN]: constantReturn("0x1234") } });
    expect((await detect(client, TOKEN, BLOCK)).erc165).toBe(false);
  });

  it("a contract answering true to everything (including 0xffffffff) fails ERC-165 detection", async () => {
    const client = fakeClient({
      chainId: 1,
      blockNumber: BLOCK,
      contracts: { [TOKEN]: contract(erc165Abi, { supportsInterface: () => true }) },
    });
    const d = await detect(client, TOKEN, BLOCK);
    expect(d.erc165).toBe(false);
    expect(d.supports.IAssetBoundToken).toBe(false);
  });
});
