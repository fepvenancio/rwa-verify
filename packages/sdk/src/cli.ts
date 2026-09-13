#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createPublicClient, http, isAddress, type PublicClient } from "viem";
import type { CheckResult, Hex } from "@rwa-verify/core";
import { CHECKS, type CheckId } from "./checks/index.js";
import { HINT_FLAGS, type CheckContext, type RegistryHints } from "./checks/context.js";
import { detect } from "./detect.js";
import { reportToJson, verify } from "./verify.js";

export const USAGE = `usage:
  rwa-verify <token> --chain <id> --rpc <url> [--token-id <n>] [hints]
  rwa-verify check <check-id> --chain <id> --rpc <url> --token <address> [--token-id <n>] [hints]

hints (addresses the token cannot tell us about; all optional):
  --subject <bytes32>           join key for 8326/8328/8330 (overrides identity adapters)
  --anchor-registry <address>   ERC-8325 registry expected to hold the binding
  --anchor-id <bytes32>         ERC-8325 anchor (only when the token has no token-side interface)
  --claim-registry <address>    ERC-8320 claim registry
  --claim-type <0-7>            ERC-8320 ClaimType ordinal (default 0 = IDENTITY)
  --document-anchor <address>   ERC-8326 anchor contract
  --role <bytes32>              ERC-8326 slot role
  --nav-oracle <address>        ERC-8330 oracle
  --currency <bytes32>          ERC-8330 stream currency
  --event-log <address>         ERC-8328 log
  --event-type <bytes32>        ERC-8328 event type (default: last recorded event)

check ids: ${Object.keys(CHECKS).join(", ")}
exit codes: 0 pass/unsupported/unknown, 1 fail/stale, 2 usage error`;

export class UsageError extends Error {}

export interface CliArgs {
  command: "verify" | "check";
  checkId?: CheckId;
  token: Hex;
  chainId: number;
  tokenId?: bigint;
  rpc?: string;
  hints: RegistryHints;
}

const ADDRESS_HINTS = new Set<keyof RegistryHints>(["anchorRegistry", "claimRegistry", "documentAnchor", "navOracle", "eventLog"]);
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const FLAG_TO_HINT = Object.fromEntries(Object.entries(HINT_FLAGS).map(([k, v]) => [v, k])) as Record<string, keyof RegistryHints>;

export function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const v = argv[++i];
    if (v === undefined || v.startsWith("--")) throw new UsageError(`${a} needs a value`);
    if (a in flags) throw new UsageError(`${a} given twice`);
    flags[a] = v;
  }

  let command: CliArgs["command"];
  let checkId: CheckId | undefined;
  let token: string | undefined;
  if (positional[0] === "check") {
    command = "check";
    if (positional.length !== 2) throw new UsageError("check needs exactly one <check-id>");
    if (!(positional[1]! in CHECKS)) throw new UsageError(`unknown check id: ${positional[1]}`);
    checkId = positional[1] as CheckId;
    token = flags["--token"];
  } else {
    command = "verify";
    if (positional.length !== 1) throw new UsageError("expected exactly one <token>");
    if ("--token" in flags) throw new UsageError("pass the token as the positional argument");
    token = positional[0];
  }
  if (!token || !isAddress(token, { strict: false })) throw new UsageError("--token / <token> must be an address");
  if (!flags["--chain"] || !/^\d+$/.test(flags["--chain"])) throw new UsageError("--chain <id> is required");

  const hints: RegistryHints = {};
  for (const [flag, raw] of Object.entries(flags)) {
    if (flag === "--token" || flag === "--chain" || flag === "--rpc" || flag === "--token-id") continue;
    const key = FLAG_TO_HINT[flag];
    if (!key) throw new UsageError(`unknown flag: ${flag}`);
    if (key === "claimType") {
      if (!/^[0-7]$/.test(raw)) throw new UsageError("--claim-type must be 0-7");
      hints.claimType = Number(raw);
    } else if (ADDRESS_HINTS.has(key)) {
      if (!isAddress(raw, { strict: false })) throw new UsageError(`${flag} must be an address`);
      hints[key] = raw as Hex;
    } else {
      if (!BYTES32.test(raw)) throw new UsageError(`${flag} must be a bytes32 hex value`);
      hints[key] = raw as Hex;
    }
  }
  if (flags["--token-id"] !== undefined && !/^\d+$/.test(flags["--token-id"])) throw new UsageError("--token-id must be a non-negative integer");

  return {
    command,
    ...(checkId ? { checkId } : {}),
    token: token as Hex,
    chainId: Number(flags["--chain"]),
    ...(flags["--token-id"] !== undefined ? { tokenId: BigInt(flags["--token-id"]) } : {}),
    ...(flags["--rpc"] ? { rpc: flags["--rpc"] } : {}),
    hints,
  };
}

const FAILING = new Set(["fail", "stale"]);

// `client` is injectable for tests; otherwise --rpc is required.
export async function runCli(argv: string[], deps: { client?: PublicClient } = {}): Promise<{ exitCode: number; output: string }> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
    if (!deps.client && !args.rpc) throw new UsageError("--rpc <url> is required");
  } catch (err) {
    if (err instanceof UsageError) return { exitCode: 2, output: `error: ${err.message}\n\n${USAGE}` };
    throw err;
  }
  const client = deps.client ?? createPublicClient({ transport: http(args.rpc!) });
  const actual = await client.getChainId();
  if (actual !== args.chainId) return { exitCode: 2, output: `error: --chain ${args.chainId} but the RPC reports chain ${actual}` };

  const common = { ...(args.tokenId !== undefined ? { tokenId: args.tokenId } : {}), ...(args.rpc ? { rpc: args.rpc } : {}) };
  if (args.command === "verify") {
    const report = await verify({ client, chainId: args.chainId, token: args.token, registryHints: args.hints, ...common });
    const all = [...report.baseline, ...report.identity, ...report.documents, ...report.valuation, ...report.compliance];
    return { exitCode: all.some((c) => FAILING.has(c.status)) ? 1 : 0, output: reportToJson(report) };
  }
  const blockNumber = await client.getBlockNumber();
  const ctx: CheckContext = { client, chainId: args.chainId, token: args.token, blockNumber, detection: await detect(client, args.token, blockNumber), hints: args.hints, ...common };
  const result: CheckResult = await CHECKS[args.checkId!](ctx);
  return { exitCode: FAILING.has(result.status) ? 1 : 0, output: reportToJson(result) };
}

const entry = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : undefined;
if (entry === import.meta.url) {
  runCli(process.argv.slice(2)).then(
    ({ exitCode, output }) => {
      console.log(output);
      process.exit(exitCode);
    },
    (err: unknown) => {
      // Transport / RPC failure before any CheckResult could be produced.
      const msg = err && typeof err === "object" && "shortMessage" in err ? String(err.shortMessage) : String(err);
      console.error(`error: ${msg}`);
      process.exit(1);
    },
  );
}
