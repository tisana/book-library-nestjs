# Critical Module Branch Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Starting from Plan 2's completed, independently reviewed final commit, raise every designated critical backend module to at least 85% branch coverage through adversarial public-contract tests, ratchet borrowing coverage to at least 90% when the identified state-transition tests remain valuable, and leave permission evaluation unchanged unless fresh evidence shows a regression.

**Architecture:** Extend the five existing Jest service specs with boundary, authorization, idempotency, concurrency, and failure-recovery assertions against public methods and observable model requests. Consume Plan 2's shared fixtures directly, add one focused critical-fixture module for stable document builders, and derive every threshold and baseline change from a fresh all-source backend run.

**Tech Stack:** TypeScript 5.9.x, NestJS 11.x, Jest 30.2, ts-jest 29.4, Mongoose 9.x, LCOV, the repository's scoped backend quality reporter.

## Global Constraints

- Plan 3 starts only from Plan 2's completed and independently reviewed final commit. Record that exact commit before changing a file.
- Execute in an isolated worktree created with `superpowers:using-git-worktrees`; preserve unrelated worktree changes.
- Import Plan 2's exact `test/support/backend-coverage-fixtures.ts` exports: `deferred`, `queryResult`, `createStaffDocument`, `createStaffModelHarness`, and `createIdentifierModelHarness`. Do not copy their implementations.
- Do not modify a Plan 2 test or `test/support/backend-coverage-fixtures.ts`. If an advertised export is defective, prove the defect with the smallest owned-spec compile/runtime reproduction, obtain a separate Plan 2 follow-up review and commit, rebase Plan 3, and rerun the dependency gate.
- Add assertions only for observable results, exceptions, model filters/updates, lease ownership, terminal ordering, redaction, or stable public contracts. Do not call or spy on private methods in new tests.
- Do not change production source, coverage denominators, exclusions, expected-file counts, thresholds, scripts, Jest configuration, CI, or e2e product behavior in this plan.
- Keep backend, frontend unit, and frontend Playwright metrics separate. Do not touch the frontend baseline object.
- Coverage gains must come from behavior assertions. Execution-only tests, snapshots of unstable implementation details, and duplicate cases are prohibited.
- Preserve generic refresh denial text, hash-only token storage, absolute family expiry, repair authorization at every mutation boundary, lease ownership, terminal-event-before-TTL ordering, member session revocation, borrowing ownership, and legal loan transitions.
- Missing, malformed, zero-test, failed-suite, producer, global-error, expected-file-count, and changed-line failures remain blocking.
- Baselines ratchet upward only. Generated `coverage/` and `test-results/` artifacts are evidence and must not be staged.
- Use separate agent contexts for implementation and review. Every task report records both actual model/reasoning assignments, RED/GREEN evidence, focused coverage pairs, files, commit, findings, and resolution.
- Ledger: `.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/`.

---

## Current evidence, target math, and milestone

The checked-in `coverage/backend-unit/coverage-summary.json` and
`coverage/backend-unit/lcov.info` provide this planning baseline:

| Module | Current branches | 85% minimum | Required to 85% | Plan 3 floor/stretch |
| --- | ---: | ---: | ---: | ---: |
| `src/auth/token-session.service.ts` | 84/103, 81.55% | 88/103, 85.43% | +4 | >=88/103 |
| `src/auth/auth-identifier-repair.service.ts` | 70/110, 63.63% | 94/110, 85.45% | +24 | >=94/110 |
| `src/auth/auth-identifier-reconciliation.service.ts` | 138/191, 72.25% | 163/191, 85.34% | +25 | >=163/191 |
| `src/members/members.service.ts` | 141/188, 75.00% | 160/188, 85.10% | +19 | >=160/188 |
| `src/borrowings/borrowings.service.ts` | 102/116, 87.93% | already met | +0 | >=105/116, 90.51% |
| `src/auth/permissions.service.ts` | 71/74, 95.94% | already met | +0 | monitor only; no edits |

The hard floor therefore needs **72** additional covered branches:
`4 + 24 + 25 + 19 + 0`. The earlier dependency design described 74 because
it added two borrowing branches even though borrowing was already above 85%;
those two are stretch work, not part of the every-module 85% floor. This plan
budgets **75**: the required 72 plus three valuable borrowing transition
branches. The extra third borrowing branch is necessary because
`Math.ceil(0.90 * 116) = 105`; 104/116 is 89.65%, not 90%.

The repository-wide branch denominator is currently 2,815. If Plan 2 finishes
at its minimum 1,971/2,815 and Plan 3 gains exactly 75 branches without a
denominator change, Plan 3 finishes at least 2,046/2,815, 72.68%, leaving at
most 66 branches to the 75% overall threshold of 2,112/2,815. If Plan 2 lands
at its 1,979/2,815 forecast, the corresponding Plan 3 forecast is
2,054/2,815, 72.97%, with 58 remaining. Task 9 replaces both forecasts with
fresh Plan 2-base and Plan 3-final evidence; Plan 2's gate remains >=70%.

If a focused run naturally exceeds 90% without execution-only assertions,
Task 9 records and ratchets the higher observed pair. The minimum acceptance
gate remains the exact pairs above.

### Milestone and program final target

Plan 3's milestone is per-file critical hardening: token session, repair,
reconciliation, members, and borrowings each meet at least 85%, borrowing
reaches the evidence-backed 90% stretch, and permissions does not regress.
The wider program target remains at least 75% overall backend branch coverage;
Plan 3 records the remaining backlog but does not hide that later work inside
this security-focused milestone. Plan 5 then adds selective mutation testing
at a minimum 70% selected-module mutation score without replacing coverage.

### Non-goals

- Reaching 75% repository-wide branch coverage in Plan 3.
- Adding production behavior, refactoring critical services, or fixing a
  newly exposed production defect without separate approval.
- Adding permission tests while its current 71/74 evidence remains stable.
- Changing e2e behavior, coverage/reporting configuration, denominators,
  exclusions, expected-file counts, thresholds, CI, or documentation outside
  the Plan 3 ledger.
- Starting mutation testing, mutation configuration, or mutation runtime work;
  those belong to Plan 5 after the reviewed handoff.

### LCOV-derived adversarial backlog

| Module | Uncovered branch lines used by this plan | Behavior exercised |
| --- | --- | --- |
| Token session | 387, 410, 421-435, 468, 485-490, 567 | duplicate-marker race disappearance, orphan/invariant distinction, missing lease, lost takeover CAS, interrupted CAS reconciliation, absent legacy auth version |
| Repair | 105-106, 135, 309, 325, 377, 425, 523, 530, 628, 642, 645-653, 662-708, 719-750, 775, 781-783, 857, 863 | stable resume id, mismatched operation ownership, missing conflict/claimant, checkpoint mismatch, invalid batch state, retained/released parent, unmapped compensation, missing target, staff/member aggregate selection, duplicate reservation, missing transaction support/key/config |
| Reconciliation | 102, 132-163, 206, 239-260, 363-405, 410-440, 503-548, 556-651, 658-718, 731-803, 809-879, 884-916 | restart/shutdown races, missing scheduler/connection, batch cap/claim loss, retry direction, cleanup-only terminal work, reservation attachment/correlation, recovery state matrix, terminal actor/outcome/TTL ordering, bounded gate/batch cleanup, configured/default bounds |
| Members | 91-109, 173-235, 287, 332-364, 414-474, 492-540 | optional fields/dependencies, unchanged/cleared identifiers, zero/default auth version, same-owner/foreign/released reservation, duplicate-key mapping, credential rollback, session revocation, system/staff audit actor |
| Borrowings | 116, 125-129, 143 | explicit return time, illegal state denial, overdue return acceptance, loan-count floor |
| Permissions | 89, 99, 132 | monitored only because 71/74 already exceeds both critical floors |

