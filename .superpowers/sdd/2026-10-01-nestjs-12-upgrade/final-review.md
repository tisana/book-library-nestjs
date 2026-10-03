# Independent whole-branch review

Reviewed on 2026-10-03: `9812ea907ed18ffc513ffdef0effc0e1ddaaa0df..5a167e907aa0c7ec5348d0278caa0d48c9e82b37`, branch `upgrade/nestjs-12`. HEAD was independently confirmed. This review covers the combined implementation and its cross-task interfaces, with the plan, repository/auth instructions, progress ledger, T0–T6 reports and original/scoped reviews as context.

**SPEC: CHANGES REQUIRED for implementation review; overall plan acceptance remains incomplete.** The two new verifier findings below violate the intended diagnostic-redaction/resource-ownership contracts. The separately documented devcontainer and mutation gates remain unfulfilled and must not be relabeled as passing acceptance.

**QUALITY: REQUEST CHANGES.** Two actionable P2 findings in the T5 production-image verifier. No additional demonstrated application, authentication, database-schema, compiler, or CI-enforcement regression was found. This is not release approval.

## New actionable findings

### 1. [P2] Redact complete Docker diagnostics before truncating them

**Location:** `scripts/quality/verify-production-image.ts:37` (redaction continues at lines 38–42).

The Docker error handler applies `.slice(-2000)` to raw stderr before replacing configured credentials. If the cutoff crosses a credential, only its suffix reaches the replacements; neither the full-value match nor the generic 32-character pattern removes a shorter suffix. The verifier can therefore print part of a configured credential to CI/local logs on its failure path. This repeats the cutoff failure already repaired in the separate T2 process helper.

An isolated probe executes the actual TypeScript verifier after ordinary TypeScript transpilation, substituting only external dependencies. A synthetic 64-character configured JWT secret followed by a newline and 1,989 padding characters causes the caught Docker failure to print its last ten characters. The result is `configuredFullSecretPrinted: false`, **`configuredTenCharacterSuffixPrinted: true`**. No real secret, Docker call, or database was involved; the probe output records booleans only. This establishes a reproducible redaction defect, not an observed leak in the preserved successful producer logs.

**Required fix:** Perform configured-value and generic redaction on the complete captured stderr, then apply the final output-size limit. The synchronous subprocess already supplies a complete buffer, so no streaming overlap mechanism is needed here. Add a bounded failure-path regression that crosses the cutoff, requires both the full credential and its suffix to be absent, and retains the final diagnostic bound. Preserve the generic, nonzero verifier failure and useful secret-safe Docker context.

### 2. [P2] Independently clean every acquired image-verification resource

**Location:** `scripts/quality/verify-production-image.ts:241–244`; acquisition also occurs outside the cleanup scope at lines 51–62.

Cleanup is sequential: a failed `docker rm -f` prevents all remaining container cleanup, fixture shutdown, and environment-directory removal; a failed `fixture.stop()` prevents directory removal. In addition, `mkdtemp()` runs after fixture creation but before `try`, so its failure leaves the acquired fixture running. The fixture owns detached Mongo processes and binds them to all interfaces for container access; the directory later contains mode0600 files with the synthetic signing/correlation keys. A failed verification can consequently leave owned processes/resources and secret-bearing temporary files behind. The T6 rehearsal received equivalent ownership fixes, but this other caller still has the original failure pattern.

Independent bounded execution of the actual transpiled verifier confirmed all three paths:

| Injected failure | Actual observed cleanup |
| --- | --- |
| `mkdtemp` rejects after successful fixture creation | Fixture stop is never called |
| Docker removal rejects after a launched container and written env file | Removal attempted; fixture stop and directory removal both skipped |
| Fixture stop rejects after a launched container and written env file | Container removal and fixture stop attempted; directory removal skipped |

Every probe retains a failing exit code; failure status alone does not clean the resources. The shared fixture's newly improved `stop()` cannot help when the verifier never calls it.

