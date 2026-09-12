// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {
    IComplianceEventLog,
    NO_CORRECTION,
    NO_CORRECTED_BY,
    EVT_CORRECTION
} from "../../src/interfaces/IComplianceEventLog.sol";

/// @dev Minimal functional ERC-8328 log (single subject) with real correction-chain semantics, so RwaVerify's
///      decoding is exercised against solc's ABI encoding of the dynamic `ComplianceEvent` struct.
contract MockEventLog is IERC165 {
    IComplianceEventLog.ComplianceEvent[] internal events;

    error NoEvent();
    error OutOfRange();

    function add(bytes32 eventType, bytes32 outcome, uint256 correctsIndex) external returns (uint256 idx) {
        idx = events.length;
        IComplianceEventLog.ComplianceEvent storage e = events.push();
        e.subjectId = keccak256("subject");
        e.eventType = eventType;
        e.outcome = outcome;
        e.actor = msg.sender;
        e.authority = keccak256("ERC-8328:AUTHORITY:INTERNAL_POLICY:V1");
        e.evidenceHash = keccak256(abi.encode("evidence", idx));
        e.evidenceURI = "ipfs://evidence";
        e.payload = hex"c0ffee";
        e.occurredAt = uint64(block.timestamp) - 1;
        e.recordedAt = uint64(block.timestamp);
        e.correctsIndex = correctsIndex;
        e.correctedByIndex = NO_CORRECTED_BY;
        if (correctsIndex != NO_CORRECTION) {
            require(eventType == EVT_CORRECTION, "not a correction");
            events[correctsIndex].correctedByIndex = idx;
        }
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IERC165).interfaceId || id == type(IComplianceEventLog).interfaceId;
    }

    function getEvent(bytes32, uint256 i) external view returns (IComplianceEventLog.ComplianceEvent memory) {
        if (i >= events.length) revert OutOfRange();
        return events[i];
    }

    function currentEventIndex(bytes32, uint256 i) external view returns (uint256) {
        if (i >= events.length) revert OutOfRange();
        while (events[i].correctedByIndex != NO_CORRECTED_BY) {
            i = events[i].correctedByIndex;
        }
        return i;
    }

    function isEventCurrent(bytes32, uint256 i) external view returns (bool) {
        if (i >= events.length) revert OutOfRange();
        return events[i].correctedByIndex == NO_CORRECTED_BY;
    }

    function eventCount(bytes32) external view returns (uint256) {
        return events.length;
    }

    function lastRecordedEventByType(bytes32, bytes32 eventType) external view returns (uint256) {
        for (uint256 i = events.length; i > 0; --i) {
            if (events[i - 1].eventType == eventType) return i - 1;
        }
        revert NoEvent();
    }
}
