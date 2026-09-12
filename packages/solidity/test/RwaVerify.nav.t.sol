// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RwaVerify} from "../src/RwaVerify.sol";
import {MockNavOracle} from "./mocks/MockNavOracle.sol";
import {Reverter, Garbage, Plain} from "./mocks/Misbehaving.sol";

contract RwaVerifyNavTest is Test {
    MockNavOracle internal oracle;
    bytes32 internal constant SUBJECT = keccak256("subject");
    bytes32 internal constant USD = keccak256("ERC-8330:CURRENCY:USD");
    uint64 internal constant HEARTBEAT = 1 days;
    uint64 internal constant MAX_AGE = 7 days;
    uint64 internal t0;

    function setUp() public {
        vm.warp(1_800_000_000);
        t0 = uint64(block.timestamp);
        oracle = new MockNavOracle();
        oracle.setThresholds(HEARTBEAT, MAX_AGE);
        oracle.setSnapshot(1_050_000, 6, t0, t0);
    }

    function _check() internal view returns (RwaVerify.Nav memory) {
        return RwaVerify.navFresh(address(oracle), SUBJECT, USD);
    }

    function _status(RwaVerify.Nav memory r, RwaVerify.Status s) internal pure {
        assertEq(uint256(r.status), uint256(s));
    }

    function test_pass() public view {
        RwaVerify.Nav memory r = _check();
        _status(r, RwaVerify.Status.Pass);
        assertTrue(r.supported);
        assertEq(r.heartbeat, HEARTBEAT);
        assertEq(r.maxValuationAge, MAX_AGE);
        assertEq(r.nav, 1_050_000);
        assertEq(r.decimals, 6);
        assertEq(r.navBasis, keccak256("ERC-8330:NAV_BASIS:PER_SHARE"));
        assertEq(r.valuationTimestamp, t0);
        assertEq(r.publishedAt, t0);
        assertEq(r.provider, address(0xBEEF));
        assertFalse(r.isPublishStale || r.isValuationStale);
    }

    function test_pass_negativeNav() public {
        oracle.setSnapshot(-42, 2, t0, t0);
        RwaVerify.Nav memory r = _check();
        _status(r, RwaVerify.Status.Pass);
        assertEq(r.nav, -42);
    }

    // ---------- staleness flags ----------

    function test_stale_publish() public {
        vm.warp(t0 + HEARTBEAT + 1);
        RwaVerify.Nav memory r = _check();
        _status(r, RwaVerify.Status.Stale);
        assertTrue(r.isPublishStale);
        assertFalse(r.isValuationStale);
        assertEq(r.nav, 1_050_000, "values still reported");
    }

    function test_stale_valuation() public {
        // Freshly published, but the valuation itself is old.
        oracle.setSnapshot(1_050_000, 6, t0 - MAX_AGE - 1, t0);
        RwaVerify.Nav memory r = _check();
        _status(r, RwaVerify.Status.Stale);
        assertFalse(r.isPublishStale);
        assertTrue(r.isValuationStale);
    }

    function test_stale_both() public {
        vm.warp(t0 + MAX_AGE + 1);
        RwaVerify.Nav memory r = _check();
        _status(r, RwaVerify.Status.Stale);
        assertTrue(r.isPublishStale && r.isValuationStale);
    }

    function test_boundary_publishNotStaleAtThreshold() public {
        vm.warp(t0 + HEARTBEAT);
        RwaVerify.Nav memory r = _check();
        _status(r, RwaVerify.Status.Pass);
        assertFalse(r.isPublishStale);
        vm.warp(t0 + HEARTBEAT + 1);
        _status(_check(), RwaVerify.Status.Stale);
    }

    function test_boundary_valuationNotStaleAtThreshold() public {
        oracle.setSnapshot(1, 0, t0 - MAX_AGE, t0);
        RwaVerify.Nav memory r = _check();
        _status(r, RwaVerify.Status.Pass);
        assertFalse(r.isValuationStale);
        oracle.setSnapshot(1, 0, t0 - MAX_AGE - 1, t0);
        _status(_check(), RwaVerify.Status.Stale);
    }

    // ---------- unconfigured thresholds ----------

    function test_unknown_heartbeatUnset() public {
        oracle.setThresholds(0, MAX_AGE);
        RwaVerify.Nav memory r = _check();
        _status(r, RwaVerify.Status.Unknown);
        assertEq(r.heartbeat, 0);
        assertEq(r.maxValuationAge, MAX_AGE);
        assertEq(r.nav, 0, "snapshot not read");
    }

    function test_unknown_maxAgeUnset() public {
        oracle.setThresholds(HEARTBEAT, 0);
        RwaVerify.Nav memory r = _check();
        _status(r, RwaVerify.Status.Unknown);
        assertEq(r.maxValuationAge, 0);
    }

    function test_unknown_bothUnset_evenWithoutSnapshot() public {
        oracle.setThresholds(0, 0);
        oracle.clearSnapshot();
        _status(_check(), RwaVerify.Status.Unknown);
    }

    // ---------- no current snapshot ----------

    function test_fail_noCurrentSnapshot() public {
        oracle.clearSnapshot();
        RwaVerify.Nav memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.heartbeat, HEARTBEAT, "thresholds in evidence");
        assertEq(r.publishedAt, 0);
    }

    // ---------- unsupported / misbehaving ----------

    function test_unsupported_eoa() public view {
        RwaVerify.Nav memory r = RwaVerify.navFresh(address(0xABCD), SUBJECT, USD);
        _status(r, RwaVerify.Status.Unsupported);
        assertFalse(r.supported);
    }

    function test_unsupported_plain() public {
        Plain plain = new Plain();
        _status(RwaVerify.navFresh(address(plain), SUBJECT, USD), RwaVerify.Status.Unsupported);
    }

    function test_fail_reverter() public {
        Reverter bad = new Reverter();
        RwaVerify.Nav memory r = RwaVerify.navFresh(address(bad), SUBJECT, USD);
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.supported);
    }

    function test_fail_shortReturn() public {
        Garbage bad = new Garbage();
        bad.setReturn(hex"");
        _status(RwaVerify.navFresh(address(bad), SUBJECT, USD), RwaVerify.Status.Fail);
    }

    function test_fail_thresholdWordOutOfRange() public {
        Garbage bad = new Garbage();
        bad.setReturn(abi.encode(uint256(type(uint64).max) + 1));
        _status(RwaVerify.navFresh(address(bad), SUBJECT, USD), RwaVerify.Status.Fail);
    }

    function test_fail_nonBooleanStaleFlag() public {
        Garbage bad = new Garbage();
        // Every call answers with the same 8 words: thresholds read word 0 (= 5, nonzero), flags read words 6/7.
        bad.setReturn(abi.encode(uint256(5), uint256(6), bytes32(0), uint256(1), uint256(1), address(1), 2, 0));
        RwaVerify.Nav memory r = RwaVerify.navFresh(address(bad), SUBJECT, USD);
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.heartbeat, 5);
    }

    function test_fail_decimalsOutOfRange() public {
        Garbage bad = new Garbage();
        bad.setReturn(abi.encode(uint256(5), uint256(256), bytes32(0), uint256(1), uint256(1), address(1), 0, 0));
        _status(RwaVerify.navFresh(address(bad), SUBJECT, USD), RwaVerify.Status.Fail);
    }
}
