// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {BINDING_SCOPE_CONTRACT} from "../src/interfaces/IAssetAnchorRegistry.sol";
import {LEGAL_BASIS} from "../src/interfaces/IDocumentBundleAnchor.sol";
import {IComplianceEventLog, NO_CORRECTION, EVT_CORRECTION} from "../src/interfaces/IComplianceEventLog.sol";
import {FixtureToken} from "../test/mocks/FixtureToken.sol";
import {MockAnchorRegistry} from "../test/mocks/MockAnchorRegistry.sol";
import {RefDocumentAnchor} from "../test/reference/RefDocumentAnchor.sol";
import {RefEventLog} from "../test/reference/RefEventLog.sol";
import {RefNavOracle} from "../test/reference/RefNavOracle.sol";

// Vendored ERC-8320 reference implementation (ethereum/ERCs assets/erc-8320, CC0).
import {RegulatedAssetClaimRegistry} from "erc8320-ref/RegulatedAssetClaimRegistry.sol";
import {
    RegulatedAssetClaim,
    ClaimType,
    ClaimState,
    RoleKind
} from "erc8320-ref/interfaces/IRegulatedAssetClaimRegistry.sol";

/// @dev Deploys a conforming full stack with history for `rwa-verify <token>` (packages/readers) and the indexer
///      (packages/indexer) on a local Anvil, and writes the addresses and stream keys to `out/fixture-stack.json`
///      (keys match `RegistryHints` in packages/readers). 8326/8328/8330 are the reference fixtures in
///      test/reference; 8320 is the vendored reference registry. History, relative to the deploy time T:
///
///      ERC-8330 stream (anchorId, USD), one provider (the deployer):
///        #0 original T-4h 1.000000 | #1 corrects 0 1.001000 | #2 corrects 1 1.002000   (correct-of-correct)
///        #3 original T-3h 1.010000 | #4 corrects 3 1.011000, then #4 invalidated -> #3 current again
///        #5 original T-2h 1.020000                                                     (latest NAV)
///        #6 corrects 2 (T-4h) 1.003000   late correction to an older valuation; latest stays #5
///        #7 original T-90m 1.030000, then invalidated -> no current terminal; currentSnapshotIndex(7) reverts
///      ERC-8328 (subject anchorId): #0 KYC_APPROVED, #1 KYC_REVOKED, #2 corrects 0, #3 corrects 2
///      ERC-8326 slot (anchorId, LEGAL_BASIS): keccak("bundle-v1") superseded by keccak("bundle")
///      ERC-8320 (assetId, VALUATION): v1 ACTIVE (no expiry), v2 ACTIVE until T+30min, v3 REVOKED
///
///      FOUNDRY_PROFILE=fixture forge script script/FixtureStack.s.sol --rpc-url <anvil> --broadcast --private-key <k>
contract FixtureStack is Script {
    bytes32 internal constant PROPOSE_TYPEHASH = keccak256(
        "Propose(bytes32 assetId,uint8 claimType,bytes32 schemaId,bytes32 schemaHash,uint64 version,"
        "uint64 validFrom,uint64 validUntil,uint8 claimState,bytes32[] tags,bytes32 contentHash,"
        "address author,string uri,uint256 nonce,uint64 deadline)"
    );
    bytes32 internal constant VALIDATE_TYPEHASH = keccak256(
        "Validate(bytes32 assetId,uint8 claimType,uint64 version,uint8 targetState,uint256 nonce,uint64 deadline)"
    );
    bytes32 internal constant ACTIVATE_TYPEHASH = keccak256(
        "Activate(bytes32 assetId,uint8 claimType,uint64 version,uint8 targetState,uint256 nonce,uint64 deadline)"
    );
    bytes32 internal constant REVOKE_TYPEHASH = keccak256(
        "Revoke(bytes32 assetId,uint8 claimType,uint64 version,uint8 targetState,uint256 nonce,uint64 deadline)"
    );

    bytes32 internal constant LEGAL_HASH = keccak256("legal");
    bytes32 internal constant EVIDENCE_HASH = keccak256("evidence");
    bytes32 internal constant USD = keccak256("ERC-8330:CURRENCY:USD");
    bytes32 internal constant PER_SHARE = keccak256("ERC-8330:NAV_BASIS:PER_SHARE");
    bytes32 internal constant METHOD = keccak256("methodology");
    bytes32 internal constant SUBJECT_TYPE_ASSET = keccak256("ERC-8328:SUBJECT_TYPE:ASSET");
    bytes32 internal constant KYC_APPROVED = keccak256("ERC-8328:EVENT_TYPE:KYC_APPROVED:V1");
    bytes32 internal constant KYC_REVOKED = keccak256("ERC-8328:EVENT_TYPE:KYC_REVOKED:V1");
    bytes32 internal constant APPROVED = keccak256("ERC-8328:OUTCOME:APPROVED");
    bytes32 internal constant EXECUTED = keccak256("ERC-8328:OUTCOME:EXECUTED");
    bytes32 internal constant AUTHORITY = keccak256("ERC-8328:AUTHORITY:INTERNAL_POLICY:V1");
    ClaimType internal constant CLAIM_TYPE = ClaimType.VALUATION;

    // Off-chain signers for the ERC-8320 lifecycle; they never send transactions.
    uint256 internal constant AUTHOR_PK = uint256(keccak256("rwa-verify:author"));
    uint256 internal constant VALIDATOR_PK = uint256(keccak256("rwa-verify:validator"));
    uint256 internal constant ACTIVATOR_PK = uint256(keccak256("rwa-verify:activator"));

    RegulatedAssetClaimRegistry internal claims;
    RefNavOracle internal oracle;
    IComplianceEventLog internal eventLog;
    bytes32 internal assetId;
    bytes32 internal anchorId;
    uint64 internal now_;

    function run() external {
        address deployer = msg.sender;
        anchorId = keccak256(abi.encode(LEGAL_HASH, EVIDENCE_HASH));
        now_ = uint64(block.timestamp);

        vm.startBroadcast();

        // ERC-8325: token bound in the registry; anchor active, binding valid.
        FixtureToken token = new FixtureToken();
        MockAnchorRegistry registry = new MockAnchorRegistry();
        registry.setAnchorId(anchorId);
        registry.setRecord(address(token), BINDING_SCOPE_CONTRACT, 0);
        registry.setFlags(true, true, true);
        token.set(address(registry), anchorId);

        // ERC-8330: configured stream with the correction/invalidation history documented above.
        oracle = new RefNavOracle();
        oracle.setNAVBasis(anchorId, USD, PER_SHARE);
        oracle.setStalenessConfig(anchorId, USD, 1 hours, 1 days);
        _publish(now_ - 4 hours, 1_000_000, NO_CORRECTION); // 0
        _publish(now_ - 4 hours, 1_001_000, 0); // 1
        _publish(now_ - 4 hours, 1_002_000, 1); // 2
        _publish(now_ - 3 hours, 1_010_000, NO_CORRECTION); // 3
        _publish(now_ - 3 hours, 1_011_000, 3); // 4
        oracle.invalidateSnapshot(anchorId, USD, 4, keccak256("fat finger"));
        _publish(now_ - 2 hours, 1_020_000, NO_CORRECTION); // 5
        _publish(now_ - 4 hours, 1_003_000, 2); // 6
        _publish(now_ - 90 minutes, 1_030_000, NO_CORRECTION); // 7
        oracle.invalidateSnapshot(anchorId, USD, 7, keccak256("wrong stream"));

        // ERC-8328: two originals, the first corrected twice.
        eventLog = IComplianceEventLog(address(new RefEventLog()));
        _record(KYC_APPROVED, APPROVED, NO_CORRECTION); // 0
        _record(KYC_REVOKED, EXECUTED, NO_CORRECTION); // 1
        _record(EVT_CORRECTION, EXECUTED, 0); // 2
        _record(EVT_CORRECTION, APPROVED, 2); // 3

        // ERC-8326: the slot's first bundle superseded by the active one.
        RefDocumentAnchor docs = new RefDocumentAnchor();
        docs.anchorBundle(keccak256("bundle-v1"), anchorId, LEGAL_BASIS, 2, "ipfs://bundle-v1");
        docs.supersedeBundle(keccak256("bundle-v1"), keccak256("bundle"), anchorId, LEGAL_BASIS, 3, "ipfs://bundle");

        // ERC-8320: reference registry, asset approves it, three claims driven through the signed lifecycle.
        claims = new RegulatedAssetClaimRegistry(deployer);
        assetId = claims.registerAsset(address(token), 0, block.chainid);
        claims.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.AUTHOR, vm.addr(AUTHOR_PK));
        claims.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.VALIDATOR, vm.addr(VALIDATOR_PK));
        claims.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.ACTIVATOR, vm.addr(ACTIVATOR_PK));
        token.setRegistry(address(claims), true);
        _activate(1, 0); // ACTIVE, no expiry
        _activate(2, now_ + 30 minutes); // ACTIVE, expires after a time warp
        _activate(3, 0);
        _lifecycle(REVOKE_TYPEHASH, 3, ClaimState.REVOKED, VALIDATOR_PK); // REVOKED

        vm.stopBroadcast();

        string memory j = "fixture-stack";
        vm.serializeUint(j, "chainId", block.chainid);
        vm.serializeAddress(j, "token", address(token));
        vm.serializeBytes32(j, "assetId", assetId);
        vm.serializeBytes32(j, "subjectId", anchorId);
        vm.serializeAddress(j, "anchorRegistry", address(registry));
        vm.serializeAddress(j, "claimRegistry", address(claims));
        vm.serializeUint(j, "claimType", uint256(CLAIM_TYPE));
        vm.serializeAddress(j, "documentAnchor", address(docs));
        vm.serializeBytes32(j, "role", LEGAL_BASIS);
        vm.serializeAddress(j, "navOracle", address(oracle));
        vm.serializeBytes32(j, "currency", USD);
        vm.serializeAddress(j, "eventLog", address(eventLog));
        string memory json = vm.serializeBytes32(j, "eventType", KYC_APPROVED);
        vm.writeJson(json, "out/fixture-stack.json");
    }

    function _publish(uint64 valuationTimestamp, int256 nav, uint256 corrects) internal {
        oracle.publishNAV(anchorId, USD, PER_SHARE, nav, 6, valuationTimestamp, METHOD, "ipfs://methodology", corrects);
    }

    function _record(bytes32 eventType, bytes32 outcome, uint256 corrects) internal {
        eventLog.recordEvent(
            anchorId,
            SUBJECT_TYPE_ASSET,
            eventType,
            outcome,
            AUTHORITY,
            new IComplianceEventLog.Party[](0),
            keccak256(abi.encode("evidence", eventLog.eventCount(anchorId))),
            "ipfs://evidence",
            bytes32(0),
            "",
            bytes32(0),
            now_ - 1,
            corrects
        );
    }

    // ---------- ERC-8320 signing (mirrors test/Erc8320Reference.t.sol) ----------

    function _sign(uint256 pk, bytes32 structHash) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", claims.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _activate(uint64 version, uint64 validUntil) internal {
        _propose(version, validUntil);
        _lifecycle(VALIDATE_TYPEHASH, version, ClaimState.VALID, VALIDATOR_PK);
        _lifecycle(ACTIVATE_TYPEHASH, version, ClaimState.ACTIVE, ACTIVATOR_PK);
    }

    function _propose(uint64 version, uint64 validUntil) internal {
        address author = vm.addr(AUTHOR_PK);
        RegulatedAssetClaim memory claim = RegulatedAssetClaim({
            assetId: assetId,
            claimType: CLAIM_TYPE,
            schemaId: keccak256("schema"),
            schemaHash: keccak256("schemaHash"),
            version: version,
            validFrom: now_,
            validUntil: validUntil,
            claimState: ClaimState.PROPOSED,
            tags: new bytes32[](0),
            contentHash: keccak256("content"),
            author: author,
            uri: "ipfs://claim"
        });
        uint256 nonce = claims.nonces(author);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes memory head = abi.encode(
            PROPOSE_TYPEHASH,
            claim.assetId,
            uint8(claim.claimType),
            claim.schemaId,
            claim.schemaHash,
            claim.version,
            claim.validFrom
        );
        bytes memory tail = abi.encode(
            claim.validUntil,
            uint8(claim.claimState),
            keccak256(abi.encodePacked(claim.tags)),
            claim.contentHash,
            claim.author,
            keccak256(bytes(claim.uri)),
            nonce,
            deadline
        );
        claims.proposeClaim(claim, nonce, deadline, _sign(AUTHOR_PK, keccak256(bytes.concat(head, tail))));
    }

    function _lifecycle(bytes32 typehash, uint64 version, ClaimState target, uint256 pk) internal {
        address signer = vm.addr(pk);
        uint256 nonce = claims.nonces(signer);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 structHash =
            keccak256(abi.encode(typehash, assetId, uint8(CLAIM_TYPE), version, uint8(target), nonce, deadline));
        bytes memory sig = _sign(pk, structHash);
        if (typehash == VALIDATE_TYPEHASH) {
            claims.validateClaim(assetId, CLAIM_TYPE, version, signer, nonce, deadline, sig);
        } else if (typehash == ACTIVATE_TYPEHASH) {
            claims.activateClaim(assetId, CLAIM_TYPE, version, signer, nonce, deadline, sig);
        } else {
            claims.revokeClaim(assetId, CLAIM_TYPE, version, signer, nonce, deadline, sig);
        }
    }
}
