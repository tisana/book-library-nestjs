# Task 04 review

## Task
Task 4 — Reconciliation startup, scheduling, claim, and lease races

## Reviewer model and reasoning
`/root/plan3_task4_review`; `gpt-5.6-sol`, high

## Reviewed commit
`05d9e1d929b7b11d3423faf506adf9a11c2834c4` (base `c6735fc56c40fa0f51b691c0dc2e3c4831dfb0d7`)

## Commands and exits
- Read the supplied brief, current project plan, implementation report, review ledger, and `review-c6735fc..05d9e1d.diff` once as the primary patch view: exit 0. The report was treated as untrusted claims.
- Inspected the owned reconciliation spec, unchanged public lifecycle/reconciliation implementation, and approved Plan 2/3 fixture helpers without rerunning Git: exit 0.
- `npx jest --runInBand auth/auth-identifier-reconciliation.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-reconciliation.service.ts --coverageReporters=text`: exit 0; 1/1 suite and 34/34 tests passed; statements 206/228, branches 151/191 (79.05%), functions 40/42, lines 204/226.
- `npx eslint src/auth/auth-identifier-reconciliation.service.spec.ts`: exit 0.

## Findings
### Spec Compliance

- Critical: none.
- Important — `src/auth/auth-identifier-reconciliation.service.spec.ts:394`: `starts a new lifecycle after shutdown without reusing prior readiness` awaits the first, immediately resolved `null` readiness result before shutdown. At that point `readinessStart` has already completed and its `finally` has cleared it, so the second bootstrap is only a normal sequential readiness check. The test would still pass if lifecycle-generation invalidation were removed, and it cannot detect reuse of an in-flight readiness promise when shutdown/rebootstrap occurs before the original Mongo readiness query settles. The brief and binding constraints require observable fresh-generation/stale-readiness behavior. Keep the first readiness query deferred across shutdown and the second bootstrap, then assert that the new lifecycle performs an independent readiness check and that the old generation cannot schedule or reconcile work.
- Minor: none.

All other required cases are directly evidenced through public `onApplicationBootstrap`, `onApplicationShutdown`, `reconcileOnce`, or `renewLease` behavior: no-connection readiness-only probing, absent-scheduler retry behavior, readiness-to-schedule transition, contained startup/scheduled rejection, null-claim accounting, configured batch cap, release of each acquired lease, missing key material before claim, shutdown/readiness race, and foreign-schedule ownership. The exact requested factory seam is present, and the spec directly reuses `deferred`, `queryResult`, `createStaffModelHarness`, `createIdentifierModelHarness`, `createIdentifierOperation`, and `criticalQueryResult`.

### Task Quality

- Critical: none.
- Important: none beyond the compliance gap above.
- Minor: none.

The focused suite and lint pass. Claim/batch/lease assertions distinguish examined, claimed, processed, skipped, claim-call, and pipeline-release behavior; the new public-path cases are materially stronger than the retained legacy private-path coverage. Every added deferred is resolved and awaited, and each added fake-timer case restores real timers and clears or verifies removal of owned intervals on its successful path.

### ⚠️ Unverifiable items

- The historical RED failure cannot be independently reproduced from the reviewed immutable head.
- The reported full backend suite, `git diff --check`, and generated-output staging state were not rerun because the review instructions prohibit rerunning broad suites or Git. No generated output or forbidden production/configuration/frontend/e2e/baseline/denominator/script change was observed in the supplied patch view, but index/staging state is not independently verifiable without Git.

## Resolutions verified
- None. The lifecycle-generation/stale-readiness finding remains open.

## Verdict
Changes requested. Not approved while the Important lifecycle-generation finding remains open.
