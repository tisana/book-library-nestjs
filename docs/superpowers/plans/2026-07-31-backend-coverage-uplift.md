# Backend Coverage Uplift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Raise backend branch coverage from 65.64% (1,848/2,815) to at least 70.00% (>=1,971/2,815), without decreasing 68.24% statements, 70.57% functions, or 68.82% lines.

**Architecture:** Add behavior assertions at public service/controller/error boundaries using test-only Mongoose/query doubles. This broad uplift explicitly leaves adversarial token rotation, repair/reconciliation, member lifecycle, and borrowing transitions for Plan 3.

**Tech Stack:** TypeScript 5.9.x, NestJS 11.x, Jest 30.2, ts-jest 29.4, Supertest, Mongoose 9.x.

## Global Constraints

- Keep backend coverage, frontend unit coverage, and frontend Playwright e2e separate; never calculate a combined percentage.
- Keep the existing production src/**/*.ts denominator, its exclusions, expected-file count, changed-line eligibility, scripts, CI, and thresholds unchanged.
- Assertions prove outputs, HTTP bodies, model requests, or stable public contracts. They never invoke private members through casts or execute code merely for coverage.
- Baselines ratchet only upward. Generated coverage and test-result artifacts are not staged.
- Work in an isolated worktree and keep a ledger at .superpowers/sdd/2026-07-29-plan-2-backend-coverage/. Each task records distinct implementer/reviewer model/reasoning, RED/GREEN output, metrics, files, commit, and concerns.
- Preserve generic sign-in copy, trusted-origin-before-cookie behavior, absolute refresh expiry, and public/redacted health behavior.

## Metrics and quantified 75% backlog

| Metric | Baseline | Current | Plan 2 floor | Direction |
| --- | ---: | ---: | ---: | ---: |
| Statements | 68.24% | 2,497/3,659 | >=68.24% | >=75% |
| Branches | 65.64% | 1,848/2,815 | >=70%, >=1,971 | >=75% |
| Functions | 70.57% | 427/605 | >=70.57% | >=75% |
| Lines | 68.82% | 2,406/3,496 | >=68.82% | >=75% |

The floor needs +123 branches. Tasks 1-3 budget +131: StaffUsersService +67 to 159/180 (88%); AuthService +17 to 185/246 (75%); AuthController +12 to 12/24 (50%); Health +14 to 14/18 (75%); exception filter +14 to 14/20 (70%); pagination +7 to 7/7. Forecast: 1,979/2,815 (70.30%); fresh full coverage is authoritative.

From the 70% floor to 75% needs 141 more. Plan 3's mandatory 85% floors
close 72: TokenSession 84/103 to 88/103 (+4), Repair 70/110 to 94/110
(+24), Reconciliation 138/191 to 163/191 (+25), Members 141/188 to
160/188 (+19), and Borrowings remains above 85% at 102/116 (+0). Its planned
high-value borrowing stretch reaches the true 90% ceiling of 105/116 (+3), so
the planned total is 75. After Plan 3's fresh run, the conservative backlog is
69 branches from the 70% floor, or 66 if the borrowing stretch lands. Select
them from AuthIdentifierService (179/375), AuthService, and StaffUsersService
through behavior tests only.

## Dependency, parallel, and conflict contract

- Required base: current quality-reporting system and baseline. Task 1 writes the execution-time base commit to the tracked file .superpowers/sdd/2026-07-29-plan-2-backend-coverage/base.sha before any task edit. Every later diff command loads and validates that file with the exact PowerShell pattern below; no future execution base is hardcoded.
- Plans 1 and 4 may run concurrently in separate worktrees. Plan 3 starts only after this plan is reviewed; Plan 5 waits for Plan 3.
- Plans 2 and 3 must never update backend baseline from stale coverage.
- Shared conflict file is quality/coverage-baselines.json. Plan 2 changes backend only; Plan 1 changes frontend only. On conflict retain each scope maximum, then rerun Task 6.
- Consumed: npm run test:cov, npm run test:e2e:report, npm run quality:report:backend, backend LCOV, and the 80% changed-line gate.
- Prohibited Plan 3 specs: src/auth/token-session.service.spec.ts, auth-identifier-repair.service.spec.ts, auth-identifier-reconciliation.service.spec.ts, src/members/members.service.spec.ts, src/borrowings/borrowings.service.spec.ts.
- Prohibited scope: production source, package/Jest/CI config, README, migrations, frontend, changed-line tooling.

