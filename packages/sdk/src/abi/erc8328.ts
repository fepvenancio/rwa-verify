import { parseAbi } from "viem";

// ERC-8328 Subject-Linked Compliance Event Log — transcribed from specs/erc-8328.md.

export const complianceEventLogAbi = parseAbi([
  "struct Party { address addr; bytes32 role; }",
  "struct ComplianceEvent { bytes32 subjectId; bytes32 subjectType; bytes32 eventType; bytes32 outcome; address actor; bytes32 authority; Party[] parties; bytes32 evidenceHash; string evidenceURI; bytes32 payloadProfileId; bytes payload; bytes32 operationRef; uint64 occurredAt; uint64 recordedAt; uint256 correctsIndex; uint256 correctedByIndex; }",
  "event ComplianceEventRecorded(bytes32 indexed subjectId, bytes32 indexed eventType, address indexed actor, uint256 eventIndex, bytes32 outcome, bytes32 authority, uint64 occurredAt, uint256 correctsIndex)",
  "function recordEvent(bytes32 subjectId, bytes32 subjectType, bytes32 eventType, bytes32 outcome, bytes32 authority, Party[] parties, bytes32 evidenceHash, string evidenceURI, bytes32 payloadProfileId, bytes payload, bytes32 operationRef, uint64 occurredAt, uint256 correctsIndex) returns (uint256 eventIndex)",
  "function getEvent(bytes32 subjectId, uint256 eventIndex) view returns (ComplianceEvent)",
  "function currentEventIndex(bytes32 subjectId, uint256 eventIndex) view returns (uint256)",
  "function isEventCurrent(bytes32 subjectId, uint256 eventIndex) view returns (bool)",
  "function eventCount(bytes32 subjectId) view returns (uint256)",
  "function eventCountByType(bytes32 subjectId, bytes32 eventType) view returns (uint256)",
  "function eventByTypeAt(bytes32 subjectId, bytes32 eventType, uint256 ordinal) view returns (uint256 eventIndex)",
  "function lastRecordedEventByType(bytes32 subjectId, bytes32 eventType) view returns (uint256 eventIndex)",
]);
