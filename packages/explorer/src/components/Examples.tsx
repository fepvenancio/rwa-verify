import Link from "next/link";

// Mainnet tokens a first-time visitor can open without typing anything (docs/known-erc3643-mainnet.md).
const EXAMPLES = [
  { name: "Ecowatt", note: "ERC-3643, mainnet", chainId: 1, token: "0x724ba15845719549ea1ea2f0aac9d75d31dbd818" },
  { name: "Spark sDAI", note: "ERC-4626, mainnet", chainId: 1, token: "0x83F20F44975D03b1b09e64809B757c47f942BEeA" },
  { name: "Tokeny TOK", note: "ERC-3643, paused", chainId: 1, token: "0xc1f8aa1ba9cef0b7e3e0e7887687e176c66759cc" },
];

export function Examples() {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {EXAMPLES.map((e) => (
        <li key={e.token}>
          <Link
            href={`/t/${e.chainId}/${e.token}`}
            title={e.token}
            className="block rounded border border-zinc-200 p-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <span className="font-semibold">{e.name}</span>
            <span className="mt-0.5 block text-xs text-zinc-500">{e.note}</span>
            <span className="mt-1 block font-mono text-xs text-zinc-600 dark:text-zinc-400">
              {e.token.slice(0, 6)}…{e.token.slice(-4)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