## Ledger and task-report contract

Task 1 creates the tracked base.sha and progress.md plus task-01.md. Tasks 2-7 create task-02.md, task-03.md, task-04.md, task-05.md, task-06.md, and task-07.md respectively in .superpowers/sdd/2026-07-29-plan-2-backend-coverage/. Every task report must contain these exact headings: Task, Implementer model and reasoning, Reviewer model and reasoning, Base SHA, Files changed, RED command and exit, RED evidence, GREEN command and exit, GREEN evidence, Focused metrics, Full-suite commands and exits, Changed-line result, Commit hash, Deferred findings, Reviewer decision. Use not-applicable with a reason when a task does not run a full-suite or changed-line command; no heading may be omitted.

Task 1 initializes and validates the runtime base:

    $plan2Status = @(git status --short)
    if ($LASTEXITCODE -ne 0 -or $plan2Status.Count -ne 0) { throw "plan-2-worktree-not-clean`n$($plan2Status -join "`n")" }
    New-Item -ItemType Directory -Force -Path '.superpowers/sdd/2026-07-29-plan-2-backend-coverage' | Out-Null
    $plan2BaseSha = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $plan2BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-2-base-sha' }
    git cat-file -e "$plan2BaseSha`^{commit}"
    if ($LASTEXITCODE -ne 0) { throw 'unavailable-plan-2-base-commit' }
    Set-Content -LiteralPath '.superpowers/sdd/2026-07-29-plan-2-backend-coverage/base.sha' -Value $plan2BaseSha -NoNewline
    $plan2BaseSha = (Get-Content -LiteralPath '.superpowers/sdd/2026-07-29-plan-2-backend-coverage/base.sha').Trim()
    if ($plan2BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-2-base-sha' }

Every later task starts its diff commands with the final two lines above plus
the `git cat-file` availability check so `$plan2BaseSha` is scoped to that
PowerShell process and still names a reachable commit.

## Owned, prohibited, shared files

Owned: src/staff-users/staff-users.service.spec.ts; src/auth/auth.service.spec.ts; new src/auth/auth.controller.spec.ts; new src/health/health.service.spec.ts; new src/common/filters/http-exception.filter.spec.ts; new src/common/dto/pagination-query.dto.spec.ts; new src/book-categories/book-categories.controller.spec.ts; new src/membership-types/membership-types.controller.spec.ts; new src/staff-users/staff-users.controller.spec.ts; src/logger.middleware.spec.ts; new test/support/backend-coverage-fixtures.ts; backend object only in quality/coverage-baselines.json; .superpowers/sdd/2026-07-29-plan-2-backend-coverage/base.sha, progress.md, and task-01.md through task-07.md.

Prohibited: all production/config/frontend files and the Plan 3 specs above. Shared read-only evidence: coverage/backend-unit/coverage-summary.json, coverage/backend-unit/lcov.info, existing backend quality scripts.

## Phase models

| Phase | Tasks | Implementer | Reviewer | Reason |
| --- | --- | --- | --- | --- |
| A | 1 | gpt-5.6-sol, high | separate gpt-5.6-sol, high | reservations, revocation, lifecycle |
| B | 2 | gpt-5.6-sol, high | separate gpt-5.6-sol, high | generic auth/session adapters |
| C | 3 | gpt-5.6-terra, high | separate gpt-5.6-terra, high | deterministic readiness/error tests |
| D | 4-5 | gpt-5.6-terra, high | separate gpt-5.6-terra, high | stable controller/middleware behavior |
| E | 6-7 | gpt-5.6-sol, high | separate gpt-5.6-sol, high | baseline/integration security |

If unavailable, substitute an equal-or-greater model and record actual model, reasoning, reason, and task before work; do not downgrade A, B, E.

---

### Task 1: Reusable fixtures and staff-account lifecycle

**Recommended agent:** gpt-5.6-sol, high. **Required reviewer:** separate-context gpt-5.6-sol, high.

**Files:** Create test/support/backend-coverage-fixtures.ts, .superpowers/sdd/2026-07-29-plan-2-backend-coverage/base.sha, .superpowers/sdd/2026-07-29-plan-2-backend-coverage/progress.md, and .superpowers/sdd/2026-07-29-plan-2-backend-coverage/task-01.md; modify src/staff-users/staff-users.service.spec.ts.

**Anchors:** src/staff-users/staff-users.service.ts:66-161, 233-301, 304-413, 416-489. Baseline 92/180 branches.

**Interfaces produced:**

    export interface Deferred<T> {
      promise: Promise<T>
      resolve(value: T): void
      reject(reason?: unknown): void
    }
    export interface StaffFindQueryDouble<T> {
      sort(value: Record<string, 1 | -1>): StaffFindQueryDouble<T>
      skip(value: number): StaffFindQueryDouble<T>
      limit(value: number): StaffFindQueryDouble<T>
      exec(): Promise<T>
    }
    export interface IdentifierQueryDouble<T> {
      select(value: unknown): IdentifierQueryDouble<T>
      session(value: unknown): IdentifierQueryDouble<T>
      exec(): Promise<T>
    }
    export interface StaffModelRecordedCalls {
      constructorInputs: unknown[]
      existsFilters: unknown[]
      findOneFilters: unknown[]
      findFilters: unknown[]
      sortValues: unknown[]
      skipValues: number[]
      limitValues: number[]
      updateOneArguments: unknown[][]
    }
    export interface IdentifierModelRecordedCalls {
      findOneFilters: unknown[]
      sessionValues: unknown[]
      updateOneArguments: unknown[][]
      createArguments: unknown[][]
    }
    export function deferred<T>(): Deferred<T>
    export function queryResult<T>(value: T): IdentifierQueryDouble<T>
    export function createStaffDocument(overrides?: Partial<StaffUserDocument>): StaffUserDocument
    export function createStaffModelHarness(options?: {
      document?: StaffUserDocument
      existsResult?: unknown
      findOneResult?: StaffUserDocument | null
      findResult?: StaffUserDocument[]
      startSession?: jest.Mock
    }): {
      model: jest.Mock & {
        exists: jest.Mock
        findOne: jest.Mock
        find: jest.Mock
        updateOne: jest.Mock
        db: { startSession?: jest.Mock }
      }
      document: StaffUserDocument
      calls: StaffModelRecordedCalls
    }
    export function createIdentifierModelHarness(options?: {
      findOneResult?: AuthIdentifierDocument | null
    }): {
      model: {
        findOne: jest.Mock
        updateOne: jest.Mock
        create: jest.Mock
      }
      calls: IdentifierModelRecordedCalls
    }

createStaffModelHarness.model must be constructable with new: its mock implementation records the constructor input in constructorInputs and returns document. Its exists records the exact filter. Its find returns one chain whose sort, skip, limit, and exec methods record their exact arguments and return findResult. Its findOne returns an IdentifierQueryDouble-compatible chain and records the exact filter. createIdentifierModelHarness.findOne returns the same chain shape and records filter/session; updateOne and create record complete positional argument arrays without normalization.

Consumes public create, update, findAll, findActiveById, touchLastLogin, bumpAuthVersion, toResponse.

- [ ] **Step 1: Initialize the runtime base and write failing tests.** Run the complete base-SHA initialization/validation block in the ledger contract before editing tests. Assert: unavailable transaction falls back, reserves normalized admin@example.test, and saves once; a failed fallback save releases that reservation; existing email conflicts; transaction succeeds; duplicate key maps to ConflictException; released reservation reactivates; foreign active reservation conflicts; absent optional identifier saves; unchanged update does not bump/revoke; role/status/email update bumps/revokes/audits prior values; fallback update compensates; inactive lookup rejects; findAll sends exact filters/sort/skip/limit; invalid/duplicate roles normalize/reject. Assert the recorded call arrays, including constructorInputs, existsFilters, findFilters, sortValues, skipValues, limitValues, identifier findOneFilters/sessionValues, updateOneArguments, and createArguments.

    expect(identifier.create).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ normalizedIdentifier: 'admin@example.test', status: AuthIdentifierStatus.Active })
    ]), expect.any(Object))
    expect(identifier.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedIdentifier: 'admin@example.test', status: AuthIdentifierStatus.Active }),
      expect.objectContaining({ $set: expect.objectContaining({ status: AuthIdentifierStatus.Released }) }),
      expect.any(Object)
    )

