// Discover ERC-3643 tokens on a chain from their `IdentityRegistryAdded(address)` events (via a Blockscout
// instance, which serves historical logs without a key) and run `verify` on each.
// Usage: pnpm exec tsx scripts/scan-erc3643.mts [chainId=1] [rpc=https://ethereum-rpc.publicnode.com] [blockscout=https://eth.blockscout.com]
import { createPublicClient, erc20Abi, http, keccak256, toHex } from "viem";
import { verify } from "../src/verify.js";

const [chainArg = "1", rpc = "https://ethereum-rpc.publicnode.com", blockscout = "https://eth.blockscout.com"] = process.argv.slice(2);
const chainId = Number(chainArg);
const topic = keccak256(toHex("IdentityRegistryAdded(address)"));
const res = (await (await fetch(`${blockscout}/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=${topic}`)).json()) as {
  result: { address: string }[] | string;
};
if (!Array.isArray(res.result)) throw new Error(`blockscout: ${res.result}`);
const tokens = [...new Set(res.result.map((l) => l.address.toLowerCase()))] as `0x${string}`[];
console.error(`${res.result.length} IdentityRegistryAdded logs, ${tokens.length} distinct emitters`);

const client = createPublicClient({ transport: http(rpc, { batch: true }) });
console.log(["token", "name", "symbol", "erc165", "IERC3643", "paused", "identityRegistry", "compliance"].join("\t"));
for (const token of tokens) {
  const [name, symbol] = await Promise.all(
    (["name", "symbol"] as const).map((fn) =>
      client.readContract({ address: token, abi: erc20Abi, functionName: fn }).catch(() => "?"),
    ),
  );
  try {
    const r = await verify({ client, chainId, token, registryHints: {}, rpc });
    const st = Object.fromEntries(r.baseline.map((c) => [c.id, c.status]));
    const det = r.baseline.find((c) => c.id === "erc165.detect")?.evidence as { erc165?: boolean; supports?: Record<string, boolean> };
    console.log(
      [token, String(name).slice(0, 28), String(symbol).slice(0, 10), det?.erc165, det?.supports?.IERC3643, st["erc3643.paused"], st["erc3643.identityRegistry"], st["erc3643.compliance"]].join("\t"),
    );
  } catch (e) {
    console.log([token, String(name).slice(0, 28), String(symbol).slice(0, 10), "ERR", (e as Error).message.slice(0, 60)].join("\t"));
  }
}
