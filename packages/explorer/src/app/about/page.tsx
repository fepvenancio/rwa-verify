import type { Metadata } from "next";
import { SPEC_COMMIT, type CheckStatus } from "@rwa-verify/core";
import { Examples } from "@/components/Examples";
import { Badge } from "@/components/Report";

export const metadata: Metadata = { title: "About — rwa-verify" };

const REPO = "https://github.com/fepvenancio/rwa-verify";
const EXAMPLE_TOKEN = "0x724ba15845719549ea1ea2f0aac9d75d31dbd818";

// One-line meanings from packages/sdk/CHECKS.md.
const STATUSES: [CheckStatus, string][] = [
  ["pass", "The spec's condition holds at the pinned block."],
  ["fail", "The spec's condition does not hold, or a contract that declares the interface reverts (non-conformance)."],
  ["stale", "ERC-8330 only: the publish heartbeat or the valuation age is exceeded. Data exists but is out of date."],
  ["unknown", "Could not determine: RPC failure, a missing input (--holder, --subject, --currency, --role), unconfigured thresholds, no events."],
  ["unsupported", "The token does not declare or expose what the check needs, or no contract address was supplied. Never a failure, never a pass."],
];

const STEPS = [
  "Detection: ERC-165 for standards that have an interface id, direct probes for those that do not (ERC-3643, ERC-4626).",
  "Baseline facts that work for any token today: ERC-20 metadata; ERC-3643 identity registry, compliance, claim topics, trusted issuers, holder status; ERC-7943; ERC-4626.",
  "Optional “verified” layers, only when the token declares them: ERC-8325 mutual anchor binding, ERC-8326 document bundle hash, ERC-8328 compliance event log, ERC-8330 NAV with staleness, ERC-8320 regulated asset claims.",
  "A report where every row pins its block and carries the command that reproduces it.",
];

const h2 = "text-base font-semibold";
const card = "mt-2 rounded border border-zinc-200 p-4 dark:border-zinc-800";
const muted = "text-sm text-zinc-600 dark:text-zinc-400";
const pre = "mt-2 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900";
const link = "hover:underline";

export default function About() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">About</h1>
      <p className={`mt-2 ${muted}`}>
        rwa-verify is read-side verification for tokenised real-world assets. Give it a token and it tells you what the token declares and whether those
        declarations hold, and every claim comes with a command to re-run it yourself. We deploy no registries, hold no keys, and are not an authority;
        the chain is.
      </p>

      <section className="mt-6">
        <h2 className={h2}>How it works</h2>
        <ol className={`${card} list-decimal space-y-2 pl-8 text-sm`}>
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="mt-6">
        <h2 className={h2}>Status vocabulary</h2>
        <div className="mt-2 overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {STATUSES.map(([status, meaning]) => (
                <tr key={status}>
                  <td className="p-3 align-top">
                    <Badge status={status} />
                  </td>
                  <td className="p-3">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`mt-2 text-xs ${muted}`}>
          <code>unsupported</code> means the token does not declare that standard, not that it failed; it never blocks a report and is never treated as{" "}
          <code>pass</code> (ADR-004). The explorer shows it as <strong>not declared</strong>.
        </p>
      </section>

      <section className="mt-6">
        <h2 className={h2}>Reproducibility</h2>
        <div className={card}>
          <p className={muted}>Every row in a report carries a command like this one. Run it against a node you trust:</p>
          <pre className={pre}>
            <code>{`rwa-verify check erc3643.identityRegistry --chain 1 --token ${EXAMPLE_TOKEN} --rpc $RPC_URL`}</code>
          </pre>
          <p className={`mt-2 ${muted}`}>
            <code>$RPC_URL</code> is whatever node the reader trusts; nothing here depends on ours. Behaviour targets the spec texts in{" "}
            <a href="https://github.com/ethereum/ERCs" className={link} target="_blank" rel="noreferrer">
              ethereum/ERCs
            </a>{" "}
            at commit{" "}
            <a href={`https://github.com/ethereum/ERCs/tree/${SPEC_COMMIT}/ERCS`} className={`font-mono ${link}`} title={SPEC_COMMIT} target="_blank" rel="noreferrer">
              {SPEC_COMMIT.slice(0, 8)}
            </a>
            , and each check records that commit in its <code>specRef</code>.
          </p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className={h2}>Try it</h2>
        <div className="mt-2">
          <Examples />
        </div>
      </section>

      <section className="mt-6">
        <h2 className={h2}>API and SDK</h2>
        <div className={card}>
          <p className={muted}>The same report as JSON:</p>
          <pre className={pre}>
            <code>{`curl "https://rwa-verify-explorer.stela-app.workers.dev/api/v1/verify?chain=1&token=${EXAMPLE_TOKEN}"`}</code>
          </pre>
          <p className={`mt-2 ${muted}`}>
            Endpoint list, parameters and check ids:{" "}
            <a href="/api/v1" className={`font-mono ${link}`}>
              /api/v1
            </a>
            .
          </p>
          <p className={`mt-4 ${muted}`}>
            In your own code: <code>npm i @rwa-verify/sdk</code>
          </p>
          <pre className={pre}>
            <code>{`import { createPublicClient, http } from "viem";
import { verify } from "@rwa-verify/sdk";

const client = createPublicClient({ transport: http(rpcUrl) });
const report = await verify({ client, chainId: 1, token: "0x…", registryHints: {} });`}</code>
          </pre>
        </div>
      </section>

      <p className="mt-8 text-xs text-zinc-500">
        MIT licensed. Source on{" "}
        <a href={REPO} className={link} target="_blank" rel="noopener">
          GitHub
        </a>
        . Spec findings are filed upstream in{" "}
        <a href={`${REPO}/blob/main/docs/spec-findings.md`} className={link} target="_blank" rel="noopener">
          docs/spec-findings.md
        </a>
        .
      </p>
    </>
  );
}
