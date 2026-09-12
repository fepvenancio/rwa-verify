// SPDX-License-Identifier: MIT
// ERC-8326 Canonical Document Bundle Anchor — transcribed from ethereum/ERCs @ 84b46e7d69d08dbd8876503e435fd299211c26b8
pragma solidity ^0.8.20;

struct DocumentEntry {
    bytes32 contentHash;
    bytes32 role;
    bytes32 mimeTypeHash;
    bytes32 filenameHash;
    bytes32 normProfileId;
}

bytes32 constant SCHEMA_V1 = keccak256("ERC-8326:BUNDLE:V1");

bytes32 constant LEGAL_BASIS = keccak256("LEGAL_BASIS");
bytes32 constant EVIDENCE = keccak256("EVIDENCE");
bytes32 constant CERTIFICATION = keccak256("CERTIFICATION");
bytes32 constant AGREEMENT = keccak256("AGREEMENT");
bytes32 constant AMENDMENT = keccak256("AMENDMENT");
bytes32 constant SUPPORTING = keccak256("SUPPORTING");

bytes32 constant PROFILE_RAW = keccak256("NORM:RAW:V1");
bytes32 constant PROFILE_JSON_RFC8785 = keccak256("NORM:JSON:RFC8785:V1");
bytes32 constant PROFILE_XML_C14N11 = keccak256("NORM:XML:C14N11:V1");

interface IDocumentBundleAnchor {
    struct AnchorRecord {
        bytes32 bundleHash;
        bytes32 subjectId;
        bytes32 role;
        address anchoredBy;
        uint64 anchoredAt;
        uint256 documentCount;
        string metadataURI;
        bool superseded;
        bytes32 supersededBy;
    }

    event BundleAnchored(
        bytes32 indexed bundleHash, bytes32 indexed subjectId, bytes32 indexed role, uint256 documentCount
    );

    event BundleSuperseded(
        bytes32 indexed oldBundleHash, bytes32 indexed newBundleHash, bytes32 indexed subjectId, bytes32 role
    );

    function anchorBundle(
        bytes32 bundleHash,
        bytes32 subjectId,
        bytes32 role,
        uint256 documentCount,
        string calldata metadataURI
    ) external;

    function supersedeBundle(
        bytes32 oldBundleHash,
        bytes32 newBundleHash,
        bytes32 subjectId,
        bytes32 role,
        uint256 documentCount,
        string calldata metadataURI
    ) external;

    function getAnchor(bytes32 bundleHash, bytes32 subjectId, bytes32 role) external view returns (AnchorRecord memory);

    function isAnchored(bytes32 bundleHash, bytes32 subjectId, bytes32 role) external view returns (bool);

    function activeBundle(bytes32 subjectId, bytes32 role) external view returns (bytes32);
}
