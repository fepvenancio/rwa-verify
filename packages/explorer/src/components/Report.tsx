import type { CheckResult, CheckStatus } from "@rwa-verify/core";
import { CopyButton } from "./CopyButton";
import { SECTIONS, type JsonReport } from "@/lib/report";

const STATUSES: CheckStatus[] = ["pass", "fail", "stale", "unsupported", "unknown"];

// Colour plus the status word itself, so the meaning never depends on colour alone.
const BADGE: Record<CheckStatus, string> = {
  pass: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200",
  fail: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  stale: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  unsupported: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
  unknown: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
};

export function Badge({ status }: { status: CheckStatus }) {
  return <span className={`inline-block rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase ${BADGE[status]}`}>{status}</span>;
}

const mono = "font-mono text-xs break-all";

export function Summary({ report, jsonHref }: { report: JsonReport; jsonHref: string }) {
  const all = SECTIONS.flatMap((s) => report[s.key]);
  const counts = STATUSES.map((st) => [st, all.filter((c) => c.status === st).length] as const).filter(([, n]) => n > 0);
  const blockNumber = report.baseline[0]?.evidence.blockNumber;
  return (
    <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <h1 className="text-lg font-semibold">
        Token <span className={mono}>{report.token}</span>
      </h1>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-zinc-500">chain</dt>
        <dd className={mono}>{report.chainId}</dd>
        {report.tokenId !== undefined && (
          <>
            <dt className="text-zinc-500">tokenId</dt>
            <dd className={mono}>{report.tokenId}</dd>
          </>
        )}
        {blockNumber !== undefined && (
          <>
            <dt className="text-zinc-500">block</dt>
            <dd className={mono}>{String(blockNumber)}</dd>
          </>
        )}
        <dt className="text-zinc-500">generated</dt>
        <dd className={mono}>{report.generatedAt}</dd>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {counts.map(([st, n]) => (
          <span key={st} className="flex items-center gap-1 text-sm">
            <Badge status={st} /> {n}
          </span>
        ))}
        <a href={jsonHref} className="ml-auto text-sm text-zinc-600 hover:underline dark:text-zinc-400">
          JSON
        </a>
      </div>
      <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
        <strong>unsupported</strong> means the token does not declare that standard, not that it failed (ADR-004). Every check pins its reads to one block; the
        command under each row re-runs it.
      </p>
    </section>
  );
}

export function Panels({ report }: { report: JsonReport }) {
  return (
    <>
      {SECTIONS.map((s) => (
        <section key={s.key} className="mt-6">
          <h2 className="flex items-baseline gap-2 text-base font-semibold">
            {s.title} <span className="text-xs font-normal text-zinc-500">{s.ercs}</span>
          </h2>
          <ul className="mt-2 divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {report[s.key].map((c, i) => (
              <li key={`${c.id}-${i}`}>
                <CheckRow check={c} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  const scalars = Object.entries(check.evidence).filter(([, v]) => v === null || typeof v !== "object");
  const { erc, commit } = check.specRef;
  return (
    <div className="flex flex-col gap-2 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={check.status} />
        <span className="font-mono font-medium">{check.id}</span>
        <span className="ml-auto text-xs text-zinc-500">
          <a href={`https://eips.ethereum.org/EIPS/eip-${erc}`} className="hover:underline" target="_blank" rel="noreferrer">
            ERC-{erc}
          </a>{" "}
          @{" "}
          <a
            href={`https://github.com/ethereum/ERCs/blob/${commit}/ERCS/erc-${erc}.md`}
            title={commit}
            className="font-mono hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {commit.slice(0, 7)}
          </a>
        </span>
      </div>
      {scalars.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {scalars.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-xs text-zinc-500">{k}</dt>
              <dd className={mono}>{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      <details>
        <summary className="cursor-pointer text-xs text-zinc-600 dark:text-zinc-400">Full evidence</summary>
        <pre className="mt-1 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">{JSON.stringify(check.evidence, null, 2)}</pre>
      </details>
      <div className="flex items-start gap-2">
        <pre className="flex-1 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
          <code>{check.reproduce}</code>
        </pre>
        <CopyButton text={check.reproduce} />
      </div>
    </div>
  );
}
