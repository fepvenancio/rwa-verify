// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RwaVerify} from "../RwaVerify.sol";

/// @title CollateralGate
/// @notice Example: a lending protocol accepts an ERC-8325-bound token as collateral only while its binding is
///         mutually declared and its ERC-8330 NAV is fresh. Both checks must be `Pass`; `Unsupported`, `Unknown`
///         and `Stale` are rejected (ADR-004).
/// @dev Uses `anchorId` as the ERC-8330 `subjectId`. That join is a deployment convention, not a spec guarantee
///      (CLAUDE.md "Identity join key"); a real integration should verify the oracle stream it relies on.
contract CollateralGate {
    error CollateralRejected(RwaVerify.Status binding, RwaVerify.Status nav);
    error ZeroAddress();

    address public immutable REGISTRY;
    address public immutable ORACLE;
    bytes32 public immutable CURRENCY;

    constructor(address registry_, address oracle_, bytes32 currency_) {
        if (registry_ == address(0) || oracle_ == address(0)) revert ZeroAddress();
        REGISTRY = registry_;
        ORACLE = oracle_;
        CURRENCY = currency_;
    }

    /// @notice Reverts unless `token` is mutually bound to `anchorId` in `registry` and its NAV is fresh.
    /// @return nav Latest NAV, `decimals` fixed-point, as published.
    function requireCollateral(address token, bytes32 anchorId) external view returns (int256 nav, uint8 decimals) {
        RwaVerify.Binding memory b = RwaVerify.bindingValid(token, 0, false, REGISTRY, anchorId);
        RwaVerify.Nav memory n = RwaVerify.navFresh(ORACLE, anchorId, CURRENCY);
        if (b.status != RwaVerify.Status.Pass || n.status != RwaVerify.Status.Pass) {
            revert CollateralRejected(b.status, n.status);
        }
        return (n.nav, n.decimals);
    }
}
