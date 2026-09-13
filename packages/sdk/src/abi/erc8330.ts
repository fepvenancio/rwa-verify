import { parseAbi } from "viem";

// ERC-8330 Subject-Linked NAV Snapshot Oracle (core interface) — transcribed from specs/erc-8330.md.

export const navSnapshotOracleAbi = parseAbi([
  "struct NAVSnapshot { bytes32 subjectId; bytes32 currency; bytes32 navBasis; int256 nav; uint8 decimals; uint64 valuationTimestamp; uint64 publishedAt; address provider; bytes32 methodologyHash; string methodologyURI; uint256 correctsIndex; uint256 correctedByIndex; }",
  "event NAVPublished(bytes32 indexed subjectId, bytes32 indexed currency, address indexed provider, uint256 snapshotIndex, int256 nav, uint8 decimals, bytes32 navBasis, uint64 valuationTimestamp, bytes32 methodologyHash, uint256 correctsIndex)",
  "event StalenessConfigUpdated(bytes32 indexed subjectId, bytes32 indexed currency, uint64 heartbeat, uint64 maxValuationAge)",
  "event NAVBasisConfigured(bytes32 indexed subjectId, bytes32 indexed currency, bytes32 navBasis)",
  "event NAVSnapshotInvalidated(bytes32 indexed subjectId, bytes32 indexed currency, address indexed provider, uint256 snapshotIndex, address invalidatedBy, bytes32 reasonHash)",
  "function publishNAV(bytes32 subjectId, bytes32 currency, bytes32 navBasis, int256 nav, uint8 decimals, uint64 valuationTimestamp, bytes32 methodologyHash, string methodologyURI, uint256 correctsIndex) returns (uint256 snapshotIndex)",
  "function setNAVBasis(bytes32 subjectId, bytes32 currency, bytes32 navBasis)",
  "function invalidateSnapshot(bytes32 subjectId, bytes32 currency, uint256 snapshotIndex, bytes32 reasonHash)",
  "function isSnapshotInvalidated(bytes32 subjectId, bytes32 currency, uint256 snapshotIndex) view returns (bool)",
  "function setStalenessConfig(bytes32 subjectId, bytes32 currency, uint64 heartbeat, uint64 maxValuationAge)",
  "function streamNAVBasis(bytes32 subjectId, bytes32 currency) view returns (bytes32 navBasis)",
  "function latestNAV(bytes32 subjectId, bytes32 currency) view returns (int256 nav, uint8 decimals, bytes32 navBasis, uint64 valuationTimestamp, uint64 publishedAt, address provider)",
  "function latestNAVStatus(bytes32 subjectId, bytes32 currency) view returns (int256 nav, uint8 decimals, bytes32 navBasis, uint64 valuationTimestamp, uint64 publishedAt, address provider, bool isPublishStale, bool isValuationStale)",
  "function getSnapshot(bytes32 subjectId, bytes32 currency, uint256 snapshotIndex) view returns (NAVSnapshot)",
  "function currentSnapshotIndex(bytes32 subjectId, bytes32 currency, uint256 snapshotIndex) view returns (uint256)",
  "function isSnapshotCurrent(bytes32 subjectId, bytes32 currency, uint256 snapshotIndex) view returns (bool)",
  "function snapshotCount(bytes32 subjectId, bytes32 currency) view returns (uint256)",
  "function latestNAVByProvider(bytes32 subjectId, bytes32 currency, address provider) view returns (NAVSnapshot)",
  "function providerSnapshotCount(bytes32 subjectId, bytes32 currency, address provider) view returns (uint256)",
  "function providerSnapshotAt(bytes32 subjectId, bytes32 currency, address provider, uint256 ordinal) view returns (uint256 snapshotIndex)",
  "function heartbeat(bytes32 subjectId, bytes32 currency) view returns (uint64)",
  "function maxValuationAge(bytes32 subjectId, bytes32 currency) view returns (uint64)",
]);
