import type { CheckResult, VerificationReport } from "@rwa-verify/core";

// A VerificationReport as the API serialises it (reportToJson): bigints are decimal strings.
export type JsonReport = Omit<VerificationReport, "tokenId"> & { tokenId?: string };

export const SECTIONS: { key: keyof Pick<JsonReport, "baseline" | "identity" | "documents" | "valuation" | "compliance">; title: string; ercs: string }[] = [
  { key: "baseline", title: "Baseline", ercs: "ERC-165 / 3643 / 7943 / 4626" },
  { key: "identity", title: "Identity", ercs: "ERC-8325 / 8320" },
  { key: "documents", title: "Documents", ercs: "ERC-8326" },
  { key: "valuation", title: "Valuation", ercs: "ERC-8330" },
  { key: "compliance", title: "Compliance", ercs: "ERC-8328" },
];

// erc165.detect answering `unsupported` with `evidence.erc165 === false` is a fact about the token (it has no
// ERC-165, so standards were probed directly), not a standard it fails to declare.
const isInfo = (c: CheckResult) => c.id === "erc165.detect" && c.status === "unsupported" && c.evidence.erc165 === false;

// Splits a panel's rows for display: checks that ran (any status but unsupported), the unsupported ones
// collapsed behind the unique ERC numbers they cover (ascending), and informational facts (ADR-004).
export function groupRows(checks: CheckResult[]): { ran: CheckResult[]; notDeclared: { ercs: number[]; rows: CheckResult[] }; info: CheckResult[] } {
  const ran: CheckResult[] = [];
  const rows: CheckResult[] = [];
  const info: CheckResult[] = [];
  for (const c of checks) {
    if (isInfo(c)) info.push(c);
    else if (c.status === "unsupported") rows.push(c);
    else ran.push(c);
  }
  const ercs = [...new Set(rows.map((c) => c.specRef.erc))].sort((a, b) => a - b);
  return { ran, notDeclared: { ercs, rows }, info };
}

// "1234567890000000000000" in base units with 18 decimals -> "1,234.56789" (integer part grouped, trailing zeros dropped).
export function formatUnits(raw: string, decimals: number): string {
  const padded = raw.padStart(decimals + 1, "0");
  const int = padded.slice(0, padded.length - decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

// The `erc20.metadata` baseline check when it passed: evidence { name, symbol, decimals, totalSupply } with
// totalSupply a decimal string in base units. Anything else (absent, not pass, unexpected shape) -> undefined.
export function tokenIdentity(report: JsonReport): { name: string; symbol: string; decimals: number; totalSupply: string } | undefined {
  const c = report.baseline.find((c) => c.id === "erc20.metadata" && c.status === "pass");
  if (!c) return undefined;
  const { name, symbol, decimals, totalSupply } = c.evidence;
  const d = Number(decimals);
  if (typeof name !== "string" || typeof symbol !== "string" || !Number.isInteger(d) || d < 0 || !/^\d+$/.test(String(totalSupply))) return undefined;
  return { name, symbol, decimals: d, totalSupply: formatUnits(String(totalSupply), d) };
}
