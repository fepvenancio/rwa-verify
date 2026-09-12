// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {INAVSnapshotOracle} from "../../src/interfaces/INAVSnapshotOracle.sol";

/// @dev Single-stream ERC-8330 oracle with the spec's `latestNAVStatus` semantics (thresholds, both flags).
contract MockNavOracle is IERC165 {
    uint64 public heartbeatValue;
    uint64 public maxValuationAgeValue;

    bool public hasCurrent;
    int256 public nav;
    uint8 public decimals;
    bytes32 public navBasis;
    uint64 public valuationTimestamp;
    uint64 public publishedAt;
    address public provider;

    error Unconfigured();
    error NoCurrentSnapshot();

    function setThresholds(uint64 heartbeat_, uint64 maxValuationAge_) external {
        heartbeatValue = heartbeat_;
        maxValuationAgeValue = maxValuationAge_;
    }

    function setSnapshot(int256 nav_, uint8 decimals_, uint64 valuationTimestamp_, uint64 publishedAt_) external {
        hasCurrent = true;
        nav = nav_;
        decimals = decimals_;
        navBasis = keccak256("ERC-8330:NAV_BASIS:PER_SHARE");
        valuationTimestamp = valuationTimestamp_;
        publishedAt = publishedAt_;
        provider = address(0xBEEF);
    }

    function clearSnapshot() external {
        hasCurrent = false;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IERC165).interfaceId || id == type(INAVSnapshotOracle).interfaceId;
    }

    function heartbeat(bytes32, bytes32) external view returns (uint64) {
        return heartbeatValue;
    }

    function maxValuationAge(bytes32, bytes32) external view returns (uint64) {
        return maxValuationAgeValue;
    }

    function latestNAVStatus(bytes32, bytes32)
        external
        view
        returns (int256, uint8, bytes32, uint64, uint64, address, bool isPublishStale, bool isValuationStale)
    {
        if (heartbeatValue == 0 || maxValuationAgeValue == 0) revert Unconfigured();
        if (!hasCurrent) revert NoCurrentSnapshot();
        isPublishStale = block.timestamp > uint256(publishedAt) + heartbeatValue;
        isValuationStale = block.timestamp > uint256(valuationTimestamp) + maxValuationAgeValue;
        return (nav, decimals, navBasis, valuationTimestamp, publishedAt, provider, isPublishStale, isValuationStale);
    }
}