**Required fix:** Put acquisition inside an outer ownership scope with optional handles. Attempt each acquired container, fixture, and directory cleanup independently, retaining the original verification failure when cleanup also fails and failing on cleanup errors when no earlier failure exists. Add bounded fault tests for acquisition failure, one container-removal failure, and fixture-stop failure, including proof that later cleanup is attempted. Apply the already reviewed T6 approach without changing production behavior or verification thresholds. No full Docker producer rerun is needed for this cleanup-only repair if direct regressions and relevant type checks pass.

The reusable RED probe is `/tmp/nestjs-final-review-image-probes.cjs`; its boolean/state output is `/tmp/nestjs-final-review-image-probes.json`. Run it from the repository root with `node /tmp/nestjs-final-review-image-probes.cjs`. It asserts the reviewed defects and is explicitly diagnostic RED evidence, not an acceptance test or successful artifact producer. It makes no real Docker/Mongo/filesystem-resource calls.

## Combined implementation assessment

- **Runtime/dependencies:** Fresh Node/npm checks report 24.19.0/11.9.0. Fresh `npm ls --json` exits 0 without dependency problems and confirms all exact Nest target versions, TypeScript6.0.2, Jest30.4.1, ts-jest29.4.14 and Mongoose9.8.1. Manifest/lock, Docker stages, runtime pin and CI setup agree. The unavailable CLI upgrade command and minimum demonstrated official Jest loader fix are recorded exceptions, with failed trials preserved. The compatible advisory patches/scoped qs override are bounded; saved final npm audit records zero advisories. That audit is dated dependency evidence, not a fresh registry or OS-image scan performed by this review.
- **Compilation and application scope:** Fresh root and Jest no-emit checks both exit 0. NodeNext production compilation retains CommonJS package semantics, decorator metadata, explicit source root and `dist/main.js`; operational/performance compilation keeps its separate boundaries. Normal unit transformation remains typed with all 87 covered files. Controller changes are type-only imports; behavioral production changes are confined to signal registration, timer ownership and recovery-pass draining. The benchmark's explicit ephemeral loopback listener fixes shared HTTP-server ownership without altering its sampling/limits. No schema/data migration or frontend architecture rewrite is present.
- **Authentication and lifecycle:** Replay revocation, refresh ownership/CAS and durable markers, role/member guards, exact browser origin and trusted-proxy policies remain intact. The compiled characterization uses the actual bootstrap, checks member ownership and JSON/static/SPA boundaries, and retains per-request opaque proxy-bucket identity. Worker teardown stops producers before awaiting active work, and Mongo closes after HTTP disposal. Drain catches preserve generic diagnostics without turning recovery failures into successful authentication. Recorded actual SIGTERM tests include accepted login, active reconciliation, rejected query and an explicitly failing over-budget case with durable restart recovery. Forced cleanup is not counted as an ordinary graceful exit. Unbounded external database stalls remain an acknowledged recovery/grace limitation.
- **Artifact/browser/CI interfaces:** The image and live suites use self-created disposable fixtures and actual built application artifacts; the live suite has no API route mocks and avoids credential-bearing browser recordings. The image probe verifies runtime-only package installation, real unsafe-production rejection and dependency-loss readiness. CI invokes production, image, benchmark, reporting/policy and live commands directly, and the build depends on both new jobs. Existing coverage/e2e producers pass actual outcomes into enforcement, including changed-line requirements. A failed new command fails its job. The selective mutation workflow retains five shards, strict aggregation and both added compiler path filters. Hosted CI completion and branch-protection configuration are not independently claimed.
- **Mutation integrity:** Fresh `mutation:check` validates all 89 rules. Critical identities/invariants and original three equivalent exemptions/expiries remain preserved; rebases correspond to the reviewed source shifts and Node24 checks. Full-source count1744 is the documented T4 addition of17 sites; smoke remains1366. The mutation-only isolated emitter has retained 10 original/instrumented AST and 15 actual Nest DI proof records and control-status comparisons; normal typed unit/production checks remain active. CPU capping addresses demonstrated false Timeout behavior without increasing configured maxima. The raw-score floor95.2518818760857 and 350000/900000ms budgets remain unchanged. Historical baseline bytes are unchanged by the whole branch; passing manifest checks do not validate or replace that historical producer.
- **Rollback and provenance:** T6 demonstrates reconstructed exact execution-base Nest11/Node22 to Nest12/Node24 to old non-overlapping transitions with persisted access/refresh continuity, replay revocation and scheduled durable recovery. Init-enabled ordinary0/143 exits are distinguished from the retained old PID1 exit137 failure and from full Nest drain. The direct future2s durable checkpoints exercise real default60s workers, not elapsed default300s leases. The runbook requires at least365s observation and retains production artifact/configuration/init/grace/owner/objective prerequisites. Fresh direct command/fault tests pass all10 cases, including fail-closed replacement guards and the corrected rehearsal/shared-fixture cleanup. Those protections do not resolve finding2 in the separate verifier.