Existing tests already cover happy-path family rotation, committed replay,
active pending lease denial, expired lease takeover, concurrent exchange,
scheduled reconciliation containment, cookie parity, generic malformed/missing
refresh denial, repair happy path/idempotent replay/authorization expiry,
reconciliation key denial/lease renewal/concurrent run/invalid state/cleanup,
member normalized credentials/conflicts/save compensation, borrowing creation,
duplicate return, ownership filters, and missing IDs. Plan 3 must not restate
those cases under new names.

---

## Dependency, parallel-execution, and conflict contract

### Hard dependency gate

Before Task 1, the dispatcher performs these read-only checks:

```powershell
git status --short
git log -1 --oneline
Get-Content -Raw .superpowers/sdd/2026-07-29-plan-2-backend-coverage/progress.md
Get-Content -Raw test/support/backend-coverage-fixtures.ts
npm run test:quality-reporting
npm run test:cov
npm run test:e2e:report
npm run quality:report:backend
```

Expected: clean isolated worktree; `HEAD` is Plan 2's final reviewed handoff
commit; its ledger names successful task and final-review commits; all five
advertised fixture functions exist with the exact signatures below; all commands
exit 0; backend branches are at least 70%; other metrics do not decrease; e2e
has zero final failures.

Validate the five-function export surface exactly:

```powershell
$fixtureFunctions = Get-Content -LiteralPath 'test/support/backend-coverage-fixtures.ts' | ForEach-Object { if ($_ -match '^export function ([A-Za-z0-9_]+)') { $Matches[1] } }
$expectedFixtureFunctions = @('deferred', 'queryResult', 'createStaffDocument', 'createStaffModelHarness', 'createIdentifierModelHarness')
if (@($fixtureFunctions).Count -ne 5 -or (Compare-Object $expectedFixtureFunctions $fixtureFunctions)) { throw 'invalid-plan-2-fixture-exports' }
```

Record the base without a symbolic placeholder:

```powershell
New-Item -ItemType Directory -Force .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git rev-parse HEAD | Set-Content -LiteralPath .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/base.sha -NoNewline
$plan3Base = (Get-Content -LiteralPath .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/base.sha).Trim()
if ($plan3Base -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-3-base-sha' }
```

Stop before Task 1 if any expected condition fails. Do not recreate a missing
fixture or infer Plan 2's final commit from conversation history.

### Consumed Plan 2 interfaces

```ts
export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

export interface StaffFindQueryDouble<T> {
  sort(value: Record<string, 1 | -1>): StaffFindQueryDouble<T>;
  skip(value: number): StaffFindQueryDouble<T>;
  limit(value: number): StaffFindQueryDouble<T>;
  exec(): Promise<T>;
}

export interface IdentifierQueryDouble<T> {
  select(value: unknown): IdentifierQueryDouble<T>;
  session(value: unknown): IdentifierQueryDouble<T>;
  exec(): Promise<T>;
}

export interface StaffModelRecordedCalls {
  constructorInputs: unknown[];
  existsFilters: unknown[];
  findOneFilters: unknown[];
  findFilters: unknown[];
  sortValues: unknown[];
  skipValues: number[];
  limitValues: number[];
  updateOneArguments: unknown[][];
}

export interface IdentifierModelRecordedCalls {
  findOneFilters: unknown[];
  sessionValues: unknown[];
  updateOneArguments: unknown[][];
  createArguments: unknown[][];
}

export function deferred<T>(): Deferred<T>;

export function queryResult<T>(value: T): IdentifierQueryDouble<T>;

export function createStaffDocument(
  overrides?: Partial<StaffUserDocument>,
): StaffUserDocument;

export function createStaffModelHarness(options?: {
  document?: StaffUserDocument;
  existsResult?: unknown;
  findOneResult?: StaffUserDocument | null;
  findResult?: StaffUserDocument[];
  startSession?: jest.Mock;
}): {
  model: jest.Mock & {
    exists: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    updateOne: jest.Mock;
    db: { startSession?: jest.Mock };
  };
  document: StaffUserDocument;
  calls: StaffModelRecordedCalls;
};

export function createIdentifierModelHarness(options?: {
  findOneResult?: AuthIdentifierDocument | null;
}): {
  model: {
    findOne: jest.Mock;
    updateOne: jest.Mock;
    create: jest.Mock;
  };
  calls: IdentifierModelRecordedCalls;
};
```

`createStaffModelHarness.model` is constructable with `new`; it records exact
constructor, exists, findOne, find, sort, skip, limit, and updateOne inputs.
`createIdentifierModelHarness` records exact findOne/session/exec, updateOne,
and create inputs without normalizing them.

### Parallel and merge rules

- Plans 1 and 4 may continue in separate isolated worktrees while Plan 3 runs.
- Plan 3 may not run concurrently with unfinished Plan 2 or any Plan 5 work.
- Plans 1, 3, and 4 may produce independent evidence concurrently, but merges
  are sequential. After each merge that touches quality output or baselines,
  rerun Task 9 from the new integrated head.
- `quality/coverage-baselines.json` is a shared conflict file. Retain the
  maximum value for every backend and frontend metric, never one side's entire
  object, then regenerate the affected report.
- Plan 5 starts only after Task 10's separate whole-plan review commit.

---

## Owned, shared, prohibited, and expected files

### Owned files

- `src/auth/token-session.service.spec.ts`
- `src/auth/auth-identifier-repair.service.spec.ts`
- `src/auth/auth-identifier-reconciliation.service.spec.ts`
- `src/members/members.service.spec.ts`
- `src/borrowings/borrowings.service.spec.ts`
- `test/support/critical-auth-fixtures.ts`
- Backend object only in `quality/coverage-baselines.json`
- `.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/**`

### Shared read-only files and artifacts

- `test/support/backend-coverage-fixtures.ts`
- `src/auth/permissions.service.ts`
- `src/auth/permissions.service.spec.ts`
- The five critical production services
- `package.json`, Jest configuration, quality scripts, CI workflow
- `coverage/backend-unit/coverage-summary.json`
- `coverage/backend-unit/lcov.info`
- `test-results/backend-unit.json`
- `test-results/backend-e2e.json`

### Prohibited files and changes

- Every production `src/**/*.ts` file
- Plan 2 tests and `test/support/backend-coverage-fixtures.ts`
- `src/auth/permissions.service.spec.ts` while permission branches remain at
  least 85%
- Backend e2e specs; they are regression evidence, not Plan 3 coverage work
- `package.json`, lockfiles, Jest/TypeScript configuration, expected-file
  count, `scripts/quality/**`, `.github/workflows/**`, README, migrations
- All frontend files and the frontend baseline object
- Generated coverage, result, HTML, LCOV, and JSON report artifacts

### Expected new files

- `test/support/critical-auth-fixtures.ts`
- `.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/base.sha`
- `.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/progress.md`
- Exact task report names `task-01-report.md` and `task-01-review.md`,
  incrementing through `task-10-report.md` and `task-10-review.md`

### Exact ledger and report contract

The Task 1 implementer initializes `progress.md` and all 20 task files before
editing a spec. `progress.md` uses these exact columns:

```text
Task | Status | Requested implementer | Actual implementer | Reasoning | Starting commit | Task commit | Reviewer | Review commit | Verdict | Findings resolved
```

Every `task-NN-report.md` contains these exact level-two headings:

```text
## Task
## Status
## Base SHA
## Starting commit
## Requested implementer model and reasoning
## Actual implementer model and reasoning
## Files changed
## RED command and exit
## RED evidence
## GREEN command and exit
## GREEN evidence
## Focused covered/total metrics
## Full-suite commands and exits
## Changed-line result
## Commit hash
## Assumptions
## Deferred findings
```

