// SPDX-License-Identifier: MIT
// ERC-8325 Asset Anchor Registry — transcribed from ethereum/ERCs @ 84b46e7d69d08dbd8876503e435fd299211c26b8
pragma solidity ^0.8.20;

bytes32 constant BINDING_SCOPE_CONTRACT = keccak256("ERC-8325:BINDING_SCOPE:CONTRACT");
bytes32 constant BINDING_SCOPE_TOKEN_ID = keccak256("ERC-8325:BINDING_SCOPE:TOKEN_ID");

interface IAssetAnchorRegistry {
    struct AnchorRecord {
        bytes32 anchorId;
        bytes32 legalHash;
        bytes32 evidenceHash;
        address boundToken;
        bytes32 bindingScope;
        uint256 boundTokenId;
        uint64 registeredAt;
        bool active;
    }

    event AnchorRegistered(bytes32 indexed anchorId, bytes32 legalHash, bytes32 evidenceHash);

    event TokenBound(bytes32 indexed anchorId, address indexed token, bytes32 indexed bindingScope, uint256 tokenId);

    event AnchorDeactivated(bytes32 indexed anchorId, string reason);

    event AnchorReattested(
        bytes32 indexed anchorId, uint64 oldExpiresAt, uint64 newExpiresAt, uint64 newAttestationDate
    );

    function registerAnchor(bytes32 legalHash, bytes32 evidenceHash, bytes calldata metadata)
        external
        returns (bytes32 anchorId);

    function bindToken(bytes32 anchorId, address token, bytes32 bindingScope, uint256 tokenId) external;

    function registerAndBind(
        bytes32 legalHash,
        bytes32 evidenceHash,
        bytes calldata metadata,
        address token,
        bytes32 bindingScope,
        uint256 tokenId
    ) external returns (bytes32 anchorId);

    function getAnchor(bytes32 anchorId) external view returns (AnchorRecord memory);

    function isBound(bytes32 anchorId) external view returns (bool);
}
