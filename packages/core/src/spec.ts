// Pinned ethereum/ERCs commit (ADR-001). Must match specs/PINNED.md.
export const SPEC_COMMIT = "84b46e7d69d08dbd8876503e435fd299211c26b8";

export const ERC = {
  TREX: 3643,
  VAULT: 4626,
  URWA: 7943,
  REGULATED_ASSET_CLAIM: 8320,
  ASSET_ANCHOR_REGISTRY: 8325,
  DOCUMENT_BUNDLE_ANCHOR: 8326,
  COMPLIANCE_EVENT_LOG: 8328,
  NAV_SNAPSHOT_ORACLE: 8330,
} as const;

export type ErcNumber = (typeof ERC)[keyof typeof ERC];

export function specRef(erc: ErcNumber): { erc: ErcNumber; commit: string } {
  return { erc, commit: SPEC_COMMIT };
}