- [ ] **Step 2: RED.**

    npx jest --runInBand staff-users/staff-users.service.spec.ts --coverage --collectCoverageFrom=staff-users/staff-users.service.ts --coverageReporters=text

Expected: new tests fail before fixture/test implementation; capture output and exit code.

- [ ] **Step 3: GREEN.** Implement only fixture/test code, rerun Step 2. Expected PASS and >=159/180 branches. Assertions inspect public results/model requests, not private methods.

- [ ] **Step 4: Review and commit.** Reviewer checks compensation filter/update, audit prior values, no secret expectation, no prohibited spec.

    git add test/support/backend-coverage-fixtures.ts src/staff-users/staff-users.service.spec.ts .superpowers/sdd/2026-07-29-plan-2-backend-coverage
    git commit -m "test: cover staff account lifecycle branches"

---

### Task 2: Shared-auth response and controller adapters

**Recommended agent:** gpt-5.6-sol, high. **Required reviewer:** separate-context gpt-5.6-sol, high.

**Files:** Modify src/auth/auth.service.spec.ts and .superpowers/sdd/2026-07-29-plan-2-backend-coverage/progress.md; create src/auth/auth.controller.spec.ts and .superpowers/sdd/2026-07-29-plan-2-backend-coverage/task-02.md.

