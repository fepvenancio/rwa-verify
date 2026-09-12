// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BundleHashLib} from "../src/BundleHashLib.sol";
import {
    DocumentEntry,
    SCHEMA_V1,
    AGREEMENT,
    EVIDENCE,
    SUPPORTING,
    PROFILE_RAW,
    PROFILE_JSON_RFC8785,
    PROFILE_XML_C14N11
} from "../src/interfaces/IDocumentBundleAnchor.sol";

contract BundleHashLibHarness {
    function computeBundleHash(DocumentEntry[] memory e) external pure returns (bytes32) {
        return BundleHashLib.computeBundleHash(e);
    }

    function computeCanonicalBundleHash(DocumentEntry[] memory e) external pure returns (bytes32) {
        return BundleHashLib.computeCanonicalBundleHash(e);
    }
}

contract BundleHashLibTest is Test {
    BundleHashLibHarness internal h;

    // ERC-8326 "Normative Test Vectors" (hex values are authoritative).
    DocumentEntry internal jsonEntry = DocumentEntry({
        contentHash: 0xb8ffb64722137f4b100665a52e3c943f8066e8ab8ba3b427e6f4b404defd82b0,
        role: 0x566614d5b403a4ea71e1ef1027b77ff1e1a13a54c7f393aa64a1368de23a5f92,
        mimeTypeHash: 0x82e6a468c95da6cfe399f69ee0782fd009e354a8030ea5636ea9c7db0edcf7f5,
        filenameHash: 0x3b40ecd25f3375868ddf559a0ef47c2dc15863a529ac592bec5e1b618bcbaf3e,
        normProfileId: 0x464861b0846e795db3d9c52e9c49870c7e83f2bb07f73764f7e4850151994f40
    });
    DocumentEntry internal xmlEntry = DocumentEntry({
        contentHash: 0xde64c753c807c4620bf010c7e855bcd38bd389e980c4054b81abd5d44d45eab1,
        role: 0x7477535acdef313b25d16b4871e7023fac62af68d6312bbdbdb96203a4710dc3,
        mimeTypeHash: 0x37aaf14a93fea5695fd8577aacfb548c98692a106d439219bfb9b83e3011ea2f,
        filenameHash: 0x696b36bf7095c1b1564382a37b8f5ba7d259b36be7639a7a1b50c97cd13cfe39,
        normProfileId: 0x72efa7a47196f4ad021a5a3758b19b14d8e09d7b7b211bf4745b35cba62e49c2
    });
    DocumentEntry internal rawEntry = DocumentEntry({
        contentHash: 0x06750728a91d155294f77f992fec49acabb0470481439ed5e3bb59854df82ec9,
        role: 0xb0e9b5730d97b99270ce15f439eec98a4f9580e1dfbfb8f5c9e0e3ab71d4bca6,
        mimeTypeHash: 0xb25570cad408307f58d995c1dadde60bc76e94924d640305a148c9a11f8303bf,
        filenameHash: 0x31f491635b16d6fb45a7d770fcbcc8cbb6eae32ac98ab622631f4bc4a8c7e9ce,
        normProfileId: 0xbe97b35c60bb0caee86a5a99022973ef2aa47cbf9586dd34065141c6668b430b
    });
    bytes32 internal constant SPEC_BUNDLE_HASH = 0xbe712c4a5eb51d9eb303f1a5c896417a8407a420936fa210626bb66b1a6d0613;

    function setUp() public {
        h = new BundleHashLibHarness();
    }

    // ---------- spec constants and vectors ----------

    function test_constantsMatchSpec() public pure {
        assertEq(SCHEMA_V1, 0x1853dddb0c73884633f2ff8e736679ec654a11f704ed868aacca79d8ae4caf67);
        assertEq(AGREEMENT, 0x566614d5b403a4ea71e1ef1027b77ff1e1a13a54c7f393aa64a1368de23a5f92);
        assertEq(EVIDENCE, 0x7477535acdef313b25d16b4871e7023fac62af68d6312bbdbdb96203a4710dc3);
        assertEq(SUPPORTING, 0xb0e9b5730d97b99270ce15f439eec98a4f9580e1dfbfb8f5c9e0e3ab71d4bca6);
        assertEq(PROFILE_JSON_RFC8785, 0x464861b0846e795db3d9c52e9c49870c7e83f2bb07f73764f7e4850151994f40);
        assertEq(PROFILE_XML_C14N11, 0x72efa7a47196f4ad021a5a3758b19b14d8e09d7b7b211bf4745b35cba62e49c2);
        assertEq(PROFILE_RAW, 0xbe97b35c60bb0caee86a5a99022973ef2aa47cbf9586dd34065141c6668b430b);
        assertEq(keccak256("application/json"), 0x82e6a468c95da6cfe399f69ee0782fd009e354a8030ea5636ea9c7db0edcf7f5);
        assertEq(keccak256(unicode"café.json"), 0x3b40ecd25f3375868ddf559a0ef47c2dc15863a529ac592bec5e1b618bcbaf3e);
    }

    function test_leavesMatchSpec() public view {
        assertEq(BundleHashLib.leaf(jsonEntry), 0xe78934e3ee972b7eae660a945de9780c77e5656203bfe437ab117413adf3ad2b);
        assertEq(BundleHashLib.leaf(xmlEntry), 0x8c72daea8a7297c8d307dd41e24038ff71065f9b0932a07e9016942abbc5c9ac);
        assertEq(BundleHashLib.leaf(rawEntry), 0xa418892b0b93cf88e9d840cf38d36f5bfa16813774f22f5cf02d6b4fcc48375a);
    }

    function test_bundleVectorSorted() public view {
        DocumentEntry[] memory e = new DocumentEntry[](3);
        (e[0], e[1], e[2]) = (jsonEntry, xmlEntry, rawEntry);
        assertEq(h.computeBundleHash(e), SPEC_BUNDLE_HASH);
        assertEq(h.computeCanonicalBundleHash(e), SPEC_BUNDLE_HASH);
    }

    function test_bundleVectorUnsorted() public {
        DocumentEntry[] memory e = new DocumentEntry[](3);
        (e[0], e[1], e[2]) = (rawEntry, jsonEntry, xmlEntry);
        assertEq(h.computeCanonicalBundleHash(e), SPEC_BUNDLE_HASH);
        (e[0], e[1], e[2]) = (rawEntry, jsonEntry, xmlEntry);
        vm.expectRevert(abi.encodeWithSelector(BundleHashLib.UnsortedEntries.selector, 1));
        h.computeBundleHash(e);
    }

    // ---------- edge cases ----------

    function test_emptyReverts() public {
        DocumentEntry[] memory e = new DocumentEntry[](0);
        vm.expectRevert(BundleHashLib.EmptyBundle.selector);
        h.computeBundleHash(e);
        vm.expectRevert(BundleHashLib.EmptyBundle.selector);
        h.computeCanonicalBundleHash(e);
    }

    function test_singleEntry() public view {
        DocumentEntry[] memory e = new DocumentEntry[](1);
        e[0] = rawEntry;
        bytes32 expected = keccak256(abi.encodePacked(SCHEMA_V1, BundleHashLib.leaf(rawEntry)));
        assertEq(h.computeBundleHash(e), expected);
        assertEq(h.computeCanonicalBundleHash(e), expected);
    }

    function test_duplicatesRetained() public view {
        DocumentEntry[] memory one = new DocumentEntry[](1);
        one[0] = rawEntry;
        DocumentEntry[] memory two = new DocumentEntry[](2);
        (two[0], two[1]) = (rawEntry, rawEntry);
        bytes32 l = BundleHashLib.leaf(rawEntry);
        assertEq(h.computeBundleHash(two), keccak256(abi.encodePacked(SCHEMA_V1, l, l)));
        assertEq(h.computeCanonicalBundleHash(two), keccak256(abi.encodePacked(SCHEMA_V1, l, l)));
        assertNotEq(h.computeBundleHash(two), h.computeBundleHash(one));
    }

    /// @dev Entries differing only in sort key `k` (0..4 = role, filenameHash, contentHash, mimeTypeHash,
    ///      normProfileId): ascending order is accepted, descending reverts, canonical path is order-independent.
    function test_orderingAtEachKey() public {
        for (uint256 k = 0; k < 5; ++k) {
            DocumentEntry memory lo = _fill(bytes32(uint256(7)));
            DocumentEntry memory hi = _fill(bytes32(uint256(7)));
            _setKey(hi, k, bytes32(uint256(8)));

            DocumentEntry[] memory asc = new DocumentEntry[](2);
            (asc[0], asc[1]) = (lo, hi);
            DocumentEntry[] memory desc = new DocumentEntry[](2);
            (desc[0], desc[1]) = (hi, lo);

            bytes32 expected = h.computeBundleHash(asc);
            assertEq(h.computeCanonicalBundleHash(desc), expected, "canonical(desc)");
            (desc[0], desc[1]) = (hi, lo);
            vm.expectRevert(abi.encodeWithSelector(BundleHashLib.UnsortedEntries.selector, 1));
            h.computeBundleHash(desc);
        }
    }

    /// @dev A higher earlier key wins even if every later key is lower.
    function test_keyPrecedence() public view {
        DocumentEntry memory a = _fill(bytes32(uint256(9)));
        a.role = bytes32(uint256(1));
        DocumentEntry memory b = _fill(bytes32(uint256(1)));
        b.role = bytes32(uint256(2));
        assertTrue(BundleHashLib.lte(a, b));
        assertFalse(BundleHashLib.lte(b, a));
    }

    // ---------- fuzz: permutation invariance ----------

    function testFuzz_permutationInvariant(bytes32[5][] memory raw, uint256 seed) public view {
        vm.assume(raw.length > 0 && raw.length <= 8);
        _checkPermutation(_entries(raw), seed);
    }

    /// @dev Narrow alphabet forces key ties and exact duplicates, exercising the later sort keys.
    function testFuzz_permutationInvariantNarrow(uint8[5][6] memory small, uint256 seed) public view {
        bytes32[5][] memory raw = new bytes32[5][](6);
        for (uint256 i = 0; i < 6; ++i) {
            for (uint256 k = 0; k < 5; ++k) {
                raw[i][k] = bytes32(uint256(small[i][k] % 3));
            }
        }
        _checkPermutation(_entries(raw), seed);
    }

    function _checkPermutation(DocumentEntry[] memory e, uint256 seed) internal view {
        uint256 n = e.length;
        DocumentEntry[] memory shuffled = new DocumentEntry[](n);
        for (uint256 i = 0; i < n; ++i) {
            shuffled[i] = e[i];
        }
        for (uint256 i = n - 1; i > 0; --i) {
            uint256 j = uint256(keccak256(abi.encode(seed, i))) % (i + 1);
            (shuffled[i], shuffled[j]) = (shuffled[j], shuffled[i]);
        }
        bytes32 a = h.computeCanonicalBundleHash(e);
        bytes32 b = h.computeCanonicalBundleHash(shuffled);
        assertEq(a, b, "permutation changed hash");
        // The internal call sorts `shuffled` in place: the strict path must then accept it and agree.
        assertEq(BundleHashLib.computeCanonicalBundleHash(shuffled), a, "internal path disagrees");
        assertEq(h.computeBundleHash(shuffled), a, "strict path disagrees");
        for (uint256 i = 1; i < n; ++i) {
            assertTrue(BundleHashLib.lte(shuffled[i - 1], shuffled[i]), "not sorted after canonical");
        }
    }

    // ---------- helpers ----------

    function _entries(bytes32[5][] memory raw) internal pure returns (DocumentEntry[] memory e) {
        e = new DocumentEntry[](raw.length);
        for (uint256 i = 0; i < raw.length; ++i) {
            e[i] = DocumentEntry(raw[i][0], raw[i][1], raw[i][2], raw[i][3], raw[i][4]);
        }
    }

    function _fill(bytes32 v) internal pure returns (DocumentEntry memory) {
        return DocumentEntry(v, v, v, v, v);
    }

    function _setKey(DocumentEntry memory e, uint256 k, bytes32 v) internal pure {
        if (k == 0) e.role = v;
        else if (k == 1) e.filenameHash = v;
        else if (k == 2) e.contentHash = v;
        else if (k == 3) e.mimeTypeHash = v;
        else e.normProfileId = v;
    }
}