Every `task-NN-review.md` contains these exact level-two headings:

```text
## Task
## Reviewer model and reasoning
## Reviewed commit
## Commands and exits
## Findings
## Resolutions verified
## Verdict
```

Initialize future-task fields to the literal `not-run`; never omit a heading.
The fresh Task 1 reviewer validates the bootstrap with:

```powershell
$plan3Ledger = '.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening'
$plan3Base = (Get-Content -LiteralPath "$plan3Ledger/base.sha").Trim()
$plan3Head = (git rev-parse HEAD).Trim()
if ($plan3Base -notmatch '^[0-9a-f]{40}$' -or $plan3Head -ne $plan3Base) { throw 'plan-3-ledger-base-mismatch' }
$implementerHeadings = @('Task','Status','Base SHA','Starting commit','Requested implementer model and reasoning','Actual implementer model and reasoning','Files changed','RED command and exit','RED evidence','GREEN command and exit','GREEN evidence','Focused covered/total metrics','Full-suite commands and exits','Changed-line result','Commit hash','Assumptions','Deferred findings')
$reviewHeadings = @('Task','Reviewer model and reasoning','Reviewed commit','Commands and exits','Findings','Resolutions verified','Verdict')
$implementerReports = @(Get-ChildItem -LiteralPath $plan3Ledger -Filter 'task-??-report.md')
$reviewReports = @(Get-ChildItem -LiteralPath $plan3Ledger -Filter 'task-??-review.md')
if ($implementerReports.Count -ne 10 -or $reviewReports.Count -ne 10) { throw 'expected-10-plan-3-implementer-and-review-reports' }
foreach ($report in $implementerReports) {
  $body = Get-Content -Raw $report.FullName
  foreach ($heading in $implementerHeadings) {
    if ($body -notmatch "(?m)^## $([regex]::Escape($heading))$") { throw "missing-$heading-in-$($report.Name)" }
  }
}
foreach ($report in $reviewReports) {
  $body = Get-Content -Raw $report.FullName
  foreach ($heading in $reviewHeadings) {
    if ($body -notmatch "(?m)^## $([regex]::Escape($heading))$") { throw "missing-$heading-in-$($report.Name)" }
  }
}
```

Expected: exact base/HEAD match, ten implementer reports, ten reviewer reports,
and every mandatory heading present. Any model substitution is written to
`progress.md` before that task begins. Each reviewer fills its review file and
sets `Verdict` to `approved` only after all findings are resolved.

---

## Phase model and review policy

| Phase | Tasks | Recommended implementer | Required reviewer | Reason |
| --- | --- | --- | --- | --- |
| A: session races and shared builders | 1 | `gpt-5.6-sol`, high | separate `gpt-5.6-sol`, high | refresh replay and concurrency are security-sensitive |
| B: offline repair | 2-3 | `gpt-5.6-sol`, high | separate `gpt-5.6-sol`, high | authorization, idempotency, compensation, transaction ordering |
| C: reconciliation | 4-5 | `gpt-5.6-sol`, high | separate `gpt-5.6-sol`, high | lifecycle, leases, multi-instance races, terminal recovery |
| D: member lifecycle | 6-7 | `gpt-5.6-sol`, high | separate `gpt-5.6-sol`, high | credential ownership, revocation, audit effects |
| E: borrowing/permission boundary | 8 | `gpt-5.6-sol`, high | separate `gpt-5.6-sol`, high | ownership and legal state transitions |
| F: ratchet and integration | 9 | `gpt-5.6-sol`, high | separate `gpt-5.6-sol`, high | authoritative baseline and security regression gate |
| G: final review and Plan 5 handoff | 10 | `gpt-5.6-sol`, high | fresh `gpt-5.6-sol`, high | whole-plan integration and mutation-ready handoff |

If a named model is unavailable, use the newest coding model with equal or
greater capability. Before work, record the substituted model, reasoning,
reason, and tasks in `progress.md`. No security, concurrency, lifecycle, or
whole-plan task may be downgraded below the recommended capability.

---

### Task 1: Refresh rotation race boundaries and critical builders

**Recommended agent:** `gpt-5.6-sol`, high.

**Required reviewer:** Separate-context `gpt-5.6-sol`, high.

**Files:**

- Create: `test/support/critical-auth-fixtures.ts`
- Modify: `src/auth/token-session.service.spec.ts`
- Create/update: `progress.md`, all 20 report templates, `task-01-report.md`,
  and `task-01-review.md` under the exact ledger contract

**Interfaces:**

- Consumes Plan 2 `deferred`, `queryResult`, `createStaffDocument`,
  `createStaffModelHarness`, and `createIdentifierModelHarness` directly; the
  latter three seed later repair/member tasks through the critical fixture
  module.
- Produces these Plan 5-stable builders:

```ts
createRefreshFamily(
  overrides?: Partial<RefreshTokenFamilyDocument>,
): RefreshTokenFamilyDocument

createReplayMarker(
  overrides?: Partial<RefreshTokenReplayMarkerDocument>,
): RefreshTokenReplayMarkerDocument

createIdentifierOperation(
  overrides?: Partial<AuthIdentifierOperationDocument>,
): AuthIdentifierOperationDocument

createMemberDocument(
  overrides?: Partial<MemberDocument>,
): MemberDocument

createBorrowingDocument(
  overrides?: Partial<BorrowingDocument>,
): BorrowingDocument

interface CriticalQueryDouble<T> extends IdentifierQueryDouble<T> {
  lean(): CriticalQueryDouble<T>;
  sort(value: unknown): CriticalQueryDouble<T>;
  limit(value: number): CriticalQueryDouble<T>;
}

criticalQueryResult<T>(
  value: T,
  capture?: { sort?: unknown; limit?: number },
): CriticalQueryDouble<T>

createCriticalModelHarnesses(options?: {
  staffDocument?: StaffUserDocument;
  identifier?: AuthIdentifierDocument | null;
}): {
  staff: ReturnType<typeof createStaffModelHarness>;
  identifier: ReturnType<typeof createIdentifierModelHarness>;
}
```

Each builder returns a valid deterministic baseline object, uses
`Types.ObjectId` for persisted IDs, gives date fields fixed UTC values, and
accepts overrides last. The module wraps Plan 2 `queryResult` only to add
`lean`, `sort`, and `limit`; it does not reproduce `select`, `session`, or
`exec`.

- [ ] **Step 0: Initialize and validate the exact ledger**

Use `apply_patch` to create `progress.md` and all 20 report templates with the
exact headings above. Fill Task 1's requested/actual `gpt-5.6-sol`, high
assignment and base SHA; leave future execution fields as `not-run`. Run the
ledger validation block, then obtain the fresh Task 1 reviewer's approval of
the bootstrap before editing a spec.

- [ ] **Step 1: Add RED tests and the missing fixture import**

Add public `rotate` cases for:

1. duplicate pending-marker insert followed by a disappeared raced marker:
   generic denial and unchanged family hash;
2. pending marker with no `leaseExpiresAt`: finalize marker, revoke family,
   and return only `Invalid refresh session`;
3. expired pending marker whose atomic takeover returns `null`: generic
   denial and no successor hash;
4. uncertain family CAS where the family still has the presented hash:
   leave the pending marker takeover-eligible and do not revoke.

Representative race:

