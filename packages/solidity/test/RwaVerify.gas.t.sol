// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RwaVerify} from "../src/RwaVerify.sol";
import {BINDING_SCOPE_CONTRACT} from "../src/interfaces/IAssetAnchorRegistry.sol";
import {NO_CORRECTION} from "../src/interfaces/IComplianceEventLog.sol";
import {MockAnchorRegistry} from "./mocks/MockAnchorRegistry.sol";
import {MockBoundToken} from "./mocks/MockBoundToken.sol";
import {MockNavOracle} from "./mocks/MockNavOracle.sol";
import {MockClaimRegistry, MockRegistryAnchor} from "./mocks/MockClaimRegistry.sol";
import {MockEventLog} from "./mocks/MockEventLog.sol";

/// @dev Happy-path gas for each library function against mocks (one test per function so `forge snapshot`
///      lines approximate the library call; the emitted `gas` value is the exact call cost).
contract RwaVerifyGasTest is Test {
    MockAnchorRegistry internal registry;
    MockBoundToken internal token;
    MockNavOracle internal oracle;
    MockClaimRegistry internal claims;
    MockRegistryAnchor internal asset;
    MockEventLog internal eventLog;
    bytes32 internal constant ID = keccak256("id");

    function setUp() public {
        vm.warp(1_800_000_000);
        registry = new MockAnchorRegistry();
        token = new MockBoundToken();
        registry.setRecord(address(token), BINDING_SCOPE_CONTRACT, 0);
        registry.setFlags(true, true, true);
        token.set(address(registry), ID);

        oracle = new MockNavOracle();
        oracle.setThresholds(1 days, 7 days);
        oracle.setSnapshot(1e6, 6, uint64(block.timestamp), uint64(block.timestamp));

        claims = new MockClaimRegistry();
        claims.setCount(1);
        asset = new MockRegistryAnchor();
        asset.setRegistry(address(claims), true);

        eventLog = new MockEventLog();
        eventLog.add(ID, ID, NO_CORRECTION);
    }

    function test_gas_bindingValid() public {
        uint256 g = gasleft();
        RwaVerify.Binding memory r = RwaVerify.bindingValid(address(token), 0, false, address(registry), ID);
        g -= gasleft();
        assertEq(uint256(r.status), uint256(RwaVerify.Status.Pass));
        emit log_named_uint("gas bindingValid", g);
    }

    function test_gas_navFresh() public {
        uint256 g = gasleft();
        RwaVerify.Nav memory r = RwaVerify.navFresh(address(oracle), ID, ID);
        g -= gasleft();
        assertEq(uint256(r.status), uint256(RwaVerify.Status.Pass));
        emit log_named_uint("gas navFresh", g);
    }

    function test_gas_hasActiveClaim() public {
        uint256 g = gasleft();
        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(claims), address(asset), ID, 1);
        g -= gasleft();
        assertEq(uint256(r.status), uint256(RwaVerify.Status.Pass));
        emit log_named_uint("gas hasActiveClaim", g);
    }

    function test_gas_latestCurrentEvent() public {
        uint256 g = gasleft();
        RwaVerify.Event memory r = RwaVerify.latestCurrentEvent(address(eventLog), ID, ID);
        g -= gasleft();
        assertEq(uint256(r.status), uint256(RwaVerify.Status.Pass));
        emit log_named_uint("gas latestCurrentEvent", g);
    }
}
