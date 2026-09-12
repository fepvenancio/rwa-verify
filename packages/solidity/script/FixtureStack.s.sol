// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {BINDING_SCOPE_CONTRACT} from "../src/interfaces/IAssetAnchorRegistry.sol";
import {LEGAL_BASIS} from "../src/interfaces/IDocumentBundleAnchor.sol";
import {NO_CORRECTION} from "../src/interfaces/IComplianceEventLog.sol";
import {FixtureToken} from "../test/mocks/FixtureToken.sol";
import {MockAnchorRegistry} from "../test/mocks/MockAnchorRegistry.sol";
import {MockDocumentAnchor} from "../test/mocks/MockDocumentAnchor.sol";
import {MockEventLog} from "../test/mocks/MockEventLog.sol";
import {MockNavOracle} from "../test/mocks/MockNavOracle.sol";

// Vendored ERC-8320 reference implementation (ethereum/ERCs assets/erc-8320, CC0).
import {RegulatedAssetClaimRegistry} from "erc8320-ref/RegulatedAssetClaimRegistry.sol";
import {
    RegulatedAssetClaim,
    ClaimType,
    ClaimState,
    RoleKind
} from "erc8320-ref/interfaces/IRegulatedAssetClaimRegistry.sol";

/// @dev Deploys a conforming full stack for `rwa-verify <token>` on a local Anvil and writes the addresses and
///      stream keys to `out/fixture-stack.json` (keys match `RegistryHints` in packages/readers).
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

    bytes32 internal constant LEGAL_HASH = keccak256("legal");
    bytes32 internal constant EVIDENCE_HASH = keccak256("evidence");
    bytes32 internal constant USD = keccak256("ERC-8330:CURRENCY:USD");
    bytes32 internal constant KYC_APPROVED = keccak256("ERC-8328:EVENT_TYPE:KYC_APPROVED:V1");
    bytes32 internal constant APPROVED = keccak256("ERC-8328:OUTCOME:APPROVED");
    ClaimType internal constant CLAIM_TYPE = ClaimType.VALUATION;

    // Off-chain signers for the ERC-8320 lifecycle; they never send transactions.
    uint256 internal constant AUTHOR_PK = uint256(keccak256("rwa-verify:author"));
    uint256 internal constant VALIDATOR_PK = uint256(keccak256("rwa-verify:validator"));
    uint256 internal constant ACTIVATOR_PK = uint256(keccak256("rwa-verify:activator"));

    RegulatedAssetClaimRegistry internal claims;
    bytes32 internal assetId;

    function run() external {
        address deployer = msg.sender;
        bytes32 anchorId = keccak256(abi.encode(LEGAL_HASH, EVIDENCE_HASH));
        uint64 now_ = uint64(block.timestamp);

        vm.startBroadcast();

        // ERC-8325: token bound in the registry; anchor active, binding valid.
        FixtureToken token = new FixtureToken();
        MockAnchorRegistry registry = new MockAnchorRegistry();
        registry.setAnchorId(anchorId);
        registry.setRecord(address(token), BINDING_SCOPE_CONTRACT, 0);
        registry.setFlags(true, true, true);
        token.set(address(registry), anchorId);

        // ERC-8330: thresholds configured, fresh current snapshot.
        MockNavOracle oracle = new MockNavOracle();
        oracle.setThresholds(1 hours, 1 days);
        oracle.setSnapshot(1_000_000, 6, now_, now_);

        // ERC-8328: one current event.
        MockEventLog log = new MockEventLog();
        log.add(KYC_APPROVED, APPROVED, NO_CORRECTION);

        // ERC-8326: one active bundle for (anchorId, LEGAL_BASIS).
        MockDocumentAnchor docs = new MockDocumentAnchor();
        docs.anchorBundle(keccak256("bundle"), anchorId, LEGAL_BASIS, 3, "ipfs://bundle");

        // ERC-8320: reference registry, asset approves it, one claim driven PROPOSED -> VALID -> ACTIVE.
        claims = new RegulatedAssetClaimRegistry(deployer);
        assetId = claims.registerAsset(address(token), 0, block.chainid);
        claims.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.AUTHOR, vm.addr(AUTHOR_PK));
        claims.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.VALIDATOR, vm.addr(VALIDATOR_PK));
        claims.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.ACTIVATOR, vm.addr(ACTIVATOR_PK));
        token.setRegistry(address(claims), true);
        _propose(now_);
        _lifecycle(VALIDATE_TYPEHASH, ClaimState.VALID, VALIDATOR_PK);
        _lifecycle(ACTIVATE_TYPEHASH, ClaimState.ACTIVE, ACTIVATOR_PK);

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
        vm.serializeAddress(j, "eventLog", address(log));
        string memory json = vm.serializeBytes32(j, "eventType", KYC_APPROVED);
        vm.writeJson(json, "out/fixture-stack.json");
    }

    // ---------- ERC-8320 signing (mirrors test/Erc8320Reference.t.sol) ----------

    function _sign(uint256 pk, bytes32 structHash) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", claims.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _propose(uint64 validFrom) internal {
        address author = vm.addr(AUTHOR_PK);
        RegulatedAssetClaim memory claim = RegulatedAssetClaim({
            assetId: assetId,
            claimType: CLAIM_TYPE,
            schemaId: keccak256("schema"),
            schemaHash: keccak256("schemaHash"),
            version: 1,
            validFrom: validFrom,
            validUntil: 0,
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

    function _lifecycle(bytes32 typehash, ClaimState target, uint256 pk) internal {
        address signer = vm.addr(pk);
        uint256 nonce = claims.nonces(signer);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 structHash =
            keccak256(abi.encode(typehash, assetId, uint8(CLAIM_TYPE), uint64(1), uint8(target), nonce, deadline));
        bytes memory sig = _sign(pk, structHash);
        if (typehash == VALIDATE_TYPEHASH) {
            claims.validateClaim(assetId, CLAIM_TYPE, 1, signer, nonce, deadline, sig);
        } else {
            claims.activateClaim(assetId, CLAIM_TYPE, 1, signer, nonce, deadline, sig);
        }
    }
}
