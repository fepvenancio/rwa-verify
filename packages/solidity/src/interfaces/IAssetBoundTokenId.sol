// SPDX-License-Identifier: MIT
// ERC-8325 Asset Anchor Registry — transcribed from ethereum/ERCs @ 84b46e7d69d08dbd8876503e435fd299211c26b8
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @dev Token side of a token-ID binding.
interface IAssetBoundTokenId is IERC165 {
    function anchorIdOf(uint256 tokenId) external view returns (bytes32);

    function anchorRegistry() external view returns (address);

    function isAnchorActiveFor(uint256 tokenId) external view returns (bool);
}
