# Task 04 review

## Task
Task 4 — Reconciliation startup, scheduling, claim, and lease races

## Reviewer model and reasoning
`/root/plan3_task4_review`; `gpt-5.6-sol`, high

## Reviewed commit
`5bffafdf4224b5c7e22e945f0ae322900af46384` (Fix Round 1; fix base `05d9e1d929b7b11d3423faf506adf9a11c2834c4`, implementation base `c6735fc56c40fa0f51b691c0dc2e3c4831dfb0d7`)

## Commands and exits
- Read the supplied brief, current project plan, implementation report, review ledger, and `review-c6735fc..05d9e1d.diff` once as the primary patch view: exit 0. The report was treated as untrusted claims.
- Inspected the owned reconciliation spec, unchanged public lifecycle/reconciliation implementation, and approved Plan 2/3 fixture helpers without rerunning Git: exit 0.
- `npx jest --runInBand auth/auth-identifier-reconciliation.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-reconciliation.service.ts --coverageReporters=text`: exit 0; 1/1 suite and 34/34 tests passed; statements 206/228, branches 151/191 (79.05%), functions 40/42, lines 204/226.
- `npx eslint src/auth/auth-identifier-reconciliation.service.spec.ts`: exit 0.
- Fix Round 1 scoped re-review: read only `rereview-05d9e1d..5bffafd.diff` and the appended Task 4 fix evidence, as instructed; no Git command or test suite was rerun.

## Findings
### Spec Compliance

- Critical: none.
- Important: none open. Fix Round 1 ADDRESSED the prior finding at `src/auth/auth-identifier-reconciliation.service.spec.ts:394`. `invalidates stale in-flight readiness before a restarted lifecycle schedules work` now holds the original readiness promise across shutdown and restarted bootstrap, resolves that stale generation as migration-ready, and asserts it registers no interval and performs no reconciliation. Advancing the public readiness-probe timer then performs the second readiness query and proves exactly one schedule and startup pass. Removing lifecycle-generation invalidation would make the stale result schedule work before those negative assertions, so the required behavior is now observable.
- Minor: none.

All other required cases are directly evidenced through public `onApplicationBootstrap`, `onApplicationShutdown`, `reconcileOnce`, or `renewLease` behavior: no-connection readiness-only probing, absent-scheduler retry behavior, readiness-to-schedule transition, contained startup/scheduled rejection, null-claim accounting, configured batch cap, release of each acquired lease, missing key material before claim, shutdown/readiness race, and foreign-schedule ownership. The exact requested factory seam is present, and the spec directly reuses `deferred`, `queryResult`, `createStaffModelHarness`, `createIdentifierModelHarness`, `createIdentifierOperation`, and `criticalQueryResult`.

### Task Quality

- Critical: none.
- Important: none.
- Minor: none.

The focused suite and lint pass. Claim/batch/lease assertions distinguish examined, claimed, processed, skipped, claim-call, and pipeline-release behavior; the new public-path cases are materially stronger than the retained legacy private-path coverage. Every added deferred is resolved and awaited, and each added fake-timer case restores real timers and clears or verifies removal of owned intervals on its successful path.

### ⚠️ Unverifiable items

- The historical RED failure cannot be independently reproduced from the reviewed immutable head.
- The reported full backend suite, `git diff --check`, and generated-output staging state were not rerun because the review instructions prohibit rerunning broad suites or Git. No generated output or forbidden production/configuration/frontend/e2e/baseline/denominator/script change was observed in the supplied patch view, but index/staging state is not independently verifiable without Git.
- Fix Round 1 command results are implementer-provided evidence and were not independently rerun under the scoped re-review instruction. The scoped evidence reports 34/34 focused tests, 151/191 branches, focused ESLint exit 0, and `git diff --check` exit 0.

## Resolutions verified
- Fix Round 1 — ADDRESSED at `src/auth/auth-identifier-reconciliation.service.spec.ts:394`: stale readiness is now deferred across shutdown/restart, prevented from scheduling work, and followed by a fresh public-probe query that schedules exactly one pass.
- New Critical/Important breakage: none.
- Out-of-scope observations: none. The scoped fix changes the owned reconciliation spec and task ledger/progress evidence only; no production behavior is changed.

## Verdict
Approved. The sole Important finding is addressed, with no new blocking breakage in Fix Round 1.
