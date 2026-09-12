import { describe, expect, it } from "vitest";
import { parseAbi } from "viem";
import { erc165Abi } from "./erc165.js";
import { INTERFACE_IDS, interfaceId } from "./interfaceIds.js";

describe("interfaceId", () => {
  it("ERC-165 itself is 0x01ffc9a7", () => {
    expect(interfaceId(erc165Abi)).toBe("0x01ffc9a7");
  });

  it("ignores events and XORs only functions", () => {
    const abi = parseAbi(["event E()", "function a() view returns (uint256)", "function b()"]);
    const a = interfaceId(parseAbi(["function a() view returns (uint256)"]));
    const b = interfaceId(parseAbi(["function b()"]));
    const expected = (Number.parseInt(a.slice(2), 16) ^ Number.parseInt(b.slice(2), 16)) >>> 0;
    expect(interfaceId(abi)).toBe(`0x${expected.toString(16).padStart(8, "0")}`);
  });

  // ERC-7943 "Additional Specifications" is the only pinned text that states IDs literally.
  it("matches the interface IDs stated in ERC-7943", () => {
    expect(INTERFACE_IDS.IERC7943Fungible).toBe("0x3edbb4c4");
    expect(INTERFACE_IDS.IERC7943NonFungible).toBe("0xbf1ef5fe");
    expect(INTERFACE_IDS.IERC7943MultiToken).toBe("0x41c4fbad");
  });

  // Cross-checked 2026-09-11 against solc `type(I).interfaceId` for interfaces transcribed
  // from the pinned spec text (forge 1.8.1). Regression guard for ABI transcription drift.
  it("matches solc type(I).interfaceId for the 83xx / 8320 / 3643 interfaces", () => {
    expect(INTERFACE_IDS).toMatchObject({
      IERC3643: "0xb97d944c",
      IRegulatedAssetClaimRegistry: "0x1edffb24",
      IRegistryAnchor: "0x1cb5db36",
      IAssetAnchorRegistry: "0x52a94b86",
      IAssetAnchorRegistryLifecycle: "0x6d8a9795",
      IAssetAnchorRegistryRecovery: "0xe2cb93dc",
      IAssetBoundToken: "0x6e4d3d14",
      IAssetBoundTokenId: "0x4a967b01",
      IDocumentBundleAnchor: "0xb553fb02",
      IDocumentBundleAnchorRecovery: "0x0df58749",
      IComplianceEventLog: "0x67640da1",
      INAVSnapshotOracle: "0x6dd5275b",
    });
  });

  it("all IDs are distinct 4-byte values", () => {
    const ids = Object.values(INTERFACE_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^0x[0-9a-f]{8}$/);
  });
});
