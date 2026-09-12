// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BundleHashLib} from "../../src/BundleHashLib.sol";
import {DocumentEntry} from "../../src/interfaces/IDocumentBundleAnchor.sol";

// Differential test: Solidity `computeCanonicalBundleHash` vs the TypeScript canonicaliser CLI
//      (`packages/canon`, WS1). Runs only under `forge test --profile diff` (needs `ffi = true`).
//      Entry sets are written as JSON to `out/` and hashed by
//      `pnpm --filter @rwa-verify/canon exec tsx src/cli.ts hash <file>`.
contract BundleHashDiffTest is Test {
    uint256 internal constant CASES = 6;

    function test_diff_specVector() public {
        DocumentEntry[] memory e = new DocumentEntry[](3);
        e[0] = DocumentEntry(
            0x06750728a91d155294f77f992fec49acabb0470481439ed5e3bb59854df82ec9,
            0xb0e9b5730d97b99270ce15f439eec98a4f9580e1dfbfb8f5c9e0e3ab71d4bca6,
            0xb25570cad408307f58d995c1dadde60bc76e94924d640305a148c9a11f8303bf,
            0x31f491635b16d6fb45a7d770fcbcc8cbb6eae32ac98ab622631f4bc4a8c7e9ce,
            0xbe97b35c60bb0caee86a5a99022973ef2aa47cbf9586dd34065141c6668b430b
        );
        e[1] = DocumentEntry(
            0xb8ffb64722137f4b100665a52e3c943f8066e8ab8ba3b427e6f4b404defd82b0,
            0x566614d5b403a4ea71e1ef1027b77ff1e1a13a54c7f393aa64a1368de23a5f92,
            0x82e6a468c95da6cfe399f69ee0782fd009e354a8030ea5636ea9c7db0edcf7f5,
            0x3b40ecd25f3375868ddf559a0ef47c2dc15863a529ac592bec5e1b618bcbaf3e,
            0x464861b0846e795db3d9c52e9c49870c7e83f2bb07f73764f7e4850151994f40
        );
        e[2] = DocumentEntry(
            0xde64c753c807c4620bf010c7e855bcd38bd389e980c4054b81abd5d44d45eab1,
            0x7477535acdef313b25d16b4871e7023fac62af68d6312bbdbdb96203a4710dc3,
            0x37aaf14a93fea5695fd8577aacfb548c98692a106d439219bfb9b83e3011ea2f,
            0x696b36bf7095c1b1564382a37b8f5ba7d259b36be7639a7a1b50c97cd13cfe39,
            0x72efa7a47196f4ad021a5a3758b19b14d8e09d7b7b211bf4745b35cba62e49c2
        );
        bytes32 ts = _tsHash("spec", e);
        assertEq(ts, 0xbe712c4a5eb51d9eb303f1a5c896417a8407a420936fa210626bb66b1a6d0613, "ts vs spec vector");
        assertEq(BundleHashLib.computeCanonicalBundleHash(e), ts, "sol vs ts");
    }

    /// @dev Deterministic pseudo-random sets: unsorted, with key ties (small alphabet) and exact duplicates.
    function test_diff_randomSets() public {
        for (uint256 c = 0; c < CASES; ++c) {
            uint256 n = 1 + (c * 3) % 9;
            DocumentEntry[] memory e = new DocumentEntry[](n);
            for (uint256 i = 0; i < n; ++i) {
                bytes32 seed = keccak256(abi.encode("rwa-verify-diff", c, i));
                bool narrow = c % 2 == 1;
                e[i] = DocumentEntry(
                    _field(seed, 0, narrow),
                    _field(seed, 1, narrow),
                    _field(seed, 2, narrow),
                    _field(seed, 3, narrow),
                    _field(seed, 4, narrow)
                );
                if (narrow && i > 0 && i % 3 == 0) e[i] = e[i - 1]; // exact duplicate
            }
            bytes32 ts = _tsHash(vm.toString(c), e);
            assertEq(BundleHashLib.computeCanonicalBundleHash(e), ts, string.concat("case ", vm.toString(c)));
        }
    }

    function _field(bytes32 seed, uint256 k, bool narrow) internal pure returns (bytes32) {
        bytes32 v = keccak256(abi.encode(seed, k));
        return narrow ? bytes32(uint256(v) % 3) : v;
    }

    function _tsHash(string memory name, DocumentEntry[] memory e) internal returns (bytes32) {
        string memory json = "[";
        for (uint256 i = 0; i < e.length; ++i) {
            json = string.concat(
                json,
                i == 0 ? "" : ",",
                '{"contentHash":"',
                vm.toString(e[i].contentHash),
                '","role":"',
                vm.toString(e[i].role),
                '","mimeTypeHash":"',
                vm.toString(e[i].mimeTypeHash),
                '","filenameHash":"',
                vm.toString(e[i].filenameHash),
                '","normProfileId":"',
                vm.toString(e[i].normProfileId),
                '"}'
            );
        }
        json = string.concat(json, "]");
        string memory path = string.concat(vm.projectRoot(), "/out/bundle-diff-", name, ".json");
        vm.writeFile(path, json);

        string[] memory cmd = new string[](8);
        cmd[0] = "pnpm";
        cmd[1] = "--filter";
        cmd[2] = "@rwa-verify/canon";
        cmd[3] = "exec";
        cmd[4] = "tsx";
        cmd[5] = "src/cli.ts";
        cmd[6] = "hash";
        cmd[7] = path;
        bytes memory out = vm.ffi(cmd);
        // ffi decodes hex stdout to raw bytes; anything else comes back as the UTF-8 text.
        if (out.length == 32) return bytes32(out);
        return vm.parseBytes32(vm.trim(string(out)));
    }
}
