// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IAssetAnchorRegistry} from "../../src/interfaces/IAssetAnchorRegistry.sol";
import {IAssetAnchorRegistryLifecycle} from "../../src/interfaces/IAssetAnchorRegistryLifecycle.sol";
import {IAssetAnchorRegistryRecovery} from "../../src/interfaces/IAssetAnchorRegistryRecovery.sol";

/// @dev Configurable ERC-8325 registry: only the read surface RwaVerify touches is implemented.
contract MockAnchorRegistry is IERC165 {
    IAssetAnchorRegistry.AnchorRecord public record;
    bool public bound;
    bool public active;
    bool public bindingValid;

    bool public supportsRegistry = true;
    bool public supportsLifecycle = true;
    bool public supportsRecovery = true;

    mapping(bytes4 => bool) public revertOn;

    error MockRevert();

    function setRecord(address token, bytes32 scope, uint256 tokenId) external {
        record.boundToken = token;
        record.bindingScope = scope;
        record.boundTokenId = tokenId;
    }

    function setAnchorId(bytes32 anchorId) external {
        record.anchorId = anchorId;
    }

    function setFlags(bool bound_, bool active_, bool bindingValid_) external {
        bound = bound_;
        active = active_;
        bindingValid = bindingValid_;
    }

    function setSupport(bool registry_, bool lifecycle_, bool recovery_) external {
        supportsRegistry = registry_;
        supportsLifecycle = lifecycle_;
        supportsRecovery = recovery_;
    }

    function setRevert(bytes4 selector, bool on) external {
        revertOn[selector] = on;
    }

    function supportsInterface(bytes4 id) external view returns (bool) {
        if (id == type(IERC165).interfaceId) return true;
        if (id == type(IAssetAnchorRegistry).interfaceId) return supportsRegistry;
        if (id == type(IAssetAnchorRegistryLifecycle).interfaceId) return supportsLifecycle;
        if (id == type(IAssetAnchorRegistryRecovery).interfaceId) return supportsRecovery;
        return false;
    }

    function getAnchor(bytes32) external view returns (IAssetAnchorRegistry.AnchorRecord memory) {
        if (revertOn[msg.sig]) revert MockRevert();
        return record;
    }

    function isBound(bytes32) external view returns (bool) {
        if (revertOn[msg.sig]) revert MockRevert();
        return bound;
    }

    function isActive(bytes32) external view returns (bool) {
        if (revertOn[msg.sig]) revert MockRevert();
        return active;
    }

    function isBindingValid(bytes32) external view returns (bool) {
        if (revertOn[msg.sig]) revert MockRevert();
        return bindingValid;
    }
}
