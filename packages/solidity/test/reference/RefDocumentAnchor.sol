// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IDocumentBundleAnchor} from "../../src/interfaces/IDocumentBundleAnchor.sol";

/// @dev Minimal spec-conforming ERC-8326 anchor registry (specs/erc-8326.md @ 84b46e7d): records keyed by
///      (bundleHash, subjectId, role), one active bundle per (subjectId, role) slot, supersession keeps the old
///      record. Test fixture only, never deployed. Authorization: deployer only.
contract RefDocumentAnchor is IDocumentBundleAnchor, IERC165 {
    address public immutable owner;
    mapping(bytes32 bundleHash => mapping(bytes32 subjectId => mapping(bytes32 role => AnchorRecord))) internal records;
    mapping(bytes32 subjectId => mapping(bytes32 role => bytes32)) internal active;

    error NotOwner();
    error ZeroField();
    error DuplicateTriple();
    error SlotOccupied();
    error UnknownAnchor();
    error AlreadySuperseded();
    error NotActive();
    error SameBundle();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IERC165).interfaceId || id == type(IDocumentBundleAnchor).interfaceId;
    }

    function anchorBundle(
        bytes32 bundleHash,
        bytes32 subjectId,
        bytes32 role,
        uint256 documentCount,
        string calldata metadataURI
    ) external onlyOwner {
        if (active[subjectId][role] != bytes32(0)) revert SlotOccupied();
        _anchor(bundleHash, subjectId, role, documentCount, metadataURI);
    }

    function supersedeBundle(
        bytes32 oldBundleHash,
        bytes32 newBundleHash,
        bytes32 subjectId,
        bytes32 role,
        uint256 documentCount,
        string calldata metadataURI
    ) external onlyOwner {
        if (oldBundleHash == newBundleHash) revert SameBundle();
        AnchorRecord storage old = records[oldBundleHash][subjectId][role];
        if (old.anchoredAt == 0) revert UnknownAnchor();
        if (old.superseded) revert AlreadySuperseded();
        if (active[subjectId][role] != oldBundleHash) revert NotActive();
        old.superseded = true;
        old.supersededBy = newBundleHash;
        emit BundleSuperseded(oldBundleHash, newBundleHash, subjectId, role);
        _anchor(newBundleHash, subjectId, role, documentCount, metadataURI);
    }

    function getAnchor(bytes32 bundleHash, bytes32 subjectId, bytes32 role)
        external
        view
        returns (AnchorRecord memory)
    {
        AnchorRecord storage r = records[bundleHash][subjectId][role];
        if (r.anchoredAt == 0) revert UnknownAnchor();
        return r;
    }

    function isAnchored(bytes32 bundleHash, bytes32 subjectId, bytes32 role) external view returns (bool) {
        return records[bundleHash][subjectId][role].anchoredAt != 0;
    }

    function activeBundle(bytes32 subjectId, bytes32 role) external view returns (bytes32) {
        return active[subjectId][role];
    }

    function _anchor(
        bytes32 bundleHash,
        bytes32 subjectId,
        bytes32 role,
        uint256 documentCount,
        string calldata metadataURI
    ) internal {
        if (bundleHash == bytes32(0) || subjectId == bytes32(0) || role == bytes32(0) || documentCount == 0) {
            revert ZeroField();
        }
        if (records[bundleHash][subjectId][role].anchoredAt != 0) revert DuplicateTriple();
        records[bundleHash][subjectId][role] = AnchorRecord({
            bundleHash: bundleHash,
            subjectId: subjectId,
            role: role,
            anchoredBy: msg.sender,
            anchoredAt: uint64(block.timestamp),
            documentCount: documentCount,
            metadataURI: metadataURI,
            superseded: false,
            supersededBy: bytes32(0)
        });
        active[subjectId][role] = bundleHash;
        emit BundleAnchored(bundleHash, subjectId, role, documentCount);
    }
}
