// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IDocumentBundleAnchor} from "../../src/interfaces/IDocumentBundleAnchor.sol";

/// @dev Minimal functional ERC-8326 anchor: one active bundle per (subjectId, role), supersession recorded.
contract MockDocumentAnchor is IDocumentBundleAnchor, IERC165 {
    mapping(bytes32 bundleHash => mapping(bytes32 subjectId => mapping(bytes32 role => AnchorRecord))) internal records;
    mapping(bytes32 subjectId => mapping(bytes32 role => bytes32)) public activeBundle;

    function anchorBundle(
        bytes32 bundleHash,
        bytes32 subjectId,
        bytes32 role,
        uint256 documentCount,
        string calldata metadataURI
    ) public {
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
        activeBundle[subjectId][role] = bundleHash;
        emit BundleAnchored(bundleHash, subjectId, role, documentCount);
    }

    function supersedeBundle(
        bytes32 oldBundleHash,
        bytes32 newBundleHash,
        bytes32 subjectId,
        bytes32 role,
        uint256 documentCount,
        string calldata metadataURI
    ) external {
        AnchorRecord storage old = records[oldBundleHash][subjectId][role];
        old.superseded = true;
        old.supersededBy = newBundleHash;
        anchorBundle(newBundleHash, subjectId, role, documentCount, metadataURI);
        emit BundleSuperseded(oldBundleHash, newBundleHash, subjectId, role);
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IERC165).interfaceId || id == type(IDocumentBundleAnchor).interfaceId;
    }

    function getAnchor(bytes32 bundleHash, bytes32 subjectId, bytes32 role)
        external
        view
        returns (AnchorRecord memory)
    {
        return records[bundleHash][subjectId][role];
    }

    function isAnchored(bytes32 bundleHash, bytes32 subjectId, bytes32 role) external view returns (bool) {
        return records[bundleHash][subjectId][role].anchoredAt != 0;
    }
}
