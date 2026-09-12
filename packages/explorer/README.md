# @rwa-verify/explorer

Next.js explorer and REST API over `@rwa-verify/readers`. The app is a rendering layer: every request is turned into
CLI argv and handed to the readers CLI entry (`runCli`), so an API response is exactly what `rwa-verify` prints for the
same inputs and the `reproduce` strings in it are the CLI's own. No verification logic lives here.

## Environment

| Variable | Meaning |
|---|---|
| `RPC_URL_<chainId>` | JSON-RPC URL used when a request has no `rpc` parameter, e.g. `RPC_URL_1`, `RPC_URL_31337`. http(s) only. **It is echoed into every `reproduce` string** (that is what makes them re-runnable), so use a URL you are willing to publish, not one carrying a private key. |
| `INDEXER_URL` | Base URL of `@rwa-verify/indexer` (e.g. `http://localhost:42069`). Optional: without it, or when unreachable, the report page shows a one-line "history unavailable" note. |

## Routes

| Route | Returns |
|---|---|
| `GET /api/v1` | endpoint listing, check ids, hint names, pinned spec commit |
| `GET /api/v1/verify?chain=<id>&token=<addr>[&tokenId=<n>][&rpc=<url>][&<hint>=<value>…]` | `VerificationReport` JSON (bigints as decimal strings) |
| `GET /api/v1/check/<id>?…same query…` | one `CheckResult` |
| `/` | form → `/t/<chainId>/<token>?…` |
| `/t/<chainId>/<token>?…same query…` | the report as five panels, one row per check with status, key evidence, full evidence, spec ref and the `reproduce` command |

Hint parameters use the `RegistryHints` key names from `packages/readers/src/checks/context.ts` (`anchorRegistry`,
`anchorId`, `claimRegistry`, `claimType`, `documentAnchor`, `role`, `navOracle`, `currency`, `eventLog`, `eventType`,
`subjectId`); each maps to the CLI flag in `HINT_FLAGS`. A single check has no identity adapter to derive the join key
from, so `/api/v1/check/erc83xx.*` needs `subjectId=` where the CLI needs `--subject`.

HTTP status describes the request, not the check: `200` also for `fail`/`stale` (read `status` in the body); `400` for
usage errors, unknown parameters, non-http(s) `rpc`, no RPC for the chain, or a chain-id mismatch with the RPC; `502`
when the RPC cannot be reached. Responses are `Cache-Control: no-store`.

## Commands

```bash
pnpm --filter @rwa-verify/explorer dev        # http://localhost:3000
pnpm --filter @rwa-verify/explorer build      # next build --webpack
pnpm --filter @rwa-verify/explorer start
pnpm --filter @rwa-verify/explorer typecheck  # tsc --noEmit
pnpm --filter @rwa-verify/explorer lint
pnpm --filter @rwa-verify/explorer test       # vitest: route logic against the readers fake chain, no network
```

Against the local fixture stack:

```bash
scripts/fixture-stack.sh                      # anvil on :8545 + FixtureStack.s.sol; prints packages/solidity/out/fixture-stack.json
pnpm --filter @rwa-verify/explorer dev
# build the query from the fixture JSON: chain, token and every hint key, plus rpc=http://127.0.0.1:8545
```

## Build notes

- `@rwa-verify/readers` is consumed from source via `tsconfig.json` `paths` (same as `packages/indexer`); `dist/` is
  not built in typecheck or CI. Readers uses NodeNext-style `./x.js` imports for `.ts` files, which Turbopack cannot
  map, so `dev`/`build` run with `--webpack` and `next.config.ts` sets `resolve.extensionAlias`.
- Included in the root `pnpm -r typecheck` / `test` / `build` (the Next build takes ~10 s).

## Deployment

Target is Cloudflare Workers via `@opennextjs/cloudflare` (adapter not added here). Route handlers and server
components use only web APIs (`Request`, `Response`, `URL`, `fetch`, `process.env`): no `fs`, no `child_process`.
Known compat caveat: the readers index re-exports `cli.ts`, which imports `node:fs` and calls `realpathSync(process.argv[1])`
at module load when `process.argv[1]` is set; on Workers (`nodejs_compat`) `process.argv` is empty so the call is
skipped, but the `node:fs` import must resolve.
