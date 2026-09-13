import type { Check } from "./context.js";
import { erc165Detect } from "./erc165.js";
import { erc3643Compliance, erc3643IdentityRegistry, erc3643Paused } from "./erc3643.js";
import { erc4626Asset, erc4626TotalAssets } from "./erc4626.js";
import { erc7943CanTransfer, erc7943FrozenBalance } from "./erc7943.js";
import { activeClaim } from "./erc8320.js";
import { mutualBinding } from "./erc8325.js";
import { activeBundle } from "./erc8326.js";
import { latestCurrentEvent } from "./erc8328.js";
import { navFresh } from "./erc8330.js";

// Check id -> implementation. Ids are documented in packages/sdk/CHECKS.md.
export const CHECKS = {
  "erc165.detect": erc165Detect,
  "erc3643.paused": erc3643Paused,
  "erc3643.identityRegistry": erc3643IdentityRegistry,
  "erc3643.compliance": erc3643Compliance,
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
  "erc165.detect",
  "erc3643.paused",
  "erc3643.identityRegistry",
  "erc3643.compliance",
  "erc7943.canTransfer",
  "erc7943.frozenBalance",
  "erc4626.asset",
  "erc4626.totalAssets",
];
