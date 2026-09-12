// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RwaVerify} from "../src/RwaVerify.sol";
import {CollateralGate} from "../src/examples/CollateralGate.sol";
import {BINDING_SCOPE_CONTRACT} from "../src/interfaces/IAssetAnchorRegistry.sol";
import {MockAnchorRegistry} from "./mocks/MockAnchorRegistry.sol";
import {MockBoundToken} from "./mocks/MockBoundToken.sol";
import {MockNavOracle} from "./mocks/MockNavOracle.sol";
import {Plain} from "./mocks/Misbehaving.sol";

contract CollateralGateTest is Test {
    MockAnchorRegistry internal registry;
    MockBoundToken internal token;
    MockNavOracle internal oracle;
    CollateralGate internal gate;
    bytes32 internal constant ANCHOR = keccak256("anchor");
    bytes32 internal constant USD = keccak256("ERC-8330:CURRENCY:USD");

    function setUp() public {
        vm.warp(1_800_000_000);
        registry = new MockAnchorRegistry();
        token = new MockBoundToken();
        oracle = new MockNavOracle();
        registry.setRecord(address(token), BINDING_SCOPE_CONTRACT, 0);
        registry.setFlags(true, true, true);
        token.set(address(registry), ANCHOR);
        oracle.setThresholds(1 days, 7 days);
        oracle.setSnapshot(123_456, 6, uint64(block.timestamp), uint64(block.timestamp));
        gate = new CollateralGate(address(registry), address(oracle), USD);
    }

    function test_accepts() public view {
        (int256 nav, uint8 decimals) = gate.requireCollateral(address(token), ANCHOR);
        assertEq(nav, 123_456);
        assertEq(decimals, 6);
    }

    function test_rejectsBrokenBinding() public {
        registry.setFlags(true, false, true);
        vm.expectRevert(
            abi.encodeWithSelector(
                CollateralGate.CollateralRejected.selector, RwaVerify.Status.Fail, RwaVerify.Status.Pass
            )
        );
        gate.requireCollateral(address(token), ANCHOR);
    }

    function test_rejectsStaleNav() public {
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(
            abi.encodeWithSelector(
                CollateralGate.CollateralRejected.selector, RwaVerify.Status.Pass, RwaVerify.Status.Stale
            )
        );
        gate.requireCollateral(address(token), ANCHOR);
    }

    function test_rejectsUnknownThresholds() public {
        oracle.setThresholds(0, 0);
        vm.expectRevert(
            abi.encodeWithSelector(
                CollateralGate.CollateralRejected.selector, RwaVerify.Status.Pass, RwaVerify.Status.Unknown
            )
        );
        gate.requireCollateral(address(token), ANCHOR);
    }

    function test_unsupportedIsNotPass() public {
        CollateralGate g = new CollateralGate(address(new Plain()), address(new Plain()), USD);
        vm.expectRevert(
            abi.encodeWithSelector(
                CollateralGate.CollateralRejected.selector, RwaVerify.Status.Unsupported, RwaVerify.Status.Unsupported
            )
        );
        g.requireCollateral(address(token), ANCHOR);
    }
}
