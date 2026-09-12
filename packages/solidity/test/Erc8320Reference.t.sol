// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RwaVerify} from "../src/RwaVerify.sol";
import {IRegulatedAssetClaimRegistry} from "../src/interfaces/IRegulatedAssetClaimRegistry.sol";
import {IRegistryAnchor} from "../src/interfaces/IRegistryAnchor.sol";

// Vendored ERC-8320 reference implementation (ethereum/ERCs assets/erc-8320, CC0). White-box differential target.
import {RegulatedAssetClaimRegistry} from "erc8320-ref/RegulatedAssetClaimRegistry.sol";
import {RegistryAnchor} from "erc8320-ref/RegistryAnchor.sol";
import {
    RegulatedAssetClaim,
    ClaimType,
    ClaimState,
    RoleKind
} from "erc8320-ref/interfaces/IRegulatedAssetClaimRegistry.sol";

/// @dev Runs `hasActiveClaim` against the reference registry through the real signed lifecycle.
contract Erc8320ReferenceTest is Test {
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
    bytes32 internal constant SUSPEND_TYPEHASH = keccak256(
        "Suspend(bytes32 assetId,uint8 claimType,uint64 version,uint8 targetState,uint256 nonce,uint64 deadline)"
    );
    bytes32 internal constant REVOKE_TYPEHASH = keccak256(
        "Revoke(bytes32 assetId,uint8 claimType,uint64 version,uint8 targetState,uint256 nonce,uint64 deadline)"
    );

    RegulatedAssetClaimRegistry internal registry;
    RegistryAnchor internal asset;

    address internal admin = makeAddr("admin");
    address internal owner = makeAddr("owner");
    address internal author;
    uint256 internal authorPk;
    address internal validator;
    uint256 internal validatorPk;
    address internal activator;
    uint256 internal activatorPk;

    ClaimType internal constant CLAIM_TYPE = ClaimType.VALUATION;
    bytes32 internal assetId;

    function setUp() public {
        vm.warp(1_800_000_000);
        (author, authorPk) = makeAddrAndKey("author");
        (validator, validatorPk) = makeAddrAndKey("validator");
        (activator, activatorPk) = makeAddrAndKey("activator");

        registry = new RegulatedAssetClaimRegistry(admin);
        asset = new RegistryAnchor(owner);

        vm.startPrank(admin);
        assetId = registry.registerAsset(address(asset), 0, block.chainid);
        registry.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.AUTHOR, author);
        registry.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.VALIDATOR, validator);
        registry.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.ACTIVATOR, activator);
        vm.stopPrank();

        vm.prank(owner);
        asset.setRegistry(address(registry), true);
    }

    function _check() internal view returns (RwaVerify.Claim memory) {
        return RwaVerify.hasActiveClaim(address(registry), address(asset), assetId, uint8(CLAIM_TYPE));
    }

    function _status(RwaVerify.Claim memory r, RwaVerify.Status s) internal pure {
        assertEq(uint256(r.status), uint256(s));
    }

    // ---------- interface ids agree with our transcriptions ----------

    function test_interfaceIdsMatchReference() public view {
        assertTrue(registry.supportsInterface(type(IRegulatedAssetClaimRegistry).interfaceId));
        assertTrue(asset.supportsInterface(type(IRegistryAnchor).interfaceId));
        assertEq(registry.getAssetId(address(asset), 0, block.chainid), assetId);
    }

    // ---------- lifecycle ----------

    function test_lifecycle_proposeValidateActivate() public {
        RwaVerify.Claim memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.registrySupported && r.anchorChecked && r.registryApproved);
        assertEq(r.activeClaimCount, 0);

        _propose(1, uint64(block.timestamp), 0);
        _status(_check(), RwaVerify.Status.Fail); // PROPOSED
        _validate(1);
        _status(_check(), RwaVerify.Status.Fail); // VALID, not live
        _activate(1);
        r = _check();
        _status(r, RwaVerify.Status.Pass);
        assertEq(r.activeClaimCount, 1);
    }

    function test_lifecycle_multipleActiveVersions() public {
        _propose(1, uint64(block.timestamp), 0);
        _validate(1);
        _activate(1);
        _propose(2, uint64(block.timestamp), 0);
        _validate(2);
        _activate(2);
        assertEq(_check().activeClaimCount, 2);
    }

    function test_lifecycle_suspend() public {
        _propose(1, uint64(block.timestamp), 0);
        _validate(1);
        _activate(1);
        _status(_check(), RwaVerify.Status.Pass);
        _lifecycle(SUSPEND_TYPEHASH, 1, ClaimState.VALID, activator, activatorPk);
        _status(_check(), RwaVerify.Status.Fail);
        _activate(1);
        _status(_check(), RwaVerify.Status.Pass);
    }

    function test_lifecycle_revoke() public {
        _propose(1, uint64(block.timestamp), 0);
        _validate(1);
        _activate(1);
        _status(_check(), RwaVerify.Status.Pass);
        _lifecycle(REVOKE_TYPEHASH, 1, ClaimState.REVOKED, validator, validatorPk);
        RwaVerify.Claim memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.activeClaimCount, 0);
        assertEq(uint256(registry.getClaim(assetId, CLAIM_TYPE, 1).claimState), uint256(ClaimState.REVOKED));
    }

    // ---------- time window: live iff validFrom <= now < validUntil ----------

    function test_expiry_isTimeDerived() public {
        uint64 until = uint64(block.timestamp) + 1 hours;
        _propose(1, uint64(block.timestamp), until);
        _validate(1);
        _activate(1);
        _status(_check(), RwaVerify.Status.Pass);

        vm.warp(until - 1);
        _status(_check(), RwaVerify.Status.Pass);
        vm.warp(until);
        _status(_check(), RwaVerify.Status.Fail);
        // Reference reports derived EXPIRED without any transaction.
        assertEq(uint256(registry.getClaim(assetId, CLAIM_TYPE, 1).claimState), uint256(ClaimState.EXPIRED));
    }

    function test_validFrom_inFuture() public {
        uint64 from = uint64(block.timestamp) + 1 days;
        _propose(1, from, 0);
        _validate(1);
        _activate(1);
        _status(_check(), RwaVerify.Status.Fail);
        vm.warp(from);
        _status(_check(), RwaVerify.Status.Pass);
    }

    // ---------- asset-side approval ----------

    function test_anchor_approvalRevoked() public {
        _propose(1, uint64(block.timestamp), 0);
        _validate(1);
        _activate(1);
        _status(_check(), RwaVerify.Status.Pass);

        vm.prank(owner);
        asset.setRegistry(address(registry), false);
        RwaVerify.Claim memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.anchorChecked);
        assertFalse(r.registryApproved);
        assertEq(r.activeClaimCount, 1, "registry still reports the claim");
    }

    function test_anchor_unapprovedRegistryIsIgnored() public {
        // A second registry holding a live claim for the same asset, not approved by the asset.
        RegulatedAssetClaimRegistry other = new RegulatedAssetClaimRegistry(admin);
        vm.startPrank(admin);
        other.registerAsset(address(asset), 0, block.chainid);
        other.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.AUTHOR, author);
        other.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.VALIDATOR, validator);
        other.grantRoleToClaimType(assetId, CLAIM_TYPE, RoleKind.ACTIVATOR, activator);
        vm.stopPrank();

        RegulatedAssetClaimRegistry saved = registry;
        registry = other;
        _propose(1, uint64(block.timestamp), 0);
        _validate(1);
        _activate(1);
        registry = saved;

        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(other), address(asset), assetId, uint8(CLAIM_TYPE));
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.activeClaimCount, 1);
        assertFalse(r.registryApproved);
    }

    function test_noAnchor_registryLevelTrust() public {
        address plainAsset = makeAddr("plainAsset");
        vm.startPrank(admin);
        bytes32 id = registry.registerAsset(plainAsset, 0, block.chainid);
        registry.grantRoleToClaimType(id, CLAIM_TYPE, RoleKind.AUTHOR, author);
        registry.grantRoleToClaimType(id, CLAIM_TYPE, RoleKind.VALIDATOR, validator);
        registry.grantRoleToClaimType(id, CLAIM_TYPE, RoleKind.ACTIVATOR, activator);
        vm.stopPrank();

        bytes32 saved = assetId;
        assetId = id;
        _propose(1, uint64(block.timestamp), 0);
        _validate(1);
        _activate(1);
        assetId = saved;

        RwaVerify.Claim memory r = RwaVerify.hasActiveClaim(address(registry), plainAsset, id, uint8(CLAIM_TYPE));
        _status(r, RwaVerify.Status.Pass);
        assertFalse(r.anchorChecked);
    }

    function test_otherClaimTypeNotCounted() public {
        _propose(1, uint64(block.timestamp), 0);
        _validate(1);
        _activate(1);
        RwaVerify.Claim memory r =
            RwaVerify.hasActiveClaim(address(registry), address(asset), assetId, uint8(ClaimType.IDENTITY));
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.activeClaimCount, 0);
    }

    // ---------- signing helpers (mirror the reference's own tests) ----------

    function _digest(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", registry.DOMAIN_SEPARATOR(), structHash));
    }

    function _sign(uint256 pk, bytes32 structHash) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, _digest(structHash));
        return abi.encodePacked(r, s, v);
    }

    function _propose(uint64 version, uint64 validFrom, uint64 validUntil) internal {
        RegulatedAssetClaim memory claim = RegulatedAssetClaim({
            assetId: assetId,
            claimType: CLAIM_TYPE,
            schemaId: keccak256("schema"),
            schemaHash: keccak256("schemaHash"),
            version: version,
            validFrom: validFrom,
            validUntil: validUntil,
            claimState: ClaimState.PROPOSED,
            tags: new bytes32[](0),
            contentHash: keccak256("content"),
            author: author,
            uri: "ipfs://claim"
        });
        uint256 nonce = registry.nonces(author);
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
        bytes memory sig = _sign(authorPk, keccak256(bytes.concat(head, tail)));
        registry.proposeClaim(claim, nonce, deadline, sig);
    }

    function _lifecycle(bytes32 typehash, uint64 version, ClaimState target, address signer, uint256 pk) internal {
        uint256 nonce = registry.nonces(signer);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 structHash =
            keccak256(abi.encode(typehash, assetId, uint8(CLAIM_TYPE), version, uint8(target), nonce, deadline));
        bytes memory sig = _sign(pk, structHash);
        if (typehash == VALIDATE_TYPEHASH) {
            registry.validateClaim(assetId, CLAIM_TYPE, version, signer, nonce, deadline, sig);
        } else if (typehash == ACTIVATE_TYPEHASH) {
            registry.activateClaim(assetId, CLAIM_TYPE, version, signer, nonce, deadline, sig);
        } else if (typehash == SUSPEND_TYPEHASH) {
            registry.suspendClaim(assetId, CLAIM_TYPE, version, signer, nonce, deadline, sig);
        } else {
            registry.revokeClaim(assetId, CLAIM_TYPE, version, signer, nonce, deadline, sig);
        }
    }

    function _validate(uint64 version) internal {
        _lifecycle(VALIDATE_TYPEHASH, version, ClaimState.VALID, validator, validatorPk);
    }

    function _activate(uint64 version) internal {
        _lifecycle(ACTIVATE_TYPEHASH, version, ClaimState.ACTIVE, activator, activatorPk);
    }
}
