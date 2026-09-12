// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IAssetBoundToken} from "../../src/interfaces/IAssetBoundToken.sol";
import {IRegistryAnchor} from "../../src/interfaces/IRegistryAnchor.sol";

/// @dev Fixture-stack token: ERC-8325 token side (contract scope) plus the ERC-8320 asset side. The reference
///      `RegistryAnchor` cannot be inherited here because its `supportsInterface` is not virtual.
contract FixtureToken is IAssetBoundToken, IRegistryAnchor {
    address public immutable owner;
    address public anchorRegistry;
    bytes32 public anchorId;
    address[] internal registries;
    mapping(address => bool) public isRegistryApproved;

    error NotOwner();

    constructor() {
        owner = msg.sender;
    }

    function set(address registry_, bytes32 anchorId_) external {
        anchorRegistry = registry_;
        anchorId = anchorId_;
    }

    function isAnchorActive() external pure returns (bool) {
        return true;
    }

    function setRegistry(address registry, bool approved) external {
        if (msg.sender != owner) revert NotOwner();
        if (approved && !isRegistryApproved[registry]) registries.push(registry);
        isRegistryApproved[registry] = approved;
        emit RegistrySet(registry, address(this), approved);
    }

    function getRegistries() external view returns (address[] memory) {
        return registries;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IERC165).interfaceId || id == type(IAssetBoundToken).interfaceId
            || id == type(IRegistryAnchor).interfaceId;
    }
}
