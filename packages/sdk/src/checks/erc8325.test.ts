import { describe, expect, it } from "vitest";
import { BINDING_SCOPE_TOKEN_ID, mutualBinding } from "./erc8325.js";
import { A, ANCHOR_ID, ctxFor, stack } from "../testing/stack.js";

const REG_WITH_RECOVERY = ["IERC165", "IAssetAnchorRegistry", "IAssetAnchorRegistryLifecycle", "IAssetAnchorRegistryRecovery"] as const;

describe("erc8325.mutualBinding", () => {
  it("passes for a conforming contract-scope binding", async () => {
    const r = await mutualBinding(await ctxFor(stack().client));
    expect(r.status).toBe("pass");
    expect(r.id).toBe("erc8325.mutualBinding");
    expect(r.evidence).toMatchObject({ blockNumber: 100n, registry: A.registry, anchorId: ANCHOR_ID });
    expect((r.evidence.conditions as Record<string, unknown>)["4_isBindingValid"]).toMatch(/not applicable/);
    expect(r.reproduce).toBe(`rwa-verify check erc8325.mutualBinding --chain 31337 --token ${A.token}`);
    expect(r.specRef.erc).toBe(8325);
  });

  it("condition 1: registry record names another token", async () => {
    const r = await mutualBinding(await ctxFor(stack({ record: { boundToken: A.other } as never }).client));
    expect(r.status).toBe("fail");
    expect(r.evidence.conditions).toMatchObject({ "1_recordMatches": false, "2_isBound": true });
  });

  it("condition 2: isBound false", async () => {
    const r = await mutualBinding(await ctxFor(stack({ isBound: false }).client));
    expect(r.status).toBe("fail");
    expect(r.evidence.conditions).toMatchObject({ "2_isBound": false });
  });

  it("condition 3: isActive false (deactivated or expired)", async () => {
    const r = await mutualBinding(await ctxFor(stack({ isActive: false }).client));
    expect(r.status).toBe("fail");
    expect(r.evidence.conditions).toMatchObject({ "3_isActive": false });
  });

  it("condition 4: isBindingValid false only matters when the registry declares Recovery", async () => {
    const withRecovery = await mutualBinding(await ctxFor(stack({ registryDeclares: [...REG_WITH_RECOVERY], isBindingValid: false }).client));
    expect(withRecovery.status).toBe("fail");
    expect(withRecovery.evidence.conditions).toMatchObject({ "4_isBindingValid": false });

    const validWithRecovery = await mutualBinding(await ctxFor(stack({ registryDeclares: [...REG_WITH_RECOVERY], isBindingValid: true }).client));
    expect(validWithRecovery.status).toBe("pass");

    // Without the Recovery interface the function is never called (registry returns false if asked).
    const noRecovery = await mutualBinding(await ctxFor(stack({ isBindingValid: false }).client));
    expect(noRecovery.status).toBe("pass");
    expect(noRecovery.evidence).not.toHaveProperty("isBindingValid");
  });

  it("condition 5: registry-side binding with no token-side interface is fail, not pass", async () => {
    const { client } = stack({ tokenDeclares: ["IERC165", "IERC3643"] });
    const r = await mutualBinding(await ctxFor(client, { anchorRegistry: A.registry, anchorId: ANCHOR_ID }));
    expect(r.status).toBe("fail");
    expect(r.evidence.conditions).toMatchObject({ "1_recordMatches": true, "2_isBound": true, "3_isActive": true, "5_tokenSideInterface": false, "6_tokenReportsSameRegistryAndAnchor": false });
    expect(r.evidence.reason).toMatch(/registry-side binding only/);
    expect(r.reproduce).toBe(`rwa-verify check erc8325.mutualBinding --chain 31337 --token ${A.token} --anchor-registry ${A.registry} --anchor-id ${ANCHOR_ID}`);
  });

  it("condition 6: token names a different registry than the one checked", async () => {
    const { client } = stack({ tokenRegistry: A.other });
    const r = await mutualBinding(await ctxFor(client, { anchorRegistry: A.registry }));
    expect(r.status).toBe("fail");
    expect(r.evidence.conditions).toMatchObject({ "5_tokenSideInterface": true, "6_tokenReportsSameRegistryAndAnchor": false });
  });

  it("token anchorId unknown to the registry: getAnchor reverts -> fail", async () => {
    const r = await mutualBinding(await ctxFor(stack({ tokenAnchorId: `0x${"ab".repeat(32)}` }).client));
    expect(r.status).toBe("fail");
    expect(r.evidence.errors).toHaveProperty("getAnchor");
  });

  it("token declares nothing and no hints: unsupported (ADR-004)", async () => {
    const r = await mutualBinding(await ctxFor(stack({ tokenDeclares: ["IERC165", "IERC3643"] }).client));
    expect(r.status).toBe("unsupported");
  });

  it("registry that is not an IAssetAnchorRegistry: fail", async () => {
    const r = await mutualBinding(await ctxFor(stack({ tokenRegistry: A.other }).client));
    expect(r.status).toBe("fail");
    expect(r.evidence.reason).toMatch(/does not declare IAssetAnchorRegistry/);
  });

  it("token-ID scope: needs --token-id, then checks TOKEN_ID scope and the token ID", async () => {
    const declares = ["IERC165", "IAssetBoundTokenId"] as const;
    const noId = await mutualBinding(await ctxFor(stack({ tokenDeclares: [...declares] }).client));
    expect(noId.status).toBe("unknown");

    const good = stack({ tokenDeclares: [...declares], record: { bindingScope: BINDING_SCOPE_TOKEN_ID, boundTokenId: 7n } as never });
    const pass = await mutualBinding(await ctxFor(good.client, {}, 7n));
    expect(pass.status).toBe("pass");
    expect(pass.reproduce).toContain("--token-id 7");

    const wrongId = await mutualBinding(await ctxFor(good.client, {}, 8n));
    expect(wrongId.status).toBe("fail");
    expect(wrongId.evidence.conditions).toMatchObject({ "1_recordMatches": false });
  });
});
