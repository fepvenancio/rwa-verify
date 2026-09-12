// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IAssetBoundToken} from "../../src/interfaces/IAssetBoundToken.sol";
import {IAssetBoundTokenId} from "../../src/interfaces/IAssetBoundTokenId.sol";

/// @dev Implements both ERC-8325 token-side interfaces; ERC-165 answers are configurable.
contract MockBoundToken is IAssetBoundToken, IAssetBoundTokenId {
    address public override(IAssetBoundToken, IAssetBoundTokenId) anchorRegistry;
    bytes32 public anchorId;
    mapping(uint256 => bytes32) public anchorOf;

    bool public supportsContractScope = true;
    bool public supportsTokenIdScope = true;

    error NotBound();

    function set(address registry_, bytes32 anchorId_) external {
        anchorRegistry = registry_;
        anchorId = anchorId_;
    }

    function setTokenAnchor(uint256 tokenId, bytes32 anchorId_) external {
        anchorOf[tokenId] = anchorId_;
    }

    function setSupport(bool contractScope, bool tokenIdScope) external {
        supportsContractScope = contractScope;
        supportsTokenIdScope = tokenIdScope;
    }

    function supportsInterface(bytes4 id) external view returns (bool) {
        if (id == type(IERC165).interfaceId) return true;
        if (id == type(IAssetBoundToken).interfaceId) return supportsContractScope;
        if (id == type(IAssetBoundTokenId).interfaceId) return supportsTokenIdScope;
        return false;
    }

    function isAnchorActive() external pure returns (bool) {
        return true;
    }

    function anchorIdOf(uint256 tokenId) external view returns (bytes32) {
        bytes32 a = anchorOf[tokenId];
        if (a == bytes32(0)) revert NotBound();
        return a;
    }

    function isAnchorActiveFor(uint256) external pure returns (bool) {
        return true;
    }
}
