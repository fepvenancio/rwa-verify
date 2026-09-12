import type { PublicClient } from "viem";
import { SPEC_COMMIT, type CheckResult, type Hex, type VerificationReport } from "@rwa-verify/core";
import { BASELINE_CHECKS, CHECKS } from "./checks/index.js";
import type { CheckContext, RegistryHints } from "./checks/context.js";
import { activeClaim } from "./checks/erc8320.js";
import { mutualBinding } from "./checks/erc8325.js";
import { activeBundle } from "./checks/erc8326.js";
import { latestCurrentEvent } from "./checks/erc8328.js";
import { navFresh } from "./checks/erc8330.js";
import { detect } from "./detect.js";
import { selectIdentity } from "./identity/select.js";

export interface VerifyOptions {
  client: PublicClient;
  chainId: number;
  token: Hex;
  tokenId?: bigint;
  registryHints?: RegistryHints;
  rpc?: string; // echoed into reproduce strings
}

export async function verify(o: VerifyOptions): Promise<VerificationReport> {
  const { client, chainId, token, tokenId } = o;
  const blockNumber = await client.getBlockNumber();
  const detection = await detect(client, token, blockNumber);
  const ctx: CheckContext = {
    client,
    chainId,
    token,
    blockNumber,
    detection,
    hints: o.registryHints ?? {},
    ...(tokenId !== undefined ? { tokenId } : {}),
    ...(o.rpc ? { rpc: o.rpc } : {}),
  };

  const baseline = await Promise.all(BASELINE_CHECKS.map((id) => CHECKS[id](ctx)));

  // Identity: both checks always appear; each reports `unsupported` when the token declares nothing.
  const identity: CheckResult[] = await Promise.all([mutualBinding(ctx), activeClaim(ctx)]);

  // Join key(s) for 8326/8328/8330. An explicit --subject overrides the adapters.
  const subjects: { standard: string; subjectId: Hex }[] = [];
  if (ctx.hints.subjectId) {
    subjects.push({ standard: "hint", subjectId: ctx.hints.subjectId });
  } else {
    for (const adapter of await selectIdentity(ctx)) {
      try {
        subjects.push({ standard: adapter.standard, subjectId: await adapter.subjectId() });
      } catch {
        // The corresponding identity check already reports why the subject is unavailable.
      }
    }
  }
  const distinct = [...new Map(subjects.map((s) => [s.subjectId.toLowerCase(), s])).values()];
  if (distinct.length > 1) {
    identity.push({
      id: "identity.subjectMismatch",
      status: "fail",
      evidence: { blockNumber, subjects },
      reproduce: reproduceVerify(ctx),
      specRef: { erc: 8325, commit: SPEC_COMMIT },
    });
  }

  const perSubject = distinct.length > 0 ? distinct.map((s) => s.subjectId) : [undefined];
  const run = (check: (c: CheckContext) => Promise<CheckResult>) =>
    Promise.all(perSubject.map((subjectId) => check(subjectId ? { ...ctx, hints: { ...ctx.hints, subjectId } } : ctx)));
  const [documents, valuation, compliance] = await Promise.all([run(activeBundle), run(navFresh), run(latestCurrentEvent)]);

  return {
    chainId,
    token,
    ...(tokenId !== undefined ? { tokenId } : {}),
    baseline,
    identity,
    documents,
    valuation,
    compliance,
    generatedAt: new Date().toISOString(),
  };
}

function reproduceVerify(ctx: CheckContext): string {
  const parts = ["rwa-verify", ctx.token, "--chain", String(ctx.chainId)];
  if (ctx.tokenId !== undefined) parts.push("--token-id", ctx.tokenId.toString());
  if (ctx.rpc) parts.push("--rpc", ctx.rpc);
  return parts.join(" ");
}

// JSON with bigint rendered as decimal strings.
export function reportToJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);
}
