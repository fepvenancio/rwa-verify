import type { CheckResult } from "@rwa-verify/core";
import type { JsonReport } from "@/lib/report";

// Optional history panel over the @rwa-verify/indexer API (packages/indexer/README.md). The subject / asset ids and
// stream keys are taken from the report's evidence as written by the readers; nothing is derived here.
// Never throws: no INDEXER_URL or an unreachable indexer renders a one-line note.

interface Query {
  label: string;
  path: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);

function queries(report: JsonReport): Query[] {
  const out: Query[] = [];
  const add = (label: string, path: string, params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, v);
    out.push({ label, path: `${path}?${q}` });
  };
  const ev = (c: CheckResult) => c.evidence;
  for (const c of report.identity.filter((c) => c.id === "erc8320.activeClaim")) {
    const assetId = str(ev(c).assetId);
    const claimType = str(ev(c).claimType);
    if (assetId && claimType) add("active claims", `/assets/${assetId}/active-claims`, { claimType });
  }
  for (const c of report.documents) {
    const subjectId = str(ev(c).subjectId);
    const role = str(ev(c).role);
    if (subjectId && role) add("active bundle", `/subjects/${subjectId}/active-bundle`, { role });
  }
  for (const c of report.valuation) {
    const subjectId = str(ev(c).subjectId);
    const currency = str(ev(c).currency);
    if (subjectId && currency) add("current snapshot", `/subjects/${subjectId}/current-snapshot`, { currency });
  }
  for (const c of report.compliance) {
    const subjectId = str(ev(c).subjectId);
    if (subjectId) add("terminal event", `/subjects/${subjectId}/terminal-event`, { type: str(ev(c).eventType) });
  }
  return out;
}

async function fetchJson(base: string, path: string): Promise<unknown> {
  const res = await fetch(`${base}${path}`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
  const body: unknown = await res.json();
  if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
  return body; // 404 bodies are informative ("no event recorded") and rendered as-is
}

const note = (text: string) => <p className="mt-6 text-xs text-zinc-500">history unavailable ({text})</p>;

export async function History({ report }: { report: JsonReport }) {
  const base = process.env.INDEXER_URL?.replace(/\/$/, "");
  if (!base) return note("INDEXER_URL not set");
  const qs = queries(report);
  if (qs.length === 0) return note("no subject in this report");
  const results = await Promise.allSettled(qs.map((q) => fetchJson(base, q.path)));
  if (results.every((r) => r.status === "rejected")) return note("indexer unreachable");
  return (
    <section className="mt-6">
      <h2 className="flex items-baseline gap-2 text-base font-semibold">
        History <span className="text-xs font-normal text-zinc-500">from the indexer, not from chain reads</span>
      </h2>
      <ul className="mt-2 divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {qs.map((q, i) => {
          const r = results[i]!;
          return (
            <li key={q.path} className="p-3 text-sm">
              <details>
                <summary className="cursor-pointer">
                  {q.label} <code className="text-xs text-zinc-500">{q.path}</code>
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
                  {r.status === "fulfilled" ? JSON.stringify(r.value, null, 2) : `unavailable: ${String(r.reason)}`}
                </pre>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
