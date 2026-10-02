# Independent T0 review

Reviewed range: `9812ea907ed18ffc513ffdef0effc0e1ddaaa0df..df74b59c1354699b4050e947a3e1551c450ee59e`, including separate benchmark repair `64a2100d8f8263bf631f791d426a580d4c0f5709`. Review date: 2026-10-02.

**Spec-compliance verdict: PASS.** T0 acceptance is met: every required check has an actual outcome and evidence; failed checks remain identified as failures; the performance comparison blocker is resolved through the coordinator's explicit, bounded authorization. T1 may proceed. Existing entry-path and advisory concerns remain documented inputs to their owning tasks.

**Code-quality verdict: APPROVE WITH NITS.** No blocking implementation, security, quality-policy, or evidence-integrity finding. Two documentation corrections below are nonblocking and require no producer reruns.

## Actionable findings

1. **[P3] Include the destination-directory prerequisite in Mongo recovery instructions.** `docs/upgrade/nestjs-12/baseline.md:20`: the displayed Docker recovery recipe copies to `/tmp/nestjs-t0-mongo/mongod` without first creating `/tmp/nestjs-t0-mongo`. Docker cp does not create missing destination parent directories, so the snippet fails in a fresh environment. The report records that mkdir was actually performed. Add `mkdir -p /tmp/nestjs-t0-mongo` before cp so the published recipe includes that prerequisite.
2. **[P3] Escape engine-range pipes in the dependency table.** `docs/upgrade/nestjs-12/dependency-matrix.md:16`, `:18`, `:20`: raw `||` in the Node-engine cells introduce extra Markdown columns. Renderers can truncate the real peer requirements or display range fragments in the peer column. Escape those pipes as already done in the peer cells. Underlying JSON metadata is correct.

## Acceptance and constraints

| Requirement | Review outcome |
| --- | --- |
| Execution/assessed SHAs and intervening changes | Met: correct execution base and dedicated upgrade branch; account-name read behavior and local-port changes are explained rather than confused with T0 changes. |
| Exact target versions, engines, peers, release notes, advisories | Met: all 14 exact registry queries and module/optional-peer queries record exit 0; compact release notes and direct-target advisory result are present. Matrix correctly identifies TypeScript 6, ts-jest <7 support and schematics' Node 24.15 floor. |
| Runtime, Mongo topology, resolved dependencies | Met: Node/npm/OS/CPU, Mongo 8.2.12, standalone/replica-set fixtures and resolved direct dependencies recorded. All recorded direct versions match the unchanged lockfile. |
| Required command execution and outcomes | Met: installation, build, unit coverage, backend e2e, quality-reporting, mutation check/smoke and auth benchmark each have evidence. Environmental recovery and the authorized code correction are distinguished. |
| Compiled entry paths and Docker-input comparison | Met: full checkout emits dist/src/main.js; narrower Docker inputs emit dist/main.js; performance runner emits dist-performance/scripts/verify-auth-performance.js. Simulation is explicitly not a built or started production container. |
| Counts, skips, coverage, mutation policy | Met: unit 35/560; recovered e2e 29/242; after-fix e2e 29/243; quality-reporting 4/68; no recorded skips. Coverage contains exactly 87 files and exceeds unchanged floors. Full smoke passes existing policy. |
| Current auth performance baseline and fixture procedure | Met: unchanged failures retained, real-runner red/green evidence supplied, current standalone pass uses disposable fixtures and unchanged 100 warm-ups/500 samples/concurrency 10/10000 events and limits. |
| Committed baseline/evidence and privacy | Met: documentation/evidence plus separately committed authorized runner/spec change; no dependency/application/schema/configuration changes. Bulk generated reports excluded and no credentials, session values or personal fixture data found in saved evidence. |

Global constraints are preserved for this T0 scope: CommonJS configuration, schemas/Mongoose 9.8.1, Jest/DTO/frontend architecture, auth/security sources and quality configuration are unchanged; no forced dependency resolution, schema/data migration against existing databases, production deployment or new services occurred. The existing local dist/main.js defect is explicitly recorded, not silently repaired or claimed compliant. Production entry-point remediation remains a dependent task's requirement, not a newly introduced T0 regression.

