"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const input = "w-full rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900";

// Pure input collection: builds /t/<chainId>/<token>?… and navigates. Validation happens server-side in readers.
export function VerifyForm({ hints }: { hints: [key: string, flag: string][] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const chainId = String(data.get("chain") ?? "").trim();
    const token = String(data.get("token") ?? "").trim();
    const q = new URLSearchParams();
    for (const [key, value] of data) {
      const v = String(value).trim();
      if (key !== "chain" && key !== "token" && v) q.set(key, v);
    }
    setPending(true);
    router.push(`/t/${encodeURIComponent(chainId)}/${encodeURIComponent(token)}${q.size ? `?${q}` : ""}`);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Chain id
        <input name="chain" required inputMode="numeric" pattern="\d+" placeholder="1" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Token address
        <input name="token" required pattern="0x[0-9a-fA-F]{40}" placeholder="0x…" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Token id <span className="text-zinc-500">(optional, ERC-8325 token-id bindings / ERC-7943 NFT variants)</span>
        <input name="tokenId" inputMode="numeric" pattern="\d+" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        RPC URL <span className="text-zinc-500">(optional; the server default for the chain is used otherwise)</span>
        <input name="rpc" type="url" placeholder="https://…" className={input} />
      </label>
      <details className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
        <summary className="cursor-pointer">Advanced: registry hints</summary>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          ERC-8326 / 8328 / 8330 have no token-side discovery; supply the contract addresses and stream keys here. Each maps to the CLI flag shown.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {hints.map(([key, flag]) => (
            <label key={key} className="flex flex-col gap-1">
              <span>
                {key} <code className="text-zinc-500">{flag}</code>
              </span>
              <input name={key} className={input} />
            </label>
          ))}
        </div>
      </details>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Verifying…" : "Verify"}
      </button>
      {hints.some(([key]) => key === "holder") && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">For ERC-3643 tokens add a holder address (under registry hints) to check verification and freeze status.</p>
      )}
    </form>
  );
}
