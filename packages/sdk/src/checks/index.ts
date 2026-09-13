import type { Check } from "./context.js";
import { erc165Detect } from "./erc165.js";
import { erc20Metadata } from "./erc20.js";
import {
  erc3643ClaimTopics,
  erc3643Compliance,
  erc3643ComplianceBound,
  erc3643Holder,
  erc3643IdentityRegistry,
  erc3643OnchainID,
  erc3643Paused,
  erc3643RegistryWiring,
  erc3643TrustedIssuers,
  erc3643Version,
} from "./erc3643.js";
import { erc4626Asset, erc4626TotalAssets } from "./erc4626.js";
import { erc7943CanTransfer, erc7943FrozenBalance } from "./erc7943.js";
import { activeClaim } from "./erc8320.js";
import { mutualBinding } from "./erc8325.js";
import { activeBundle } from "./erc8326.js";
import { latestCurrentEvent } from "./erc8328.js";
import { navFresh } from "./erc8330.js";

// Check id -> implementation. Ids are documented in packages/sdk/CHECKS.md.
export const CHECKS = {
  "erc20.metadata": erc20Metadata,
  "erc165.detect": erc165Detect,
  "erc3643.paused": erc3643Paused,
  "erc3643.identityRegistry": erc3643IdentityRegistry,
  "erc3643.compliance": erc3643Compliance,
  "erc3643.onchainID": erc3643OnchainID,
  "erc3643.version": erc3643Version,
  "erc3643.registryWiring": erc3643RegistryWiring,
  "erc3643.claimTopics": erc3643ClaimTopics,
  "erc3643.trustedIssuers": erc3643TrustedIssuers,
  "erc3643.complianceBound": erc3643ComplianceBound,
  "erc3643.holder": erc3643Holder,
  "erc7943.canTransfer": erc7943CanTransfer,
  "erc7943.frozenBalance": erc7943FrozenBalance,
  "erc4626.asset": erc4626Asset,
  "erc4626.totalAssets": erc4626TotalAssets,
  "erc8325.mutualBinding": mutualBinding,
  "erc8320.activeClaim": activeClaim,
  "erc8326.activeBundle": activeBundle,
  "erc8328.latestCurrentEvent": latestCurrentEvent,
  "erc8330.navFresh": navFresh,
} satisfies Record<string, Check>;

export type CheckId = keyof typeof CHECKS;

export const BASELINE_CHECKS: CheckId[] = [
  "erc20.metadata",
  "erc165.detect",
  "erc3643.paused",
  "erc3643.identityRegistry",
  "erc3643.compliance",
  "erc3643.onchainID",
  "erc3643.version",
  "erc3643.registryWiring",
  "erc3643.claimTopics",
  "erc3643.trustedIssuers",
  "erc3643.complianceBound",
  "erc3643.holder",
  "erc7943.canTransfer",
  "erc7943.frozenBalance",
  "erc4626.asset",
  "erc4626.totalAssets",
];
