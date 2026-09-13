// REST surface over @rwa-verify/sdk. Query parameters are translated to CLI argv and handed to the
// readers CLI entry, so an API response is byte-for-byte what `rwa-verify` prints for the same inputs and
// the `reproduce` strings in it are the CLI's own. No verification logic lives here.
import { HINT_FLAGS, UsageError, runCli } from "@rwa-verify/sdk";

type Deps = NonNullable<Parameters<typeof runCli>[1]>; // { client? } — injectable for tests

export interface ApiResult {
  status: number;
  body: string; // JSON text
}

const RESERVED = new Set(["chain", "token", "tokenId", "rpc"]);

// Alchemy network slugs by chain id, used when ALCHEMY_API_KEY is set and no RPC_URL_<chainId> exists.
const ALCHEMY: Record<string, string> = {
  "1": "eth-mainnet", "11155111": "eth-sepolia", "17000": "eth-holesky",
  "137": "polygon-mainnet", "80002": "polygon-amoy",
  "42161": "arb-mainnet", "421614": "arb-sepolia",
  "10": "opt-mainnet", "11155420": "opt-sepolia",
  "8453": "base-mainnet", "84532": "base-sepolia",
  "56": "bnb-mainnet", "43114": "avax-mainnet", "100": "gnosis-mainnet",
  "324": "zksync-mainnet", "59144": "linea-mainnet", "534352": "scroll-mainnet",
  "5000": "mantle-mainnet", "81457": "blast-mainnet",
};

interface Rpc {
  url: string;
  secret?: string; // placeholder to show instead of the URL when it came from the environment
}

// Explicit `rpc` (echoed as-is), else RPC_URL_<chainId>, else Alchemy via ALCHEMY_API_KEY. Only http(s).
// Environment-derived URLs may embed API keys, so they are redacted from the response (see `redact`).
function resolveRpc(chain: string, explicit: string | null): Rpc {
  let rpc: Rpc | undefined;
  if (explicit) rpc = { url: explicit };
  else if (process.env[`RPC_URL_${chain}`]) rpc = { url: process.env[`RPC_URL_${chain}`]!, secret: `$RPC_URL_${chain}` };
  else if (process.env.ALCHEMY_API_KEY && ALCHEMY[chain])
    rpc = { url: `https://${ALCHEMY[chain]}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`, secret: "$RPC_URL" };
  if (!rpc) throw new UsageError(`no RPC for chain ${chain}: pass rpc=<url> or set RPC_URL_${chain} or ALCHEMY_API_KEY`);
  let parsed: URL | undefined;
  try {
    parsed = new URL(rpc.url);
  } catch {
    /* fallthrough */
  }
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) throw new UsageError("rpc must be an http(s) URL");
  return rpc;
}

// Environment RPC URLs never leave the server: every occurrence in the CLI output (reproduce strings,
// evidence) is replaced by a shell-variable placeholder, so commands stay runnable with `export RPC_URL=…`.
function redact(output: string, rpc: Rpc): string {
  return rpc.secret ? output.split(rpc.url).join(rpc.secret) : output;
}

// Hint parameters use the RegistryHints key names (`anchorRegistry=…`), see HINT_FLAGS.
export function argvFromQuery(q: URLSearchParams, checkId?: string): { argv: string[]; rpc: Rpc } {
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
  const rpc = resolveRpc(chain, q.get("rpc"));
  argv.push("--rpc", rpc.url);
  return { argv, rpc };
}

const errorBody = (error: string) => JSON.stringify({ error });

// 200 with the report / CheckResult (also for fail/stale: HTTP status describes the request, not the check),
// 400 for usage errors and chain-id mismatch, 502 when the RPC cannot be reached.
export async function run(q: URLSearchParams, checkId?: string, deps: Deps = {}): Promise<ApiResult> {
  let argv: string[];
  let rpc: Rpc;
  try {
    ({ argv, rpc } = argvFromQuery(q, checkId));
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
  const output = redact(r.output, rpc);
  if (r.exitCode === 2) return { status: 400, body: errorBody(output.split("\n")[0]!.replace(/^error: /, "")) };
  return { status: 200, body: output };
}

export function toResponse(r: ApiResult): Response {
  return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