## Benchmark correction review

The progress ledger explicitly authorizes repairing HTTP ownership now, requires a regression and independent review, and prohibits threshold changes. The implementation changes only `app.init()` to awaited `app.listen(0, '127.0.0.1')`, with a short ownership comment. Nest still initializes the benchmark application; its server now has an address before concurrent Supertest requests begin. Locked Supertest's `serverAddress` automatically listens on an unstarted server and records that request's server ownership; `end` closes that owned server. Explicit startup prevents requests from owning/closing the shared listener. Existing `finally` closes the application, seed connection and replica set. Binding an ephemeral loopback port is appropriate for the disposable harness and does not expose production benchmark routes.

The focused test compiles and executes the actual runner in a temporary directory, preserves its fixed request parameters and gates, inherits Mongo test prerequisites, writes evidence outside the repository, checks subprocess completion and removes its output in finally. Recorded red evidence fails specifically on ECONNRESET; green passes all four tests. Full e2e afterward adds exactly one passing test, and standalone performance exits 0 with boundary p95 13.00 ms and activity first-50 latency 12.07 ms. This is sufficient relevant regression evidence; no extra same-code rerun was performed during review.

## Evidence integrity and limitations

- Inspected the brief/global constraints, report, progress authorization, AGENTS.md/auth plan, copied upgrade plan, complete task diff package and corresponding committed files. Read-only comparisons establish that the package contains the actual committed diff; its code sections intentionally use expanded context. That context difference is not an evidence mismatch.
- Read retained producer exit files/log summaries. npm audit exits 1 and reports seven affected packages (two high/five moderate), consistent with the matrix. The direct-target advisory response is empty but explicitly makes no future transitive-lockfile claim.
- Compact unit and after-fix e2e counts exactly match the current full producer JSON. Recovered pre-fix e2e log confirms 29 suites/242 tests; after-fix log confirms 29/243; quality-reporting log confirms 4/68. Failed initial Mongo run and both failed benchmark attempts are not counted as successful producers.
- Coverage totals are statements 81.51%, branches 76.47%, functions 81.50%, lines 81.89%, above unchanged 80.89/74.70/81.32/81.26 floors. Corrected e2e uses the unchanged application-unit coverage producer; the benchmark-only repair does not affect its source graph.
- Mutation smoke has 1366 mutants, raw score 99.78%, three existing approved equivalents, no violations and five successful process/policy outcomes. All shard durations are below 350000 ms; summed sequential time is not a per-shard failure. Aggregate Stryker exit is null because execution is sharded, not evidence of an omitted check. Saved source hashes match the repository's CRLF-normalizing hash algorithm; a plain raw-byte SHA would differ. Selected mutation sources and policy inputs are unchanged across T0, so pre-repair smoke evidence remains applicable.
- Historical auth-performance evidence is unchanged across the reviewed range. Current metrics are retained separately with a matching successful command log. The diagnostic's 7 resets/37 auto-closes versus 0/0 is correctly treated as harness diagnosis, not application performance evidence.
- Saved additions were checked for secret-bearing key/token/credential-URI patterns and reviewed in context; none found. Existing synthetic source fixture credentials in diff context are not captured live credentials. Bulk report/coverage/Stryker artifacts are absent from committed evidence.
- The copied handoff plan differs from its upstream committed form only by an extra trailing blank line; no semantic plan changes. Claims about preserving the pre-existing untracked copy do not alter upgrade requirements. The reported whitespace limitation is transparently documented.

Review does not certify Nest 12 compatibility, production HTTP contracts, signal lifecycle, container startup, rollback or deployment. T0 reports those boundaries accurately; they remain subsequent tasks. No implementation files were modified, tests rerun, or agents spawned. This review file is the sole reviewer-authored artifact.
