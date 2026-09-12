# rwa-verify

Read-side verification kit for tokenised real-world assets.

Consumes ERC-3643 / ERC-7943 / ERC-4626 today and ERC-8320 / 8325 / 8326 / 8328 / 8330 as optional "verified" layers. Builds no registries, deploys no canonical contracts.

- [PLAN.md](PLAN.md) — scope, workstreams, phases
- [CLAUDE.md](CLAUDE.md) — operating rules for agents and contributors
- [docs/adr](docs/adr) — architecture decisions
- [specs](specs) — vendored ERC texts at a pinned commit

## Layout

| Package | Workstream | Purpose |
|---|---|---|
| `packages/core` | WS0 | Shared types: `CheckResult`, `VerificationReport`, `AssetIdentity`; pinned spec refs |
| `packages/canon` | WS1 | Off-chain canonicaliser and ERC-8326 `bundleHash` |
| `packages/readers` | WS2 | viem ABIs and typed chain readers; `AssetIdentity` adapters |
| `packages/solidity` | WS3 | `RwaVerify` view library and `CollateralGate` example (Foundry) |
| `packages/indexer` | WS4 | Correction chains, supersession, claim lifecycle |
| `packages/explorer` | WS5 | Explorer UI and REST API |

## Develop

```bash
pnpm install
pnpm test          # all TS packages
pnpm test:sol      # Foundry
pnpm test:diff     # TypeScript canonicaliser vs Solidity BundleHashLib (FFI)
```

## CLI

```bash
pnpm --filter @rwa-verify/readers exec tsx src/cli.ts <token> --chain <id> --rpc <url> [--token-id <n>] [hints]
pnpm --filter @rwa-verify/readers exec tsx src/cli.ts check <id> --chain <id> --rpc <url> --token <addr>
pnpm --filter @rwa-verify/canon   exec tsx src/cli.ts hash [--strict] <entries.json>
pnpm --filter @rwa-verify/canon   exec tsx src/cli.ts entry --file <path> --role <ROLE> --mime <type> --profile raw|json|xml
```

Check ids and status semantics: [packages/readers/CHECKS.md](packages/readers/CHECKS.md).
