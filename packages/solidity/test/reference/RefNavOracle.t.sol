// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RwaVerify} from "../../src/RwaVerify.sol";
import {INAVSnapshotOracle} from "../../src/interfaces/INAVSnapshotOracle.sol";
import {MockNavOracle} from "../mocks/MockNavOracle.sol";
import {RefNavOracle} from "./RefNavOracle.sol";

/// @dev Spec behaviour of the ERC-8330 reference fixture, plus a differential: `RwaVerify.navFresh` must read the
///      same result from the reference (real correction chains) as from `MockNavOracle` set to the equivalent state.
contract RefNavOracleTest is Test {
    RefNavOracle internal oracle;
    MockNavOracle internal mock;

    bytes32 internal constant SUBJECT = keccak256("subject");
    bytes32 internal constant USD = keccak256("ERC-8330:CURRENCY:USD");
    bytes32 internal constant PER_SHARE = keccak256("ERC-8330:NAV_BASIS:PER_SHARE");
    bytes32 internal constant METHOD = keccak256("methodology");
    uint256 internal constant NONE = type(uint256).max;
    uint64 internal constant HEARTBEAT = 1 hours;
    uint64 internal constant MAX_AGE = 1 days;
    address internal constant P1 = address(0xBEEF); // MockNavOracle's fixed provider, so differential structs match
    address internal constant P2 = address(0xCAFE);
    uint64 internal t0;

    function setUp() public {
        vm.warp(1_800_000_000);
        t0 = uint64(block.timestamp);
        oracle = new RefNavOracle();
        oracle.setProvider(P1, true);
        oracle.setProvider(P2, true);
        oracle.setNAVBasis(SUBJECT, USD, PER_SHARE);
        oracle.setStalenessConfig(SUBJECT, USD, HEARTBEAT, MAX_AGE);
        mock = new MockNavOracle();
        mock.setThresholds(HEARTBEAT, MAX_AGE);
    }

    function _publish(address provider, uint64 ts, int256 nav, uint256 corrects) internal returns (uint256) {
        vm.prank(provider);
        return oracle.publishNAV(SUBJECT, USD, PER_SHARE, nav, 6, ts, METHOD, "ipfs://methodology", corrects);
    }

    function _current(uint256 i) internal view returns (uint256) {
        return oracle.currentSnapshotIndex(SUBJECT, USD, i);
    }

    function _isCurrent(uint256 i) internal view returns (bool) {
        return oracle.isSnapshotCurrent(SUBJECT, USD, i);
    }

    function _latestNav() internal view returns (int256 nav) {
        (nav,,,,,) = oracle.latestNAV(SUBJECT, USD);
    }

    function _snap(uint256 i) internal view returns (INAVSnapshotOracle.NAVSnapshot memory) {
        return oracle.getSnapshot(SUBJECT, USD, i);
    }

    // ---------- configuration ----------

    function test_configuration() public {
        RefNavOracle fresh = new RefNavOracle();
        vm.expectRevert(RefNavOracle.InvalidBasis.selector);
        fresh.setNAVBasis(SUBJECT, USD, keccak256("bogus"));
        vm.expectRevert(RefNavOracle.BasisMismatch.selector); // unconfigured stream rejects publication
        fresh.publishNAV(SUBJECT, USD, PER_SHARE, 1, 6, t0, METHOD, "", NONE);
        assertEq(fresh.streamNAVBasis(SUBJECT, USD), bytes32(0));

        vm.expectEmit(address(fresh));
        emit INAVSnapshotOracle.NAVBasisConfigured(SUBJECT, USD, PER_SHARE);
        fresh.setNAVBasis(SUBJECT, USD, PER_SHARE);
        assertEq(fresh.streamNAVBasis(SUBJECT, USD), PER_SHARE);
        vm.expectRevert(RefNavOracle.BasisAlreadyConfigured.selector);
        fresh.setNAVBasis(SUBJECT, USD, PER_SHARE);

        vm.expectEmit(address(fresh));
        emit INAVSnapshotOracle.StalenessConfigUpdated(SUBJECT, USD, HEARTBEAT, MAX_AGE);
        fresh.setStalenessConfig(SUBJECT, USD, HEARTBEAT, MAX_AGE);
        assertEq(fresh.heartbeat(SUBJECT, USD), HEARTBEAT);
        assertEq(fresh.maxValuationAge(SUBJECT, USD), MAX_AGE);

        vm.prank(P2);
        vm.expectRevert(RefNavOracle.NotOwner.selector);
        fresh.setStalenessConfig(SUBJECT, USD, 1, 1);
        vm.expectRevert(RefNavOracle.NotProvider.selector);
        vm.prank(P2);
        fresh.publishNAV(SUBJECT, USD, PER_SHARE, 1, 6, t0, METHOD, "", NONE);

        assertTrue(oracle.supportsInterface(type(INAVSnapshotOracle).interfaceId));
        assertTrue(oracle.supportsInterface(0x01ffc9a7));
    }

    function test_publish_storesAndEmits() public {
        vm.expectEmit(address(oracle));
        emit INAVSnapshotOracle.NAVPublished(SUBJECT, USD, P1, 0, 1_000_000, 6, PER_SHARE, t0 - 10, METHOD, NONE);
        assertEq(_publish(P1, t0 - 10, 1_000_000, NONE), 0);
        assertEq(_publish(P1, t0 - 5, 1_000_500, NONE), 1);

        INAVSnapshotOracle.NAVSnapshot memory s = _snap(0);
        assertEq(s.subjectId, SUBJECT);
        assertEq(s.currency, USD);
        assertEq(s.navBasis, PER_SHARE);
        assertEq(s.nav, 1_000_000);
        assertEq(s.decimals, 6);
        assertEq(s.valuationTimestamp, t0 - 10);
        assertEq(s.publishedAt, t0);
        assertEq(s.provider, P1);
        assertEq(s.methodologyHash, METHOD);
        assertEq(s.methodologyURI, "ipfs://methodology");
        assertEq(s.correctsIndex, NONE);
        assertEq(s.correctedByIndex, 0);

        assertEq(oracle.snapshotCount(SUBJECT, USD), 2);
        assertEq(oracle.providerSnapshotCount(SUBJECT, USD, P1), 2);
        assertEq(oracle.providerSnapshotAt(SUBJECT, USD, P1, 1), 1);
        assertEq(oracle.providerSnapshotCount(SUBJECT, USD, P2), 0);
        assertTrue(_isCurrent(0) && _isCurrent(1));
        assertEq(_current(0), 0);
        assertEq(_latestNav(), 1_000_500, "greater valuation timestamp wins");
        assertEq(oracle.latestNAVByProvider(SUBJECT, USD, P1).nav, 1_000_500);
    }

    function test_publish_rules() public {
        vm.prank(P1);
        vm.expectRevert(RefNavOracle.FutureValuation.selector);
        oracle.publishNAV(SUBJECT, USD, PER_SHARE, 1, 6, t0 + 1, METHOD, "", NONE);
        vm.prank(P1);
        vm.expectRevert(RefNavOracle.ZeroMethodology.selector);
        oracle.publishNAV(SUBJECT, USD, PER_SHARE, 1, 6, t0, bytes32(0), "", NONE);
        vm.prank(P1);
        vm.expectRevert(RefNavOracle.BasisMismatch.selector);
        oracle.publishNAV(SUBJECT, USD, keccak256("ERC-8330:NAV_BASIS:TOTAL"), 1, 6, t0, METHOD, "", NONE);

        _publish(P1, t0, 1, NONE);
        vm.expectRevert(RefNavOracle.SlotOccupied.selector);
        _publish(P1, t0, 2, NONE); // one current original per provider and valuation timestamp
        _publish(P2, t0, 3, NONE); // other providers may publish independent originals
        assertEq(oracle.snapshotCount(SUBJECT, USD), 2);
    }

    // ---------- correction chains ----------

    function test_correctOfCorrect() public {
        _publish(P1, t0, 1_000_000, NONE); // 0
        _publish(P1, t0, 1_001_000, 0); // 1 corrects 0
        vm.expectEmit(address(oracle));
        emit INAVSnapshotOracle.NAVPublished(SUBJECT, USD, P1, 2, 1_002_000, 6, PER_SHARE, t0, METHOD, 1);
        _publish(P1, t0, 1_002_000, 1); // 2 corrects 1

        assertEq(_snap(0).correctedByIndex, 1);
        assertEq(_snap(1).correctedByIndex, 2);
        assertEq(_snap(1).correctsIndex, 0);
        assertEq(_snap(2).correctedByIndex, 0);
        assertEq(_snap(2).correctsIndex, 1);
        assertEq(_current(0), 2);
        assertEq(_current(1), 2);
        assertEq(_current(2), 2);
        assertFalse(_isCurrent(0) || _isCurrent(1));
        assertTrue(_isCurrent(2));
        assertEq(_latestNav(), 1_002_000);
        assertEq(oracle.latestNAVByProvider(SUBJECT, USD, P1).nav, 1_002_000);
        assertEq(oracle.snapshotCount(SUBJECT, USD), 3, "corrected records are retained");
        assertEq(oracle.providerSnapshotAt(SUBJECT, USD, P1, 2), 2);
    }

    function test_correction_rules() public {
        _publish(P1, t0 - 10, 1, NONE); // 0
        _publish(P1, t0 - 5, 2, NONE); // 1
        vm.expectRevert(RefNavOracle.WrongProvider.selector);
        _publish(P2, t0 - 10, 3, 0);
        vm.expectRevert(RefNavOracle.TargetMismatch.selector);
        _publish(P1, t0 - 5, 3, 0); // valuation timestamp must equal the target's
        vm.expectRevert(RefNavOracle.UnknownSnapshot.selector);
        _publish(P1, t0 - 10, 3, 7);
        _publish(P1, t0 - 10, 3, 0); // 2 corrects 0
        vm.expectRevert(RefNavOracle.NotTerminal.selector);
        _publish(P1, t0 - 10, 4, 0); // each snapshot is corrected at most once
        assertEq(_current(0), 2);
    }

    // ---------- invalidation ----------

    function test_invalidate_terminalCorrection_restoresPredecessor() public {
        _publish(P1, t0, 1_000_000, NONE); // 0
        _publish(P1, t0, 1_001_000, 0); // 1
        _publish(P1, t0, 1_002_000, 1); // 2
        vm.expectEmit(address(oracle));
        emit INAVSnapshotOracle.NAVSnapshotInvalidated(SUBJECT, USD, P1, 2, address(this), keccak256("bad"));
        oracle.invalidateSnapshot(SUBJECT, USD, 2, keccak256("bad"));

        assertTrue(oracle.isSnapshotInvalidated(SUBJECT, USD, 2));
        assertFalse(_isCurrent(2));
        assertTrue(_isCurrent(1), "direct predecessor is terminal again");
        assertEq(_current(0), 1);
        assertEq(_current(1), 1);
        vm.expectRevert(RefNavOracle.NoCurrentSnapshot.selector);
        _current(2);
        assertEq(_latestNav(), 1_001_000);
        assertEq(_snap(2).correctsIndex, 1, "invalidation keeps history");
        assertEq(_snap(1).correctedByIndex, 0);

        vm.expectRevert(RefNavOracle.AlreadyInvalidated.selector);
        _publish(P1, t0, 5, 2); // an invalidated snapshot cannot be corrected
        _publish(P1, t0, 1_003_000, 1); // 3: replacement correction of the restored predecessor
        assertEq(_current(0), 3);
        assertEq(_latestNav(), 1_003_000);
        assertEq(oracle.snapshotCount(SUBJECT, USD), 4);
    }

    function test_invalidate_original_noCurrentRemains() public {
        _publish(P1, t0, 1_000_000, NONE);
        oracle.invalidateSnapshot(SUBJECT, USD, 0, keccak256("bad"));
        assertFalse(_isCurrent(0));
        vm.expectRevert(RefNavOracle.NoCurrentSnapshot.selector);
        _current(0);
        vm.expectRevert(RefNavOracle.NoCurrentSnapshot.selector);
        oracle.latestNAV(SUBJECT, USD);
        vm.expectRevert(RefNavOracle.NoCurrentSnapshot.selector);
        oracle.latestNAVStatus(SUBJECT, USD);
        vm.expectRevert(RefNavOracle.NoCurrentSnapshot.selector);
        oracle.latestNAVByProvider(SUBJECT, USD, P1);
        assertEq(oracle.snapshotCount(SUBJECT, USD), 1, "record preserved");

        // The provider/timestamp slot is free again for a replacement original.
        assertEq(_publish(P1, t0, 1_000_001, NONE), 1);
        assertEq(_latestNav(), 1_000_001);
    }

    function test_invalidate_fallsBackToOtherCurrent() public {
        _publish(P1, t0 - 2 hours, 1_000_000, NONE); // 0
        _publish(P1, t0 - 1 hours, 1_010_000, NONE); // 1
        assertEq(_latestNav(), 1_010_000);
        oracle.invalidateSnapshot(SUBJECT, USD, 1, keccak256("bad"));
        assertEq(_latestNav(), 1_000_000);
        (,,, uint64 ts,,,,) = oracle.latestNAVStatus(SUBJECT, USD);
        assertEq(ts, t0 - 2 hours);
    }

    function test_invalidate_rules() public {
        _publish(P1, t0, 1, NONE); // 0
        _publish(P1, t0, 2, 0); // 1
        vm.expectRevert(RefNavOracle.ZeroReason.selector);
        oracle.invalidateSnapshot(SUBJECT, USD, 1, bytes32(0));
        vm.expectRevert(RefNavOracle.UnknownSnapshot.selector);
        oracle.invalidateSnapshot(SUBJECT, USD, 2, keccak256("r"));
        vm.expectRevert(RefNavOracle.NotTerminal.selector);
        oracle.invalidateSnapshot(SUBJECT, USD, 0, keccak256("r"));
        vm.prank(P1);
        vm.expectRevert(RefNavOracle.NotOwner.selector);
        oracle.invalidateSnapshot(SUBJECT, USD, 1, keccak256("r"));
        oracle.invalidateSnapshot(SUBJECT, USD, 1, keccak256("r"));
        vm.expectRevert(RefNavOracle.AlreadyInvalidated.selector);
        oracle.invalidateSnapshot(SUBJECT, USD, 1, keccak256("r"));
    }

    // ---------- latest-NAV ordering ----------

    function test_lateCorrection_doesNotReplaceLatest() public {
        _publish(P1, t0 - 2 hours, 1_000_000, NONE); // 0
        _publish(P1, t0 - 1 hours, 1_010_000, NONE); // 1
        vm.warp(t0 + 10);
        _publish(P1, t0 - 2 hours, 1_000_500, 0); // 2: published last, but for the older valuation
        assertEq(_current(0), 2);
        assertEq(_latestNav(), 1_010_000, "latest is by valuation timestamp, not publication order");
        (,,, uint64 ts, uint64 publishedAt,,,) = oracle.latestNAVStatus(SUBJECT, USD);
        assertEq(ts, t0 - 1 hours);
        assertEq(publishedAt, t0);
    }

    function test_tieBreak_mostRecentlyPublished() public {
        _publish(P1, t0 - 1 hours, 1_000_000, NONE); // 0 at t0
        vm.warp(t0 + 10);
        _publish(P2, t0 - 1 hours, 2_000_000, NONE); // 1 at t0 + 10, same valuation timestamp
        (int256 nav,,,, uint64 publishedAt, address provider) = oracle.latestNAV(SUBJECT, USD);
        assertEq(nav, 2_000_000);
        assertEq(publishedAt, t0 + 10);
        assertEq(provider, P2);

        vm.warp(t0 + 20);
        _publish(P1, t0 - 1 hours, 1_000_500, 0); // 2: P1's correction is now the most recently published
        (nav,,,,, provider) = oracle.latestNAV(SUBJECT, USD);
        assertEq(nav, 1_000_500);
        assertEq(provider, P1);
        assertEq(oracle.latestNAVByProvider(SUBJECT, USD, P2).nav, 2_000_000);
    }

    function test_tieBreak_greaterIndexOnEqualPublishedAt() public {
        _publish(P1, t0 - 1 hours, 1_000_000, NONE); // 0
        _publish(P2, t0 - 1 hours, 2_000_000, NONE); // 1, same block
        (int256 nav,,,,, address provider) = oracle.latestNAV(SUBJECT, USD);
        assertEq(nav, 2_000_000);
        assertEq(provider, P2);
        // Valuation timestamp dominates both tie-breaks.
        _publish(P1, t0 - 30 minutes, 1_500_000, NONE); // 2
        assertEq(_latestNav(), 1_500_000);
        vm.warp(t0 + 10);
        _publish(P2, t0 - 45 minutes, 2_500_000, NONE); // 3: newer publication, older valuation
        assertEq(_latestNav(), 1_500_000);
    }

    function test_unknownIndex_reverts() public {
        vm.expectRevert(RefNavOracle.UnknownSnapshot.selector);
        oracle.getSnapshot(SUBJECT, USD, 0);
        vm.expectRevert(RefNavOracle.UnknownSnapshot.selector);
        oracle.currentSnapshotIndex(SUBJECT, USD, 0);
        vm.expectRevert(RefNavOracle.UnknownSnapshot.selector);
        oracle.isSnapshotCurrent(SUBJECT, USD, 0);
        vm.expectRevert(RefNavOracle.UnknownSnapshot.selector);
        oracle.isSnapshotInvalidated(SUBJECT, USD, 0);
        vm.expectRevert(RefNavOracle.OutOfRange.selector);
        oracle.providerSnapshotAt(SUBJECT, USD, P1, 0);
        RefNavOracle unconfigured = new RefNavOracle();
        vm.expectRevert(RefNavOracle.Unconfigured.selector);
        unconfigured.latestNAVStatus(SUBJECT, USD);
    }

    // ---------- differential: RwaVerify.navFresh on the reference vs the mock in the equivalent state ----------

    function _assertSameAsMock() internal view {
        RwaVerify.Nav memory a = RwaVerify.navFresh(address(oracle), SUBJECT, USD);
        RwaVerify.Nav memory b = RwaVerify.navFresh(address(mock), SUBJECT, USD);
        assertEq(keccak256(abi.encode(a)), keccak256(abi.encode(b)), "navFresh(reference) != navFresh(mock)");
    }

    function test_diff_freshSnapshot() public {
        _publish(P1, t0 - 10, 1_050_000, NONE);
        mock.setSnapshot(1_050_000, 6, t0 - 10, t0);
        _assertSameAsMock();
        assertEq(uint256(RwaVerify.navFresh(address(oracle), SUBJECT, USD).status), uint256(RwaVerify.Status.Pass));
    }

    function test_diff_correctOfCorrectThenInvalidatedTerminal() public {
        _publish(P1, t0 - 10, 1_000_000, NONE); // 0
        _publish(P1, t0 - 10, 1_001_000, 0); // 1
        _publish(P1, t0 - 10, 1_002_000, 1); // 2
        mock.setSnapshot(1_002_000, 6, t0 - 10, t0);
        _assertSameAsMock();

        oracle.invalidateSnapshot(SUBJECT, USD, 2, keccak256("bad"));
        mock.setSnapshot(1_001_000, 6, t0 - 10, t0);
        _assertSameAsMock();

        oracle.invalidateSnapshot(SUBJECT, USD, 1, keccak256("bad"));
        oracle.invalidateSnapshot(SUBJECT, USD, 0, keccak256("bad"));
        mock.clearSnapshot();
        _assertSameAsMock();
        assertEq(uint256(RwaVerify.navFresh(address(oracle), SUBJECT, USD).status), uint256(RwaVerify.Status.Fail));
    }

    function test_diff_lateCorrectionAndStaleness() public {
        _publish(P1, t0 - 2 hours, 1_000_000, NONE); // 0
        _publish(P1, t0 - 1 hours, 1_010_000, NONE); // 1
        vm.warp(t0 + 10);
        _publish(P1, t0 - 2 hours, 1_000_500, 0); // 2, late correction to the older valuation
        mock.setSnapshot(1_010_000, 6, t0 - 1 hours, t0);
        _assertSameAsMock();

        vm.warp(t0 + HEARTBEAT + 1);
        _assertSameAsMock();
        RwaVerify.Nav memory r = RwaVerify.navFresh(address(oracle), SUBJECT, USD);
        assertEq(uint256(r.status), uint256(RwaVerify.Status.Stale));
        assertTrue(r.isPublishStale);
        assertFalse(r.isValuationStale);

        vm.warp(t0 + MAX_AGE + 1);
        _assertSameAsMock();
        assertTrue(RwaVerify.navFresh(address(oracle), SUBJECT, USD).isValuationStale);
    }

    function test_diff_unconfiguredThreshold() public {
        _publish(P1, t0, 1, NONE);
        mock.setSnapshot(1, 6, t0, t0);
        oracle.setStalenessConfig(SUBJECT, USD, 0, MAX_AGE);
        mock.setThresholds(0, MAX_AGE);
        _assertSameAsMock();
        assertEq(uint256(RwaVerify.navFresh(address(oracle), SUBJECT, USD).status), uint256(RwaVerify.Status.Unknown));
    }
}
