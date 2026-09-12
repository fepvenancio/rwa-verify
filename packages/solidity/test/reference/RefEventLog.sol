// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {
    IComplianceEventLog,
    NO_CORRECTION,
    NO_CORRECTED_BY,
    EVT_CORRECTION
} from "../../src/interfaces/IComplianceEventLog.sol";

/// @dev Minimal spec-conforming ERC-8328 log (specs/erc-8328.md @ 84b46e7d): per-subject zero-based indices,
///      per-type indices, single-successor correction chains. Test fixture only, never deployed.
///      Authorization: the deployer approves recorders; a correction is accepted from the target's actor or the
///      deployer (documented correction policy).
///      `recordEvent` is served from `fallback`: its 13 parameters exceed what solc's legacy codegen can ABI-decode
///      into one function frame ("stack too deep") and this repo does not compile via IR. Callers see the spec
///      ABI unchanged (selector, encoding, return value, event); Solidity callers use `IComplianceEventLog(log)`.
contract RefEventLog is IERC165 {
    address public immutable owner;
    mapping(address => bool) public isRecorder;
    mapping(bytes32 => IComplianceEventLog.ComplianceEvent[]) internal events;
    mapping(bytes32 => mapping(bytes32 => uint256[])) internal byType;

    error NotOwner();
    error NotRecorder();
    error FutureOccurredAt();
    error ZeroEvidence();
    error TooManyParties();
    error PayloadTooLarge();
    error OriginalIsCorrectionType();
    error CorrectionWrongType();
    error UnknownEvent();
    error NotTerminal();
    error NotAuthorizedToCorrect();
    error NoEvent();
    error UnknownSelector();

    constructor() {
        owner = msg.sender;
        isRecorder[msg.sender] = true;
    }

    function setRecorder(address recorder, bool allowed) external {
        if (msg.sender != owner) revert NotOwner();
        isRecorder[recorder] = allowed;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IERC165).interfaceId || id == type(IComplianceEventLog).interfaceId;
    }

    fallback(bytes calldata data) external returns (bytes memory) {
        if (bytes4(data[:4]) != IComplianceEventLog.recordEvent.selector) revert UnknownSelector();
        return abi.encode(_record(data[4:]));
    }

    function _record(bytes calldata data) internal returns (uint256 eventIndex) {
        IComplianceEventLog.ComplianceEvent memory e;
        {
            (
                bytes32[5] memory head, // subjectId, subjectType, eventType, outcome, authority
                IComplianceEventLog.Party[] memory parties,
                bytes32 evidenceHash,
                string memory evidenceURI,
                bytes32 payloadProfileId,
                bytes memory payload,
                bytes32 operationRef,
                uint64 occurredAt,
                uint256 correctsIndex
            ) = abi.decode(
                data,
                (bytes32[5], IComplianceEventLog.Party[], bytes32, string, bytes32, bytes, bytes32, uint64, uint256)
            );
            e.subjectId = head[0];
            e.subjectType = head[1];
            e.eventType = head[2];
            e.outcome = head[3];
            e.authority = head[4];
            e.parties = parties;
            e.evidenceHash = evidenceHash;
            e.evidenceURI = evidenceURI;
            e.payloadProfileId = payloadProfileId;
            e.payload = payload;
            e.operationRef = operationRef;
            e.occurredAt = occurredAt;
            e.correctsIndex = correctsIndex;
        }

        if (!isRecorder[msg.sender]) revert NotRecorder();
        if (block.timestamp > type(uint64).max || e.occurredAt > block.timestamp) revert FutureOccurredAt();
        if (e.evidenceHash == bytes32(0)) revert ZeroEvidence();
        if (e.parties.length > 10) revert TooManyParties();
        if (e.payload.length > 2048) revert PayloadTooLarge();

        IComplianceEventLog.ComplianceEvent[] storage log = events[e.subjectId];
        eventIndex = log.length;
        if (e.correctsIndex == NO_CORRECTION) {
            if (e.eventType == EVT_CORRECTION) revert OriginalIsCorrectionType();
        } else {
            if (e.eventType != EVT_CORRECTION) revert CorrectionWrongType();
            if (e.correctsIndex >= eventIndex) revert UnknownEvent();
            IComplianceEventLog.ComplianceEvent storage target = log[e.correctsIndex];
            if (target.correctedByIndex != NO_CORRECTED_BY) revert NotTerminal();
            if (msg.sender != target.actor && msg.sender != owner) revert NotAuthorizedToCorrect();
            target.correctedByIndex = eventIndex;
        }

        // Field-wise copy: memory -> storage copies of structs holding a struct array are unsupported by solc.
        IComplianceEventLog.ComplianceEvent storage s = log.push();
        s.subjectId = e.subjectId;
        s.subjectType = e.subjectType;
        s.eventType = e.eventType;
        s.outcome = e.outcome;
        s.actor = msg.sender;
        s.authority = e.authority;
        for (uint256 i = 0; i < e.parties.length; ++i) {
            s.parties.push(e.parties[i]);
        }
        s.evidenceHash = e.evidenceHash;
        s.evidenceURI = e.evidenceURI;
        s.payloadProfileId = e.payloadProfileId;
        s.payload = e.payload;
        s.operationRef = e.operationRef;
        s.occurredAt = e.occurredAt;
        s.recordedAt = uint64(block.timestamp);
        s.correctsIndex = e.correctsIndex;
        s.correctedByIndex = NO_CORRECTED_BY;
        byType[e.subjectId][e.eventType].push(eventIndex);

        emit IComplianceEventLog.ComplianceEventRecorded(
            e.subjectId, e.eventType, msg.sender, eventIndex, e.outcome, e.authority, e.occurredAt, e.correctsIndex
        );
    }

    function getEvent(bytes32 subjectId, uint256 eventIndex)
        external
        view
        returns (IComplianceEventLog.ComplianceEvent memory)
    {
        if (eventIndex >= events[subjectId].length) revert UnknownEvent();
        return events[subjectId][eventIndex];
    }

    function currentEventIndex(bytes32 subjectId, uint256 eventIndex) external view returns (uint256) {
        IComplianceEventLog.ComplianceEvent[] storage log = events[subjectId];
        if (eventIndex >= log.length) revert UnknownEvent();
        while (log[eventIndex].correctedByIndex != NO_CORRECTED_BY) {
            eventIndex = log[eventIndex].correctedByIndex;
        }
        return eventIndex;
    }

    function isEventCurrent(bytes32 subjectId, uint256 eventIndex) external view returns (bool) {
        if (eventIndex >= events[subjectId].length) revert UnknownEvent();
        return events[subjectId][eventIndex].correctedByIndex == NO_CORRECTED_BY;
    }

    function eventCount(bytes32 subjectId) external view returns (uint256) {
        return events[subjectId].length;
    }

    function eventCountByType(bytes32 subjectId, bytes32 eventType) external view returns (uint256) {
        return byType[subjectId][eventType].length;
    }

    function eventByTypeAt(bytes32 subjectId, bytes32 eventType, uint256 ordinal) external view returns (uint256) {
        uint256[] storage idx = byType[subjectId][eventType];
        if (ordinal >= idx.length) revert UnknownEvent();
        return idx[ordinal];
    }

    function lastRecordedEventByType(bytes32 subjectId, bytes32 eventType) external view returns (uint256) {
        uint256[] storage idx = byType[subjectId][eventType];
        if (idx.length == 0) revert NoEvent();
        return idx[idx.length - 1];
    }
}
