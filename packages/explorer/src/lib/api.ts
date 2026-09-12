// REST surface over @rwa-verify/readers. Query parameters are translated to CLI argv and handed to the
// readers CLI entry, so an API response is byte-for-byte what `rwa-verify` prints for the same inputs and
// the `reproduce` strings in it are the CLI's own. No verification logic lives here.
import { HINT_FLAGS, UsageError, runCli } from "@rwa-verify/readers";

type Deps = NonNullable<Parameters<typeof runCli>[1]>; // { client? } — injectable for tests

export interface ApiResult {
  status: number;
  body: string; // JSON text
}

const RESERVED = new Set(["chain", "token", "tokenId", "rpc"]);

// Explicit `rpc`, else RPC_URL_<chainId>. Only http(s). Note: the URL is echoed into `reproduce` strings.
function resolveRpc(chain: string, explicit: string | null): string {
  const url = explicit || process.env[`RPC_URL_${chain}`];
  if (!url) throw new UsageError(`no RPC for chain ${chain}: pass rpc=<url> or set RPC_URL_${chain}`);
  let parsed: URL | undefined;
  try {
    parsed = new URL(url);
  } catch {
    /* fallthrough */
  }
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) throw new UsageError("rpc must be an http(s) URL");
  return url;
}

// Hint parameters use the RegistryHints key names (`anchorRegistry=…`), see HINT_FLAGS.
export function argvFromQuery(q: URLSearchParams, checkId?: string): string[] {
  const chain = q.get("chain");
  const token = q.get("token");
  if (!chain || !/^\d+$/.test(chain)) throw new UsageError("chain must be a numeric chain id");
  if (!token) throw new UsageError("token is required");
  const argv = checkId ? ["check", checkId, "--token", token] : [token];
  argv.push("--chain", chain);
  const tokenId = q.get("tokenId");
  if (tokenId) argv.push("--token-id", tokenId);
  for (const [key, value] of q) {
    if (RESERVED.has(key)) continue;
    if (!Object.hasOwn(HINT_FLAGS, key)) throw new UsageError(`unknown query parameter: ${key}`);
    if (value) argv.push(HINT_FLAGS[key as keyof typeof HINT_FLAGS], value);
  }
  argv.push("--rpc", resolveRpc(chain, q.get("rpc")));
  return argv;
}

const errorBody = (error: string) => JSON.stringify({ error });

// 200 with the report / CheckResult (also for fail/stale: HTTP status describes the request, not the check),
// 400 for usage errors and chain-id mismatch, 502 when the RPC cannot be reached.
export async function run(q: URLSearchParams, checkId?: string, deps: Deps = {}): Promise<ApiResult> {
  let argv: string[];
  try {
    argv = argvFromQuery(q, checkId);
  } catch (err) {
    if (err instanceof UsageError) return { status: 400, body: errorBody(err.message) };
    throw err;
  }
  let r: Awaited<ReturnType<typeof runCli>>;
  try {
    r = await runCli(argv, deps);
  } catch (err) {
    const msg = err && typeof err === "object" && "shortMessage" in err ? String(err.shortMessage) : String(err);
    return { status: 502, body: errorBody(`rpc: ${msg}`) };
  }
  if (r.exitCode === 2) return { status: 400, body: errorBody(r.output.split("\n")[0]!.replace(/^error: /, "")) };
  return { status: 200, body: r.output };
}

export function toResponse(r: ApiResult): Response {
  return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