```ts
it('denies a lost duplicate-marker race without mutating the family', async () => {
  const issued = await createFamily();
  const originalHash = families.documents[0].currentTokenHash;
  const insertStarted = deferred<void>();
  jest.spyOn(markers, 'create').mockImplementationOnce(async () => {
    insertStarted.resolve(undefined);
    throw Object.assign(new Error('duplicate'), { code: 11000 });
  });
  jest
    .spyOn(markers, 'findOne')
    .mockReturnValueOnce(queryResult(undefined) as never);

  const rotation = service.rotate(issued.refreshToken);
  await insertStarted.promise;

  await expect(rotation).rejects.toMatchObject({
    message: 'Invalid refresh session',
  });
  expect(families.documents[0].currentTokenHash).toBe(originalHash);
});
```

- [ ] **Step 2: Run RED**

```powershell
npx jest --runInBand auth/token-session.service.spec.ts --coverage --collectCoverageFrom=auth/token-session.service.ts --coverageReporters=text
```

Expected: FAIL first because `critical-auth-fixtures.ts` is absent and the
new race expectations are not supported by the spec harness.

- [ ] **Step 3: Implement builders and the smallest harness extensions**

Import Plan 2 `queryResult`, `createStaffDocument`,
`createStaffModelHarness`, and `createIdentifierModelHarness` into
`critical-auth-fixtures.ts`; use all four in the adapters/builders above.
Import `deferred` directly into the token spec. Extend the local fake marker
model with deterministic one-shot `create`, `findOne`, and takeover outcomes;
do not change `TokenSessionService`.

- [ ] **Step 4: Run GREEN and focused coverage**

Run the Step 2 command again.

Expected: PASS; token-session branches are at least 88/103. All denials have
identical text, no test inspects a raw stored refresh token, and the uncertain
pre-CAS case retains a pending marker.

- [ ] **Step 5: Review and commit**

Reviewer rejects copied Plan 2 helper code, unstable UUID/date assertions,
private-method access, or a denial that exposes the invariant category.

```powershell
git add test/support/critical-auth-fixtures.ts src/auth/token-session.service.spec.ts .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git commit -m "test: harden refresh rotation races"
```

---

### Task 2: Offline repair validation and fail-closed preconditions

**Recommended agent:** `gpt-5.6-sol`, high.

**Required reviewer:** Separate-context `gpt-5.6-sol`, high.

**Files:**

- Modify: `src/auth/auth-identifier-repair.service.spec.ts`
- Create/update: task 02 ledger reports

**Interfaces:**

- Consumes public `dryRun(input: OfflineRepairRequest)`,
  `apply(input: OfflineRepairRequest)`, and `cancel(input: OfflineRepairRequest)`.
- Consumes `createIdentifierOperation`, `createStaffDocument`, and the existing
  manifest fixture.
- Produces proof that authorization/configuration/manifest failures precede
  writes and that public errors reveal no claimant or database details.

- [ ] **Step 1: Add RED precondition cases**

Add table-driven assertions for:

- `apply` resume IDs `undefined`, `''`, and `'   '` reject with 422 before
  `authorizeMutation`;
- `dryRun` with no configured current key version rejects
  `repair-key-required` before operation lookup/create;
- an existing operation with wrong type, key version, or manifest hash rejects
  as operation-id conflict without mutation;
- missing conflict and non-conflict reservation both return the same
  `Identifier conflict not found`;
- omitted claimant, foreign claimant, and duplicate claimant fail the manifest
  accounting contract before operation mutation;
- missing persisted operation returns `Repair operation not found`.

```ts
it.each([undefined, '', '   '])(
  'rejects unstable resume id %p before authorization or mutation',
  async (resumeId) => {
    const fixture = createFixture();
    try {
      await fixture.service.apply({
        token: 'redacted-admin-token',
        operationId: 'repair-1',
        manifest,
        resumeId,
      });
      fail('Expected apply to reject an unstable resume id');
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(error).toMatchObject({
        message: 'A stable resume id is required',
      });
      expect((error as UnprocessableEntityException).getStatus()).toBe(422);
    }
    expect(fixture.authorization.authorizeMutation).not.toHaveBeenCalled();
    expect(fixture.operationModel.updateOne).not.toHaveBeenCalled();
  },
);
```

- [ ] **Step 2: Run RED**

```powershell
npx jest --runInBand auth/auth-identifier-repair.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-repair.service.ts --coverageReporters=text
```

Expected: at least one new case FAILS before the harness uses real public model
queries; record the failing title and exit code.

- [ ] **Step 3: Implement test-only query/model setup**

Use `criticalQueryResult` for `dryRun`'s `findOne().lean().exec()` operation
query and `mockResolvedValue` for `apply`/`cancel`'s awaited document lookup.
Use `createIdentifierOperation(overrides)` for persisted states. Use a
`createStaffDocument({ id: 'admin-2' })` actor only as a stable active staff
subject; never place its password hash or token in an expectation.

- [ ] **Step 4: Run GREEN and coverage checkpoint**

Run Step 2 again.

Expected: PASS and at least 80/110 repair branches. Every failure path has zero
calls to batch, identifier, staff, and member mutation mocks.

- [ ] **Step 5: Review and commit**

```powershell
git add src/auth/auth-identifier-repair.service.spec.ts .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git commit -m "test: cover repair validation boundaries"
```

---

### Task 3: Offline repair transaction, aggregate, and compensation recovery

**Recommended agent:** `gpt-5.6-sol`, high.

**Required reviewer:** Separate-context `gpt-5.6-sol`, high.

**Files:**

- Modify: `src/auth/auth-identifier-repair.service.spec.ts`
- Create/update: task 03 ledger reports

**Interfaces:**

- Consumes the same public repair methods and Task 2 fixture extensions.
- Produces observable transaction ordering, aggregate selection, rollback,
  terminal-event, and session-cleanup evidence.

- [ ] **Step 1: Add RED transaction and recovery cases**

Exercise these through `apply` or `cancel`, not private calls:

- existing pending batch with wrong `checkpointHash` rejects before aggregate
  mutation and ends the session;
- batch in a state other than `prepared`/`activated` rejects activation;
- transaction session without `withTransaction` ends and rejects
  `Offline repair requires transaction support`;
- replacement upsert returning `null` maps to `Replacement unavailable`;
- duplicate-key code `11000` maps to the fixed reservation conflict while a
  nonduplicate error is rethrown unchanged;
- missing staff and missing member aggregate each return `Repair subject not
  found`;
- aggregate already at the replacement identifier skips `updateOne`;
- staff and member assignments select `email` and `loginIdentifier`
  respectively and increment `authVersion` once;
- a manifest without `retainedSubject` releases the original conflict under
  the first reassigned subject;
- cancellation skips an unmapped batch assignment and an assignment without a
  target reservation while still reaching the redacted failed terminal event.

Representative transaction-support assertion:

