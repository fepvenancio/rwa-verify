// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RwaVerify} from "../../src/RwaVerify.sol";
import {
    IComplianceEventLog,
    NO_CORRECTION,
    NO_CORRECTED_BY,
    EVT_CORRECTION
} from "../../src/interfaces/IComplianceEventLog.sol";
import {MockEventLog} from "../mocks/MockEventLog.sol";
import {RefEventLog} from "./RefEventLog.sol";

/// @dev Spec behaviour of the ERC-8328 reference fixture, plus a differential: `RwaVerify.latestCurrentEvent`
///      must read the same result from the reference as from `MockEventLog` holding the same events.
contract RefEventLogTest is Test {
    RefEventLog internal ref;
    IComplianceEventLog internal evlog; // recordEvent is served from the reference's fallback
    MockEventLog internal mock;

    bytes32 internal constant SUBJECT = keccak256("subject"); // MockEventLog's fixed subject
    bytes32 internal constant SUBJECT_TYPE = keccak256("ERC-8328:SUBJECT_TYPE:ASSET");
    bytes32 internal constant KYC_APPROVED = keccak256("ERC-8328:EVENT_TYPE:KYC_APPROVED:V1");
    bytes32 internal constant KYC_REVOKED = keccak256("ERC-8328:EVENT_TYPE:KYC_REVOKED:V1");
    bytes32 internal constant APPROVED = keccak256("ERC-8328:OUTCOME:APPROVED");
    bytes32 internal constant EXECUTED = keccak256("ERC-8328:OUTCOME:EXECUTED");
    bytes32 internal constant AUTHORITY = keccak256("ERC-8328:AUTHORITY:INTERNAL_POLICY:V1");
    address internal constant OTHER = address(0xCAFE);

    function setUp() public {
        vm.warp(1_800_000_000);
        ref = new RefEventLog();
        evlog = IComplianceEventLog(address(ref));
        mock = new MockEventLog();
    }

    /// @dev Mirrors `MockEventLog.add` field for field so both logs hold equal events.
    function _record(bytes32 eventType, bytes32 outcome, uint256 corrects) internal returns (uint256) {
        return _recordAt(evlog.eventCount(SUBJECT), eventType, outcome, corrects);
    }

    /// @dev `next` only feeds the evidence hash; callers expecting a revert pass it so no view call precedes.
    function _recordAt(uint256 next, bytes32 eventType, bytes32 outcome, uint256 corrects) internal returns (uint256) {
        return evlog.recordEvent(
            SUBJECT,
            SUBJECT_TYPE,
            eventType,
            outcome,
            AUTHORITY,
            new IComplianceEventLog.Party[](0),
            keccak256(abi.encode("evidence", next)),
            "ipfs://evidence",
            bytes32(0),
            hex"c0ffee",
            bytes32(0),
            uint64(block.timestamp) - 1,
            corrects
        );
    }

    function _both(bytes32 eventType, bytes32 outcome, uint256 corrects) internal {
        _record(eventType, outcome, corrects);
        mock.add(eventType, outcome, corrects);
    }

    function _ev(uint256 i) internal view returns (IComplianceEventLog.ComplianceEvent memory) {
        return evlog.getEvent(SUBJECT, i);
    }

    // ---------- recording ----------

    function test_record_storesAndEmits() public {
        vm.expectEmit(address(ref));
        emit IComplianceEventLog.ComplianceEventRecorded(
            SUBJECT, KYC_APPROVED, address(this), 0, APPROVED, AUTHORITY, uint64(block.timestamp) - 1, NO_CORRECTION
        );
        assertEq(_record(KYC_APPROVED, APPROVED, NO_CORRECTION), 0);
        assertEq(_record(KYC_REVOKED, EXECUTED, NO_CORRECTION), 1, "indices are zero-based per subject");

        IComplianceEventLog.ComplianceEvent memory e = _ev(0);
        assertEq(e.subjectId, SUBJECT);
        assertEq(e.subjectType, SUBJECT_TYPE);
        assertEq(e.eventType, KYC_APPROVED);
        assertEq(e.outcome, APPROVED);
        assertEq(e.actor, address(this));
        assertEq(e.authority, AUTHORITY);
        assertEq(e.parties.length, 0);
        assertEq(e.evidenceHash, keccak256(abi.encode("evidence", uint256(0))));
        assertEq(e.evidenceURI, "ipfs://evidence");
        assertEq(e.payload, hex"c0ffee");
        assertEq(e.occurredAt, uint64(block.timestamp) - 1);
        assertEq(e.recordedAt, uint64(block.timestamp));
        assertEq(e.correctsIndex, NO_CORRECTION);
        assertEq(e.correctedByIndex, NO_CORRECTED_BY);

        assertEq(evlog.eventCount(SUBJECT), 2);
        assertEq(evlog.eventCount(keccak256("other")), 0);
        assertEq(evlog.eventCountByType(SUBJECT, KYC_APPROVED), 1);
        assertEq(evlog.eventByTypeAt(SUBJECT, KYC_REVOKED, 0), 1);
        assertEq(evlog.lastRecordedEventByType(SUBJECT, KYC_APPROVED), 0);
        assertTrue(evlog.isEventCurrent(SUBJECT, 0));
        assertEq(evlog.currentEventIndex(SUBJECT, 1), 1, "terminal event resolves to itself");
        assertTrue(ref.supportsInterface(type(IComplianceEventLog).interfaceId));
    }

    function test_record_withParties() public {
        IComplianceEventLog.Party[] memory parties = new IComplianceEventLog.Party[](2);
        parties[0] = IComplianceEventLog.Party(address(1), keccak256("ERC-8328:PARTY_ROLE:FROM"));
        parties[1] = IComplianceEventLog.Party(address(2), keccak256("ERC-8328:PARTY_ROLE:TO"));
        evlog.recordEvent(
            SUBJECT,
            SUBJECT_TYPE,
            KYC_APPROVED,
            APPROVED,
            AUTHORITY,
            parties,
            keccak256("e"),
            "",
            keccak256("profile"),
            "",
            keccak256("op"),
            uint64(block.timestamp),
            NO_CORRECTION
        );
        IComplianceEventLog.ComplianceEvent memory e = _ev(0);
        assertEq(e.parties.length, 2);
        assertEq(e.parties[1].addr, address(2));
        assertEq(e.parties[1].role, keccak256("ERC-8328:PARTY_ROLE:TO"));
        assertEq(e.payloadProfileId, keccak256("profile"));
        assertEq(e.operationRef, keccak256("op"));
        assertEq(bytes(e.evidenceURI).length, 0, "empty URI allowed with a nonzero commitment");
    }

    // ---------- correction chains ----------

    function test_correctionChain() public {
        _record(KYC_APPROVED, APPROVED, NO_CORRECTION); // 0
        _record(KYC_REVOKED, EXECUTED, NO_CORRECTION); // 1
        _record(EVT_CORRECTION, EXECUTED, 0); // 2 corrects 0
        vm.expectEmit(address(ref));
        emit IComplianceEventLog.ComplianceEventRecorded(
            SUBJECT, EVT_CORRECTION, address(this), 3, APPROVED, AUTHORITY, uint64(block.timestamp) - 1, 2
        );
        _record(EVT_CORRECTION, APPROVED, 2); // 3 corrects 2

        assertEq(_ev(0).correctedByIndex, 2);
        assertEq(_ev(2).correctedByIndex, 3);
        assertEq(_ev(2).correctsIndex, 0);
        assertEq(_ev(3).correctsIndex, 2);
        assertEq(_ev(3).correctedByIndex, NO_CORRECTED_BY);
        assertEq(evlog.currentEventIndex(SUBJECT, 0), 3);
        assertEq(evlog.currentEventIndex(SUBJECT, 2), 3);
        assertEq(evlog.currentEventIndex(SUBJECT, 3), 3);
        assertEq(evlog.currentEventIndex(SUBJECT, 1), 1);
        assertFalse(evlog.isEventCurrent(SUBJECT, 0) || evlog.isEventCurrent(SUBJECT, 2));
        assertTrue(evlog.isEventCurrent(SUBJECT, 1) && evlog.isEventCurrent(SUBJECT, 3));

        // Corrections are indexed under EVT_CORRECTION, not the corrected type; last-of-type is recording order.
        assertEq(evlog.lastRecordedEventByType(SUBJECT, KYC_APPROVED), 0);
        assertEq(evlog.eventCountByType(SUBJECT, KYC_APPROVED), 1);
        assertEq(evlog.eventCountByType(SUBJECT, EVT_CORRECTION), 2);
        assertEq(evlog.eventByTypeAt(SUBJECT, EVT_CORRECTION, 0), 2);
        assertEq(evlog.eventByTypeAt(SUBJECT, EVT_CORRECTION, 1), 3);
        assertEq(evlog.lastRecordedEventByType(SUBJECT, EVT_CORRECTION), 3);
        assertEq(evlog.eventCount(SUBJECT), 4, "append-only");
    }

    function test_rules() public {
        uint64 now_ = uint64(block.timestamp);
        IComplianceEventLog.Party[] memory none = new IComplianceEventLog.Party[](0);

        vm.prank(OTHER);
        vm.expectRevert(RefEventLog.NotRecorder.selector);
        evlog.recordEvent(
            SUBJECT,
            SUBJECT_TYPE,
            KYC_APPROVED,
            APPROVED,
            AUTHORITY,
            none,
            keccak256("e"),
            "",
            0,
            "",
            0,
            now_,
            NO_CORRECTION
        );
        vm.expectRevert(RefEventLog.FutureOccurredAt.selector);
        evlog.recordEvent(
            SUBJECT,
            SUBJECT_TYPE,
            KYC_APPROVED,
            APPROVED,
            AUTHORITY,
            none,
            keccak256("e"),
            "",
            0,
            "",
            0,
            now_ + 1,
            NO_CORRECTION
        );
        vm.expectRevert(RefEventLog.ZeroEvidence.selector);
        evlog.recordEvent(
            SUBJECT,
            SUBJECT_TYPE,
            KYC_APPROVED,
            APPROVED,
            AUTHORITY,
            none,
            bytes32(0),
            "",
            0,
            "",
            0,
            now_,
            NO_CORRECTION
        );
        vm.expectRevert(RefEventLog.TooManyParties.selector);
        evlog.recordEvent(
            SUBJECT,
            SUBJECT_TYPE,
            KYC_APPROVED,
            APPROVED,
            AUTHORITY,
            new IComplianceEventLog.Party[](11),
            keccak256("e"),
            "",
            0,
            "",
            0,
            now_,
            NO_CORRECTION
        );
        vm.expectRevert(RefEventLog.PayloadTooLarge.selector);
        evlog.recordEvent(
            SUBJECT,
            SUBJECT_TYPE,
            KYC_APPROVED,
            APPROVED,
            AUTHORITY,
            none,
            keccak256("e"),
            "",
            0,
            new bytes(2049),
            0,
            now_,
            NO_CORRECTION
        );
        vm.expectRevert(RefEventLog.OriginalIsCorrectionType.selector);
        _recordAt(0, EVT_CORRECTION, APPROVED, NO_CORRECTION);

        _record(KYC_APPROVED, APPROVED, NO_CORRECTION); // 0
        vm.expectRevert(RefEventLog.CorrectionWrongType.selector);
        _recordAt(1, KYC_APPROVED, APPROVED, 0);
        vm.expectRevert(RefEventLog.UnknownEvent.selector);
        _recordAt(1, EVT_CORRECTION, APPROVED, 1);

        // Correction policy: the target's actor or the owner, never another recorder.
        ref.setRecorder(OTHER, true);
        vm.prank(OTHER);
        vm.expectRevert(RefEventLog.NotAuthorizedToCorrect.selector);
        evlog.recordEvent(
            SUBJECT, SUBJECT_TYPE, EVT_CORRECTION, APPROVED, AUTHORITY, none, keccak256("e"), "", 0, "", 0, now_, 0
        );
        vm.prank(OTHER);
        evlog.recordEvent(
            SUBJECT,
            SUBJECT_TYPE,
            KYC_REVOKED,
            EXECUTED,
            AUTHORITY,
            none,
            keccak256("e"),
            "",
            0,
            "",
            0,
            now_,
            NO_CORRECTION
        ); // 1
        _record(EVT_CORRECTION, APPROVED, 1); // 2: owner may correct another actor's event
        assertEq(_ev(1).correctedByIndex, 2);
        vm.expectRevert(RefEventLog.NotTerminal.selector);
        _recordAt(3, EVT_CORRECTION, APPROVED, 1);

        vm.expectRevert(RefEventLog.UnknownEvent.selector);
        evlog.getEvent(SUBJECT, 3);
        vm.expectRevert(RefEventLog.UnknownEvent.selector);
        evlog.currentEventIndex(SUBJECT, 3);
        vm.expectRevert(RefEventLog.UnknownEvent.selector);
        evlog.isEventCurrent(SUBJECT, 3);
        vm.expectRevert(RefEventLog.UnknownEvent.selector);
        evlog.eventByTypeAt(SUBJECT, KYC_APPROVED, 1);
        vm.expectRevert(RefEventLog.NoEvent.selector);
        evlog.lastRecordedEventByType(SUBJECT, keccak256("never"));
        (bool ok, bytes memory ret) = address(ref).call(abi.encodeWithSelector(bytes4(0xdeadbeef)));
        assertFalse(ok);
        assertEq(bytes4(ret), RefEventLog.UnknownSelector.selector);
    }

    // ---------- differential: RwaVerify.latestCurrentEvent on the reference vs the mock with equal events ----------

    function _assertSameAsMock(bytes32 eventType) internal view {
        RwaVerify.Event memory a = RwaVerify.latestCurrentEvent(address(ref), SUBJECT, eventType);
        RwaVerify.Event memory b = RwaVerify.latestCurrentEvent(address(mock), SUBJECT, eventType);
        assertEq(keccak256(abi.encode(a)), keccak256(abi.encode(b)), "latestCurrentEvent(reference) != mock");
    }

    function test_diff_terminalOriginal() public {
        _both(KYC_REVOKED, EXECUTED, NO_CORRECTION);
        _both(KYC_APPROVED, APPROVED, NO_CORRECTION);
        _assertSameAsMock(KYC_APPROVED);
        _assertSameAsMock(KYC_REVOKED);
        RwaVerify.Event memory r = RwaVerify.latestCurrentEvent(address(ref), SUBJECT, KYC_APPROVED);
        assertEq(uint256(r.status), uint256(RwaVerify.Status.Pass));
        assertEq(r.currentIndex, 1);
    }

    function test_diff_correctOfCorrect() public {
        _both(KYC_APPROVED, APPROVED, NO_CORRECTION); // 0
        _both(EVT_CORRECTION, EXECUTED, 0); // 1
        _assertSameAsMock(KYC_APPROVED);
        _both(EVT_CORRECTION, APPROVED, 1); // 2
        _assertSameAsMock(KYC_APPROVED);
        _assertSameAsMock(EVT_CORRECTION);
        RwaVerify.Event memory r = RwaVerify.latestCurrentEvent(address(ref), SUBJECT, KYC_APPROVED);
        assertEq(r.lastIndex, 0);
        assertEq(r.currentIndex, 2);
        assertEq(r.eventType, EVT_CORRECTION);
    }

    function test_diff_lastOfTypeIsRecordingOrder() public {
        _both(KYC_APPROVED, APPROVED, NO_CORRECTION); // 0
        _both(EVT_CORRECTION, EXECUTED, 0); // 1
        _both(KYC_APPROVED, APPROVED, NO_CORRECTION); // 2
        _assertSameAsMock(KYC_APPROVED);
        assertEq(RwaVerify.latestCurrentEvent(address(ref), SUBJECT, KYC_APPROVED).currentIndex, 2);
    }

    function test_diff_noEventOfType() public {
        _both(KYC_REVOKED, EXECUTED, NO_CORRECTION);
        _assertSameAsMock(KYC_APPROVED);
        assertEq(
            uint256(RwaVerify.latestCurrentEvent(address(ref), SUBJECT, KYC_APPROVED).status),
            uint256(RwaVerify.Status.Fail)
        );
    }
}
