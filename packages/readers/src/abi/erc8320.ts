import { parseAbi } from "viem";

// ERC-8320 Regulated Asset Claim — transcribed from specs/erc-8320.md.
// Solidity enums (ClaimType, ClaimState, RoleKind) are uint8 in the ABI.

export const regulatedAssetClaimRegistryAbi = parseAbi([
  "struct RegulatedAssetClaim { bytes32 assetId; uint8 claimType; bytes32 schemaId; bytes32 schemaHash; uint64 version; uint64 validFrom; uint64 validUntil; uint8 claimState; bytes32[] tags; bytes32 contentHash; address author; string uri; }",
  "event ClaimProposed(bytes32 indexed assetId, uint8 indexed claimType, uint64 version, address indexed author)",
  "event ClaimValidated(bytes32 indexed assetId, uint8 indexed claimType, uint64 version, address indexed validator)",
  "event ClaimActivated(bytes32 indexed assetId, uint8 indexed claimType, uint64 version, address indexed activator)",
  "event ClaimSuspended(bytes32 indexed assetId, uint8 indexed claimType, uint64 version, address indexed activator)",
  "event ClaimRevoked(bytes32 indexed assetId, uint8 indexed claimType, uint64 version, address indexed revoker)",
  "event RoleGrantedToClaimType(bytes32 indexed assetId, uint8 claimType, uint8 kind, address indexed who)",
  "event RoleRevokedFromClaimType(bytes32 indexed assetId, uint8 claimType, uint8 kind, address indexed who)",
  "event AssetRegistered(bytes32 indexed assetId, address indexed contractAddr, uint256 subAssetId, uint256 chainId, address indexed registrant)",
  "event AssetRemoved(bytes32 indexed assetId, address indexed admin)",
  "function grantRoleToClaimType(bytes32 assetId, uint8 t, uint8 kind, address who)",
  "function revokeRoleToClaimType(bytes32 assetId, uint8 t, uint8 kind, address who)",
  "function isAuthorized(bytes32 assetId, uint8 t, uint8 kind, address who) view returns (bool)",
  "function proposeClaim(RegulatedAssetClaim claim, uint256 nonce, uint64 deadline, bytes signature)",
  "function validateClaim(bytes32 assetId, uint8 t, uint64 version, address signer, uint256 nonce, uint64 deadline, bytes signature)",
  "function activateClaim(bytes32 assetId, uint8 t, uint64 version, address signer, uint256 nonce, uint64 deadline, bytes signature)",
  "function suspendClaim(bytes32 assetId, uint8 t, uint64 version, address signer, uint256 nonce, uint64 deadline, bytes signature)",
  "function revokeClaim(bytes32 assetId, uint8 t, uint64 version, address signer, uint256 nonce, uint64 deadline, bytes signature)",
  "function getActiveClaims(bytes32 assetId, uint8 t) view returns (RegulatedAssetClaim[] activeClaims)",
  "function getClaim(bytes32 assetId, uint8 t, uint64 version) view returns (RegulatedAssetClaim)",
  "function nonces(address signer) view returns (uint256)",
  "function registerAsset(address contractAddr, uint256 subAssetId, uint256 chainId) returns (bytes32 assetId)",
  "function removeAsset(bytes32 assetId)",
  "function isAssetActive(bytes32 assetId) view returns (bool)",
  "function getAssetId(address contractAddr, uint256 subAssetId, uint256 chainId) pure returns (bytes32)",
  "function getAssetReference(bytes32 assetId) view returns (address contractAddr, uint256 subAssetId, uint256 chainId)",
]);

export const registryAnchorAbi = parseAbi([
  "event RegistrySet(address indexed registry, address indexed asset, bool approved)",
  "function setRegistry(address registry, bool approved)",
  "function getRegistries() view returns (address[])",
  "function isRegistryApproved(address registry) view returns (bool)",
]);

// enum ClaimType { IDENTITY, VALUATION, MANDATE, TERMS, COMPLIANCE, BACKING, EVENT, RISK }
export const CLAIM_TYPES = ["IDENTITY", "VALUATION", "MANDATE", "TERMS", "COMPLIANCE", "BACKING", "EVENT", "RISK"] as const;
