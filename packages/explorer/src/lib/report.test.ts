import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CheckResult, CheckStatus } from "@rwa-verify/core";
import { Panels, Summary } from "@/components/Report";
import { formatUnits, groupRows, tokenIdentity, type JsonReport } from "./report";

const check = (id: string, erc: number, status: CheckStatus, evidence: Record<string, unknown> = {}): CheckResult => ({
  id,
  status,
  evidence: { blockNumber: "1", ...evidence },
  reproduce: `rwa-verify check ${id} --chain 1 --token 0xt`,
  specRef: { erc, commit: "c".repeat(40) },
});

// A TREXDINO-shaped baseline: no ERC-165, ERC-3643 ran, 7943 / 4626 not declared.
const baseline = [
  check("erc165.detect", 7943, "unsupported", { erc165: false }),
  check("erc3643.paused", 3643, "pass"),
  check("erc3643.identityRegistry", 3643, "pass"),
  check("erc3643.compliance", 3643, "fail"),
  check("erc7943.canTransfer", 7943, "unsupported"),
  check("erc7943.frozenBalance", 7943, "unsupported"),
  check("erc4626.asset", 4626, "unsupported"),
  check("erc4626.totalAssets", 4626, "unsupported"),
];
const report = (b: CheckResult[] = baseline): JsonReport => ({
  chainId: 1,
  token: "0xa4cba3f89d30184bf213172fea2c6241bd27911e",
  baseline: b,
  identity: [check("erc8325.mutualBinding", 8325, "unsupported"), check("erc8320.activeClaim", 8320, "unsupported")],
  documents: [],
  valuation: [check("erc8330.navFresh", 8330, "unknown")],
  compliance: [],
  generatedAt: "2026-09-13T00:00:00.000Z",
});

describe("groupRows", () => {
  it("splits ran / not-declared / info, with unique ERCs ascending", () => {
    const g = groupRows(baseline);
    expect(g.ran.map((c) => c.id)).toEqual(["erc3643.paused", "erc3643.identityRegistry", "erc3643.compliance"]);
    expect(g.notDeclared.ercs).toEqual([4626, 7943]);
    expect(g.notDeclared.rows).toHaveLength(4);
    expect(g.info.map((c) => c.id)).toEqual(["erc165.detect"]);
  });

  it("erc165.detect is info only when unsupported with evidence.erc165 === false; every other status is a ran row", () => {
    expect(groupRows([check("erc165.detect", 7943, "pass", { erc165: true })]).ran).toHaveLength(1);
    expect(groupRows([check("erc165.detect", 7943, "unsupported", { erc165: false })]).info).toHaveLength(1);
    expect(groupRows([check("erc165.detect", 7943, "unsupported")]).notDeclared.rows).toHaveLength(1);
    expect(groupRows([check("other.check", 7943, "unsupported", { erc165: false })]).notDeclared.rows).toHaveLength(1);
  });

  it("handles an empty panel and an all-unsupported panel", () => {
    expect(groupRows([])).toEqual({ ran: [], notDeclared: { ercs: [], rows: [] }, info: [] });
    const g = groupRows([check("a", 8330, "unsupported"), check("b", 8330, "unsupported")]);
    expect(g).toMatchObject({ ran: [], notDeclared: { ercs: [8330] }, info: [] });
    expect(g.notDeclared.rows).toHaveLength(2);
  });
});

describe("formatUnits / tokenIdentity", () => {
  it("groups thousands and drops trailing zeros", () => {
    expect(formatUnits("1234567890000000000000", 18)).toBe("1,234.56789");
    expect(formatUnits("1000000", 6)).toBe("1");
    expect(formatUnits("123", 6)).toBe("0.000123");
    expect(formatUnits("0", 18)).toBe("0");
    expect(formatUnits("123456789", 0)).toBe("123,456,789");
  });

  it("reads a passing erc20.metadata check", () => {
    const meta = check("erc20.metadata", 20, "pass", { name: "Savings Dai", symbol: "sDAI", decimals: 18, totalSupply: "2500000000000000000000000" });
    expect(tokenIdentity(report([...baseline, meta]))).toEqual({ name: "Savings Dai", symbol: "sDAI", decimals: 18, totalSupply: "2,500,000" });
  });

  it("is undefined when the check is absent, not pass, or malformed", () => {
    expect(tokenIdentity(report())).toBeUndefined();
    expect(tokenIdentity(report([check("erc20.metadata", 20, "unknown", { name: "x", symbol: "X", decimals: 18, totalSupply: "1" })]))).toBeUndefined();
    expect(tokenIdentity(report([check("erc20.metadata", 20, "pass", { name: "x", symbol: "X", decimals: 18, totalSupply: "1.5" })]))).toBeUndefined();
    expect(tokenIdentity(report([check("erc20.metadata", 20, "pass", { symbol: "X", decimals: 18, totalSupply: "1" })]))).toBeUndefined();
  });
});

describe("Report rendering (static markup)", () => {
  it("panels: ran rows visible, unsupported collapsed behind one line per panel, erc165 as info", () => {
    const html = renderToStaticMarkup(createElement(Panels, { report: report() }));
    expect(html).toContain("Not declared: ERC-4626, ERC-7943");
    expect(html).toContain("show 4");
    expect(html).toContain("Not declared: ERC-8320, ERC-8325");
    expect(html).toContain("No ERC-165: standards probed directly");
    // collapsed rows keep their reproduce commands in the markup
    expect(html).toContain("rwa-verify check erc4626.asset");
    expect(html).toContain("erc8330.navFresh");
    expect((html.match(/<details/g) ?? []).length).toBeGreaterThan(0);
  });

  it("summary: ran counts prominent, not-declared count, ADR-004 note; identity line only when erc20.metadata passed", () => {
    const plain = renderToStaticMarkup(createElement(Summary, { report: report(), jsonHref: "/j" }));
    expect(plain).toContain("4 checks ran"); // 3 baseline + the unknown valuation row
    expect(plain).toContain("6 not declared");
    expect(plain).toContain("ADR-004");
    expect(plain).not.toContain("total supply");
    const meta = check("erc20.metadata", 20, "pass", { name: "TREX Dino", symbol: "TREXDINO", decimals: 0, totalSupply: "1000" });
    const withId = renderToStaticMarkup(createElement(Summary, { report: report([...baseline, meta]), jsonHref: "/j" }));
    expect(withId).toContain("TREX Dino");
    expect(withId).toContain(">TREXDINO</span>");
    expect(withId).toContain("total supply 1,000");
    expect(withId).toContain("5 checks ran");
  });
});