**Anchors:** auth.service.ts:98-157, 416-488, 617-782; auth.controller.ts:85-148, 201-285, 315-347. Baselines 168/246 and 0/24 branches.

**Interfaces:** consume Task 1 queryResult/createStaffDocument/deferred. A local controller factory returns controller, response cookie/status mocks, and mocked AuthService. Do not call TokenSessionService.rotate/createFamily, refresh parsing, origin guards, replay markers, repair, or reconciliation.

- [ ] **Step 1: Write failing tests.** Prove staff session uses server role area and normalized identifier; conflict/unresolved/gated/mismatched/inactive/password failures all expose UnauthorizedException Invalid credentials while recording redacted category; member success uses empty membership type fields when profile absent; non-string identifier fails generically. Prove controller login/staff-login/member-login mapping and named cookie options, member/staff me projections, activity query/unavailable error, conflict response redaction/status, and logout-all absent context clears cookie without service call.

    const { response } = await service.createSharedSession({ identifier: ' ADMIN@EXAMPLE.TEST ', password: 'pw' })
    expect(response).toMatchObject({ roleArea: 'staff', user: { id: 'staff-1', email: 'admin@example.test' } })
    await expect(service.createSharedSession(conflictInput)).rejects.toThrow('Invalid credentials')

- [ ] **Step 2: RED then GREEN.**

    npx jest --runInBand auth/auth.service.spec.ts auth/auth.controller.spec.ts --coverage --collectCoverageFrom=auth/auth.service.ts --collectCoverageFrom=auth/auth.controller.ts --coverageReporters=text

Expected RED before additions; then PASS with AuthService >=185/246 and AuthController >=12/24. No raw password/token assertion.

- [ ] **Step 3: Security review and commit.**

    git add src/auth/auth.service.spec.ts src/auth/auth.controller.spec.ts .superpowers/sdd/2026-07-29-plan-2-backend-coverage
    git commit -m "test: cover shared authentication adapters"

---

### Task 3: Readiness, normalized errors, pagination

**Recommended agent:** gpt-5.6-terra, high. **Required reviewer:** separate-context gpt-5.6-terra, high.

**Files:** Create src/health/health.service.spec.ts, src/common/filters/http-exception.filter.spec.ts, src/common/dto/pagination-query.dto.spec.ts, and .superpowers/sdd/2026-07-29-plan-2-backend-coverage/task-03.md; modify .superpowers/sdd/2026-07-29-plan-2-backend-coverage/progress.md.

**Anchors:** health.service.ts:73-163; http-exception.filter.ts:21-91; pagination-query.dto.ts:8-15,45-56. Baselines 0/18, 0/20, 0/7 branches.

**Interfaces:** Consumes public HealthService.getHealth/getReadiness, HttpExceptionFilter.catch, and createPaginatedResult. Produces response.status(code).json(body), host.switchToHttp().getRequest/getResponse, connection.db.admin().ping, and AuthReadinessKeyPolicy doubles; no production interface changes.

