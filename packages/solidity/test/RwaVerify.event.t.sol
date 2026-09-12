// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RwaVerify} from "../src/RwaVerify.sol";
import {NO_CORRECTION, EVT_CORRECTION} from "../src/interfaces/IComplianceEventLog.sol";
import {MockEventLog} from "./mocks/MockEventLog.sol";
import {Reverter, Garbage, Plain} from "./mocks/Misbehaving.sol";

contract RwaVerifyEventTest is Test {
    MockEventLog internal eventLog;
    bytes32 internal constant SUBJECT = keccak256("subject");
    bytes32 internal constant KYC_APPROVED = keccak256("ERC-8328:EVENT_TYPE:KYC_APPROVED:V1");
    bytes32 internal constant KYC_REVOKED = keccak256("ERC-8328:EVENT_TYPE:KYC_REVOKED:V1");
    bytes32 internal constant APPROVED = keccak256("ERC-8328:OUTCOME:APPROVED");
    bytes32 internal constant EXECUTED = keccak256("ERC-8328:OUTCOME:EXECUTED");

    function setUp() public {
        vm.warp(1_800_000_000);
        eventLog = new MockEventLog();
    }

    function _check(bytes32 eventType) internal view returns (RwaVerify.Event memory) {
        return RwaVerify.latestCurrentEvent(address(eventLog), SUBJECT, eventType);
    }

    function _status(RwaVerify.Event memory r, RwaVerify.Status s) internal pure {
        assertEq(uint256(r.status), uint256(s));
    }

    function test_fail_noEventOfType() public {
        eventLog.add(KYC_REVOKED, EXECUTED, NO_CORRECTION);
        RwaVerify.Event memory r = _check(KYC_APPROVED);
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.supported);
    }

    function test_pass_terminalOriginal() public {
        eventLog.add(KYC_REVOKED, EXECUTED, NO_CORRECTION);
        eventLog.add(KYC_APPROVED, APPROVED, NO_CORRECTION);
        RwaVerify.Event memory r = _check(KYC_APPROVED);
        _status(r, RwaVerify.Status.Pass);
        assertEq(r.lastIndex, 1);
        assertEq(r.currentIndex, 1);
        assertTrue(r.isCurrent);
        assertEq(r.eventType, KYC_APPROVED);
        assertEq(r.outcome, APPROVED);
        assertEq(r.actor, address(this));
        assertEq(r.authority, keccak256("ERC-8328:AUTHORITY:INTERNAL_POLICY:V1"));
        assertEq(r.evidenceHash, keccak256(abi.encode("evidence", uint256(1))));
        assertEq(r.occurredAt, uint64(block.timestamp) - 1);
        assertEq(r.recordedAt, uint64(block.timestamp));
        assertEq(r.correctsIndex, NO_CORRECTION);
    }

    function test_pass_resolvesCorrection() public {
        eventLog.add(KYC_APPROVED, APPROVED, NO_CORRECTION); // 0
        eventLog.add(EVT_CORRECTION, EXECUTED, 0); // 1 corrects 0
        RwaVerify.Event memory r = _check(KYC_APPROVED);
        _status(r, RwaVerify.Status.Pass);
        assertEq(r.lastIndex, 0, "lastRecordedEventByType ignores corrections");
        assertEq(r.currentIndex, 1);
        assertEq(r.eventType, EVT_CORRECTION, "terminal event is the correction");
        assertEq(r.outcome, EXECUTED);
        assertEq(r.correctsIndex, 0);
        assertEq(r.evidenceHash, keccak256(abi.encode("evidence", uint256(1))));
    }

    function test_pass_correctionOfCorrection() public {
        eventLog.add(KYC_APPROVED, APPROVED, NO_CORRECTION); // 0
        eventLog.add(EVT_CORRECTION, EXECUTED, 0); // 1
        eventLog.add(EVT_CORRECTION, APPROVED, 1); // 2
        RwaVerify.Event memory r = _check(KYC_APPROVED);
        _status(r, RwaVerify.Status.Pass);
        assertEq(r.lastIndex, 0);
        assertEq(r.currentIndex, 2);
        assertEq(r.correctsIndex, 1);
        assertEq(r.outcome, APPROVED);
    }

    function test_pass_lastOfTypeIsRecordingOrder() public {
        eventLog.add(KYC_APPROVED, APPROVED, NO_CORRECTION); // 0
        eventLog.add(EVT_CORRECTION, EXECUTED, 0); // 1
        eventLog.add(KYC_APPROVED, APPROVED, NO_CORRECTION); // 2, uncorrected
        RwaVerify.Event memory r = _check(KYC_APPROVED);
        _status(r, RwaVerify.Status.Pass);
        assertEq(r.lastIndex, 2);
        assertEq(r.currentIndex, 2);
        assertEq(r.eventType, KYC_APPROVED);
    }

    function test_unsupported() public {
        Plain plain = new Plain();
        RwaVerify.Event memory r = RwaVerify.latestCurrentEvent(address(plain), SUBJECT, KYC_APPROVED);
        _status(r, RwaVerify.Status.Unsupported);
        assertFalse(r.supported);
        _status(RwaVerify.latestCurrentEvent(address(0xABCD), SUBJECT, KYC_APPROVED), RwaVerify.Status.Unsupported);
    }

    function test_fail_reverter() public {
        Reverter bad = new Reverter();
        RwaVerify.Event memory r = RwaVerify.latestCurrentEvent(address(bad), SUBJECT, KYC_APPROVED);
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.supported);
    }

    function test_fail_garbage() public {
        Garbage bad = new Garbage();
        // lastRecordedEventByType / currentEventIndex read word 0 = 0; isEventCurrent reads 0 => false.
        bad.setReturn(abi.encode(uint256(0)));
        _status(RwaVerify.latestCurrentEvent(address(bad), SUBJECT, KYC_APPROVED), RwaVerify.Status.Fail);
        // isEventCurrent true, but getEvent's tuple is too short for 16 static slots.
        bad.setReturn(abi.encode(uint256(1), uint256(32), uint256(0)));
        _status(RwaVerify.latestCurrentEvent(address(bad), SUBJECT, KYC_APPROVED), RwaVerify.Status.Fail);
    }
}
