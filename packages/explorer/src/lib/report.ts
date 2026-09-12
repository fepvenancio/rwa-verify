import type { VerificationReport } from "@rwa-verify/core";

// A VerificationReport as the API serialises it (reportToJson): bigints are decimal strings.
export type JsonReport = Omit<VerificationReport, "tokenId"> & { tokenId?: string };

export const SECTIONS: { key: keyof Pick<JsonReport, "baseline" | "identity" | "documents" | "valuation" | "compliance">; title: string; ercs: string }[] = [
  { key: "baseline", title: "Baseline", ercs: "ERC-165 / 3643 / 7943 / 4626" },
  { key: "identity", title: "Identity", ercs: "ERC-8325 / 8320" },
  { key: "documents", title: "Documents", ercs: "ERC-8326" },
  { key: "valuation", title: "Valuation", ercs: "ERC-8330" },
  { key: "compliance", title: "Compliance", ercs: "ERC-8328" },
];
