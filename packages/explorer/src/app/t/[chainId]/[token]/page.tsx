import Link from "next/link";
import { run } from "@/lib/api";
import type { JsonReport } from "@/lib/report";
import { History } from "@/components/History";
import { Panels, Summary } from "@/components/Report";

type SearchParams = Record<string, string | string[] | undefined>;

// Renders exactly what GET /api/v1/verify returns for the same inputs; the query string carries tokenId, rpc and hints.
export default async function TokenPage({ params, searchParams }: { params: Promise<{ chainId: string; token: string }>; searchParams: Promise<SearchParams> }) {
  const [{ chainId, token }, sp] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (first !== undefined) q.set(k, first);
  }
  q.set("chain", chainId);
  q.set("token", token);

  const r = await run(q);
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
