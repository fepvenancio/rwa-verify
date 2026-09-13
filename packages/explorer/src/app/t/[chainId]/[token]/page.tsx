import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { run } from "@/lib/api";
import { tokenIdentity, type JsonReport } from "@/lib/report";
import { History } from "@/components/History";
import { Panels, Summary } from "@/components/Report";

type Props = { params: Promise<{ chainId: string; token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function query({ params, searchParams }: Props): Promise<URLSearchParams> {
  const [{ chainId, token }, sp] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    // Report pages never accept a caller-supplied RPC: a shared link must not be able to show data from an
    // attacker's node under this explorer's name. The API keeps `rpc=` for programmatic use.
    if (k === "rpc") continue;
    const first = Array.isArray(v) ? v[0] : v;
    if (first !== undefined) q.set(k, first);
  }
  q.set("chain", chainId);
  q.set("token", token);
  return q;
}

// One verification per request: generateMetadata and the page share the result (keyed on the query string).
const verify = cache((qs: string) => run(new URLSearchParams(qs)));

export async function generateMetadata(props: Props): Promise<Metadata> {
  const q = await query(props);
  const r = await verify(q.toString());
  const symbol = r.status === 200 ? tokenIdentity(JSON.parse(r.body) as JsonReport)?.symbol : undefined;
  return { title: `${symbol ?? q.get("token")} — rwa-verify` };
}

// Renders exactly what GET /api/v1/verify returns for the same inputs; the query string carries tokenId and hints (never rpc).
export default async function TokenPage(props: Props) {
  const q = await query(props);
  const rpcOverride = "rpc" in (await props.searchParams);
  const r = rpcOverride
    ? { status: 400, body: JSON.stringify({ error: "rpc= is not accepted on report pages; use /api/v1/verify?rpc=… for a custom endpoint" }) }
    : await verify(q.toString());
  if (r.status !== 200) {
    const { error } = JSON.parse(r.body) as { error: string };
    return (
      <section className="mx-auto max-w-xl rounded border border-red-300 p-4 dark:border-red-900">
        <h1 className="font-semibold">Could not verify</h1>
        <p className="mt-2 font-mono text-sm break-all">{error}</p>
        <Link href="/" className="mt-3 inline-block text-sm hover:underline">
          Back to the form
        </Link>
      </section>
    );
  }
  const report = JSON.parse(r.body) as JsonReport;
  return (
    <>
      <Summary report={report} jsonHref={`/api/v1/verify?${q}`} />
      <Panels report={report} />
      <History report={report} />
    </>
  );
}