```ts
it('fails before repair writes when MongoDB transaction support is absent', async () => {
  const fixture = createFixture();
  const endSession = jest.fn().mockResolvedValue(undefined);
  fixture.operationModel.db.startSession.mockResolvedValue({ endSession });
  const manifestHash = hashRepairManifest(
    manifest,
    Buffer.alloc(32, 4),
    1,
  ).manifestHash;
  fixture.operationModel.findOne.mockResolvedValue(
    createIdentifierOperation({
      operationId: 'repair-1',
      operationType: AuthIdentifierOperationType.OfflineRepair,
      status: AuthIdentifierOperationStatus.Applying,
      manifestHash,
      manifestKeyVersion: 1,
    }),
  );
  fixture.identifierModel.findById = jest.fn().mockResolvedValue({
    _id: 'conflict-1',
    status: AuthIdentifierStatus.Conflict,
    conflictingSubjects: [manifest.retainedSubject, ...manifest.reassignments],
  });

  await expect(
    fixture.service.apply({
      token: 'redacted-admin-token',
      operationId: 'repair-1',
      manifest,
      resumeId: 'resume-transaction-check',
    }),
  ).rejects.toMatchObject({
    message: 'Offline repair requires transaction support',
  });
  expect(endSession).toHaveBeenCalledTimes(1);
  expect(fixture.identifierModel.updateOne).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run RED**

```powershell
npx jest --runInBand auth/auth-identifier-repair.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-repair.service.ts --coverageReporters=text
```

Expected: new transaction/recovery cases FAIL before the harness models the
actual query and session boundaries.

- [ ] **Step 3: GREEN with test-only harness changes**

Use Plan 2 `createStaffModelHarness()` for the staff aggregate, extend its model
locally with `findById`, and use Plan 2 `queryResult()` plus a one-method
`lean()` adapter. Do not widen the Plan 2 helper contract.

- [ ] **Step 4: Run GREEN and repair hard gate**

Run Step 2 again.

Expected: PASS; repair branches are at least 94/110. Terminal event recording
precedes the parent terminal update, sessions end on success and failure, and
no raw identifier is emitted in an event assertion.

- [ ] **Step 5: Review and commit**

```powershell
git add src/auth/auth-identifier-repair.service.spec.ts .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git commit -m "test: harden repair transaction recovery"
```

---

### Task 4: Reconciliation startup, scheduling, claim, and lease races

**Recommended agent:** `gpt-5.6-sol`, high.

**Required reviewer:** Separate-context `gpt-5.6-sol`, high.

**Files:**

- Modify: `src/auth/auth-identifier-reconciliation.service.spec.ts`
- Create/update: task 04 ledger reports

**Interfaces:**

- Consumes `onApplicationBootstrap(): Promise<void>`,
  `onApplicationShutdown(): void`, `reconcileOnce()`, and `renewLease()`.
- Consumes Plan 2 `deferred`, `queryResult`,
  `createStaffModelHarness`, and `createIdentifierModelHarness`.
- Produces lifecycle-generation, scheduler, batch-bound, claim-loss, and
  lease-release evidence.
- Produces this test-local factory:

```ts
createReconciliationService(overrides?: {
  scheduler?: SchedulerRegistry;
  connection?: Connection;
  config?: ConfigService;
  operations?: typeof operations;
  identifiers?: typeof identifiers;
  batches?: typeof batches;
}): AuthIdentifierReconciliationService
```

- [ ] **Step 1: Add RED lifecycle and race cases**

Add assertions that:

- bootstrap without a Mongo connection registers only a readiness probe and
  never a reconciliation schedule;
- bootstrap after prior shutdown starts a new lifecycle generation and does
  not reuse a stale readiness promise;
- absent `SchedulerRegistry` never marks work scheduled;
- two candidates racing for one claim count the `null` claim as examined but
  not claimed/processed;
- a candidate list larger than the configured batch size claims only the
  configured maximum and releases each acquired lease;
- an offline repair with an allowed decision but missing key material is
  skipped before claim;
- shutdown during deferred migration readiness prevents late schedule
  registration;
- shutdown with a scheduler that no longer owns the interval is idempotent and
  does not delete another instance's schedule.

```ts
it('does not register work after shutdown wins a migration-readiness race', async () => {
  const readiness = deferred<Record<string, unknown> | null>();
  const scheduler = {
    addInterval: jest.fn(),
    doesExist: jest.fn().mockReturnValue(false),
    deleteInterval: jest.fn(),
  };
  const connection = {
    db: {
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValue(readiness.promise),
      }),
    },
  };
  service = createReconciliationService({ scheduler, connection });

  const bootstrap = service.onApplicationBootstrap();
  service.onApplicationShutdown();
  readiness.resolve({ version: '003' });
  await bootstrap;

  expect(scheduler.addInterval).not.toHaveBeenCalled();
  expect(operations.findOneAndUpdate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run RED**

```powershell
npx jest --runInBand auth/auth-identifier-reconciliation.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-reconciliation.service.ts --coverageReporters=text
```

Expected: FAIL before the test fixture accepts scheduler/connection overrides
and deferred readiness.

- [ ] **Step 3: Extend only the test factory**

Replace new one-off identifier query doubles with Plan 2 `queryResult`; use
`createIdentifierModelHarness` for recorded identifier `findOne`/`updateOne`
requests and extend only the local operations mock with reconciliation-specific
`find`, `findOneAndUpdate`, and update-pipeline handling. Use
`createStaffModelHarness` only for a deterministic staff requester document.
Keep the service source unchanged.

- [ ] **Step 4: Run GREEN and checkpoint**

Run Step 2 again.

Expected: PASS and at least 150/191 reconciliation branches. Fake timers are
restored and no test leaves an interval or unresolved promise.

- [ ] **Step 5: Review and commit**

```powershell
git add src/auth/auth-identifier-reconciliation.service.spec.ts .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git commit -m "test: cover reconciliation scheduling races"
```

---

### Task 5: Reconciliation recovery, terminal ordering, and bounded cleanup

**Recommended agent:** `gpt-5.6-sol`, high.

**Required reviewer:** Separate-context `gpt-5.6-sol`, high.

**Files:**

- Modify: `src/auth/auth-identifier-reconciliation.service.spec.ts`
- Create/update: task 05 ledger reports

**Interfaces:**

- Consumes `reconcileOnce()` and Task 4's public service factory.
- Produces exact model requests proving recovery direction, HMAC-only
  correlation, terminal outcome, TTL gating, and bounded cleanup.

- [ ] **Step 1: Add RED recovery matrix**

Through claimed operations returned to `reconcileOnce`, prove:

- a terminal operation with cleanup not pending performs no cleanup mutation;
- failed-retryable with any compensated assignment transitions to
  `compensating`; without one it transitions to `applying`;
- already-applied/already-compensated assignments are skipped;
- missing or operation-mismatched reservations return recovery to
  `failed-retryable`;
- `retain`, `release`, and `replace` compensation restore `conflict`, `active`,
  and `released` respectively;
- unmatched discovered reservations do not mutate assignments;
- a matching reservation attaches its ID and an HMAC correlation under a
  requested key version, never its normalized identifier;
- absent key version/material still attaches the reservation ID but no fake
  correlation value;
- explicit failure result, all-compensated fallback, and successful recovery
  produce the correct terminal status/outcome/reason;
- a member request records a member actor; staff/system requests record staff;
- cleanup-pending finalization omits parent `expiresAt`;
- failed-terminal gated identifiers are released, completed gated identifiers
  are only unlocked;
- exhausted gate capacity defers batch expiry, remaining gate/batch work keeps
  cleanup pending, and empty remainder completes cleanup plus retention TTL.

Representative privacy assertion:

```ts
it('attaches an HMAC-only reservation reference during recovery', async () => {
  const candidate = createIdentifierOperation({
    operationId: 'operation-hmac',
    manifestKeyVersion: 7,
    assignments: [{
      assignmentId: 'assignment-1',
      subjectType: AuthIdentifierSubjectType.Member,
      subjectId: 'member-1',
      action: AuthIdentifierAssignmentAction.Replace,
      status: AuthIdentifierAssignmentStatus.Pending,
    }],
  });
  operations.find.mockReturnValue(query([candidate]));
  operations.findOneAndUpdate.mockResolvedValueOnce(candidate);
  identifiers.find.mockReturnValue(query([{
    _id: new Types.ObjectId(),
    normalizedIdentifier: 'secret@example.test',
    pendingOperationId: 'operation-hmac',
    pendingAction: AuthIdentifierPendingAction.Replace,
    subjectType: AuthIdentifierSubjectType.Member,
    subjectId: 'member-1',
  }]));

  await service.reconcileOnce();

  const serialized = JSON.stringify(operations.updateOne.mock.calls);
  expect(serialized).not.toContain('secret@example.test');
  expect(operations.updateOne).toHaveBeenCalledWith(
    expect.any(Object),
    expect.objectContaining({
      $set: expect.objectContaining({
        'assignments.$.identifierCorrelationHash': expect.any(String),
        'assignments.$.correlationKeyVersion': 7,
      }),
    }),
  );
});
```

- [ ] **Step 2: Run RED**

```powershell
npx jest --runInBand auth/auth-identifier-reconciliation.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-reconciliation.service.ts --coverageReporters=text
```

Expected: new recovery cases FAIL before the fixture supplies exact
reservation/gate/batch sequences.

- [ ] **Step 3: GREEN using sequenced query results**

Use Plan 2 `queryResult` and Jest `mockReturnValueOnce` sequences. Assertions
must inspect public result counts and model requests, not call `process`,
`finalize`, `cleanup`, or `correlationFor` directly.

- [ ] **Step 4: Run GREEN and reconciliation hard gate**

Run Step 2 again.

Expected: PASS; reconciliation branches are at least 163/191. No raw
identifier appears in operation/event writes, and lease release is attempted
even when one operation fails.

- [ ] **Step 5: Review and commit**

```powershell
git add src/auth/auth-identifier-reconciliation.service.spec.ts .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git commit -m "test: harden identifier recovery transitions"
```

---

### Task 6: Member identifier reservation and credential boundaries

**Recommended agent:** `gpt-5.6-sol`, high.

**Required reviewer:** Separate-context `gpt-5.6-sol`, high.

**Files:**

- Modify: `src/members/members.service.spec.ts`
- Create/update: task 06 ledger reports

**Interfaces:**

- Consumes public `create`, `update`, and `setMemberCredentials`.
- Consumes Plan 3 `createMemberDocument` and Plan 2 `queryResult`.
- Produces same-owner idempotency, foreign-owner denial, released-reservation
  recovery, duplicate-key normalization, and compensation evidence.
- Produces this test-local public-service factory:

```ts
createServiceWithMember(
  member: MemberDocument,
  overrides?: {
    model?: MockMemberModel;
    membershipTypesService?: MembershipTypesService;
    identifierModel?: ReturnType<typeof createIdentifierModel>;
    refreshTokenFamilyModel?: { updateMany: jest.Mock };
    securityActivityService?: { record: jest.Mock };
  },
): MembersService
```

Its default model returns `member` from `findOne().exec()`, has no duplicate
from `exists`, and accepts optional integrations exactly as the production
constructor does.

- [ ] **Step 1: Add RED identifier cases**

Add behavior tests for:

- same active member reservation is idempotent and performs no write;
- active reservation owned by another member and active reservation owned by
  staff both fail with `Sign-in identifier is already reserved`;
- released reservation reactivates with member ownership and clears
  `releasedAt`;
- create duplicate-key code `11000` maps to the fixed conflict message;
- nonduplicate object error and primitive rejection propagate unchanged;
- credential update to the same normalized login does not release its own
  active reservation;
- credential save failure releases only the newly acquired reservation;
- missing optional identifier model still permits credentials to be saved,
  hashed, and versioned.

```ts
it('keeps a same-owner active identifier idempotent', async () => {
  const member = createMemberDocument({
    id: 'member-id',
    loginIdentifier: 'ada@example.test',
    authVersion: 4,
  });
  member.save = jest.fn().mockResolvedValue(member);
  const identifierModel = createIdentifierModel({
    _id: 'identifier-1',
    status: AuthIdentifierStatus.Active,
    subjectType: AuthIdentifierSubjectType.Member,
    subjectId: 'member-id',
  });
  const service = createServiceWithMember(member, { identifierModel });

  await service.setMemberCredentials(
    validMemberId,
    ' ADA@EXAMPLE.TEST ',
    'replacement-password',
    actor,
  );

  expect(identifierModel.updateOne).not.toHaveBeenCalled();
  expect(member.authVersion).toBe(5);
});
```

- [ ] **Step 2: Run RED**

```powershell
npx jest --runInBand members/members.service.spec.ts --coverage --collectCoverageFrom=members/members.service.ts --coverageReporters=text
```

Expected: new same-owner/error-shape cases FAIL before the member fixture and
identifier sequences are generalized.

- [ ] **Step 3: GREEN with shared builders**

Replace only new document literals with `createMemberDocument`; use
`queryResult` for `findOne` and do not copy its chain implementation.

- [ ] **Step 4: Run GREEN and checkpoint**

Run Step 2 again.

Expected: PASS and at least 151/188 member branches. Password expectations use
`bcrypt.compare`; plaintext and hashes do not enter snapshots or ledger output.

- [ ] **Step 5: Review and commit**

```powershell
git add src/members/members.service.spec.ts .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git commit -m "test: cover member identifier boundaries"
```

---

### Task 7: Member lifecycle, revocation, optional dependency, and audit effects

**Recommended agent:** `gpt-5.6-sol`, high.

**Required reviewer:** Separate-context `gpt-5.6-sol`, high.

**Files:**

- Modify: `src/members/members.service.spec.ts`
- Create/update: task 07 ledger reports

**Interfaces:**

- Consumes public `create`, `update`, `findActiveById`,
  `getPolicyStatus`, and `setMemberCredentials`.
- Produces exact auth-version, revocation, optional-integration, and
  redacted-audit behavior.

- [ ] **Step 1: Add RED lifecycle cases**

Add assertions that:

- create works when the model has no optional `exists`, preserves a supplied
  zero/nonzero `activeLoanCount`, and omits absent email/actor fields;
- clearing an email does not reserve an empty identifier, releases the old
  identifier, increments auth version, revokes sessions, and audits a system
  actor when no staff actor is supplied;
- setting the same normalized email skips reservation, release, revocation,
  and identifier audit;
- status change with absent `authVersion` initializes it to 1 and revokes only
  active member families while unsetting both token hashes;
- absent refresh/session and security-activity integrations do not prevent the
  owned member update from completing;
- identifier-only and status-only changes emit only their matching event;
- active membership plus absent/non-active auth status follows the same public
  `Active member not found` contract;
- policy allowance clamps at zero when active loans exceed the tier maximum.

```ts
it('clears email without reserving an empty identifier and revokes sessions', async () => {
  const member = createMemberDocument({
    email: 'ada@example.test',
    authVersion: 0,
  });
  member.save = jest.fn().mockResolvedValue(member);
  const identifierModel = createIdentifierModel(null);
  const refreshTokenFamilyModel = {
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
  };
  const securityActivityService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const service = createServiceWithMember(member, {
    identifierModel,
    refreshTokenFamilyModel,
    securityActivityService,
  });

  await service.update(validMemberId, { email: '   ' });

  expect(identifierModel.create).not.toHaveBeenCalled();
  expect(identifierModel.updateOne).toHaveBeenCalledWith(
    expect.objectContaining({ normalizedIdentifier: 'ada@example.test' }),
    expect.objectContaining({
      $set: expect.objectContaining({ status: AuthIdentifierStatus.Released }),
    }),
  );
  expect(refreshTokenFamilyModel.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      subjectType: AuthSubjectType.Member,
      status: RefreshTokenFamilyStatus.Active,
    }),
    expect.objectContaining({
      $unset: { currentTokenHash: '', previousTokenHash: '' },
    }),
  );
  expect(securityActivityService.record).toHaveBeenCalledWith(
    expect.objectContaining({
      actorType: SecurityActivityActorType.System,
      actorId: undefined,
      reasonCategory: 'member-identifier-updated',
    }),
  );
});
```

- [ ] **Step 2: Run RED**

```powershell
npx jest --runInBand members/members.service.spec.ts --coverage --collectCoverageFrom=members/members.service.ts --coverageReporters=text
```

Expected: new lifecycle cases FAIL before the test factory supports absent
optional dependencies and cleared identifiers.

- [ ] **Step 3: GREEN with public-result/model-request assertions**

No production change is allowed. Keep model optionality explicit in the
constructor calls and verify the returned `MemberResponseDto`.

- [ ] **Step 4: Run GREEN and member hard gate**

Run Step 2 again.

Expected: PASS; members branches are at least 160/188. Revocation filters are
member-scoped, audit records contain only IDs/categories, and no credential is
logged.

- [ ] **Step 5: Review and commit**

```powershell
git add src/members/members.service.spec.ts .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git commit -m "test: harden member lifecycle effects"
```

---

### Task 8: Borrowing return boundary stretch and permission monitor

**Recommended agent:** `gpt-5.6-sol`, high.

**Required reviewer:** Separate-context `gpt-5.6-sol`, high.

**Files:**

- Modify: `src/borrowings/borrowings.service.spec.ts`
- Read only: `src/auth/permissions.service.spec.ts`
- Create/update: task 08 ledger reports

**Interfaces:**

- Consumes public `returnBorrowing`.
- Consumes Plan 3 `createBorrowingDocument`.
- Produces legal/illegal return transition and nonnegative loan-count evidence.
- Produces no permission test or source change; only a fresh measured pair.

- [ ] **Step 1: Add RED borrowing transition cases**

Add two public cases:

1. an `overdue` borrowing with explicit `returnedAt` succeeds, preserves that
   exact timestamp, increments availability, and clamps a zero member loan
   count at zero;
2. a non-returned borrowing in an illegal state rejects
   `Borrowing record cannot be returned`, ends its transaction session, and
   writes neither borrowing, book, nor member.

```ts
it('returns an overdue loan at the supplied time without a negative loan count', async () => {
  const fixture = createBorrowingLifecycleFixture();
  const returnedAt = '2026-07-31T05:00:00.000Z';
  const borrowing = createBorrowingDocument({
    status: LoanState.Overdue,
    memberId: objectId(fixture.memberId),
    bookId: objectId(fixture.bookId),
    save: jest.fn().mockResolvedValue(undefined),
  });
  (fixture.borrowingModel as { findOne: jest.Mock }).findOne = jest
    .fn()
    .mockReturnValue(createSessionQuery(borrowing));
  const service = createService(fixture.borrowingModel, fixture.dependencies);

  const result = await service.returnBorrowing(
    fixture.borrowingId,
    { returnedAt },
    actor,
  );

  expect(result.returnedAt).toBe(returnedAt);
  expect(fixture.member.activeLoanCount).toBe(0);
  expect(fixture.book.availableQuantity).toBe(3);
});
```

- [ ] **Step 2: Run RED**

```powershell
npx jest --runInBand borrowings/borrowings.service.spec.ts --coverage --collectCoverageFrom=borrowings/borrowings.service.ts --coverageReporters=text
```

Expected: new cases FAIL before the lifecycle fixture accepts an existing
borrowing and explicit return time.

- [ ] **Step 3: GREEN with fixture-only extension**

Use `createBorrowingDocument` from the shared critical fixture module; extend
`createBorrowingLifecycleFixture` only with deterministic existing-borrowing
overrides. Do not duplicate creation/duplicate-return/ownership tests.

- [ ] **Step 4: Run GREEN and monitor permission coverage**

```powershell
npx jest --runInBand borrowings/borrowings.service.spec.ts --coverage --collectCoverageFrom=borrowings/borrowings.service.ts --coverageReporters=text
npx jest --runInBand auth/permissions.service.spec.ts --coverage --collectCoverageFrom=auth/permissions.service.ts --coverageReporters=text
```

Expected: borrowing PASS at least 105/116; permission remains at least 71/74
(95.94%). If permission drops below its planning baseline, stop and diagnose
evidence drift; do not add a low-value permission test in this task.

- [ ] **Step 5: Review and commit**

```powershell
git add src/borrowings/borrowings.service.spec.ts .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git commit -m "test: cover borrowing return boundaries"
```

---

### Task 9: Fresh full-source evidence, changed-line gate, and backend ratchet

**Recommended agent:** `gpt-5.6-sol`, high.

**Required reviewer:** Separate-context `gpt-5.6-sol`, high.

**Files:**

- Modify: backend object only in `quality/coverage-baselines.json`
- Create/update: task 09 ledger reports

**Interfaces:**

- Consumes fresh backend summary, LCOV, unit JSON, e2e JSON, the Plan 3 base
  SHA file, and all task commits.
- Produces monotonic backend baseline values, exact critical-module pairs,
  changed-line status, and the quantified remaining overall-75% backlog.

- [ ] **Step 1: Run all authoritative producers**

```powershell
npm run test:quality-reporting
npm run test:cov
npm run test:e2e:report
npm run quality:report:backend
```

Expected: all exit 0; nonzero unit/e2e tests; zero final e2e failures; expected
backend file count remains 87; branches are at least Plan 2's final value and
at least 70%; statements/functions/lines do not decrease.

- [ ] **Step 2: Enforce exact critical pairs from fresh JSON**

```powershell
node -e "const s=require('./coverage/backend-unit/coverage-summary.json');const t={'src/auth/token-session.service.ts':[88,103],'src/auth/auth-identifier-repair.service.ts':[94,110],'src/auth/auth-identifier-reconciliation.service.ts':[163,191],'src/members/members.service.ts':[160,188],'src/borrowings/borrowings.service.ts':[105,116],'src/auth/permissions.service.ts':[71,74]};for(const [suffix,[min,total]] of Object.entries(t)){const e=Object.entries(s).find(([k])=>k.replace(/\\/g,'/').endsWith(suffix));if(!e)throw new Error('missing-critical-file:'+suffix);const b=e[1].branches;if(b.total!==total||b.covered<min)throw new Error('critical-branch-gate:'+suffix+':'+b.covered+'/'+b.total+'<'+min+'/'+total);console.log(suffix,b.covered+'/'+b.total,b.pct+'%')}"
```

Expected: exit 0 with all six measured pairs. If a denominator differs, stop;
do not alter the command or coverage eligibility.

- [ ] **Step 3: Run changed-line, lint, build, and whitespace checks**

```powershell
$plan3Base = (Get-Content -LiteralPath .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/base.sha).Trim()
if ($plan3Base -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-3-base-sha' }
git cat-file -e "$plan3Base`^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'unavailable-plan-3-base-commit' }
New-Item -ItemType Directory -Force -Path 'test-results' | Out-Null
git diff --unified=0 "$plan3Base...HEAD" --output=test-results/plan-3-backend.diff
npx eslint "{src,apps,libs,test}/**/*.ts"
npm run build
git diff --check
```

Expected: all exit 0. Because Plan 3 owns no production source, changed-line
coverage is `not-applicable` with zero eligible backend production lines. Any
eligible production line indicates scope drift and stops the plan.

- [ ] **Step 4: Ratchet from fresh evidence**

```powershell
npm run quality:report:backend -- --changed-line-diff test-results/plan-3-backend.diff --changed-line-lcov coverage/backend-unit/lcov.info --write-baseline
npm run quality:report:backend -- --check-only --changed-line-diff test-results/plan-3-backend.diff --changed-line-lcov coverage/backend-unit/lcov.info
git diff -- quality/coverage-baselines.json
```

Expected: each backend metric equals `max(Plan 2 final, fresh measured)`;
frontend object is byte-for-byte unchanged; no metric decreases. Both calls
receive the same diff and LCOV arguments, so the final summary retains the
changed-line `not-applicable` evidence instead of overwriting it.

- [ ] **Step 5: Record backlog, review, and commit**

Record `covered/total` for all four backend metrics, all six critical modules,
and `2112 - freshCoveredBranches` (clamped at zero) as the remaining overall
75% branch backlog.

```powershell
git add quality/coverage-baselines.json .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git commit -m "test: ratchet critical backend coverage"
```

---

### Task 10: Independent whole-plan review and Plan 5 handoff

**Recommended agent:** `gpt-5.6-sol`, high.

**Required reviewer:** Fresh separate-context `gpt-5.6-sol`, high.

**Files:**

- Complete: `.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/task-10-report.md`
- Complete: `.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/task-10-review.md`
- Update: `.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/progress.md`

**Interfaces:**

- Consumes every task/review report, base SHA, task commit, fresh coverage/e2e
  artifacts, critical fixture exports, and ratcheted baseline.
- Produces the reviewed final Plan 3 commit and Plan 5 handoff described below.

- [ ] **Step 1: Review scope and duplication**

```powershell
$plan3Base = (Get-Content -LiteralPath .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/base.sha).Trim()
if ($plan3Base -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-3-base-sha' }
git diff --name-only "$plan3Base...HEAD"
git diff --check "$plan3Base...HEAD"
```

Expected: only owned specs, `test/support/critical-auth-fixtures.ts`, backend
baseline object, and ledger. Reviewer compares every added test title/assertion
with pre-Plan-3 critical specs and Plan 2 reports; duplicated behavior blocks
completion.

- [ ] **Step 2: Run independent final verification**

```powershell
npm run test:quality-reporting
npm run test:cov
npm run test:e2e:report
npm run quality:report:backend
$plan3Base = (Get-Content -LiteralPath .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/base.sha).Trim()
if ($plan3Base -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-3-base-sha' }
git diff --unified=0 "$plan3Base...HEAD" --output=test-results/plan-3-backend.diff
npm run quality:report:backend -- --changed-line-diff test-results/plan-3-backend.diff --changed-line-lcov coverage/backend-unit/lcov.info
npx eslint "{src,apps,libs,test}/**/*.ts"
npm run build
git diff --check
node -e "const s=require('./coverage/backend-unit/coverage-summary.json');const t={'src/auth/token-session.service.ts':[88,103],'src/auth/auth-identifier-repair.service.ts':[94,110],'src/auth/auth-identifier-reconciliation.service.ts':[163,191],'src/members/members.service.ts':[160,188],'src/borrowings/borrowings.service.ts':[105,116],'src/auth/permissions.service.ts':[71,74]};for(const [suffix,[min,total]] of Object.entries(t)){const e=Object.entries(s).find(([k])=>k.replace(/\\/g,'/').endsWith(suffix));if(!e||e[1].branches.total!==total||e[1].branches.covered<min)process.exit(1)}"
```

Expected: every command exits 0; exact critical gates pass; e2e has zero final
failures; changed-line is `not-applicable`; backend baseline is nondecreasing.

- [ ] **Step 3: Write the Plan 5 handoff**

The handoff records:

- Plan 2 final SHA, Plan 3 base SHA, every Plan 3 task SHA, and ratchet SHA;
- implementer/reviewer models and reasoning for all tasks;
- fresh overall and per-critical-file coverage pairs;
- every command and exit result;
- zero unresolved reviewer findings;
- remaining overall-75% backlog;
- no production-source or reporting-config changes;
- mutation scope limited to the five stabilized production services;
- permission evaluation as a monitored, non-mutated control unless Plan 5's
  approved mutation design explicitly adds it.

**Plan 5 exported code interfaces:**

```ts
// test/support/backend-coverage-fixtures.ts, owned by Plan 2
deferred
queryResult
createStaffDocument
createStaffModelHarness
createIdentifierModelHarness

// test/support/critical-auth-fixtures.ts, owned by Plan 3
createRefreshFamily
createReplayMarker
createIdentifierOperation
createMemberDocument
createBorrowingDocument
CriticalQueryDouble
criticalQueryResult
createCriticalModelHarnesses
```

**Plan 5 exported evidence interfaces:**

- `coverage/backend-unit/coverage-summary.json`: final all-source summary;
- `coverage/backend-unit/lcov.info`: final line/branch map;
- `progress.md`: exact stabilized pairs, focused commands, runtime, remaining
  findings, and review decision;
- the five focused Jest commands from Tasks 1, 3, 5, 7, and 8;
- the invariant list: no authorization/ownership bypass, no refresh-family
  replay/revocation bypass, no illegal borrowing transition, no terminal TTL
  before durable event/cleanup.

- [ ] **Step 4: Resolve findings and commit the handoff**

Any finding returns to its owning task, receives a new RED/GREEN cycle and
fresh task-scoped review, then reruns Steps 1-2.

```powershell
git add .superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening
git commit -m "docs: record critical module handoff"
git rev-parse HEAD
```

The final command's 40-character SHA is the reviewed Plan 3 handoff interface
passed to the Plan 5 dispatcher. Plan 5 must start from this reviewed handoff
commit, not the Task 9 ratchet commit.

---

## Stop, escalation, rollback, and recovery

Stop and request direction when:

- Plan 2's reviewed final commit/ledger/export is absent or inconsistent.
- A required target needs a denominator, exclusion, expected-file-count,
  threshold, production-source, or reporting-tool change.
- A test exposes a production defect whose correction changes behavior or
  materially expands this test-only plan.
- A security/product contract conflicts with a proposed assertion.
- A critical module denominator changes from 103, 110, 191, 188, 116, or 74.
- Backend e2e has a persistent final failure after test-fixture diagnosis.
- Permission coverage falls below 85%.
- A new test requires private-method access or unstable internal state to pass.

Ordinary RED failures, uncovered branches, mock-chain extensions, test timeout
diagnosis, and replacement of a low-value proposed case with another listed
LCOV-backed adversarial case are not blockers.

Rollback rules:

- Before commit, remove only the unsuitable owned test/helper changes, record
  why the case was rejected, and select another branch from the same task's
  explicit LCOV backlog.
- For a committed task rollback, confirm the exact task SHA from `progress.md`,
  then resolve the latest commit for that task's owned spec and revert it:

```powershell
$taskSha = (git log -1 --format=%H -- src/auth/token-session.service.spec.ts).Trim()
if ($taskSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-3-task-sha' }
git revert $taskSha
```

  Use the corresponding owned spec path for Tasks 2-8, then rerun every
  dependent focused task plus Tasks 9-10. Do not use reset or checkout to erase
  work.
- Never overwrite a baseline with a lower value. After a revert, regenerate
  fresh coverage and keep the greater checked-in minimum; if the reverted code
  can no longer meet it, the rollback is incomplete.
- Never recover a Plan 2 fixture defect by copying the helper into Plan 3.
  Repair and review Plan 2 separately, rebase Plan 3, and restart the hard
  dependency gate.

## Plan self-review checklist

- The dependency gate consumes Plan 2's reviewed commit and all five exact
  fixture exports.
- The 85% math is ceiling-based and requires 72 branches; borrowing's true 90%
  ceiling is 105/116.
- Every behavior task has files, interfaces, RED, GREEN, focused coverage,
  reviewer, commit, and ledger evidence.
- Security/concurrency/lifecycle tasks use `gpt-5.6-sol`, high, with separate
  reviewer contexts.
- No Plan 2 test, production source, permission spec, e2e spec, denominator,
  script, CI, frontend, or generated artifact is owned.
- Task 9 runs fresh unit/e2e/report/changed-line/lint/build/whitespace gates
  before a monotonic backend-only ratchet.
- Task 10 reruns all gates independently and exports exact Plan 5 builders,
  evidence, invariants, and reviewed commit.
- The plan contains no deferred implementation instructions or unspecified
  test cases.
