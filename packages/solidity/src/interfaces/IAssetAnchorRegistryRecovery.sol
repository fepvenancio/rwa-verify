// SPDX-License-Identifier: MIT
// ERC-8325 Asset Anchor Registry — transcribed from ethereum/ERCs @ 84b46e7d69d08dbd8876503e435fd299211c26b8
pragma solidity ^0.8.20;

/// @dev Optional. Detect via ERC-165 before calling.
interface IAssetAnchorRegistryRecovery {
    event TokenBindingInvalidated(
        bytes32 indexed anchorId,
        address indexed token,
        bytes32 indexed bindingScope,
        uint256 tokenId,
        bytes32 reasonHash
    );

    function invalidateTokenBinding(bytes32 anchorId, bytes32 reasonHash) external;

    function isBindingValid(bytes32 anchorId) external view returns (bool);
}
