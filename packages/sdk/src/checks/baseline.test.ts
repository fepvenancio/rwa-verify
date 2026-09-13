import { describe, expect, it } from "vitest";
import { erc165Abi } from "../abi/erc165.js";
import { BASELINE_CHECKS, CHECKS } from "./index.js";
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
import { PROBE, erc7943CanTransfer, erc7943FrozenBalance } from "./erc7943.js";
import { contract, fakeClient, rpcError } from "../testing/fakeChain.js";
import { A, BLOCK, CHAIN_ID, ctxFor, stack } from "../testing/stack.js";
import { ZERO_ADDRESS } from "./context.js";

describe("baseline checks on a conforming 3643 + 7943 token", () => {
  it("erc20.metadata reads name/symbol/decimals/totalSupply with an ERC-20 specRef", async () => {
    const r = await erc20Metadata(await ctxFor(stack().client));
    expect(r).toMatchObject({ status: "pass", evidence: { name: "Fixture Token", symbol: "FIX", decimals: 18, totalSupply: 1_000_000n }, specRef: { erc: 20 } });
    expect(r.reproduce).toBe(`rwa-verify check erc20.metadata --chain ${CHAIN_ID} --token ${A.token}`);
  });

  it("erc165.detect passes and lists declared interfaces", async () => {
    const r = await erc165Detect(await ctxFor(stack().client));
    expect(r.status).toBe("pass");
    expect(r.evidence.supports).toMatchObject({ IERC3643: true, IERC7943Fungible: true, IAssetBoundToken: true, INAVSnapshotOracle: false });
  });

  it("erc3643.* facts", async () => {
    const ctx = await ctxFor(stack().client);
    expect(await erc3643Paused(ctx)).toMatchObject({ status: "pass", evidence: { paused: false, declaresIERC3643: true } });
    expect(await erc3643IdentityRegistry(ctx)).toMatchObject({ status: "pass", evidence: { identityRegistry: A.identityRegistry } });
    expect(await erc3643Compliance(ctx)).toMatchObject({ status: "pass", evidence: { compliance: A.compliance } });
    expect((await erc3643Paused(await ctxFor(stack({ paused: true }).client))).status).toBe("fail");
  });

  it("erc3643.onchainID / version", async () => {
    const ctx = await ctxFor(stack().client);
    expect(await erc3643OnchainID(ctx)).toMatchObject({ status: "pass", evidence: { onchainID: A.onchainID } });
    expect(await erc3643Version(ctx)).toMatchObject({ status: "pass", evidence: { version: "4.1.3" } });
    expect((await erc3643OnchainID(await ctxFor(stack({ onchainID: ZERO_ADDRESS }).client))).status).toBe("fail");
    expect((await erc3643Version(await ctxFor(stack({ version: "" }).client))).status).toBe("fail");
    expect((await erc3643Version(await ctxFor(stack({ version: null }).client))).status).toBe("unsupported");
  });

  it("erc3643.registryWiring", async () => {
    expect(await erc3643RegistryWiring(await ctxFor(stack().client))).toMatchObject({
      status: "pass",
      evidence: { identityRegistry: A.identityRegistry, identityStorage: A.identityStorage, issuersRegistry: A.issuersRegistry, topicsRegistry: A.topicsRegistry },
    });
    expect((await erc3643RegistryWiring(await ctxFor(stack({ identityStorage: ZERO_ADDRESS }).client))).status).toBe("fail");
  });

  it("erc3643.claimTopics / trustedIssuers list topics as decimal strings", async () => {
    const ctx = await ctxFor(stack({ claimTopics: [1n, 7n] }).client);
    expect(await erc3643ClaimTopics(ctx)).toMatchObject({ status: "pass", evidence: { topicsRegistry: A.topicsRegistry, claimTopics: ["1", "7"] } });
    expect(await erc3643TrustedIssuers(ctx)).toMatchObject({
      status: "pass",
      evidence: { issuersRegistry: A.issuersRegistry, trustedIssuers: [{ issuer: A.issuer, claimTopics: ["1", "7"] }] },
    });
    expect((await erc3643ClaimTopics(await ctxFor(stack({ claimTopics: [] }).client))).status).toBe("fail");
    expect(await erc3643TrustedIssuers(await ctxFor(stack({ trustedIssuers: [] }).client))).toMatchObject({ status: "fail", evidence: { trustedIssuers: [] } });
  });

  it("erc3643.complianceBound, with the getTokenBound fallback", async () => {
    expect(await erc3643ComplianceBound(await ctxFor(stack().client))).toMatchObject({ status: "pass", evidence: { compliance: A.compliance, isTokenBound: true } });
    expect((await erc3643ComplianceBound(await ctxFor(stack({ complianceBound: false }).client))).status).toBe("fail");
    const legacy = await erc3643ComplianceBound(await ctxFor(stack({ complianceHasIsTokenBound: false }).client));
    expect(legacy).toMatchObject({ status: "pass", evidence: { getTokenBound: A.token } });
    expect(legacy.evidence.isTokenBoundError).toMatch(/isTokenBound/);
    expect((await erc3643ComplianceBound(await ctxFor(stack({ complianceHasIsTokenBound: false, complianceBound: false }).client))).status).toBe("fail");
  });

  it("erc3643.holder needs --holder; verified and not frozen -> pass", async () => {
    const { client } = stack();
    expect(await erc3643Holder(await ctxFor(client))).toMatchObject({ status: "unknown", evidence: { reason: "pass --holder <address>" } });
    const r = await erc3643Holder(await ctxFor(client, { holder: A.holder }));
    expect(r).toMatchObject({
      status: "pass",
      evidence: { identityRegistry: A.identityRegistry, holder: A.holder, isVerified: true, contains: true, investorCountry: 620, isFrozen: false, getFrozenTokens: 0n, balanceOf: 1000n },
    });
    expect(r.reproduce).toBe(`rwa-verify check erc3643.holder --chain ${CHAIN_ID} --token ${A.token} --holder ${A.holder}`);
    expect(await erc3643Holder(await ctxFor(stack({ holderVerified: false }).client, { holder: A.holder }))).toMatchObject({ status: "fail", evidence: { isVerified: false, contains: false, investorCountry: 0 } });
    expect(await erc3643Holder(await ctxFor(stack({ holderFrozen: true }).client, { holder: A.holder }))).toMatchObject({ status: "fail", evidence: { isVerified: true, isFrozen: true } });
  });

  it("erc7943.* facts for the probe account", async () => {
    const ctx = await ctxFor(stack().client);
    const ct = await erc7943CanTransfer(ctx);
    expect(ct).toMatchObject({ status: "pass", evidence: { variant: "IERC7943Fungible", allowed: false, args: [PROBE, PROBE, 0n] } });
    expect(await erc7943FrozenBalance(ctx)).toMatchObject({ status: "pass", evidence: { frozen: 0n } });
  });

  it("erc4626.* are unsupported on a non-vault and pass on a vault", async () => {
    const plain = await ctxFor(stack().client);
    expect((await erc4626Asset(plain)).status).toBe("unsupported");
    expect((await erc4626TotalAssets(plain)).status).toBe("unsupported");
    const vault = await ctxFor(stack({ vaultAsset: A.other }).client);
    expect(await erc4626Asset(vault)).toMatchObject({ status: "pass", evidence: { asset: A.other } });
    expect(await erc4626TotalAssets(vault)).toMatchObject({ status: "pass", evidence: { totalAssets: 42n } });
  });
});

