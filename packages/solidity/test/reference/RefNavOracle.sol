// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {INAVSnapshotOracle} from "../../src/interfaces/INAVSnapshotOracle.sol";

/// @dev Minimal spec-conforming ERC-8330 core oracle (specs/erc-8330.md @ 84b46e7d): correction chains,
///      invalidation, provider/timestamp slots and the latest-NAV ordering. Test fixture only, never deployed.
///      Authorization: the deployer configures streams, approves providers and invalidates; approved providers
///      publish. All history is kept in one array per stream and scanned linearly; fine for fixtures.
contract RefNavOracle is INAVSnapshotOracle, IERC165 {
    uint256 public constant NO_CORRECTION = type(uint256).max;
    uint256 public constant NO_CORRECTED_BY = 0;
    bytes32 public constant PER_UNIT = keccak256("ERC-8330:NAV_BASIS:PER_UNIT");
    bytes32 public constant PER_SHARE = keccak256("ERC-8330:NAV_BASIS:PER_SHARE");
    bytes32 public constant TOTAL = keccak256("ERC-8330:NAV_BASIS:TOTAL");

    struct Stream {
        NAVSnapshot[] snapshots;
        mapping(uint256 => bool) invalidated;
        mapping(address => uint256[]) byProvider;
        // provider => valuationTimestamp => (current snapshot index + 1); 0 = slot free
        mapping(address => mapping(uint64 => uint256)) slot;
        bytes32 navBasis;
        uint64 heartbeat;
        uint64 maxValuationAge;
    }

    address public immutable owner;
    mapping(address => bool) public isProvider;
    mapping(bytes32 => Stream) internal streams;

    error NotOwner();
    error NotProvider();
    error InvalidBasis();
    error BasisAlreadyConfigured();
    error StreamNotEmpty();
    error BasisMismatch();
    error FutureValuation();
    error ZeroMethodology();
    error SlotOccupied();
    error UnknownSnapshot();
    error NotTerminal();
    error AlreadyInvalidated();
    error WrongProvider();
    error TargetMismatch();
    error NotCurrentForTimestamp();
    error ZeroReason();
    error NoCurrentSnapshot();
    error Unconfigured();
    error OutOfRange();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        isProvider[msg.sender] = true;
    }

    function setProvider(address provider, bool allowed) external onlyOwner {
        isProvider[provider] = allowed;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IERC165).interfaceId || id == type(INAVSnapshotOracle).interfaceId;
    }

    // ---------------------------------------------------------------- configuration

    function setNAVBasis(bytes32 subjectId, bytes32 currency, bytes32 navBasis) external onlyOwner {
        if (navBasis != PER_UNIT && navBasis != PER_SHARE && navBasis != TOTAL) revert InvalidBasis();
        Stream storage s = _stream(subjectId, currency);
        if (s.snapshots.length != 0) revert StreamNotEmpty();
        if (s.navBasis != bytes32(0)) revert BasisAlreadyConfigured();
        s.navBasis = navBasis;
        emit NAVBasisConfigured(subjectId, currency, navBasis);
    }

    function setStalenessConfig(bytes32 subjectId, bytes32 currency, uint64 heartbeat_, uint64 maxValuationAge_)
        external
        onlyOwner
    {
        Stream storage s = _stream(subjectId, currency);
        s.heartbeat = heartbeat_;
        s.maxValuationAge = maxValuationAge_;
        emit StalenessConfigUpdated(subjectId, currency, heartbeat_, maxValuationAge_);
    }

    // ---------------------------------------------------------------- publication

    function publishNAV(
        bytes32 subjectId,
        bytes32 currency,
        bytes32 navBasis,
        int256 nav,
        uint8 decimals,
        uint64 valuationTimestamp,
        bytes32 methodologyHash,
        string calldata methodologyURI,
        uint256 correctsIndex
    ) external returns (uint256 snapshotIndex) {
        if (!isProvider[msg.sender]) revert NotProvider();
        Stream storage s = _stream(subjectId, currency);
        if (s.navBasis == bytes32(0) || navBasis != s.navBasis) revert BasisMismatch();
        if (block.timestamp > type(uint64).max) revert FutureValuation();
        if (valuationTimestamp > block.timestamp) revert FutureValuation();
        if (methodologyHash == bytes32(0)) revert ZeroMethodology();

        snapshotIndex = s.snapshots.length;
        if (correctsIndex == NO_CORRECTION) {
            if (s.slot[msg.sender][valuationTimestamp] != 0) revert SlotOccupied();
        } else {
            if (correctsIndex >= snapshotIndex) revert UnknownSnapshot();
            NAVSnapshot storage target = s.snapshots[correctsIndex];
            if (target.correctedByIndex != NO_CORRECTED_BY) revert NotTerminal();
            if (s.invalidated[correctsIndex]) revert AlreadyInvalidated();
            if (target.provider != msg.sender) revert WrongProvider();
            if (target.valuationTimestamp != valuationTimestamp || target.navBasis != navBasis) {
                revert TargetMismatch();
            }
            if (s.slot[msg.sender][valuationTimestamp] != correctsIndex + 1) revert NotCurrentForTimestamp();
            target.correctedByIndex = snapshotIndex;
        }

        s.snapshots
            .push(
                NAVSnapshot({
                    subjectId: subjectId,
                    currency: currency,
                    navBasis: navBasis,
                    nav: nav,
                    decimals: decimals,
                    valuationTimestamp: valuationTimestamp,
                    publishedAt: uint64(block.timestamp),
                    provider: msg.sender,
                    methodologyHash: methodologyHash,
                    methodologyURI: methodologyURI,
                    correctsIndex: correctsIndex,
                    correctedByIndex: NO_CORRECTED_BY
                })
            );
        s.byProvider[msg.sender].push(snapshotIndex);
        s.slot[msg.sender][valuationTimestamp] = snapshotIndex + 1;

        _emitPublished(s.snapshots[snapshotIndex], snapshotIndex);
    }

    /// @dev Emitted from storage: the 10 event arguments on top of publishNAV's frame exceed the stack reach.
    function _emitPublished(NAVSnapshot storage snap, uint256 snapshotIndex) internal {
        emit NAVPublished(
            snap.subjectId,
            snap.currency,
            snap.provider,
            snapshotIndex,
            snap.nav,
            snap.decimals,
            snap.navBasis,
            snap.valuationTimestamp,
            snap.methodologyHash,
            snap.correctsIndex
        );
    }

    function invalidateSnapshot(bytes32 subjectId, bytes32 currency, uint256 snapshotIndex, bytes32 reasonHash)
        external
        onlyOwner
    {
        if (reasonHash == bytes32(0)) revert ZeroReason();
        Stream storage s = _stream(subjectId, currency);
        if (snapshotIndex >= s.snapshots.length) revert UnknownSnapshot();
        NAVSnapshot storage snap = s.snapshots[snapshotIndex];
        if (snap.correctedByIndex != NO_CORRECTED_BY) revert NotTerminal();
        if (s.invalidated[snapshotIndex]) revert AlreadyInvalidated();

        s.invalidated[snapshotIndex] = true;
        if (snap.correctsIndex == NO_CORRECTION) {
            // Original: the provider/timestamp slot becomes available for a replacement original.
            delete s.slot[snap.provider][snap.valuationTimestamp];
        } else {
            // Correction: the direct predecessor becomes terminal again and owns the slot.
            s.snapshots[snap.correctsIndex].correctedByIndex = NO_CORRECTED_BY;
            s.slot[snap.provider][snap.valuationTimestamp] = snap.correctsIndex + 1;
        }
        emit NAVSnapshotInvalidated(subjectId, currency, snap.provider, snapshotIndex, msg.sender, reasonHash);
    }

    // ---------------------------------------------------------------- queries

    function streamNAVBasis(bytes32 subjectId, bytes32 currency) external view returns (bytes32) {
        return _stream(subjectId, currency).navBasis;
    }

    function heartbeat(bytes32 subjectId, bytes32 currency) external view returns (uint64) {
        return _stream(subjectId, currency).heartbeat;
    }

    function maxValuationAge(bytes32 subjectId, bytes32 currency) external view returns (uint64) {
        return _stream(subjectId, currency).maxValuationAge;
    }

    function isSnapshotInvalidated(bytes32 subjectId, bytes32 currency, uint256 snapshotIndex)
        external
        view
        returns (bool)
    {
        Stream storage s = _stream(subjectId, currency);
        if (snapshotIndex >= s.snapshots.length) revert UnknownSnapshot();
        return s.invalidated[snapshotIndex];
    }

    function latestNAV(bytes32 subjectId, bytes32 currency)
        external
        view
        returns (int256, uint8, bytes32, uint64, uint64, address)
    {
        Stream storage s = _stream(subjectId, currency);
        NAVSnapshot storage snap = s.snapshots[_latest(s, address(0))];
        return (snap.nav, snap.decimals, snap.navBasis, snap.valuationTimestamp, snap.publishedAt, snap.provider);
    }

    function latestNAVStatus(bytes32 subjectId, bytes32 currency)
        external
        view
        returns (int256, uint8, bytes32, uint64, uint64, address, bool isPublishStale, bool isValuationStale)
    {
        Stream storage s = _stream(subjectId, currency);
        if (s.heartbeat == 0 || s.maxValuationAge == 0) revert Unconfigured();
        NAVSnapshot storage snap = s.snapshots[_latest(s, address(0))];
        isPublishStale = block.timestamp > uint256(snap.publishedAt) + s.heartbeat;
        isValuationStale = block.timestamp > uint256(snap.valuationTimestamp) + s.maxValuationAge;
        return (
            snap.nav,
            snap.decimals,
            snap.navBasis,
            snap.valuationTimestamp,
            snap.publishedAt,
            snap.provider,
            isPublishStale,
            isValuationStale
        );
    }

    function getSnapshot(bytes32 subjectId, bytes32 currency, uint256 snapshotIndex)
        external
        view
        returns (NAVSnapshot memory)
    {
        Stream storage s = _stream(subjectId, currency);
        if (snapshotIndex >= s.snapshots.length) revert UnknownSnapshot();
        return s.snapshots[snapshotIndex];
    }

    function currentSnapshotIndex(bytes32 subjectId, bytes32 currency, uint256 snapshotIndex)
        external
        view
        returns (uint256)
    {
        Stream storage s = _stream(subjectId, currency);
        if (snapshotIndex >= s.snapshots.length) revert UnknownSnapshot();
        while (s.snapshots[snapshotIndex].correctedByIndex != NO_CORRECTED_BY) {
            snapshotIndex = s.snapshots[snapshotIndex].correctedByIndex;
        }
        if (s.invalidated[snapshotIndex]) revert NoCurrentSnapshot();
        return snapshotIndex;
    }

    function isSnapshotCurrent(bytes32 subjectId, bytes32 currency, uint256 snapshotIndex)
        external
        view
        returns (bool)
    {
        Stream storage s = _stream(subjectId, currency);
        if (snapshotIndex >= s.snapshots.length) revert UnknownSnapshot();
        return s.snapshots[snapshotIndex].correctedByIndex == NO_CORRECTED_BY && !s.invalidated[snapshotIndex];
    }

    function snapshotCount(bytes32 subjectId, bytes32 currency) external view returns (uint256) {
        return _stream(subjectId, currency).snapshots.length;
    }

    function latestNAVByProvider(bytes32 subjectId, bytes32 currency, address provider)
        external
        view
        returns (NAVSnapshot memory)
    {
        Stream storage s = _stream(subjectId, currency);
        return s.snapshots[_latest(s, provider)];
    }

    function providerSnapshotCount(bytes32 subjectId, bytes32 currency, address provider)
        external
        view
        returns (uint256)
    {
        return _stream(subjectId, currency).byProvider[provider].length;
    }

    function providerSnapshotAt(bytes32 subjectId, bytes32 currency, address provider, uint256 ordinal)
        external
        view
        returns (uint256)
    {
        uint256[] storage history = _stream(subjectId, currency).byProvider[provider];
        if (ordinal >= history.length) revert OutOfRange();
        return history[ordinal];
    }

    // ---------------------------------------------------------------- internals

    function _stream(bytes32 subjectId, bytes32 currency) internal view returns (Stream storage) {
        return streams[keccak256(abi.encode(subjectId, currency))];
    }

    /// @dev Latest current snapshot: greatest valuationTimestamp, then most recently published, then greater
    ///      index. `provider == address(0)` means any provider. Reverts when no current snapshot exists.
    function _latest(Stream storage s, address provider) internal view returns (uint256 best) {
        bool found;
        uint256 n = s.snapshots.length;
        for (uint256 i = 0; i < n; ++i) {
            NAVSnapshot storage c = s.snapshots[i];
            if (c.correctedByIndex != NO_CORRECTED_BY || s.invalidated[i]) continue;
            if (provider != address(0) && c.provider != provider) continue;
            if (!found) {
                (found, best) = (true, i);
                continue;
            }
            NAVSnapshot storage b = s.snapshots[best];
            if (
                c.valuationTimestamp > b.valuationTimestamp
                    || (c.valuationTimestamp == b.valuationTimestamp && c.publishedAt >= b.publishedAt)
            ) best = i; // equal publishedAt: i > best, so the greater index wins
        }
        if (!found) revert NoCurrentSnapshot();
    }
}
