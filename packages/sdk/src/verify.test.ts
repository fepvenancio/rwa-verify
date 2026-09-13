import { describe, expect, it } from "vitest";
import { erc165Abi } from "./abi/erc165.js";
import { contract, fakeClient } from "./testing/fakeChain.js";
import { A, ANCHOR_ID, ASSET_ID, BLOCK, CHAIN_ID, LEGAL_BASIS, USD, stack } from "./testing/stack.js";
import { reportToJson, verify } from "./verify.js";

const fullHints = { navOracle: A.oracle, currency: USD, documentAnchor: A.anchor, role: LEGAL_BASIS, eventLog: A.log };
const sections = ["baseline", "identity", "documents", "valuation", "compliance"] as const;

describe("verify", () => {
  it("non-ERC-165 token: baseline-only report, everything unsupported, nothing thrown", async () => {
    const client = fakeClient({ chainId: CHAIN_ID, blockNumber: BLOCK, contracts: { [A.token]: contract(erc165Abi, {}) } });
    const report = await verify({ client, chainId: CHAIN_ID, token: A.token });
    expect(report.baseline.length).toBe(16);
    expect(report.identity.map((c) => c.id)).toEqual(["erc8325.mutualBinding", "erc8320.activeClaim"]);
    expect(report.documents.length + report.valuation.length + report.compliance.length).toBe(3);
    for (const s of sections) for (const c of report[s]) expect(c.status, c.id).toBe("unsupported");
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report).not.toHaveProperty("tokenId");
  });

  it("fully conforming 8325 + 8330 stack: every check passes, joined on the anchorId", async () => {
    const report = await verify({ client: stack().client, chainId: CHAIN_ID, token: A.token, registryHints: fullHints });
    const statuses = Object.fromEntries(sections.flatMap((s) => report[s].map((c) => [c.id, c.status])));
    expect(statuses).toEqual({
      "erc20.metadata": "pass",
      "erc165.detect": "pass",
      "erc3643.paused": "pass",
      "erc3643.identityRegistry": "pass",
      "erc3643.compliance": "pass",
      "erc3643.onchainID": "pass",
      "erc3643.version": "pass",
      "erc3643.registryWiring": "pass",
      "erc3643.claimTopics": "pass",
      "erc3643.trustedIssuers": "pass",
      "erc3643.complianceBound": "pass",
      "erc3643.holder": "unknown",
      "erc7943.canTransfer": "pass",
      "erc7943.frozenBalance": "pass",
      "erc4626.asset": "unsupported",
      "erc4626.totalAssets": "unsupported",
      "erc8325.mutualBinding": "pass",
      "erc8320.activeClaim": "unsupported",
      "erc8326.activeBundle": "pass",
      "erc8330.navFresh": "pass",
      "erc8328.latestCurrentEvent": "pass",
    });
    expect(report.valuation[0]!.evidence.subjectId).toBe(ANCHOR_ID);
    expect(report.documents[0]!.evidence.subjectId).toBe(ANCHOR_ID);
  });

  it("8325 and 8320 disagree on the subject: identity.subjectMismatch fails and subject checks run per subject", async () => {
    const { client } = stack({ tokenDeclares: ["IERC165", "IAssetBoundToken", "IRegistryAnchor"] });
    const report = await verify({ client, chainId: CHAIN_ID, token: A.token, registryHints: fullHints });
    const mismatch = report.identity.find((c) => c.id === "identity.subjectMismatch")!;
    expect(mismatch.status).toBe("fail");
    expect(mismatch.evidence.subjects).toEqual([
      { standard: "erc8325", subjectId: ANCHOR_ID },
      { standard: "erc8320", subjectId: ASSET_ID },
    ]);
    expect(mismatch.reproduce).toBe(`rwa-verify ${A.token} --chain ${CHAIN_ID}`);
    expect(report.valuation.map((c) => c.evidence.subjectId)).toEqual([ANCHOR_ID, ASSET_ID]);
  });

  it("an explicit subjectId hint overrides the adapters", async () => {
    const subjectId = `0x${"cd".repeat(32)}` as const;
    const { client } = stack({ tokenDeclares: ["IERC165", "IAssetBoundToken", "IRegistryAnchor"] });
    const report = await verify({ client, chainId: CHAIN_ID, token: A.token, registryHints: { ...fullHints, subjectId } });
    expect(report.identity.some((c) => c.id === "identity.subjectMismatch")).toBe(false);
    expect(report.valuation.length).toBe(1);
    expect(report.valuation[0]!.evidence.subjectId).toBe(subjectId);
  });

  it("tokenId and rpc flow into the report and reproduce strings", async () => {
    const report = await verify({ client: stack().client, chainId: CHAIN_ID, token: A.token, tokenId: 3n, rpc: "http://localhost:8545" });
    expect(report.tokenId).toBe(3n);
    for (const c of report.baseline) expect(c.reproduce).toMatch(/--token-id 3 (.* )?--rpc http:\/\/localhost:8545$/);
  });

  it("reportToJson renders bigint as decimal strings", () => {
    expect(JSON.parse(reportToJson({ a: 10n, b: [1n], c: "x" }))).toEqual({ a: "10", b: ["1"], c: "x" });
  });
});
