import { toFunctionSelector, type Abi, type Hex } from "viem";
import { erc3643Abi } from "./erc3643.js";
import { erc7943FungibleAbi, erc7943MultiTokenAbi, erc7943NonFungibleAbi } from "./erc7943.js";
import { registryAnchorAbi, regulatedAssetClaimRegistryAbi } from "./erc8320.js";
import {
  assetAnchorRegistryAbi,
  assetAnchorRegistryLifecycleAbi,
  assetAnchorRegistryRecoveryAbi,
  assetBoundTokenAbi,
  assetBoundTokenIdAbi,
} from "./erc8325.js";
import { documentBundleAnchorAbi, documentBundleAnchorRecoveryAbi } from "./erc8326.js";
import { complianceEventLogAbi } from "./erc8328.js";
import { navSnapshotOracleAbi } from "./erc8330.js";

// ERC-165: XOR of the selectors of the interface's own functions (inherited members excluded).
export function interfaceId(abi: Abi): Hex {
  let id = 0;
  for (const item of abi) {
    if (item.type === "function") id ^= Number.parseInt(toFunctionSelector(item).slice(2), 16);
  }
  return `0x${(id >>> 0).toString(16).padStart(8, "0")}`;
}

export const INTERFACE_IDS = {
  IERC165: "0x01ffc9a7",
  IERC3643: interfaceId(erc3643Abi),
  IERC7943Fungible: interfaceId(erc7943FungibleAbi),
  IERC7943NonFungible: interfaceId(erc7943NonFungibleAbi),
  IERC7943MultiToken: interfaceId(erc7943MultiTokenAbi),
  IRegulatedAssetClaimRegistry: interfaceId(regulatedAssetClaimRegistryAbi),
  IRegistryAnchor: interfaceId(registryAnchorAbi),
  IAssetAnchorRegistry: interfaceId(assetAnchorRegistryAbi),
  IAssetAnchorRegistryLifecycle: interfaceId(assetAnchorRegistryLifecycleAbi),
  IAssetAnchorRegistryRecovery: interfaceId(assetAnchorRegistryRecoveryAbi),
  IAssetBoundToken: interfaceId(assetBoundTokenAbi),
  IAssetBoundTokenId: interfaceId(assetBoundTokenIdAbi),
  IDocumentBundleAnchor: interfaceId(documentBundleAnchorAbi),
  IDocumentBundleAnchorRecovery: interfaceId(documentBundleAnchorRecoveryAbi),
  IComplianceEventLog: interfaceId(complianceEventLogAbi),
  INAVSnapshotOracle: interfaceId(navSnapshotOracleAbi),
} as const satisfies Record<string, Hex>;

export type InterfaceName = keyof typeof INTERFACE_IDS;
