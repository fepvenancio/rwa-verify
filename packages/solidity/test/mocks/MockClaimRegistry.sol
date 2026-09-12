// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {
    IRegulatedAssetClaimRegistry,
    RegulatedAssetClaim,
    ClaimType
} from "../../src/interfaces/IRegulatedAssetClaimRegistry.sol";
import {IRegistryAnchor} from "../../src/interfaces/IRegistryAnchor.sol";

/// @dev ERC-8320 registry stub: `getActiveClaims` returns `count` placeholder claims.
contract MockClaimRegistry is IERC165 {
    uint256 public count;

    function setCount(uint256 count_) external {
        count = count_;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IERC165).interfaceId || id == type(IRegulatedAssetClaimRegistry).interfaceId;
    }

    // Typed `ClaimType` so an out-of-range claim type reverts in ABI decoding, as a real registry would.
    function getActiveClaims(bytes32, ClaimType) external view returns (RegulatedAssetClaim[] memory claims) {
        claims = new RegulatedAssetClaim[](count);
        for (uint256 i = 0; i < count; ++i) {
            claims[i].version = uint64(i + 1);
            claims[i].uri = "ipfs://claim";
        }
    }
}

/// @dev ERC-8320 asset side with a configurable approval set.
contract MockRegistryAnchor is IERC165 {
    mapping(address => bool) public isRegistryApproved;

    function setRegistry(address registry, bool approved) external {
        isRegistryApproved[registry] = approved;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IERC165).interfaceId || id == type(IRegistryAnchor).interfaceId;
    }
}
