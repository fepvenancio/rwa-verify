// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import {
    IAssetAnchorRegistry,
    BINDING_SCOPE_CONTRACT,
    BINDING_SCOPE_TOKEN_ID
} from "./interfaces/IAssetAnchorRegistry.sol";
import {IAssetAnchorRegistryLifecycle} from "./interfaces/IAssetAnchorRegistryLifecycle.sol";
import {IAssetAnchorRegistryRecovery} from "./interfaces/IAssetAnchorRegistryRecovery.sol";
import {IAssetBoundToken} from "./interfaces/IAssetBoundToken.sol";
import {IAssetBoundTokenId} from "./interfaces/IAssetBoundTokenId.sol";
import {IComplianceEventLog} from "./interfaces/IComplianceEventLog.sol";
import {INAVSnapshotOracle} from "./interfaces/INAVSnapshotOracle.sol";
import {IRegistryAnchor} from "./interfaces/IRegistryAnchor.sol";
import {IRegulatedAssetClaimRegistry} from "./interfaces/IRegulatedAssetClaimRegistry.sol";

/// @title RwaVerify
/// @notice Read-only verification helpers for ERC-8325 / 8330 / 8320 / 8328 targets.
/// @dev Never reverts on target misbehaviour: every external read is a raw `staticcall` whose return data is
///      length- and range-checked. A reverting, malformed or non-ERC-165 target yields `Fail` / `Unsupported`.
///      Gas griefing by a target (burning all forwarded gas, huge return data) is not defended here; callers
///      that need a bound should wrap the call with an explicit gas limit.
///      Spec text pinned at ethereum/ERCs @ 84b46e7d69d08dbd8876503e435fd299211c26b8.
///      `Unsupported` and `Unknown` are never equivalent to `Pass` (ADR-004).
///      Raw staticcall, assembly word reads and literal ABI word offsets are the design, not an oversight.
// forge-lint: disable-start(literal-instead-of-constant, low-level-calls, inline-assembly)
library RwaVerify {
    /// @dev Mirrors `CheckStatus` in packages/core: pass | fail | unsupported | stale | unknown.
    enum Status {
        Pass,
        Fail,
        Unsupported,
        Stale,
        Unknown
    }

    struct Binding {
        Status status;
        bool registrySupported; // ERC-165: IAssetAnchorRegistry and IAssetAnchorRegistryLifecycle
        bool recoverySupported; // ERC-165: IAssetAnchorRegistryRecovery (condition 4 evaluated only if true)
        bool tokenSupported; // ERC-165: IAssetBoundToken or IAssetBoundTokenId as selected
        address boundToken; // registry record
        bytes32 bindingScope;
        uint256 boundTokenId;
        bool isBound;
        bool isActive;
        bool isBindingValid; // only meaningful when recoverySupported
        address tokenRegistry; // token side
        bytes32 tokenAnchorId;
    }

    struct Nav {
        Status status;
        bool supported; // ERC-165: INAVSnapshotOracle
        uint64 heartbeat;
        uint64 maxValuationAge;
        int256 nav;
        uint8 decimals;
        bytes32 navBasis;
        uint64 valuationTimestamp;
        uint64 publishedAt;
        address provider;
        bool isPublishStale;
        bool isValuationStale;
    }

    struct Claim {
        Status status;
        bool registrySupported; // ERC-165: IRegulatedAssetClaimRegistry
        bool anchorChecked; // asset supports IRegistryAnchor, so asset-side approval was required
        bool registryApproved; // asset.isRegistryApproved(registry); only meaningful when anchorChecked
        uint256 activeClaimCount;
    }

    struct Event {
        Status status;
        bool supported; // ERC-165: IComplianceEventLog
        uint256 lastIndex; // lastRecordedEventByType
        uint256 currentIndex; // currentEventIndex(lastIndex): terminal of the correction chain
        bool isCurrent; // isEventCurrent(currentIndex)
        bytes32 eventType; // static fields of the terminal event; dynamic fields via getEvent(currentIndex)
        bytes32 outcome;
        address actor;
        bytes32 authority;
        bytes32 evidenceHash;
        uint64 occurredAt;
        uint64 recordedAt;
        uint256 correctsIndex;
    }

    // ---------------------------------------------------------------------------------------------------------
    // ERC-8325
    // ---------------------------------------------------------------------------------------------------------

    /// @notice ERC-8325 "Complete Binding Verification": all six conditions, condition 4 only when the
    ///         registry advertises recovery, conditions 5/6 through the token interface selected by `useTokenId`.
    /// @dev A registry-side binding to a token without the token-side interface is `Fail` (not mutual).
    ///      A registry that does not advertise both mandatory registry interfaces is `Unsupported`.
    // forge-lint: disable-next-item(cyclomatic-complexity) — one branch per spec condition
    function bindingValid(address token, uint256 tokenId, bool useTokenId, address registry, bytes32 anchorId)
        internal
        view
        returns (Binding memory r)
    {
        bytes4[] memory ids = new bytes4[](3);
        ids[0] = type(IAssetAnchorRegistry).interfaceId;
        ids[1] = type(IAssetAnchorRegistryLifecycle).interfaceId;
        ids[2] = type(IAssetAnchorRegistryRecovery).interfaceId;
        bool[] memory has = ERC165Checker.getSupportedInterfaces(registry, ids);
        r.registrySupported = has[0] && has[1];
        r.recoverySupported = has[2];
        r.tokenSupported = ERC165Checker.supportsInterface(
            token, useTokenId ? type(IAssetBoundTokenId).interfaceId : type(IAssetBoundToken).interfaceId
        );
        if (!r.registrySupported) {
            r.status = Status.Unsupported;
            return r;
        }

        bool ok = true;
        bool v;

        // 1. getAnchor returns the expected token, scope and token ID.
        (bool s, bytes memory ret) = _call(registry, abi.encodeCall(IAssetAnchorRegistry.getAnchor, (anchorId)));
        if (s && ret.length >= 8 * 32) {
            (r.boundToken, v) = _addr(ret, 3);
            r.bindingScope = bytes32(_word(ret, 4));
            r.boundTokenId = _word(ret, 5);
            ok = v && r.boundToken == token && r.boundTokenId == (useTokenId ? tokenId : 0)
                && r.bindingScope == (useTokenId ? BINDING_SCOPE_TOKEN_ID : BINDING_SCOPE_CONTRACT);
        } else {
            ok = false;
        }

        // 2. isBound. 3. isActive. 4. isBindingValid, only when recovery is implemented.
        (v, r.isBound) = _bool(registry, abi.encodeCall(IAssetAnchorRegistry.isBound, (anchorId)));
        ok = ok && v && r.isBound;
        (v, r.isActive) = _bool(registry, abi.encodeCall(IAssetAnchorRegistryLifecycle.isActive, (anchorId)));
        ok = ok && v && r.isActive;
        if (r.recoverySupported) {
            (v, r.isBindingValid) =
                _bool(registry, abi.encodeCall(IAssetAnchorRegistryRecovery.isBindingValid, (anchorId)));
            ok = ok && v && r.isBindingValid;
        }

        // 5. token supports the applicable interface. 6. token reports the same registry and anchor.
        ok = ok && r.tokenSupported;
        if (r.tokenSupported) {
            (s, ret) = _call(token, abi.encodeCall(IAssetBoundToken.anchorRegistry, ()));
            if (s && ret.length >= 32) {
                (r.tokenRegistry, v) = _addr(ret, 0);
                ok = ok && v;
            } else {
                ok = false;
            }
            (s, ret) = _call(
                token,
                useTokenId
                    ? abi.encodeCall(IAssetBoundTokenId.anchorIdOf, (tokenId))
                    : abi.encodeCall(IAssetBoundToken.anchorId, ())
            );
            if (s && ret.length >= 32) r.tokenAnchorId = bytes32(_word(ret, 0));
            else ok = false;
            ok = ok && r.tokenRegistry == registry && r.tokenAnchorId == anchorId;
        }

        r.status = ok ? Status.Pass : Status.Fail;
    }

    // ---------------------------------------------------------------------------------------------------------
    // ERC-8330
    // ---------------------------------------------------------------------------------------------------------

    /// @notice Reads `latestNAVStatus` and honours both staleness flags.
    /// @dev Thresholds are read first: either unconfigured (zero) -> `Unknown` with the zero values in evidence.
    ///      `latestNAVStatus` reverting with both thresholds set means no current snapshot -> `Fail`.
    ///      Either staleness flag set -> `Stale`.
    function navFresh(address oracle, bytes32 subjectId, bytes32 currency) internal view returns (Nav memory r) {
        r.supported = ERC165Checker.supportsInterface(oracle, type(INAVSnapshotOracle).interfaceId);
        if (!r.supported) {
            r.status = Status.Unsupported;
            return r;
        }

        bool ok = true;
        bool v;
        (bool s, bytes memory ret) = _call(oracle, abi.encodeCall(INAVSnapshotOracle.heartbeat, (subjectId, currency)));
        if (s && ret.length >= 32) {
            (r.heartbeat, v) = _u64(ret, 0);
            ok = v;
        } else {
            ok = false;
        }
        (s, ret) = _call(oracle, abi.encodeCall(INAVSnapshotOracle.maxValuationAge, (subjectId, currency)));
        if (s && ret.length >= 32) {
            (r.maxValuationAge, v) = _u64(ret, 0);
            ok = ok && v;
        } else {
            ok = false;
        }
        if (!ok) {
            r.status = Status.Fail;
            return r;
        }
        if (r.heartbeat == 0 || r.maxValuationAge == 0) {
            r.status = Status.Unknown;
            return r;
        }

        (s, ret) = _call(oracle, abi.encodeCall(INAVSnapshotOracle.latestNAVStatus, (subjectId, currency)));
        if (!s || ret.length < 8 * 32) {
            r.status = Status.Fail;
            return r;
        }
        // forge-lint: disable-next-line(unsafe-typecast) — bit reinterpretation, no truncation
        r.nav = int256(_word(ret, 0));
        uint256 w = _word(ret, 1);
        ok = w <= type(uint8).max;
        // forge-lint: disable-next-line(unsafe-typecast) — range checked on the line above
        r.decimals = uint8(w);
        r.navBasis = bytes32(_word(ret, 2));
        (r.valuationTimestamp, v) = _u64(ret, 3);
        ok = ok && v;
        (r.publishedAt, v) = _u64(ret, 4);
        ok = ok && v;
        (r.provider, v) = _addr(ret, 5);
        ok = ok && v;
        w = _word(ret, 6);
        ok = ok && w <= 1;
        r.isPublishStale = w == 1;
        w = _word(ret, 7);
        ok = ok && w <= 1;
        r.isValuationStale = w == 1;

        if (!ok) r.status = Status.Fail;
        else if (r.isPublishStale || r.isValuationStale) r.status = Status.Stale;
        else r.status = Status.Pass;
    }

    // ---------------------------------------------------------------------------------------------------------
    // ERC-8320
    // ---------------------------------------------------------------------------------------------------------

    /// @notice `Pass` when `getActiveClaims(assetId, claimType)` is non-empty and, if `asset` implements
    ///         IRegistryAnchor, `asset.isRegistryApproved(registry)` is true.
    /// @dev `getActiveClaims` already filters to ACTIVE within [validFrom, validUntil); only the array length is
    ///      decoded. `anchorChecked == false` means trust is registry-level only (asset has no IRegistryAnchor,
    ///      or `asset == address(0)` for an off-chain asset).
    function hasActiveClaim(address registry, address asset, bytes32 assetId, uint8 claimType)
        internal
        view
        returns (Claim memory r)
    {
        r.registrySupported = ERC165Checker.supportsInterface(registry, type(IRegulatedAssetClaimRegistry).interfaceId);
        if (!r.registrySupported) {
            r.status = Status.Unsupported;
            return r;
        }

        bool ok = true;
        (bool s, bytes memory ret) = _call(
            registry,
            abi.encodeWithSelector(IRegulatedAssetClaimRegistry.getActiveClaims.selector, assetId, uint256(claimType))
        );
        // Dynamic array return: word 0 is the offset of the array, whose first word is its length.
        if (s && ret.length >= 64) {
            uint256 off = _word(ret, 0);
            if (off % 32 == 0 && off <= ret.length - 32) r.activeClaimCount = _word(ret, off / 32);
            else ok = false;
        } else {
            ok = false;
        }

        r.anchorChecked = ERC165Checker.supportsInterface(asset, type(IRegistryAnchor).interfaceId);
        if (r.anchorChecked) {
            bool v;
            (v, r.registryApproved) = _bool(asset, abi.encodeCall(IRegistryAnchor.isRegistryApproved, (registry)));
            ok = ok && v && r.registryApproved;
        }

        r.status = ok && r.activeClaimCount > 0 ? Status.Pass : Status.Fail;
    }

    // ---------------------------------------------------------------------------------------------------------
    // ERC-8328
    // ---------------------------------------------------------------------------------------------------------

    /// @notice Resolves the last recorded event of `eventType` to the terminal event of its correction chain.
    /// @dev `lastRecordedEventByType` reverts when no event of that type exists -> `Fail`. The terminal event may
    ///      be an `EVT_CORRECTION` event; its `eventType` is reported as read. Dynamic fields (parties,
    ///      evidenceURI, payload) are not decoded; read them with `getEvent(subjectId, currentIndex)`.
    function latestCurrentEvent(address log, bytes32 subjectId, bytes32 eventType)
        internal
        view
        returns (Event memory r)
    {
        r.supported = ERC165Checker.supportsInterface(log, type(IComplianceEventLog).interfaceId);
        if (!r.supported) {
            r.status = Status.Unsupported;
            return r;
        }

        (bool s, bytes memory ret) =
            _call(log, abi.encodeCall(IComplianceEventLog.lastRecordedEventByType, (subjectId, eventType)));
        if (!s || ret.length < 32) {
            r.status = Status.Fail;
            return r;
        }
        r.lastIndex = _word(ret, 0);

        (s, ret) = _call(log, abi.encodeCall(IComplianceEventLog.currentEventIndex, (subjectId, r.lastIndex)));
        if (!s || ret.length < 32) {
            r.status = Status.Fail;
            return r;
        }
        r.currentIndex = _word(ret, 0);

        bool ok;
        bool v;
        (ok, r.isCurrent) = _bool(log, abi.encodeCall(IComplianceEventLog.isEventCurrent, (subjectId, r.currentIndex)));
        ok = ok && r.isCurrent;

        // Struct with dynamic members: word 0 is the offset of the tuple; static members sit at fixed slots.
        (s, ret) = _call(log, abi.encodeCall(IComplianceEventLog.getEvent, (subjectId, r.currentIndex)));
        uint256 off = s && ret.length >= 32 ? _word(ret, 0) : 1;
        if (off % 32 == 0 && off <= ret.length && ret.length - off >= 16 * 32) {
            uint256 b = off / 32;
            r.eventType = bytes32(_word(ret, b + 2));
            r.outcome = bytes32(_word(ret, b + 3));
            (r.actor, v) = _addr(ret, b + 4);
            ok = ok && v;
            r.authority = bytes32(_word(ret, b + 5));
            r.evidenceHash = bytes32(_word(ret, b + 7));
            (r.occurredAt, v) = _u64(ret, b + 12);
            ok = ok && v;
            (r.recordedAt, v) = _u64(ret, b + 13);
            ok = ok && v;
            r.correctsIndex = _word(ret, b + 14);
        } else {
            ok = false;
        }

        r.status = ok ? Status.Pass : Status.Fail;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Raw call helpers. Return data is never trusted to be well-formed.
    // ---------------------------------------------------------------------------------------------------------

    function _call(address target, bytes memory data) private view returns (bool ok, bytes memory ret) {
        if (target.code.length == 0) return (ok, ret);
        (ok, ret) = target.staticcall(data);
    }

    /// @dev Strict bool: `valid` only for a successful call returning a word equal to 0 or 1.
    function _bool(address target, bytes memory data) private view returns (bool valid, bool value) {
        (bool s, bytes memory ret) = _call(target, data);
        if (!s || ret.length < 32) return (valid, value);
        uint256 w = _word(ret, 0);
        return (w <= 1, w == 1);
    }

    function _word(bytes memory ret, uint256 i) private pure returns (uint256 w) {
        assembly ("memory-safe") {
            w := mload(add(add(ret, 0x20), mul(i, 0x20)))
        }
    }

    function _addr(bytes memory ret, uint256 i) private pure returns (address, bool valid) {
        uint256 w = _word(ret, i);
        // forge-lint: disable-next-line(unsafe-typecast) — truncation is reported through `valid`
        return (address(uint160(w)), w >> 160 == 0);
    }

    function _u64(bytes memory ret, uint256 i) private pure returns (uint64, bool valid) {
        uint256 w = _word(ret, i);
        // forge-lint: disable-next-line(unsafe-typecast) — truncation is reported through `valid`
        return (uint64(w), w <= type(uint64).max);
    }
}
// forge-lint: disable-end(literal-instead-of-constant, low-level-calls, inline-assembly)
