# PLAN.md — rwa-verify (working name)

Read-side verification kit for tokenised real-world assets. Consumes ERC-3643 / ERC-7943 / ERC-4626 today and ERC-8320 / 8325 / 8326 / 8328 / 8330 as optional "verified" layers. We build no registries and deploy no canonical contracts.

Status of upstream specs at time of writing (2026-09-11): 8325–8330 in **Review** (moved 2026-07-21), 8320 in **Draft**. All may change. See ADR-001.

---

## 0. Scope

**In**
- Reproduce ERC-8326 bundle hashes from raw documents (off-chain canonicalisation is the unbuilt piece).
- Verify ERC-8325 mutual token↔registry binding.
- Read ERC-8330 NAV with both staleness signals; resolve correction chains.
- Read ERC-8320 active claims and signer authorisation.
- Read ERC-8328 event history and terminal events.
- Baseline report for plain ERC-3643 / 7943 / 4626 tokens (works with zero 83xx adoption).
- Solidity view library + collateral gate for protocols.
- Hosted explorer + API.

**Out**
- ERC-8329 (impact) — no market pull.
- ERC-8327 — optional later as an ERC-3643 `ICompliance` module; not on the critical path.
- Any registry deployment, any custody, any legal opinion on claims.

---

## 1. Team / workstreams

Each workstream is independently assignable to one agent (Claude Code subagent) or one person. Contracts between workstreams are fixed in `packages/core` (WS0) before parallel work starts.

| WS | Name | Owner type | Deliverable | Depends on |
|---|---|---|---|---|
| WS0 | Core contracts & orchestration | Lead (you) + 1 coordinator agent | Monorepo, `VerificationReport` schema, `AssetIdentity` adapter interface, `CheckResult` type, CI, ADRs | — |
| WS1 | Canonicaliser & bundle hash (TS) | 1 agent | RFC 8785 JSON, C14N 1.1 XML (no comments, XXE disabled), `filenameHash`, entry sort, `bundleHash`; differential tests vs Kula `BundleHashLib` | WS0 |
| WS2 | Chain readers (TS/viem) | 1 agent | ABIs + typed readers for 8320/8325/8326/8328/8330/3643/7943/4626; `AssetIdentity` adapters for 8320 and 8325 | WS0 |
| WS3 | Solidity library | 1 agent | `RwaVerify` view lib (`bindingValid`, `navFresh`, `hasActiveClaim`, `latestCurrentEvent`), `CollateralGate` example; Foundry tests against Kula reference impls | WS0 |
| WS4 | Indexer | 1 agent | Ponder (or subgraph) indexing correction chains, supersession history, claim lifecycle events → Postgres | WS0, WS2 ABIs |
| WS5 | Explorer + API | 1 agent | Next.js explorer, REST API returning `VerificationReport`, each check links to a reproducible SDK command | WS1, WS2, WS4 |
| WS6 | Ecosystem & funding | Lead (you) | Spec-change tracking, Magicians feedback, license audit, grant applications (EF ESP, Optimism RetroPGF, Gitcoin) | — |

Coordinator agent responsibilities: keep `packages/core` stable, run the cross-workstream differential test suite, reject PRs that change shared types without an ADR.

---

## 2. Shared contracts (WS0, frozen before Phase 1)

```ts
// packages/core
type CheckStatus = "pass" | "fail" | "unsupported" | "stale" | "unknown";

interface CheckResult {
  id: string;               // e.g. "erc8325.mutualBinding"
  status: CheckStatus;
  evidence: Record<string, unknown>; // tx hashes, block, values read
  reproduce: string;        // CLI command that re-runs this check
  specRef: { erc: number; commit: string }; // pinned spec commit
}

interface VerificationReport {
  chainId: number;
  token: `0x${string}`;
  tokenId?: bigint;
  baseline: CheckResult[];  // 3643 / 7943 / 4626 facts
  identity: CheckResult[];  // 8320 | 8325 via AssetIdentity adapter
  documents: CheckResult[]; // 8326
  valuation: CheckResult[]; // 8330
  compliance: CheckResult[];// 8328
  generatedAt: string;
}

interface AssetIdentity {          // adapter, one per identity standard
  standard: "erc8320" | "erc8325";
  subjectId(): Promise<`0x${string}`>;
  isBound(): Promise<CheckResult>;
  registries(): Promise<`0x${string}`[]>;
}
```

`subjectId` is the join key across 8326/8328/8330 by convention (Kula) — treat as convention, not guarantee; report when subjects don't align.

---

## 3. Phases

### Phase 0 — Foundation (week 1)
- Monorepo: pnpm workspaces + Foundry. `packages/{core,canon,readers,solidity,indexer,explorer}`.
- ADR-001..005 written (section 5).
- Pin spec commits: `erc-8320.md`, `erc-8325.md` … `erc-8330.md` from `ethereum/ERCs` at a fixed SHA; vendor the markdown into `specs/`.
- Fixture set: pull Kula's test vectors (8326 canonicalisation examples, 8330 aggregation cases) into `fixtures/`; record their commit (`caa9b05` is the audited commit).
- Deploy Kula reference impls to a local Anvil profile for differential tests (interfaces only if license blocks vendoring — see ADR-003).
- **Exit:** `pnpm test` and `forge test` green on empty packages; CI runs both.