- [ ] **Step 1: Write failing tests.** Cover database disconnected/ping reject/fake-timer timeout/no policy/policy reject; auth reason repair-key-required and unknown reason mapping to auth-infrastructure-unavailable; health timestamp/rounded uptime. Cover unknown/string/object HTTP errors, validation array/details/path, missing URL. Exercise decorator transforms with plainToInstance(PaginationQueryDto, input): undefined/null/empty values produce defaults, decimal/string garbage produce defaults, and valid numeric strings produce integers. Pass each transformed instance to createPaginatedResult and cover zero total.

    filter.catch(new BadRequestException({ message: ['email must be an email'], error: 'Bad Request', details: { field: 'email' } }), host)
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ path: '/staff-users', message: ['email must be an email'], details: { field: 'email' } }))
    const query = plainToInstance(PaginationQueryDto, { page: '2', limit: '2' })
    expect(query).toMatchObject({ page: 2, limit: 2 })
    expect(createPaginatedResult(['a','b'], 5, query)).toEqual({ items:['a','b'], page:2, limit:2, total:5, totalPages:3 })

- [ ] **Step 2: RED then GREEN.**

    npx jest --runInBand health/health.service.spec.ts common/filters/http-exception.filter.spec.ts common/dto/pagination-query.dto.spec.ts --coverage --collectCoverageFrom=health/health.service.ts --collectCoverageFrom=common/filters/http-exception.filter.ts --collectCoverageFrom=common/dto/pagination-query.dto.ts --coverageReporters=text

Expected RED then PASS: Health >=14/18, filter >=14/20, pagination 7/7. Restore fake timers.

- [ ] **Step 3: Review and commit.**

    git add src/health/health.service.spec.ts src/common/filters/http-exception.filter.spec.ts src/common/dto/pagination-query.dto.spec.ts .superpowers/sdd/2026-07-29-plan-2-backend-coverage
    git commit -m "test: cover health and error contracts"

---

### Task 4: Catalog, membership, staff controller delegation

**Recommended agent:** gpt-5.6-terra, high. **Required reviewer:** separate-context gpt-5.6-terra, high.

**Files:** Create src/book-categories/book-categories.controller.spec.ts, src/membership-types/membership-types.controller.spec.ts, src/staff-users/staff-users.controller.spec.ts, and .superpowers/sdd/2026-07-29-plan-2-backend-coverage/task-04.md; modify .superpowers/sdd/2026-07-29-plan-2-backend-coverage/progress.md.

**Anchors:** respective controller lines 35-63, 35-65, 35-67; all have zero statement/line coverage and no executable branches.

**Interfaces:** Consumes each public create/findAll/update controller method. Produces exact service-boundary proofs: the original DTO and AuditActor are forwarded unchanged and the controller returns the service result. Route-guard policy remains consumed from existing e2e tests, not recreated here.

- [ ] **Step 1: Write failing cases.** For each controller test create/list/update. Mutation tests require reference-equal actor/DTO and return object; list tests require exact query. Use loanPeriodDays, maxActiveBorrowings, and roles/status to prevent swapped calls. Do not reimplement authorization matrix checks.

    await expect(controller.create(createDto, actor)).resolves.toBe(response)
    expect(service.create).toHaveBeenCalledWith(createDto, actor)

- [ ] **Step 2: RED then GREEN.**

    npx jest --runInBand book-categories/book-categories.controller.spec.ts membership-types/membership-types.controller.spec.ts staff-users/staff-users.controller.spec.ts --coverage --collectCoverageFrom=book-categories/book-categories.controller.ts --collectCoverageFrom=membership-types/membership-types.controller.ts --collectCoverageFrom=staff-users/staff-users.controller.ts --coverageReporters=text

Expected RED then PASS, 100% statement/function/line coverage in all three.

- [ ] **Step 3: Review and commit.**

    git add src/book-categories/book-categories.controller.spec.ts src/membership-types/membership-types.controller.spec.ts src/staff-users/staff-users.controller.spec.ts .superpowers/sdd/2026-07-29-plan-2-backend-coverage
    git commit -m "test: cover catalog administration controllers"

---

### Task 5: Middleware flow and changed-line evidence

**Recommended agent:** gpt-5.6-terra, high. **Required reviewer:** separate-context gpt-5.6-terra, high.

