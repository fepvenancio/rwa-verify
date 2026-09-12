import { describe, expect, it } from "vitest";
import { erc165Abi } from "../abi/erc165.js";
import { BASELINE_CHECKS, CHECKS } from "./index.js";
import { erc165Detect } from "./erc165.js";
import { erc3643Compliance, erc3643IdentityRegistry, erc3643Paused } from "./erc3643.js";
import { erc4626Asset, erc4626TotalAssets } from "./erc4626.js";
import { PROBE, erc7943CanTransfer, erc7943FrozenBalance } from "./erc7943.js";
import { contract, fakeClient } from "../testing/fakeChain.js";
import { A, BLOCK, CHAIN_ID, ctxFor, stack } from "../testing/stack.js";

describe("baseline checks on a conforming 3643 + 7943 token", () => {
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

  it("a 7943 token whose canTransfer reverts violates the spec -> fail", async () => {
    const r = await erc7943CanTransfer(await ctxFor(stack({ canTransferReverts: true }).client));
    expect(r.status).toBe("fail");
    expect(r.evidence.reason).toMatch(/MUST NOT revert/);
  });
});
