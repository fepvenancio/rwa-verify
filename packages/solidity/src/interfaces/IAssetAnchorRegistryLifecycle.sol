// SPDX-License-Identifier: MIT
// ERC-8325 Asset Anchor Registry — transcribed from ethereum/ERCs @ 84b46e7d69d08dbd8876503e435fd299211c26b8
pragma solidity ^0.8.20;

/// @dev Registration metadata; canonical encoding is `abi.encode` of the fields in this order.
struct AnchorMetadata {
    bytes32 assetClass;
    bytes32 jurisdiction;
    uint64 attestationDate;
    uint64 expiresAt;
    bytes uri;
    bytes extensions;
}

/// @dev Mandatory for every compliant registry.
interface IAssetAnchorRegistryLifecycle {
    function getMetadata(bytes32 anchorId) external view returns (AnchorMetadata memory);

    function registeredBy(bytes32 anchorId) external view returns (address);

    function isActive(bytes32 anchorId) external view returns (bool);

    function deactivateAnchor(bytes32 anchorId, string calldata reason) external;

    function reattest(bytes32 anchorId, uint64 newExpiresAt, uint64 newAttestationDate) external;
}