**Files:** Modify src/logger.middleware.spec.ts and .superpowers/sdd/2026-07-29-plan-2-backend-coverage/progress.md; create .superpowers/sdd/2026-07-29-plan-2-backend-coverage/task-05.md. **Anchor:** logger.middleware.ts:5-11 (50% functions, 60% lines).

**Interfaces:** Consumes LoggerMiddleware.use(req, res, next). Produces proof that the public middleware logs the method/path and invokes the supplied next function exactly once; no logger configuration changes.

- [ ] **Step 1: Write failing request-flow test.**

    middleware.use({ method: 'PATCH', path: '/books/book-1' } as Request, {} as Response, next)
    expect(Logger.prototype.log).toHaveBeenCalledWith('PATCH /books/book-1')
    expect(next).toHaveBeenCalledTimes(1)

- [ ] **Step 2: RED then GREEN.**

    npx jest --runInBand logger.middleware.spec.ts --coverage --collectCoverageFrom=logger.middleware.ts --coverageReporters=text

Expected RED then PASS and 100% statements/functions/lines; restore spy.

- [ ] **Step 3: Defer changed-line evidence to the authoritative full run.**

Task 5's focused command intentionally writes one-file LCOV, which is invalid
input for the 87-file backend quality reporter. Record `not-applicable —
focused LCOV; Task 6 owns fresh full-source changed-line evidence` under the
task report's changed-line heading. Do not invoke the quality reporter against
this focused artifact.

- [ ] **Step 4: Review and commit.**

    git add src/logger.middleware.spec.ts .superpowers/sdd/2026-07-29-plan-2-backend-coverage
    git commit -m "test: cover request logging flow"

---

### Task 6: Fresh full evidence and monotonic ratchet

**Recommended agent:** gpt-5.6-sol, high. **Required reviewer:** separate-context gpt-5.6-sol, high.

**Files:** Modify the backend object only in quality/coverage-baselines.json and .superpowers/sdd/2026-07-29-plan-2-backend-coverage/progress.md; create .superpowers/sdd/2026-07-29-plan-2-backend-coverage/task-06.md.

**Interfaces:** Consumes fresh coverage-summary JSON, backend unit/e2e JSON, backend LCOV, baseline JSON, and plan-base diff. Produces backend baseline values equal to max(previous, fresh measured) per metric plus scoped backend-summary markdown/JSON artifacts.

- [ ] **Step 1: Authoritative full commands.**

    npm run test:cov
    npm run test:e2e:report
    npm run quality:report:backend

Expected all exit 0, nonzero tests, zero e2e final failures, scoped report. Record four metrics/covered totals.

