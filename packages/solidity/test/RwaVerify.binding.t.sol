// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RwaVerify} from "../src/RwaVerify.sol";
import {
    IAssetAnchorRegistry,
    BINDING_SCOPE_CONTRACT,
    BINDING_SCOPE_TOKEN_ID
} from "../src/interfaces/IAssetAnchorRegistry.sol";
import {IAssetAnchorRegistryRecovery} from "../src/interfaces/IAssetAnchorRegistryRecovery.sol";
import {MockAnchorRegistry} from "./mocks/MockAnchorRegistry.sol";
import {MockBoundToken} from "./mocks/MockBoundToken.sol";
import {Reverter, Garbage, Plain} from "./mocks/Misbehaving.sol";

contract RwaVerifyBindingTest is Test {
    MockAnchorRegistry internal registry;
    MockBoundToken internal token;
    bytes32 internal constant ANCHOR = keccak256("anchor");
    uint256 internal constant TOKEN_ID = 7;

    function setUp() public {
        registry = new MockAnchorRegistry();
        token = new MockBoundToken();
        registry.setRecord(address(token), BINDING_SCOPE_CONTRACT, 0);
        registry.setFlags(true, true, true);
        token.set(address(registry), ANCHOR);
        token.setTokenAnchor(TOKEN_ID, ANCHOR);
    }

    function _check() internal view returns (RwaVerify.Binding memory) {
        return RwaVerify.bindingValid(address(token), 0, false, address(registry), ANCHOR);
    }

    function _status(RwaVerify.Binding memory r, RwaVerify.Status s) internal pure {
        assertEq(uint256(r.status), uint256(s));
    }

    // ---------- pass ----------

    function test_pass_contractScope() public view {
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Pass);
        assertTrue(r.registrySupported && r.recoverySupported && r.tokenSupported);
        assertEq(r.boundToken, address(token));
        assertEq(r.bindingScope, BINDING_SCOPE_CONTRACT);
        assertEq(r.boundTokenId, 0);
        assertTrue(r.isBound && r.isActive && r.isBindingValid);
        assertEq(r.tokenRegistry, address(registry));
        assertEq(r.tokenAnchorId, ANCHOR);
    }

    function test_pass_tokenIdScope() public {
        registry.setRecord(address(token), BINDING_SCOPE_TOKEN_ID, TOKEN_ID);
        RwaVerify.Binding memory r = RwaVerify.bindingValid(address(token), TOKEN_ID, true, address(registry), ANCHOR);
        _status(r, RwaVerify.Status.Pass);
        assertEq(r.boundTokenId, TOKEN_ID);
        assertEq(r.tokenAnchorId, ANCHOR);
    }

    function test_pass_tokenIdZeroIsNotContractScope() public {
        registry.setRecord(address(token), BINDING_SCOPE_TOKEN_ID, 0);
        token.setTokenAnchor(0, ANCHOR);
        _status(RwaVerify.bindingValid(address(token), 0, true, address(registry), ANCHOR), RwaVerify.Status.Pass);
        // Same record checked as a contract binding must fail on scope (condition 1).
        _status(_check(), RwaVerify.Status.Fail);
    }

    // ---------- condition 1: getAnchor tuple ----------

    function test_fail_1_boundTokenMismatch() public {
        registry.setRecord(address(0xDEAD), BINDING_SCOPE_CONTRACT, 0);
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.boundToken, address(0xDEAD));
        assertTrue(r.isBound && r.isActive, "other evidence still read");
    }

    function test_fail_1_scopeMismatch() public {
        registry.setRecord(address(token), BINDING_SCOPE_TOKEN_ID, 0);
        _status(_check(), RwaVerify.Status.Fail);
    }

    function test_fail_1_tokenIdMismatch() public {
        registry.setRecord(address(token), BINDING_SCOPE_TOKEN_ID, TOKEN_ID + 1);
        _status(
            RwaVerify.bindingValid(address(token), TOKEN_ID, true, address(registry), ANCHOR), RwaVerify.Status.Fail
        );
    }

    function test_fail_1_unknownAnchorReverts() public {
        registry.setRevert(IAssetAnchorRegistry.getAnchor.selector, true);
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.boundToken, address(0));
    }

    // ---------- condition 2 / 3 / 4 ----------

    function test_fail_2_notBound() public {
        registry.setFlags(false, true, true);
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertFalse(r.isBound);
    }

    function test_fail_3_notActive() public {
        registry.setFlags(true, false, true);
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.isBound, "isBound stays true after deactivation");
        assertFalse(r.isActive);
    }

    function test_fail_4_bindingInvalidated() public {
        registry.setFlags(true, true, false);
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.isBound);
        assertFalse(r.isBindingValid);
    }

    function test_pass_4_skippedWithoutRecovery() public {
        registry.setSupport(true, true, false);
        // If the library called isBindingValid blind, this revert would turn the result into Fail.
        registry.setRevert(IAssetAnchorRegistryRecovery.isBindingValid.selector, true);
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Pass);
        assertFalse(r.recoverySupported);
        assertFalse(r.isBindingValid);
    }

    // ---------- condition 5 / 6 ----------

    function test_fail_5_tokenWithoutInterface_isRegistrySideOnly() public {
        token.setSupport(false, true);
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertFalse(r.tokenSupported);
        assertTrue(r.isBound && r.isActive && r.isBindingValid, "registry side in evidence");
        assertEq(r.boundToken, address(token));
        assertEq(r.tokenRegistry, address(0), "token side not read");
    }

    function test_fail_5_plainToken() public {
        Plain plain = new Plain();
        registry.setRecord(address(plain), BINDING_SCOPE_CONTRACT, 0);
        RwaVerify.Binding memory r = RwaVerify.bindingValid(address(plain), 0, false, address(registry), ANCHOR);
        _status(r, RwaVerify.Status.Fail);
        assertFalse(r.tokenSupported);
    }

    function test_fail_5_wrongTokenInterfaceForScope() public {
        // Token only implements the token-ID interface but we check a contract-scope binding.
        token.setSupport(false, true);
        _status(_check(), RwaVerify.Status.Fail);
    }

    function test_fail_6_tokenRegistryMismatch() public {
        token.set(address(0xCAFE), ANCHOR);
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.tokenRegistry, address(0xCAFE));
    }

    function test_fail_6_tokenAnchorMismatch() public {
        token.set(address(registry), keccak256("other"));
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.tokenAnchorId, keccak256("other"));
    }

    function test_fail_6_anchorIdOfRevertsForUnboundTokenId() public {
        registry.setRecord(address(token), BINDING_SCOPE_TOKEN_ID, 99);
        RwaVerify.Binding memory r = RwaVerify.bindingValid(address(token), 99, true, address(registry), ANCHOR);
        _status(r, RwaVerify.Status.Fail);
        assertEq(r.tokenAnchorId, bytes32(0));
    }

    // ---------- unsupported ----------

    function test_unsupported_eoaRegistry() public view {
        RwaVerify.Binding memory r = RwaVerify.bindingValid(address(token), 0, false, address(0xABCD), ANCHOR);
        _status(r, RwaVerify.Status.Unsupported);
        assertFalse(r.registrySupported);
        assertTrue(r.tokenSupported, "token ERC-165 still reported");
    }

    function test_unsupported_plainRegistry() public {
        Plain plain = new Plain();
        _status(RwaVerify.bindingValid(address(token), 0, false, address(plain), ANCHOR), RwaVerify.Status.Unsupported);
    }

    function test_unsupported_registryWithoutLifecycle() public {
        registry.setSupport(true, false, true);
        RwaVerify.Binding memory r = _check();
        _status(r, RwaVerify.Status.Unsupported);
        assertFalse(r.registrySupported);
        assertFalse(r.isBound, "nothing read");
    }

    // ---------- misbehaving targets never revert the caller ----------

    function test_fail_reverterRegistry() public {
        Reverter bad = new Reverter();
        RwaVerify.Binding memory r = RwaVerify.bindingValid(address(token), 0, false, address(bad), ANCHOR);
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.registrySupported && r.recoverySupported);
    }

    function test_fail_reverterToken() public {
        Reverter bad = new Reverter();
        registry.setRecord(address(bad), BINDING_SCOPE_CONTRACT, 0);
        RwaVerify.Binding memory r = RwaVerify.bindingValid(address(bad), 0, false, address(registry), ANCHOR);
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.tokenSupported);
    }

    function test_fail_shortReturnData() public {
        Garbage bad = new Garbage();
        bad.setReturn(hex"01");
        _status(RwaVerify.bindingValid(address(token), 0, false, address(bad), ANCHOR), RwaVerify.Status.Fail);
    }

    function test_fail_nonBooleanWord() public {
        Garbage bad = new Garbage();
        bad.setReturn(abi.encode(uint256(2)));
        _status(RwaVerify.bindingValid(address(token), 0, false, address(bad), ANCHOR), RwaVerify.Status.Fail);
    }

    function test_fail_dirtyAddressBitsInRecord() public {
        Garbage bad = new Garbage();
        // A 256-byte getAnchor answer whose boundToken word has high bits set; every 32-byte read sees word 0.
        bytes memory ret = new bytes(256);
        assembly ("memory-safe") {
            mstore(add(ret, 0x20), 1) // isBound / isActive / isBindingValid read this word as `true`
            mstore(add(ret, 0x80), or(shl(200, 1), address())) // boundToken with dirty high bits
        }
        bad.setReturn(ret);
        RwaVerify.Binding memory r = RwaVerify.bindingValid(address(this), 0, false, address(bad), ANCHOR);
        _status(r, RwaVerify.Status.Fail);
        assertTrue(r.isBound && r.isActive, "sanity: garbage did answer true elsewhere");
    }
}