### Phase 1 — Core verification (weeks 2–4)
- WS1: canonicaliser + `bundleHash`. Property tests: permutation invariance, duplicate retention, reject non-I-JSON, reject unsorted input for strict path. Differential test against `BundleHashLib.computeCanonicalBundleHash` via Anvil.
- WS3: `RwaVerify` lib. `bindingValid` implements the 8325 two-sided check (`token.anchorRegistry() == registry && token.anchorId() == anchorId && registry.isActive && registry.isBindingValid`). `navFresh` uses `latestNAVStatus` and honours both flags. `hasActiveClaim` verifies `IRegistryAnchor.isRegistryApproved` when the token implements it.
- WS2: readers for 8325/8326/8330 + ERC-165 detection + 3643/7943 baseline.
- **Exit:** CLI `rwa-verify <token>` produces a `VerificationReport` for a local fixture stack; every check has a working `reproduce` string.

### Phase 2 — History & identity (weeks 5–6)
- WS4: index 8328 events, 8330 corrections/invalidations, 8326 supersession, 8320 lifecycle; expose `terminalEvent`, `currentSnapshot`, `activeClaims` queries.
- WS2: 8320 adapter; 8328 reader; `AssetIdentity` selection logic (prefer whichever the token declares; report both if both).
- WS3: `CollateralGate` example + gas report.
- **Exit:** Report is complete for full-stack fixture; differential tests cover all correction-chain edge cases (correct-of-correct, invalidated terminal, expired claim).

### Phase 3 — Public surface (weeks 7–9)
- WS5: explorer + API. Every panel shows the `reproduce` command.
- Publish `@rwa-verify/canon`, `@rwa-verify/sdk` to npm; `rwa-verify` to Foundry registry.
- WS6: submit EF ESP + RetroPGF applications with Phase 1–2 artefacts as evidence.
- **Exit:** Public URL, npm packages, one external integrator (target: an RWA lending curator or an ERC-8348 author) using the SDK.

### Phase 4 — Reference-consumer position (ongoing)
- File implementation findings as feedback in each Magicians thread (this is how you get influence on the specs while they are in Review).
- Track spec changes; bump pinned SHAs via ADR.
- Optional: ERC-8327 `ICompliance` module for ERC-3643.

---

## 4. Agent operating rules (drop into `CLAUDE.md`)

- Read `PLAN.md` and `packages/core` before writing code. Do not change `packages/core` without an ADR PR first.
- Every check must emit a `reproduce` command that passes in CI.
- No registry deployments, no admin keys, no canonical anything.
- Differential test against reference implementation is required for any hashing or lifecycle logic.
- Spec text is the source of truth; when reference impl and spec disagree, implement the spec and log an issue in `docs/spec-findings.md` for WS6.
- Solidity: OpenZeppelin v5 only, no Solady, no upgradeability in the library (pure/view).
- Terse PR descriptions; no unsolicited refactors.

---

## 5. ADRs (write in Phase 0)

- **ADR-001 Spec pinning.** All 83xx/8320 behaviour targets a pinned `ethereum/ERCs` SHA. Bumps are explicit PRs.
- **ADR-002 Two identity roots.** Support 8320 and 8325 behind `AssetIdentity`; take no position on which wins.
- **ADR-003 Reference-code license.** Kula repo shows no license on GitHub as of 2026-09-11. Until confirmed, use their contracts only as black-box test targets via Anvil; do not vendor. ERC text is CC0 and may be vendored.
- **ADR-004 Baseline-first.** The SDK must be useful on ERC-3643/7943 alone; 83xx checks report `unsupported` rather than blocking.
- **ADR-005 Clean room.** No code, docs or fixtures from employer projects. Separate repo, separate accounts, own time.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Specs change during Review | ADR-001 pinning; WS6 tracks threads; adapters isolate spec surface |
| Zero 83xx adoption for a long time | ADR-004; explorer is valuable on 3643/7943 day one |
| Kula publishes its own SDK/verifier | Ship WS1 fast; canonicaliser is the moat, be the neutral third party |
| Chainlink/Chronicle ship 8330 adapters | Fine — our `navFresh` reads any 8330 implementation |
| Reference impl license restrictive | ADR-003 |
| Grant funding doesn't land | Phase 1–2 are cheap; API pricing for curators is the fallback |

---

## 7. Definition of "sellable"

- Free: SDK, Solidity lib, explorer.
- Paid: API with SLA + webhooks (NAV stale, binding invalidated, claim revoked) for risk curators, RWA aggregators, diligence desks.
- Grants: ESP, RetroPGF, Gitcoin — apply after Phase 2 with reproducible artefacts.

Realistic 12-month outcome: grants + a few API customers. Not a company by itself; a credible public good with an upgrade path.
