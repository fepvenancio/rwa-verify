// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DocumentEntry, SCHEMA_V1} from "./interfaces/IDocumentBundleAnchor.sol";

/// @title BundleHashLib
/// @notice ERC-8326 bundle hash derivation, implemented from the spec text
///         (ethereum/ERCs @ 84b46e7d69d08dbd8876503e435fd299211c26b8, "Bundle Hash Derivation").
/// @dev Total order: `role`, `filenameHash`, `contentHash`, `mimeTypeHash`, `normProfileId`, each ascending on
///      the raw bytes32 value. Duplicates are retained. Leaf field order differs from the sort key order.
///      Reverting inside the loop is what the spec requires for unsorted input; keccak stays in plain Solidity so
///      the derivation reads exactly like the spec text.
// forge-lint: disable-start(require-revert-in-loop, asm-keccak256)
library BundleHashLib {
    error EmptyBundle();
    error UnsortedEntries(uint256 index);

    /// @notice Hashes an already canonically ordered bundle. Reverts on empty or unsorted input.
    function computeBundleHash(DocumentEntry[] memory entries) internal pure returns (bytes32) {
        uint256 n = entries.length;
        if (n == 0) revert EmptyBundle();
        bytes32[] memory leaves = new bytes32[](n);
        leaves[0] = leaf(entries[0]);
        for (uint256 i = 1; i < n; ++i) {
            if (!lte(entries[i - 1], entries[i])) revert UnsortedEntries(i);
            leaves[i] = leaf(entries[i]);
        }
        return keccak256(abi.encodePacked(SCHEMA_V1, leaves));
    }

    /// @notice Sorts `entries` in place (insertion sort), then hashes. Reverts on empty input.
    function computeCanonicalBundleHash(DocumentEntry[] memory entries) internal pure returns (bytes32) {
        uint256 n = entries.length;
        for (uint256 i = 1; i < n; ++i) {
            DocumentEntry memory key = entries[i];
            uint256 j = i;
            while (j > 0 && !lte(entries[j - 1], key)) {
                entries[j] = entries[j - 1];
                --j;
            }
            entries[j] = key;
        }
        return computeBundleHash(entries);
    }

    function leaf(DocumentEntry memory e) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(e.contentHash, e.role, e.mimeTypeHash, e.filenameHash, e.normProfileId));
    }

    /// @dev `a <= b` under the canonical total order.
    function lte(DocumentEntry memory a, DocumentEntry memory b) internal pure returns (bool) {
        if (a.role != b.role) return a.role < b.role;
        if (a.filenameHash != b.filenameHash) return a.filenameHash < b.filenameHash;
        if (a.contentHash != b.contentHash) return a.contentHash < b.contentHash;
        if (a.mimeTypeHash != b.mimeTypeHash) return a.mimeTypeHash < b.mimeTypeHash;
        return a.normProfileId <= b.normProfileId;
    }
}
// forge-lint: disable-end(require-revert-in-loop, asm-keccak256)
