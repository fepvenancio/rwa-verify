import { describe, expect, it } from "vitest";
import { activeClaim } from "./erc8320.js";
import { A, ASSET_ID, ctxFor, stack } from "../testing/stack.js";

const ANCHORED = ["IERC165", "IRegistryAnchor"] as const;

describe("erc8320.activeClaim", () => {
  it("asset approves the registry and has an active IDENTITY claim -> pass", async () => {
    const r = await activeClaim(await ctxFor(stack({ tokenDeclares: [...ANCHORED] }).client));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ registry: A.claimRegistry, assetId: ASSET_ID, trust: "asset-approved", registryApproved: true, claimTypeName: "IDENTITY" });
    expect((r.evidence.activeClaims as unknown[]).length).toBe(1);
    expect(r.reproduce).toBe(`rwa-verify check erc8320.activeClaim --chain 31337 --token ${A.token} --claim-registry ${A.claimRegistry} --claim-type 0`);
  });

  it("asset declares IRegistryAnchor but approves no registry -> fail", async () => {
    const r = await activeClaim(await ctxFor(stack({ tokenDeclares: [...ANCHORED], approvedRegistries: [] }).client));
    expect(r.status).toBe("fail");
    expect(r.evidence.reason).toMatch(/approves no registry/);
  });

  it("hinted registry the asset does not approve MUST be ignored -> fail", async () => {
    const { client } = stack({ tokenDeclares: [...ANCHORED], approvedRegistries: [] });
    const r = await activeClaim(await ctxFor(client, { claimRegistry: A.claimRegistry }));
    expect(r.status).toBe("fail");
    expect(r.evidence).toMatchObject({ registryApproved: false });
  });

  it("asset without IRegistryAnchor: registry-level trust, reported as such", async () => {
    const r = await activeClaim(await ctxFor(stack().client, { claimRegistry: A.claimRegistry }));
    expect(r.status).toBe("pass");
    expect(r.evidence).toMatchObject({ trust: "registry-level", assetDeclaresIRegistryAnchor: false });
  });

  it("no active claims -> fail", async () => {
    const r = await activeClaim(await ctxFor(stack({ claims: 0 }).client, { claimRegistry: A.claimRegistry }));
    expect(r.status).toBe("fail");
  });

  it("nothing declared, no hint -> unsupported; hinted contract not a registry -> unsupported", async () => {
    const { client } = stack();
    expect((await activeClaim(await ctxFor(client))).status).toBe("unsupported");
    expect((await activeClaim(await ctxFor(client, { claimRegistry: A.oracle }))).status).toBe("unsupported");
  });
});
