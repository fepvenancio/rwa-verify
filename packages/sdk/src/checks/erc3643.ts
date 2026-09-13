import { ERC, type CheckResult, type Hex } from "@rwa-verify/core";
import { claimTopicsRegistryAbi, complianceAbi, erc20BalanceOfAbi, erc3643Abi, identityRegistryAbi, trustedIssuersRegistryAbi } from "../abi/erc3643.js";
import { read, type ReadResult } from "../call.js";
import { ZERO_ADDRESS, result, sameAddress, type Check, type CheckContext, type UsedHints } from "./context.js";

// ERC-3643 defines no ERC-165 ID in the spec text, so support is probed by calling. A revert
// means the token does not expose the function: `unsupported`. `declaresIERC3643` is the
// ERC-165 answer for the computed IERC3643 ID, evidence only.
async function fact<T>(
  ctx: CheckContext,
  id: string,
  functionName: "paused" | "identityRegistry" | "compliance" | "onchainID" | "version",
  judge: (value: T) => boolean,
) {
  const r = await read(ctx.client, { address: ctx.token, abi: erc3643Abi, functionName, blockNumber: ctx.blockNumber });
  const declaresIERC3643 = ctx.detection.supports.IERC3643;
  if (!r.ok) {
    return result(ctx, id, ERC.TREX, r.kind === "revert" ? "unsupported" : "unknown", { declaresIERC3643, error: r.message });
  }
  const value = r.value as T;
  return result(ctx, id, ERC.TREX, judge(value) ? "pass" : "fail", { declaresIERC3643, [functionName]: value });
}

// erc3643.paused — fail while the token is paused (all transfers blocked).
export const erc3643Paused: Check = (ctx) => fact<boolean>(ctx, "erc3643.paused", "paused", (paused) => !paused);

// erc3643.identityRegistry — fail when unset (zero address).
export const erc3643IdentityRegistry: Check = (ctx) =>
  fact<string>(ctx, "erc3643.identityRegistry", "identityRegistry", (a) => !sameAddress(a, ZERO_ADDRESS));

// erc3643.compliance — fail when unset (zero address).
export const erc3643Compliance: Check = (ctx) =>
  fact<string>(ctx, "erc3643.compliance", "compliance", (a) => !sameAddress(a, ZERO_ADDRESS));

// The deeper checks hang off identityRegistry(): a token that does not answer it is not ERC-3643
// (`unsupported`; RPC error `unknown`). Every read below maps the same way — a revert means the
// contract lacks the function (older T-REX), never a conformance failure.
function notAnswered(ctx: CheckContext, id: string, r: ReadResult<unknown> & { ok: false }, evidence: Record<string, unknown> = {}, used?: UsedHints) {
  return result(ctx, id, ERC.TREX, r.kind === "revert" ? "unsupported" : "unknown", { ...evidence, error: r.message }, used);
}

async function onTrex(ctx: CheckContext, id: string, body: (identityRegistry: Hex) => Promise<CheckResult>, used?: UsedHints): Promise<CheckResult> {
  const r = await read(ctx.client, { address: ctx.token, abi: erc3643Abi, functionName: "identityRegistry", blockNumber: ctx.blockNumber });
  return r.ok ? body(r.value) : notAnswered(ctx, id, r, {}, used);
}

// erc3643.onchainID — the token's own ONCHAINID; fail when unset (zero address).
export const erc3643OnchainID: Check = (ctx) =>
  onTrex(ctx, "erc3643.onchainID", () => fact<string>(ctx, "erc3643.onchainID", "onchainID", (a) => !sameAddress(a, ZERO_ADDRESS)));

// erc3643.version — fail when empty; unsupported when the token has no version() (older T-REX).
export const erc3643Version: Check = (ctx) => onTrex(ctx, "erc3643.version", () => fact<string>(ctx, "erc3643.version", "version", (v) => v.length > 0));

