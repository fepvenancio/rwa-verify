import { describe, expect, it } from "vitest";
import { selectIdentity } from "./select.js";
import { A, ANCHOR_ID, ASSET_ID, ctxFor, stack } from "../testing/stack.js";

describe("selectIdentity (ADR-002)", () => {
  it("token declaring only IAssetBoundToken -> erc8325 adapter", async () => {
    const adapters = await selectIdentity(await ctxFor(stack().client));
    expect(adapters.map((a) => a.standard)).toEqual(["erc8325"]);
    expect(await adapters[0]!.subjectId()).toBe(ANCHOR_ID);
    expect(await adapters[0]!.registries()).toEqual([A.registry]);
    expect((await adapters[0]!.isBound()).id).toBe("erc8325.mutualBinding");
  });

  it("token declaring both -> both adapters, each with its own subject", async () => {
    const adapters = await selectIdentity(await ctxFor(stack({ tokenDeclares: ["IERC165", "IAssetBoundToken", "IRegistryAnchor"] }).client));
    expect(adapters.map((a) => a.standard)).toEqual(["erc8325", "erc8320"]);
    const erc8320 = adapters[1]!;
    expect(await erc8320.subjectId()).toBe(ASSET_ID);
    expect(await erc8320.registries()).toEqual([A.claimRegistry]);
    expect((await erc8320.isBound()).id).toBe("erc8320.activeClaim");
  });

  it("token declaring nothing -> no adapters, unless a claim registry is hinted", async () => {
    const { client } = stack({ tokenDeclares: ["IERC165"] });
    expect(await selectIdentity(await ctxFor(client))).toEqual([]);
    const hinted = await selectIdentity(await ctxFor(client, { claimRegistry: A.claimRegistry }));
    expect(hinted.map((a) => a.standard)).toEqual(["erc8320"]);
    expect(await hinted[0]!.registries()).toEqual([A.claimRegistry]);
  });

  it("erc8325 subjectId rejects when the token-side getters fail", async () => {
    const [adapter] = await selectIdentity(await ctxFor(stack({ tokenDeclares: ["IERC165", "IAssetBoundTokenId"] }).client));
    await expect(adapter!.subjectId()).rejects.toThrow(/needsTokenId/);
  });
});