describe("baseline checks on a non-ERC-165 token", () => {
  it("every baseline check is unsupported and none throws", async () => {
    const client = fakeClient({ chainId: CHAIN_ID, blockNumber: BLOCK, contracts: { [A.token]: contract(erc165Abi, {}) } });
    const ctx = await ctxFor(client);
    for (const id of BASELINE_CHECKS) {
      const r = await CHECKS[id](ctx);
      expect(r.id).toBe(id);
      expect(r.status, id).toBe("unsupported");
    }
  });

  it("erc3643.holder is unsupported, not unknown, when the token is not ERC-3643 even without --holder", async () => {
    const client = fakeClient({ chainId: CHAIN_ID, blockNumber: BLOCK, contracts: { [A.token]: contract(erc165Abi, {}) } });
    expect((await erc3643Holder(await ctxFor(client))).status).toBe("unsupported");
  });

  it("an RPC failure is unknown, not unsupported", async () => {
    const client = fakeClient({ chainId: CHAIN_ID, blockNumber: BLOCK, contracts: { [A.token]: () => rpcError() } });
    const ctx = await ctxFor(client);
    expect((await erc20Metadata(ctx)).status).toBe("unknown");
    expect((await erc3643ClaimTopics(ctx)).status).toBe("unknown");
  });

  it("a 7943 token whose canTransfer reverts violates the spec -> fail", async () => {
    const r = await erc7943CanTransfer(await ctxFor(stack({ canTransferReverts: true }).client));
    expect(r.status).toBe("fail");
    expect(r.evidence.reason).toMatch(/MUST NOT revert/);
  });
});