// erc3643.registryWiring — the identity registry names its storage, issuers and topics registries.
export const erc3643RegistryWiring: Check = (ctx) =>
  onTrex(ctx, "erc3643.registryWiring", async (identityRegistry) => {
    const id = "erc3643.registryWiring";
    const { client, blockNumber } = ctx;
    const [storage, issuers, topics] = await Promise.all([
      read(client, { address: identityRegistry, abi: identityRegistryAbi, functionName: "identityStorage", blockNumber }),
      read(client, { address: identityRegistry, abi: identityRegistryAbi, functionName: "issuersRegistry", blockNumber }),
      read(client, { address: identityRegistry, abi: identityRegistryAbi, functionName: "topicsRegistry", blockNumber }),
    ]);
    if (!storage.ok) return notAnswered(ctx, id, storage, { identityRegistry, function: "identityStorage" });
    if (!issuers.ok) return notAnswered(ctx, id, issuers, { identityRegistry, function: "issuersRegistry" });
    if (!topics.ok) return notAnswered(ctx, id, topics, { identityRegistry, function: "topicsRegistry" });
    const wiring = { identityStorage: storage.value, issuersRegistry: issuers.value, topicsRegistry: topics.value };
    const ok = Object.values(wiring).every((a) => !sameAddress(a, ZERO_ADDRESS));
    return result(ctx, id, ERC.TREX, ok ? "pass" : "fail", { identityRegistry, ...wiring });
  });

// erc3643.claimTopics — fail when no claim topics are required to hold the token.
export const erc3643ClaimTopics: Check = (ctx) =>
  onTrex(ctx, "erc3643.claimTopics", async (identityRegistry) => {
    const id = "erc3643.claimTopics";
    const { client, blockNumber } = ctx;
    const registry = await read(client, { address: identityRegistry, abi: identityRegistryAbi, functionName: "topicsRegistry", blockNumber });
    if (!registry.ok) return notAnswered(ctx, id, registry, { identityRegistry });
    const topics = await read(client, { address: registry.value, abi: claimTopicsRegistryAbi, functionName: "getClaimTopics", blockNumber });
    if (!topics.ok) return notAnswered(ctx, id, topics, { topicsRegistry: registry.value });
    const claimTopics = topics.value.map(String);
    return result(ctx, id, ERC.TREX, claimTopics.length > 0 ? "pass" : "fail", { topicsRegistry: registry.value, claimTopics });
  });

// erc3643.trustedIssuers — fail when no issuer is trusted (nobody can attest the claim topics).
export const erc3643TrustedIssuers: Check = (ctx) =>
  onTrex(ctx, "erc3643.trustedIssuers", async (identityRegistry) => {
    const id = "erc3643.trustedIssuers";
    const { client, blockNumber } = ctx;
    const registry = await read(client, { address: identityRegistry, abi: identityRegistryAbi, functionName: "issuersRegistry", blockNumber });
    if (!registry.ok) return notAnswered(ctx, id, registry, { identityRegistry });
    const issuers = await read(client, { address: registry.value, abi: trustedIssuersRegistryAbi, functionName: "getTrustedIssuers", blockNumber });
    if (!issuers.ok) return notAnswered(ctx, id, issuers, { issuersRegistry: registry.value });
    const perIssuer = await Promise.all(
      issuers.value.map((issuer) => read(client, { address: registry.value, abi: trustedIssuersRegistryAbi, functionName: "getTrustedIssuerClaimTopics", args: [issuer], blockNumber })),
    );
    const trustedIssuers: { issuer: Hex; claimTopics: string[] }[] = [];
    for (const [i, issuer] of issuers.value.entries()) {
      const topics = perIssuer[i]!;
      if (!topics.ok) return notAnswered(ctx, id, topics, { issuersRegistry: registry.value, issuer });
      trustedIssuers.push({ issuer, claimTopics: topics.value.map(String) });
    }
    return result(ctx, id, ERC.TREX, trustedIssuers.length > 0 ? "pass" : "fail", { issuersRegistry: registry.value, trustedIssuers });
  });