Recorded final normal producer evidence supports 566 backend unit,254 backend e2e,54 production,68 reporting,186 frontend unit,87 mocked browser and3 live browser tests, with no new final skips; the scoped mutation policy/runner review records106 passing controls. Saved coverage meets unchanged backend/frontend floors, auth overhead p95 is25.55ms against50ms, and container dependency-loss readiness is approximately4.01s against5s. These are the preserved actual producer outcomes, not fresh broad reruns by this reviewer. Relevant later test/report/cleanup fixes are distinguished from original runtime artifacts and historical evidence.

## Existing unresolved acceptance/release gates

These are already accepted handoff limitations, distinct from the two new actionable defects:

1. **T1 actual devcontainer build/runtime verification remains blocked.** The exact pin is configured, but the unchanged MCR/Mongo download path is blocked by the managed network policy. Local Node and production-container evidence do not close this check.
2. **T5 mutation acceptance remains blocked.** Actual token smoke exceeded350000ms at350132ms. The isolated complete token producer finished802494ms but retained a RuntimeError; the later narrowly repaired fixture and bounded throughput proof do not constitute a new accepted full run. There are no accepted coherent current five-shard1744 complete and1366 smoke merges, and current token/reconciliation source hashes differ from the preserved historical baseline. No baseline may be rebound or fabricated to close this gap.
3. **Production approval prerequisites remain undefined/unverified:** adopted error/latency objectives and traffic baseline, named owner, actual old/new immutable registry artifacts and protected configuration versions, deployment init/grace, backup/recovery readiness, required CI completion and separate deployment authorization.

Thus all-plan acceptance, implementation completion under every original gate, and production readiness cannot be claimed even after the two new verifier defects are repaired. T6's useful independent rehearsal does not convert the incomplete T1/T5 gates into success.

## Fresh independent checks

- Exact requested HEAD, Node24.19.0/npm11.9.0 and full `npm ls --json`: pass, no invalid dependency tree.
- `tsc -p tsconfig.json --noEmit --incremental false` and equivalent Jest-config check: pass, exit0.
- `npm run mutation:check`: pass,89 rules.
- Whole-branch diff of schema sources, migrations, coverage floors and historical mutation baseline: unchanged.
- Source/test/configuration/lock/Docker/frontend workflow `git diff --check`: pass. Whole-range preserved raw-log/verbatim-plan whitespace is the already documented evidence limitation; no blanket whole-range whitespace pass is asserted.
- Actual T6 runbook/rehearsal fault tests:10/10 pass, zero failed/skipped/cancelled/todo in2.87s.
- Four harmless actual-verifier fault probes: confirmed both findings with the exact state/boolean outcomes above.

No application or test implementation was edited; no subagents, commit, push, merge, deployment, real Docker/Mongo fault experiment, broad regression rerun or long mutation producer was used. Only this review report and temporary reviewer probe artifacts were written. Route both findings to one focused T5 verifier fix and obtain scoped re-review; retain all existing acceptance blockers.
