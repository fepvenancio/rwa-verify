import { parseAbi } from "viem";

// ERC-8325 Asset Anchor Registry — transcribed from specs/erc-8325.md.
// Each interface is kept separate because ERC-165 IDs exclude inherited members.

export const assetAnchorRegistryAbi = parseAbi([
  "struct AnchorRecord { bytes32 anchorId; bytes32 legalHash; bytes32 evidenceHash; address boundToken; bytes32 bindingScope; uint256 boundTokenId; uint64 registeredAt; bool active; }",
  "event AnchorRegistered(bytes32 indexed anchorId, bytes32 legalHash, bytes32 evidenceHash)",
  "event TokenBound(bytes32 indexed anchorId, address indexed token, bytes32 indexed bindingScope, uint256 tokenId)",
  "event AnchorDeactivated(bytes32 indexed anchorId, string reason)",
  "event AnchorReattested(bytes32 indexed anchorId, uint64 oldExpiresAt, uint64 newExpiresAt, uint64 newAttestationDate)",
  "function registerAnchor(bytes32 legalHash, bytes32 evidenceHash, bytes metadata) returns (bytes32 anchorId)",
  "function bindToken(bytes32 anchorId, address token, bytes32 bindingScope, uint256 tokenId)",
  "function registerAndBind(bytes32 legalHash, bytes32 evidenceHash, bytes metadata, address token, bytes32 bindingScope, uint256 tokenId) returns (bytes32 anchorId)",
  "function getAnchor(bytes32 anchorId) view returns (AnchorRecord)",
  "function isBound(bytes32 anchorId) view returns (bool)",
]);

export const assetAnchorRegistryLifecycleAbi = parseAbi([
  "struct AnchorMetadata { bytes32 assetClass; bytes32 jurisdiction; uint64 attestationDate; uint64 expiresAt; bytes uri; bytes extensions; }",
  "function getMetadata(bytes32 anchorId) view returns (AnchorMetadata)",
  "function registeredBy(bytes32 anchorId) view returns (address)",
  "function isActive(bytes32 anchorId) view returns (bool)",
  "function deactivateAnchor(bytes32 anchorId, string reason)",
  "function reattest(bytes32 anchorId, uint64 newExpiresAt, uint64 newAttestationDate)",
]);

export const assetAnchorRegistryRecoveryAbi = parseAbi([
  "event TokenBindingInvalidated(bytes32 indexed anchorId, address indexed token, bytes32 indexed bindingScope, uint256 tokenId, bytes32 reasonHash)",
  "function invalidateTokenBinding(bytes32 anchorId, bytes32 reasonHash)",
  "function isBindingValid(bytes32 anchorId) view returns (bool)",
]);

export const assetBoundTokenAbi = parseAbi([
  "function anchorId() view returns (bytes32)",
  "function anchorRegistry() view returns (address)",
  "function isAnchorActive() view returns (bool)",
]);

export const assetBoundTokenIdAbi = parseAbi([
  "function anchorIdOf(uint256 tokenId) view returns (bytes32)",
  "function anchorRegistry() view returns (address)",
  "function isAnchorActiveFor(uint256 tokenId) view returns (bool)",
]);
