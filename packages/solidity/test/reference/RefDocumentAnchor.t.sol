// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IDocumentBundleAnchor, LEGAL_BASIS, EVIDENCE} from "../../src/interfaces/IDocumentBundleAnchor.sol";
import {RefDocumentAnchor} from "./RefDocumentAnchor.sol";

/// @dev Spec behaviour of the ERC-8326 reference fixture: slot semantics and the supersession chain.
contract RefDocumentAnchorTest is Test {
    RefDocumentAnchor internal anchor;

    bytes32 internal constant SUBJECT = keccak256("subject");
    bytes32 internal constant A = keccak256("bundle-a");
    bytes32 internal constant B = keccak256("bundle-b");
    bytes32 internal constant C = keccak256("bundle-c");

    function setUp() public {
        vm.warp(1_800_000_000);
        anchor = new RefDocumentAnchor();
    }

    function _rec(bytes32 h) internal view returns (IDocumentBundleAnchor.AnchorRecord memory) {
        return anchor.getAnchor(h, SUBJECT, LEGAL_BASIS);
    }

    function test_anchor_storesAndEmits() public {
        vm.expectEmit(address(anchor));
        emit IDocumentBundleAnchor.BundleAnchored(A, SUBJECT, LEGAL_BASIS, 3);
        anchor.anchorBundle(A, SUBJECT, LEGAL_BASIS, 3, "ipfs://a");

        IDocumentBundleAnchor.AnchorRecord memory r = _rec(A);
        assertEq(r.bundleHash, A);
        assertEq(r.subjectId, SUBJECT);
        assertEq(r.role, LEGAL_BASIS);
        assertEq(r.anchoredBy, address(this));
        assertEq(r.anchoredAt, uint64(block.timestamp));
        assertEq(r.documentCount, 3);
        assertEq(r.metadataURI, "ipfs://a");
        assertFalse(r.superseded);
        assertEq(r.supersededBy, bytes32(0));

        assertTrue(anchor.isAnchored(A, SUBJECT, LEGAL_BASIS));
        assertFalse(anchor.isAnchored(A, SUBJECT, EVIDENCE), "records are keyed by the full triple");
        assertEq(anchor.activeBundle(SUBJECT, LEGAL_BASIS), A);
        assertEq(anchor.activeBundle(SUBJECT, EVIDENCE), bytes32(0), "never-occupied slot");
        vm.expectRevert(RefDocumentAnchor.UnknownAnchor.selector);
        anchor.getAnchor(A, SUBJECT, EVIDENCE);
        assertTrue(anchor.supportsInterface(type(IDocumentBundleAnchor).interfaceId));
    }

    function test_anchor_rules() public {
        vm.expectRevert(RefDocumentAnchor.ZeroField.selector);
        anchor.anchorBundle(bytes32(0), SUBJECT, LEGAL_BASIS, 1, "");
        vm.expectRevert(RefDocumentAnchor.ZeroField.selector);
        anchor.anchorBundle(A, bytes32(0), LEGAL_BASIS, 1, "");
        vm.expectRevert(RefDocumentAnchor.ZeroField.selector);
        anchor.anchorBundle(A, SUBJECT, bytes32(0), 1, "");
        vm.expectRevert(RefDocumentAnchor.ZeroField.selector);
        anchor.anchorBundle(A, SUBJECT, LEGAL_BASIS, 0, "");
        vm.prank(address(0xCAFE));
        vm.expectRevert(RefDocumentAnchor.NotOwner.selector);
        anchor.anchorBundle(A, SUBJECT, LEGAL_BASIS, 1, "");

        anchor.anchorBundle(A, SUBJECT, LEGAL_BASIS, 1, ""); // empty metadataURI allowed
        vm.expectRevert(RefDocumentAnchor.SlotOccupied.selector);
        anchor.anchorBundle(B, SUBJECT, LEGAL_BASIS, 1, "");
        anchor.anchorBundle(A, SUBJECT, EVIDENCE, 2, ""); // same hash, other slot: independent record
        assertEq(anchor.getAnchor(A, SUBJECT, EVIDENCE).documentCount, 2);
        assertEq(_rec(A).documentCount, 1);
    }

    function test_supersede_chain() public {
        anchor.anchorBundle(A, SUBJECT, LEGAL_BASIS, 3, "ipfs://a");
        vm.warp(block.timestamp + 100);
        vm.expectEmit(address(anchor));
        emit IDocumentBundleAnchor.BundleSuperseded(A, B, SUBJECT, LEGAL_BASIS);
        vm.expectEmit(address(anchor));
        emit IDocumentBundleAnchor.BundleAnchored(B, SUBJECT, LEGAL_BASIS, 4);
        anchor.supersedeBundle(A, B, SUBJECT, LEGAL_BASIS, 4, "ipfs://b");
        anchor.supersedeBundle(B, C, SUBJECT, LEGAL_BASIS, 5, "ipfs://c");

        assertEq(anchor.activeBundle(SUBJECT, LEGAL_BASIS), C);
        IDocumentBundleAnchor.AnchorRecord memory a = _rec(A);
        assertTrue(a.superseded);
        assertEq(a.supersededBy, B);
        assertEq(a.anchoredAt, uint64(block.timestamp) - 100, "other fields unchanged");
        assertEq(a.documentCount, 3);
        assertEq(a.metadataURI, "ipfs://a");
        IDocumentBundleAnchor.AnchorRecord memory b = _rec(B);
        assertTrue(b.superseded);
        assertEq(b.supersededBy, C);
        assertEq(b.anchoredAt, uint64(block.timestamp));
        IDocumentBundleAnchor.AnchorRecord memory c = _rec(C);
        assertFalse(c.superseded);
        assertEq(c.supersededBy, bytes32(0));
        assertEq(c.documentCount, 5);
        assertTrue(anchor.isAnchored(A, SUBJECT, LEGAL_BASIS), "superseded records remain queryable");
        assertTrue(anchor.isAnchored(B, SUBJECT, LEGAL_BASIS) && anchor.isAnchored(C, SUBJECT, LEGAL_BASIS));
    }

    function test_supersede_rules() public {
        vm.expectRevert(RefDocumentAnchor.UnknownAnchor.selector);
        anchor.supersedeBundle(A, B, SUBJECT, LEGAL_BASIS, 1, "");
        anchor.anchorBundle(A, SUBJECT, LEGAL_BASIS, 1, "");
        vm.expectRevert(RefDocumentAnchor.SameBundle.selector);
        anchor.supersedeBundle(A, A, SUBJECT, LEGAL_BASIS, 1, "");
        vm.expectRevert(RefDocumentAnchor.ZeroField.selector);
        anchor.supersedeBundle(A, bytes32(0), SUBJECT, LEGAL_BASIS, 1, "");
        vm.expectRevert(RefDocumentAnchor.ZeroField.selector);
        anchor.supersedeBundle(A, B, SUBJECT, LEGAL_BASIS, 0, "");
        vm.prank(address(0xCAFE));
        vm.expectRevert(RefDocumentAnchor.NotOwner.selector);
        anchor.supersedeBundle(A, B, SUBJECT, LEGAL_BASIS, 1, "");

        anchor.supersedeBundle(A, B, SUBJECT, LEGAL_BASIS, 1, "");
        vm.expectRevert(RefDocumentAnchor.AlreadySuperseded.selector);
        anchor.supersedeBundle(A, C, SUBJECT, LEGAL_BASIS, 1, "");
        vm.expectRevert(RefDocumentAnchor.DuplicateTriple.selector);
        anchor.supersedeBundle(B, A, SUBJECT, LEGAL_BASIS, 1, ""); // a superseded hash cannot be recycled
        assertEq(anchor.activeBundle(SUBJECT, LEGAL_BASIS), B);
    }
}