// erc3643.complianceBound — the compliance contract acknowledges this token. Older compliance
// contracts lack isTokenBound(); then getTokenBound() must name the token.
export const erc3643ComplianceBound: Check = (ctx) =>
  onTrex(ctx, "erc3643.complianceBound", async () => {
    const id = "erc3643.complianceBound";
    const { client, token, blockNumber } = ctx;
    const compliance = await read(client, { address: token, abi: erc3643Abi, functionName: "compliance", blockNumber });
    if (!compliance.ok) return notAnswered(ctx, id, compliance);
    const bound = await read(client, { address: compliance.value, abi: complianceAbi, functionName: "isTokenBound", args: [token], blockNumber });
    if (bound.ok) return result(ctx, id, ERC.TREX, bound.value ? "pass" : "fail", { compliance: compliance.value, isTokenBound: bound.value });
    if (bound.kind === "error") return notAnswered(ctx, id, bound, { compliance: compliance.value });
    const tokenBound = await read(client, { address: compliance.value, abi: complianceAbi, functionName: "getTokenBound", blockNumber });
    const evidence = { compliance: compliance.value, isTokenBoundError: bound.message };
    if (!tokenBound.ok) return notAnswered(ctx, id, tokenBound, evidence);
    return result(ctx, id, ERC.TREX, sameAddress(tokenBound.value, token) ? "pass" : "fail", { ...evidence, getTokenBound: tokenBound.value });
  });

// erc3643.holder — can --holder hold the token: verified in the identity registry and not frozen.
// Without --holder the token still supports the check; the input is missing -> `unknown`.
export const erc3643Holder: Check = (ctx) => {
  const id = "erc3643.holder";
  const holder = ctx.hints.holder;
  const used = { holder };
  return onTrex(ctx, id, async (identityRegistry) => {
    if (!holder) return result(ctx, id, ERC.TREX, "unknown", { reason: "pass --holder <address>" }, used);
    const { client, token, blockNumber } = ctx;
    const [verified, contains, country, frozen, frozenTokens, balance] = await Promise.all([
      read(client, { address: identityRegistry, abi: identityRegistryAbi, functionName: "isVerified", args: [holder], blockNumber }),
      read(client, { address: identityRegistry, abi: identityRegistryAbi, functionName: "contains", args: [holder], blockNumber }),
      read(client, { address: identityRegistry, abi: identityRegistryAbi, functionName: "investorCountry", args: [holder], blockNumber }),
      read(client, { address: token, abi: erc3643Abi, functionName: "isFrozen", args: [holder], blockNumber }),
      read(client, { address: token, abi: erc3643Abi, functionName: "getFrozenTokens", args: [holder], blockNumber }),
      read(client, { address: token, abi: erc20BalanceOfAbi, functionName: "balanceOf", args: [holder], blockNumber }),
    ]);
    const reads = { isVerified: verified, contains, investorCountry: country, isFrozen: frozen, getFrozenTokens: frozenTokens, balanceOf: balance };
    for (const [fn, r] of Object.entries(reads)) {
      if (!r.ok) return notAnswered(ctx, id, r, { identityRegistry, holder, function: fn }, used);
    }
    if (!verified.ok || !contains.ok || !country.ok || !frozen.ok || !frozenTokens.ok || !balance.ok) throw new Error("unreachable");
    const ok = verified.value && !frozen.value;
    return result(ctx, id, ERC.TREX, ok ? "pass" : "fail", {
      identityRegistry,
      holder,
      isVerified: verified.value,
      contains: contains.value,
      investorCountry: country.value,
      isFrozen: frozen.value,
      getFrozenTokens: frozenTokens.value,
      balanceOf: balance.value,
    }, used);
  }, used);
};