- [ ] **Step 2: Changed-line/lint/build/whitespace.**

    $plan2BaseSha = (Get-Content -LiteralPath '.superpowers/sdd/2026-07-29-plan-2-backend-coverage/base.sha').Trim()
    if ($plan2BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-2-base-sha' }
    git cat-file -e "$plan2BaseSha`^{commit}"
    if ($LASTEXITCODE -ne 0) { throw 'unavailable-plan-2-base-commit' }
    New-Item -ItemType Directory -Force -Path 'test-results' | Out-Null
    git diff --unified=0 "$plan2BaseSha...HEAD" --output=test-results/plan-2-backend.diff
    npx eslint "{src,apps,libs,test}/**/*.ts"
    npm run build
    git diff --check

Expected all exit 0. The explicit ESLint command intentionally omits --fix and bypasses the repository's mutating package lint script.

- [ ] **Step 3: Ratchet, review, commit.**

    npm run quality:report:backend -- --changed-line-diff test-results/plan-2-backend.diff --changed-line-lcov coverage/backend-unit/lcov.info --write-baseline
    npm run quality:report:backend -- --check-only --changed-line-diff test-results/plan-2-backend.diff --changed-line-lcov coverage/backend-unit/lcov.info
    git diff -- quality/coverage-baselines.json
    git add quality/coverage-baselines.json .superpowers/sdd/2026-07-29-plan-2-backend-coverage
    git commit -m "test: ratchet backend coverage baseline"

Expected changed-line >=80% or the reporter's explicit `not-applicable` result;
every backend value >=68.24/65.64/70.57/68.82; branches >=70%; frontend object
byte-identical; reviewer rejects generated artifacts. The authoritative
summary retains changed-line evidence because both ratchet and check-only calls
receive the same diff and LCOV arguments.

---

### Task 7: Whole-plan review and Plan 3 handoff

**Recommended agent:** gpt-5.6-sol, high. **Required reviewer:** fresh separate-context gpt-5.6-sol, high.

**Files:** Create .superpowers/sdd/2026-07-29-plan-2-backend-coverage/task-07.md; modify .superpowers/sdd/2026-07-29-plan-2-backend-coverage/progress.md.

**Interfaces:** Consumes all task reports, their commits, fresh report artifacts, and Task 1 fixture exports. Produces a handoff record containing final metrics, review findings, commands/exits, and the Plan 3 fixture inventory below.

**Exported Plan 3 interfaces:**

| Export | Contract | Plan 3 use |
| --- | --- | --- |
| test/support/backend-coverage-fixtures.ts deferred<T> | externally controlled promise, no timer | token race and concurrent reconcile |
| queryResult<T> | chainable select/session/exec configured result | repair/replay/batch lookup |
| createStaffDocument | active defaults, overrides, string id, async save mock | auth actor/stale-version setup |
| createStaffModelHarness | constructable model plus exact constructor/exists/findOne/find/sort/skip/limit/updateOne records and optional startSession | staff actor/stale-version and test-local critical model extension |
| createIdentifierModelHarness | exact identifier findOne/session/exec/updateOne/create records | repair/replay/batch model lookup and mutation setup |

Plan 3 imports these rather than copies them; it may add test/support/critical-auth-fixtures.ts and must not edit Plan 2 tests unless an export defect is demonstrated.

- [ ] **Step 1: Scope review.**

    $plan2BaseSha = (Get-Content -LiteralPath '.superpowers/sdd/2026-07-29-plan-2-backend-coverage/base.sha').Trim()
    if ($plan2BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-2-base-sha' }
    git cat-file -e "$plan2BaseSha`^{commit}"
    if ($LASTEXITCODE -ne 0) { throw 'unavailable-plan-2-base-commit' }
    git diff --name-only "$plan2BaseSha...HEAD"
    git diff --check "$plan2BaseSha...HEAD"

Expected owned tests/support/baseline/ledger only.

- [ ] **Step 2: Independent final verification.**

    npm run test:quality-reporting
    npm run test:cov
    npm run test:e2e:report
    npm run quality:report:backend
    $plan2BaseSha = (Get-Content -LiteralPath '.superpowers/sdd/2026-07-29-plan-2-backend-coverage/base.sha').Trim()
    if ($plan2BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-2-base-sha' }
    git cat-file -e "$plan2BaseSha`^{commit}"
    if ($LASTEXITCODE -ne 0) { throw 'unavailable-plan-2-base-commit' }
    git diff --unified=0 "$plan2BaseSha...HEAD" --output=test-results/plan-2-backend.diff
    npm run quality:report:backend -- --changed-line-diff test-results/plan-2-backend.diff --changed-line-lcov coverage/backend-unit/lcov.info
    npx eslint "{src,apps,libs,test}/**/*.ts"
    npm run build
    git diff --check

Expected all exit 0, branches >=70%, other metrics non-decreasing, zero final e2e failures, changed-line >=80%. The explicit ESLint command is non-fixing because it omits --fix.

- [ ] **Step 3: Handoff record and commit.** Record every task hash, final pairs, commands/exits, model/reasoning, findings or none, exports, and 75% backlog.

    git add .superpowers/sdd/2026-07-29-plan-2-backend-coverage
    git commit -m "docs: record backend coverage handoff"

## Stop, rollback, self-review

Stop for direction if 70% requires denominator/threshold change, a test exposes a production defect needing code, security contract conflict, missing predecessor artifact, or persistent e2e failure. Ordinary test failures, uncovered branches, fixture extensions are not blockers.

Never lower/overwrite baseline. Revert only uncommitted unsuitable task tests/support, record reason, choose another owned broad boundary, and regenerate evidence. For committed reversal, confirm hash, git revert task commit, then rerun Task 6 before ratchet.

Self-review: tasks cover actual low branches; Tasks 6-7 run unit/e2e/report/changed-line/lint/build; Plan 3 critical work is prohibited and quantified; every task has models, files, interfaces, RED/GREEN, commit, ledger, and rollback.
