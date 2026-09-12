// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @dev Claims every ERC-165 interface (except 0xffffffff, so ERC165Checker accepts it) and reverts on anything else.
contract Reverter is IERC165 {
    error AlwaysReverts();

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id != 0xffffffff;
    }

    fallback() external {
        revert AlwaysReverts();
    }
}

/// @dev Claims every ERC-165 interface and answers every other call with a configurable byte string.
contract Garbage is IERC165 {
    bytes public ret;

    function setReturn(bytes calldata data) external {
        ret = data;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id != 0xffffffff;
    }

    fallback() external {
        bytes memory r = ret;
        assembly ("memory-safe") {
            return(add(r, 0x20), mload(r))
        }
    }
}

/// @dev Has code but no ERC-165.
contract Plain {
    function foo() external pure returns (uint256) {
        return 1;
    }
}
