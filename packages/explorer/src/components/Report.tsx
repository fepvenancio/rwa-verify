import type { CheckResult, CheckStatus } from "@rwa-verify/core";
import { CopyButton } from "./CopyButton";
import { SECTIONS, groupRows, tokenIdentity, type JsonReport } from "@/lib/report";

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
const list = "divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800";

export function Summary({ report, jsonHref }: { report: JsonReport; jsonHref: string }) {
  const { ran, notDeclared } = groupRows(SECTIONS.flatMap((s) => report[s.key]));
  const counts = STATUSES.map((st) => [st, ran.filter((c) => c.status === st).length] as const).filter(([, n]) => n > 0);
  const blockNumber = report.baseline[0]?.evidence.blockNumber;
  const identity = tokenIdentity(report);
  return (
    <>
      <header className="mb-4">
        {identity ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              {identity.name}{" "}
              <span className="font-mono text-2xl font-medium text-zinc-500 dark:text-zinc-400">{identity.symbol}</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {identity.decimals} decimals · total supply {identity.totalSupply}
            </p>
          </>
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">Token report</h1>
        )}
        <p className={`mt-2 ${mono}`}>{report.token}</p>
      </header>
      <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
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
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">
          {ran.length} {ran.length === 1 ? "check" : "checks"} ran{counts.length > 0 && ":"}
        </span>
        {counts.map(([st, n]) => (
          <span key={st} className="flex items-center gap-1">
            <Badge status={st} /> {n}
          </span>
        ))}
        {notDeclared.rows.length > 0 && <span className="text-zinc-500">· {notDeclared.rows.length} not declared</span>}
        <a href={jsonHref} className="ml-auto text-sm text-zinc-600 hover:underline dark:text-zinc-400">
          JSON
        </a>
      </div>
      <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
        <strong>not declared</strong> (<code>unsupported</code>) means the token does not declare that standard, not that it failed (ADR-004). Every check
        pins its reads to one block; the command under each row re-runs it.
      </p>
    </section>
    </>
  );
}

export function Panels({ report }: { report: JsonReport }) {
  return (
    <>
      {SECTIONS.map((s) => {
        const { ran, notDeclared, info } = groupRows(report[s.key]);
        return (
          <section key={s.key} className="mt-6">
            <h2 className="flex items-baseline gap-2 text-base font-semibold">
              {s.title} <span className="text-xs font-normal text-zinc-500">{s.ercs}</span>
            </h2>
            <ul className={list}>
              <Rows checks={ran} />
              {info.map((c, i) => (
                <li key={`${c.id}-${i}`} className="p-3 text-sm">
                  <span className="font-mono font-medium">{c.id}</span> <span className="text-zinc-600 dark:text-zinc-400">No ERC-165: standards probed directly</span>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-zinc-500">details</summary>
                    <CheckRow check={c} />
                  </details>
                </li>
              ))}
              {notDeclared.rows.length > 0 && (
                <li>
                  <details className="group p-3 text-sm">
                    <summary className="flex cursor-pointer flex-wrap items-baseline gap-2">
                      <span className="text-zinc-600 dark:text-zinc-400">Not declared: {notDeclared.ercs.map((e) => `ERC-${e}`).join(", ")}</span>
                      <span className="text-xs text-zinc-500 group-open:hidden">show {notDeclared.rows.length}</span>
                      <span className="hidden text-xs text-zinc-500 group-open:inline">hide</span>
                    </summary>
                    <ul className={`mt-2 ${list}`}>
                      <Rows checks={notDeclared.rows} />
                    </ul>
                  </details>
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function Rows({ checks }: { checks: CheckResult[] }) {
  return checks.map((c, i) => (
    <li key={`${c.id}-${i}`}>
      <CheckRow check={c} />
    </li>
  ));
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
