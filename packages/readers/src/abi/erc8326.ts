import { parseAbi } from "viem";

// ERC-8326 Canonical Document Bundle Anchor — transcribed from specs/erc-8326.md.

export const documentBundleAnchorAbi = parseAbi([
  "struct AnchorRecord { bytes32 bundleHash; bytes32 subjectId; bytes32 role; address anchoredBy; uint64 anchoredAt; uint256 documentCount; string metadataURI; bool superseded; bytes32 supersededBy; }",
  "event BundleAnchored(bytes32 indexed bundleHash, bytes32 indexed subjectId, bytes32 indexed role, uint256 documentCount)",
  "event BundleSuperseded(bytes32 indexed oldBundleHash, bytes32 indexed newBundleHash, bytes32 indexed subjectId, bytes32 role)",
  "function anchorBundle(bytes32 bundleHash, bytes32 subjectId, bytes32 role, uint256 documentCount, string metadataURI)",
  "function supersedeBundle(bytes32 oldBundleHash, bytes32 newBundleHash, bytes32 subjectId, bytes32 role, uint256 documentCount, string metadataURI)",
  "function getAnchor(bytes32 bundleHash, bytes32 subjectId, bytes32 role) view returns (AnchorRecord)",
  "function isAnchored(bytes32 bundleHash, bytes32 subjectId, bytes32 role) view returns (bool)",
  "function activeBundle(bytes32 subjectId, bytes32 role) view returns (bytes32)",
]);

export const documentBundleAnchorRecoveryAbi = parseAbi([
  "event SlotPrincipalAssigned(bytes32 indexed subjectId, bytes32 indexed role, address indexed principal)",
  "function slotPrincipal(bytes32 subjectId, bytes32 role) view returns (address)",
  "function assignSlotPrincipal(bytes32 subjectId, bytes32 role, address principal)",
]);
