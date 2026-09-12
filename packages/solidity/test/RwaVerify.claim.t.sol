// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RwaVerify} from "../src/RwaVerify.sol";
import {MockClaimRegistry, MockRegistryAnchor} from "./mocks/MockClaimRegistry.sol";
import {Reverter, Garbage, Plain} from "./mocks/Misbehaving.sol";

contract RwaVerifyClaimTest is Test {
    MockClaimRegistry internal registry;
    MockRegistryAnchor internal asset;
    bytes32 internal constant ASSET_ID = keccak256("asset");
    uint8 internal constant VALUATION = 1;

    function setUp() public {
        registry = new MockClaimRegistry();
        asset = new MockRegistryAnchor();
        registry.setCount(1);
    }

    function _status(RwaVerify.Claim memory r, RwaVerify.Status s) internal pure {
        assertEq(uint256(r.status), uint256(s));
    }

    function test_pass_noAnchor_registryLevelTrust() public {
        Plain plain = new Plain();
        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(registry), address(plain), ASSET_ID, VALUATION);
        _status(r, RwaVerify.Status.Pass);
        assertTrue(r.registrySupported);
        assertFalse(r.anchorChecked);
        assertFalse(r.registryApproved);
        assertEq(r.activeClaimCount, 1);
    }

    function test_pass_offchainAsset() public view {
        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(registry), address(0), ASSET_ID, VALUATION);
        _status(r, RwaVerify.Status.Pass);
        assertFalse(r.anchorChecked);
    }

    function test_pass_anchorApproved() public {
        asset.setRegistry(address(registry), true);
        registry.setCount(3);
        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(registry), address(asset), ASSET_ID, VALUATION);
        _status(r, RwaVerify.Status.Pass);
        assertTrue(r.anchorChecked && r.registryApproved);
        assertEq(r.activeClaimCount, 3);
    }

    function test_fail_anchorNotApproved() public view {
        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(registry), address(asset), ASSET_ID, VALUATION);
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.anchorChecked);
        assertFalse(r.registryApproved);
        assertEq(r.activeClaimCount, 1, "claims still counted in evidence");
    }

    function test_fail_noActiveClaims() public {
        registry.setCount(0);
        asset.setRegistry(address(registry), true);
        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(registry), address(asset), ASSET_ID, VALUATION);
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.activeClaimCount, 0);
        assertTrue(r.registryApproved);
    }

    function test_fail_invalidClaimTypeReverts() public view {
        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(registry), address(0), ASSET_ID, 8);
        _status(r, RwaVerify.Status.Fail);
    }

    function test_unsupported_registry() public {
        Plain plain = new Plain();
        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(plain), address(asset), ASSET_ID, VALUATION);
        _status(r, RwaVerify.Status.Unsupported);
        assertFalse(r.registrySupported);
        assertFalse(r.anchorChecked, "asset side not consulted");
        _status(
            RwaVerify.hasActiveClaim(address(0xABCD), address(0), ASSET_ID, VALUATION), RwaVerify.Status.Unsupported
        );
    }

    function test_fail_reverterRegistry() public {
        Reverter bad = new Reverter();
        _status(RwaVerify.hasActiveClaim(address(bad), address(0), ASSET_ID, VALUATION), RwaVerify.Status.Fail);
    }

    function test_fail_reverterAsset() public {
        Reverter bad = new Reverter();
        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(registry), address(bad), ASSET_ID, VALUATION);
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.anchorChecked);
    }

    function test_fail_garbageArrayEncoding() public {
        Garbage bad = new Garbage();
        bad.setReturn(abi.encode(uint256(96), uint256(1))); // offset points past the return data
        _status(RwaVerify.hasActiveClaim(address(bad), address(0), ASSET_ID, VALUATION), RwaVerify.Status.Fail);
        bad.setReturn(abi.encode(uint256(1)));
        _status(RwaVerify.hasActiveClaim(address(bad), address(0), ASSET_ID, VALUATION), RwaVerify.Status.Fail);
    }
}
