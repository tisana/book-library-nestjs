# Mobile Playwright Skip Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sole skipped mobile Playwright performance scenario with a deterministic, equivalent mobile browser assertion so the full suite finishes with 87/87 executed first-attempt passes and zero failed, flaky, or skipped tests.

**Architecture:** Keep the test at the existing browser boundary: a real Vite-served React application, Playwright Chromium projects, and intercepted API requests backed by the existing fixed seeded-scale fixture. Make readiness explicit by measuring one user navigation through the point where the route's useful content is visible, with a 2,000 ms assertion-owned timeout and the unchanged 2,000 ms end-to-end budget. Run the same staff seeded-scale list/detail/borrowing workflow in the existing `mobile-chromium` project rather than creating a synthetic unit check or changing the budget.

**Tech Stack:** TypeScript 5.9, React/Vite, `@playwright/test` 1.60, Chromium (desktop/tablet/Pixel 5 project definitions), Node 22 CI, existing TypeScript quality-report parser.

## Global Constraints

- Execute in an isolated worktree created from the required base; preserve unrelated working-tree changes.
- This is Plan 4 of [Next Five Test Quality Priorities Design](../specs/2026-07-29-next-five-test-quality-priorities-design.md). It begins from the clean integrated plan-package commit selected by the dispatcher. Commit `d057d6efc40f55ed871e9fb407246e9f4f87d880` must be an ancestor of that runtime base; record the actual runtime commit in the ledger before changes.
- Do not lower the 2,000 ms performance budget, relax readiness expectations, raise Playwright timeouts to conceal a slow scenario, reduce seeded fixture size, disable a browser project, add a retry-based pass criterion, or mark a test skipped/fixme.
- Keep backend coverage/e2e, frontend Vitest coverage, and Playwright pass-rate data as independent streams. Do not change `quality/coverage-baselines.json`, changed-line coverage rules, coverage includes/excludes, or report denominators.
- The final result must be exactly 87 total/87 first-attempt passed/0 flaky/0 failed/0 skipped, including 29 first-attempt passes in each of `desktop-chromium`, `tablet-chromium`, and `mobile-chromium`.
- The application must be ready before a measurement begins; mocked responses must remain local, immediate, stable, and seeded. Do not use live API calls, external images, arbitrary sleeps, `networkidle`, or a clock advance as a readiness proxy.
- Existing fixed date semantics remain deterministic: use `page.clock.setFixedTime(new Date('2026-06-17T12:00:00.000Z'))` where the member performance workflow needs dates. The staff fixture has no time-dependent outcome.
- Each implementation task and its review must use separate agent contexts. If a named model is unavailable, use the newest model with equal-or-greater capability and record the model, reasoning level, reason, and affected task in the ledger before work starts.

---

## Current Evidence and Milestone

| Evidence item | Exact current state | Required post-plan state |
| --- | --- | --- |
| Explicit skip | `frontend/tests/e2e/performance-smoke.spec.ts` calls `test.skip(testInfo.project.name === 'mobile-chromium', 'Staff performance smoke targets desktop/tablet back-office layouts.')` in the staff seeded-scale scenario. | No conditional or unconditional `test.skip`, `test.fixme`, or equivalent exclusion in this file or configuration. |
| Risk assertion | The skipped scenario creates `createPerformanceDataset()` (100 books, 50 members, 25 active + 10 overdue borrowings), signs in as staff, and asserts list, book detail, and borrowing list useful content each in `< 2000` ms. | The same fixture scale, three user-visible route transitions, content assertions, and 2,000 ms ceiling execute on all three projects, including Pixel 5 mobile. |
| Existing timing | The staff scenario uses a non-monotonic wall-clock timer and gives each visibility assertion an independent default timeout, so sequential waits can outlive the intended route budget; the books-list measurement also starts after its click. | Import `performance` from `node:perf_hooks`. Each navigation starts immediately before its click and uses one monotonic deadline, `start + 2_000`; every sequential readiness wait receives only the remaining deadline time, and total elapsed time must be `<= 2_000` ms. |
| Current suite inventory | 29 Playwright scenarios expand across three projects. The skip yields 86 passed, 1 skipped, 0 failed, 0 flaky (as recorded in the quality design). | 29 scenarios × 3 projects = 87 executed first attempts; all are passed. |
| Projects | `frontend/playwright.config.ts`: desktop 1440×900, tablet 768×1024, mobile Pixel 5 at 390×844; `fullyParallel: true`; CI retries 2, local retries 0. | Project names, viewports, reporters, artifacts, and retry policy remain intact; the quality report proves the three project rows are each 29/29 clean. |
| Parser semantics | `parsePlaywrightResults` classifies `expectedStatus === 'skipped'` or final `skipped` as skipped; it reports per-project counts. `evaluateTestRun` blocks final failures, global errors, and zero tests; flakiness is a warning. | Parser behavior stays strict and is exercised against an actual clean full-suite report; plan acceptance adds a local zero-count assertion so skipped/flaky results cannot be treated as success. |

The milestone is not merely a green command: it is a reproducible full report with `passed: 87`, `failed: 0`, `flaky: 0`, `skipped: 0`, `total: 87`, 100% clean/eventual pass rates, no global errors, and every project row at 29 passed/29 total.

## Dependency, Parallelism, and Conflict Contract

**Required predecessor/base:** Plan 4 has no predecessor plan. Start from the clean base above; if Plan 1 has already merged, consume its resulting clean commit and rerun its frontend-unit producer before the final integrated verification.

**May run concurrently:** Plan 4 may run in an isolated worktree alongside Plan 1 or Plan 2. Plan 2 uses backend-only tests/baselines and has no file overlap. Plan 4 may independently perform focused mobile repetitions while Plan 1 or 2 is in progress.

**Must not run concurrently:** Never edit the same worktree as Plan 1. Plans 1 and 4 must merge sequentially because both affect frontend quality outputs. After either merge, rerun both `npm run frontend:test:coverage` + `npm run quality:report:frontend-unit` and `npm run frontend:test:e2e:report` + `npm run quality:report:frontend-e2e` from the combined tree. Do not alter Plan 1's frontend coverage target, baseline section, or unit-test scope. Plan 3 and Plan 5 are out of this plan's execution scope.

**Shared conflict files and handoff contract:**

| File/interface | Ownership in this plan | Plan 1 conflict rule |
| --- | --- | --- |
| `frontend/playwright.config.ts` | Shared only; modify only if a test-only timing/readiness configuration is proven necessary. Preserve reporters, `outputDir`, projects, and the `webServer` contract. | Plan 1 previously owns its reporting/artifact setup here. Rebase rather than overwrite; report the exact diff hunk and rerun both frontend producers after merge. |
| `frontend/package.json` | Shared only if adding the focused repeat command described below. | Plan 1 may edit frontend unit/coverage scripts. Merge scripts structurally, retain both sets, and validate lockfile is unchanged unless dependencies change (none are authorized here). |
| `package.json` | Prohibited unless a root forwarding command is required by CI convention; prefer the frontend script. | Plan 1 and reporting work may touch root scripts. No overwrite and no changed coverage/report command semantics. |
| `scripts/quality/test-result-report.ts`, `scripts/quality/report-quality.ts`, `test/quality/test-result-report.spec.ts` | Shared/read-only by default. A change requires a demonstrated parser defect in a clean 87-result file, a failing focused parser test, and reviewer approval. | These are quality-system interfaces shared by Plan 1. Plan 4's expected outcome needs no parser semantic change. |
| `README.md`, `quality/coverage-baselines.json`, `frontend/vitest.config.ts`, `frontend/package-lock.json` | Prohibited. | Plan 1 owns frontend coverage docs/config/baseline; Plan 4 must not create merge noise. |

**Consumed interfaces:** `createPerformanceDataset(): { books: MockBook[]; members: MockMember[]; borrowings: MockBorrowing[]; overdueBorrowings: MockBorrowing[] }`, `mockStaffApi(page, options)`, `mockMemberApi(page, options)`, `loginAsStaff(page)`, and the Playwright JSON shape normalized by `parsePlaywrightResults(raw): TestRunSummary`.

**Produced interfaces:** `performance-smoke.spec.ts` must expose no production interface. Its internal test-only helper is `assertUsefulContentWithinBudget(name: string, action: (timeoutMs: number) => Promise<void>, ready: readonly Locator[]): Promise<void>`, with a fixed `PERFORMANCE_BUDGET_MS = 2_000`; it uses `performance.now()`, calculates one `deadline = start + PERFORMANCE_BUDGET_MS`, and passes only the remaining deadline time to the Playwright action and every sequential locator wait after first rejecting any remainder below 1 ms. It resolves only when the action and every named ready locator complete and total elapsed time is `<= 2_000` ms; otherwise it rejects with the named route, step, and measured duration. The optional frontend script is exactly `test:e2e:mobile-performance:repeat`, which runs only `tests/e2e/performance-smoke.spec.ts` for `mobile-chromium` with `--workers=1 --repeat-each=10` and does not write quality summaries.

**Base-SHA interface:** Task 1 creates the tracked file `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/base.sha`. Every task that runs a `git diff` command must first load and validate it with this exact PowerShell block:

```powershell
$plan4BaseSha = (Get-Content -Raw .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/base.sha).Trim()
if ($plan4BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan4-base-sha' }
$plan4ResolvedBase = (git rev-parse "$($plan4BaseSha)^{commit}").Trim()
if ($LASTEXITCODE -ne 0 -or $plan4ResolvedBase -ne $plan4BaseSha) { throw 'unresolvable-plan4-base-sha' }
```

**Task-report interface:** Each task owns exactly one tracked report:

- `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-01.md`
- `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-02.md`
- `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-03.md`
- `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-04.md`

Every report must contain these headings, in this order: `## Task`, `## Base SHA`, `## Implementer model and reasoning`, `## Reviewer model and reasoning`, `## Commands and results`, `## Changed files`, `## Assumptions`, `## Follow-ups`, and `## Reviewer verdict`. `Commands and results` records each exact command, exit code, and observed counts; `Reviewer verdict` is `approved` or lists unresolved findings. The ledger links all four reports rather than duplicating their details.

## File Contract

| Classification | Files |
| --- | --- |
| Owned modifications | `frontend/tests/e2e/performance-smoke.spec.ts` |
| Conditionally owned modifications | `frontend/package.json` only for `test:e2e:mobile-performance:repeat`; `frontend/playwright.config.ts` only if Task 1 evidence proves an isolated test configuration is necessary. |
| Existing fixtures consumed, not casually refactored | `frontend/tests/e2e/support/library-api-mocks.ts` |
| Shared/read-only quality/report files | `scripts/quality/test-result-report.ts`, `scripts/quality/report-quality.ts`, `scripts/quality/render-quality-report.ts`, `test/quality/test-result-report.spec.ts` |
| Prohibited modifications | `quality/coverage-baselines.json`, `frontend/vitest.config.ts`, `frontend/package-lock.json`, root `package.json`, `README.md`, backend files, CI workflow, all unrelated e2e specs |
| Required generated evidence, never committed | `frontend/test-results/playwright-results.json`, `frontend/test-results/e2e-summary.md`, `frontend/test-results/e2e-summary.json`, `frontend/playwright-report/`, `frontend/test-results/playwright-artifacts/` |
| Required new tracked files | `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/base.sha`, `progress.md`, and `task-01.md` through `task-04.md` |

## Phase Model and Review Model

| Phase | Work | Recommended worker model | Reasoning | Required reviewer model | Reasoning |
| --- | --- | --- | --- | --- | --- |
| 0 | Clean-base and baseline capture | `gpt-5.6-terra` | medium | `gpt-5.6-terra` | high |
| 1 | Deterministic browser performance test | `gpt-5.6-terra` | high | `gpt-5.6-terra` | high |
| 2 | Repetition, cross-viewport, parser/report evidence | `gpt-5.6-terra` | high | `gpt-5.6-terra` | high |
| 3 | Whole-plan integration, conflict, and final review | `gpt-5.6-sol` | high | `gpt-5.6-sol` | high |

The Phase 3 model differs from the normal behavior-test assignment because it evaluates cross-plan merge conditions, report integrity, timing evidence, and stop conditions as one quality gate.

## Execution Tasks

### Task 1: Capture the clean baseline and define deterministic readiness

**Recommended agent:** `gpt-5.6-terra`, reasoning `medium` — this task is read-only inventory, baseline capture, and deterministic report analysis, matching Phase 0.

**Required reviewer:** fresh `gpt-5.6-terra`, reasoning `high`, in a separate agent context. The reviewer must inspect the baseline artifacts and proposed locator/action pairs before any implementation task begins.

**Files:**

- Create: `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/base.sha`
- Create: `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/progress.md`
- Create: `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-01.md`
- Read: `frontend/playwright.config.ts`, `frontend/tests/e2e/performance-smoke.spec.ts`, `frontend/tests/e2e/support/library-api-mocks.ts`, `scripts/quality/test-result-report.ts`, `scripts/quality/report-quality.ts`, `test/quality/test-result-report.spec.ts`
- Do not modify product, coverage, parser, or configuration files in this task.

**Consumes:** the exact current skip, 2,000 ms budgets, three project definitions, and fixed in-memory fixture interface listed above.

**Produces:** a ledger baseline record and a readiness map used verbatim by Task 2:

| Navigation | Action begins measurement immediately before | Ready locator that ends measurement | Fixture proof |
| --- | --- | --- | --- |
| Staff books list | click the first `Books` link after `loginAsStaff` resolves | heading `Book Collection` **and** text `Demo Book 001` are visible | `mockStaffApi(page, createPerformanceDataset())` intercepts `/books`; dataset has 100 books. |
| Staff book detail | click link `Demo Book 001` from the ready list | heading `Demo Book 001` **and** text `BK-2001` are visible | same fixed `/books/:id` handler. |
| Staff borrowings | click the first `Borrowings` link from ready list/detail flow | exact text `Demo Member 01` **and** exact text `Demo Book 001` are visible | same fixed `/borrowings`; dataset has 35 borrowings. |
| Member home | click Sign in after a fixed 2026-06-17 browser clock and `mockMemberApi` setup | heading `Jane Reader` **and** `page.getByLabel('Current borrowed books').getByText('Demo Book 001')` are visible | fixed member response and the first three seeded borrowings. |

- [ ] **Step 1: Verify the clean worktree and create the tracked base-SHA record.**

  Run before creating any execution-ledger file or changing behavior:

  ```powershell
  $plan4Status = @(git status --short)
  if ($LASTEXITCODE -ne 0 -or $plan4Status.Count -ne 0) { throw "plan4-worktree-not-clean`n$($plan4Status -join "`n")" }
  $plan4Root = '.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination'
  New-Item -ItemType Directory -Force $plan4Root | Out-Null
  $plan4BaseSha = (git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $plan4BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan4-starting-commit' }
  git merge-base --is-ancestor d057d6efc40f55ed871e9fb407246e9f4f87d880 $plan4BaseSha
  if ($LASTEXITCODE -ne 0) { throw 'approved-plan4-design-is-not-an-ancestor' }
  Set-Content -LiteralPath "$plan4Root/base.sha" -Value $plan4BaseSha -NoNewline
  ```

  Expected: the initial status is empty, the approved design commit is an
  ancestor of the runtime base, and `base.sha` contains exactly that
  40-character starting commit. Otherwise stop before any behavior edit.

- [ ] **Step 2: Create the ledger and Task 1 report.**

  Create `progress.md` with headings `Base`, `Scope`, `Task reports`, `Model substitutions`, `Baseline`, `Focused evidence`, `Full evidence`, `Review findings`, `Commits`, and `Deferred findings`. Link `task-01.md` through `task-04.md`. Create `task-01.md` with every mandatory task-report heading; record `$plan4BaseSha`, `gpt-5.6-terra`/medium as implementer, and fresh `gpt-5.6-terra`/high as reviewer. State that the one allowed behavior change is executing the staff seeded-scale test on mobile under unchanged 2,000 ms risk semantics.

- [ ] **Step 3: Capture the focused mobile baseline.**

  Run:

  ```powershell
  npm run frontend:test:e2e -- --project=mobile-chromium tests/e2e/performance-smoke.spec.ts
  ```

  Expected: exit 0, one member test passed, staff seeded-scale test skipped with the exact reason `Staff performance smoke targets desktop/tablet back-office layouts.`, and no failure. Copy the terminal count and the JSON project's passed/failed/flaky/skipped/total counts into `task-01.md`; this is baseline evidence, not RED evidence and not final quality evidence.

- [ ] **Step 4: Run the current full producer and parser once.**

  Run:

  ```powershell
  npm run frontend:test:e2e:report
  npm run quality:report:frontend-e2e
  ```

  Expected: producer exit 0; parser reports 86 passed, 1 skipped, 0 failed, 0 flaky, 87 total, with the skip in the `mobile-chromium` row. Record the generated JSON summary, Node/Playwright version, elapsed command time, and the clean/eventual rate in `task-01.md`. If existing artifacts are stale, the command outputs—not file timestamps—are authoritative.

- [ ] **Step 5: Review the readiness map before editing.**

  The fresh reviewer must confirm every listed locator requires useful route content rather than just URL, spinner disappearance, or a root container; all data comes through `page.route` fixtures; and no external asset is needed for a pass. Record commands, changed files, assumptions, follow-ups, and the review verdict under the mandatory headings in `task-01.md`; link the report from the ledger. Resolve findings before Task 2.

- [ ] **Step 6: Commit the baseline contract and reports.**

  ```powershell
  git add .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/base.sha .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/progress.md .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-01.md
  git commit -m "docs: record mobile Playwright skip baseline"
  ```

### Task 2: Execute the seeded-scale staff performance contract on mobile

**Recommended agent:** `gpt-5.6-terra`, reasoning `high` — this is behavior-test implementation with a timing boundary; it uses the default high assignment.

**Required reviewer:** fresh `gpt-5.6-terra`, reasoning `high`, in a separate agent context. The reviewer must reject any change that reduces dataset scale, changes a budget above 2,000 ms, replaces useful-content locators with URL-only readiness, or leaves an exclusion for `mobile-chromium`.

**Files:**

- Modify: `frontend/tests/e2e/performance-smoke.spec.ts`
- Conditionally modify: `frontend/package.json` only to add the exact repeat script in the produced-interface contract.
- Create: `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-02.md`
- Modify: `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/progress.md`
- Test: the same Playwright spec, first in `mobile-chromium`, then every project.

**Consumes:** Task 1's approved readiness map, existing `createPerformanceDataset`, API mocks, login helpers, and Playwright projects.

**Produces:** two deterministic performance tests running in all projects. The staff test has no `testInfo` parameter and no skip branch. Both tests use the fixed 2,000 ms budget through the named helper. If the repeat script is added, it uses one worker and ten independent repetitions without changing the normal full-suite command.

- [ ] **Step 1: Write and run an executable RED assertion for the single-deadline defect.**

  Make an uncommitted test-first edit in `performance-smoke.spec.ts`: import `performance` from `node:perf_hooks`, define `PERFORMANCE_BUDGET_MS = 2_000`, remove the staff test's `testInfo` argument and `test.skip`, and insert this temporary contract probe immediately after `loginAsStaff(page)`. It deliberately creates two readiness events within separate 2,000 ms waits but outside one shared 2,000 ms deadline; it is the only authorized artificial-delay probe and must be removed in Step 2.

  ```typescript
  await page.evaluate(() => {
    const first = document.createElement('p');
    first.dataset.testid = 'plan4-deadline-first';
    first.hidden = true;
    document.body.append(first);

    const second = document.createElement('p');
    second.dataset.testid = 'plan4-deadline-second';
    second.hidden = true;
    document.body.append(second);

    window.setTimeout(() => {
      first.hidden = false;
    }, 1_100);
    window.setTimeout(() => {
      second.hidden = false;
    }, 2_100);
  });

  const redStart = performance.now();
  await expect(page.getByTestId('plan4-deadline-first')).toBeVisible({
    timeout: PERFORMANCE_BUDGET_MS,
  });
  await expect(page.getByTestId('plan4-deadline-second')).toBeVisible({
    timeout: PERFORMANCE_BUDGET_MS,
  });
  expect(
    performance.now() - redStart,
    'sequential readiness waits must share one 2,000 ms deadline',
  ).toBeLessThanOrEqual(PERFORMANCE_BUDGET_MS);
  ```

  Run:

  ```powershell
  npm run frontend:test:e2e -- --project=mobile-chromium tests/e2e/performance-smoke.spec.ts
  ```

  Expected: exit 1. The temporary probe executes in `mobile-chromium`; both independent visibility waits resolve, then the named elapsed assertion fails at about 2,100 ms because the old pattern grants a fresh timeout to the second readiness wait. Record the exact failure and elapsed value in `task-02.md`. A skip, compile error, missing locator, or unrelated route failure is not acceptable RED evidence. Do not commit the probe.

- [ ] **Step 2: Replace the skip with assertion-owned timing/readiness.**

  Delete the temporary probe but keep the `node:perf_hooks` import, constant, removed skip, and removed `testInfo`. Add this exact helper:

  ```typescript
  import { performance } from 'node:perf_hooks';
  import { expect, type Locator, test } from '@playwright/test';

  const PERFORMANCE_BUDGET_MS = 2_000;

  async function assertUsefulContentWithinBudget(
    name: string,
    action: (timeoutMs: number) => Promise<void>,
    ready: readonly Locator[],
  ): Promise<void> {
    const start = performance.now();
    const deadline = start + PERFORMANCE_BUDGET_MS;

    const remainingBudget = (step: string): number => {
      const remaining = deadline - performance.now();
      if (remaining < 1) {
        throw new Error(
          `${name} exceeded ${PERFORMANCE_BUDGET_MS} ms before ${step}; elapsed=${(performance.now() - start).toFixed(1)} ms`,
        );
      }
      return Math.floor(remaining);
    };

    await action(remainingBudget('action completed'));

    for (const locator of ready) {
      await expect(locator, `${name} useful content`).toBeVisible({
        timeout: remainingBudget('all useful content was ready'),
      });
    }

    const elapsed = performance.now() - start;
    expect(
      elapsed,
      `${name} exceeded ${PERFORMANCE_BUDGET_MS} ms; elapsed=${elapsed.toFixed(1)} ms`,
    ).toBeLessThanOrEqual(PERFORMANCE_BUDGET_MS);
  }
  ```

  For staff books, detail, and borrowings, pass the click as
  `(timeoutMs) => targetLink.click({ timeout: timeoutMs })` and the two exact
  Task 1 locators as `ready`. For member home, pass only
  `(timeoutMs) => signInButton.click({ timeout: timeoutMs })` as `action` and
  use the `Jane Reader` heading plus
  `page.getByLabel('Current borrowed books').getByText('Demo Book 001')` as
  `ready`; remove `page.waitForURL` from the measured operation because its
  independent default timeout would violate the single-deadline contract. The
  action and every readiness wait are therefore bounded by the same monotonic
  deadline, and total elapsed time is asserted
  `<= PERFORMANCE_BUDGET_MS`.

  The helper must not wait for `networkidle`, use `waitForTimeout`, set a project-specific longer timeout, retry the action, or catch/reclassify an assertion failure. Continue using route interception before login, and do not modify the 100/50/35 fixture construction.

- [ ] **Step 3: Verify GREEN for the formerly skipped project.**

  Run:

  ```powershell
  npm run frontend:test:e2e -- --project=mobile-chromium tests/e2e/performance-smoke.spec.ts
  ```

  Expected: exactly 2 passed, 0 skipped, 0 failed, 0 retries. Confirm the staff test displays the three named seeded-scale ready states at 390×844 rather than merely completing navigation.

- [ ] **Step 4: Verify the same contract across all configured viewports.**

  Run:

  ```powershell
  npm run frontend:test:e2e -- tests/e2e/performance-smoke.spec.ts
  ```

  Expected: exactly 6 first-attempt passes (two tests × desktop/tablet/mobile), 0 skipped, 0 failed, 0 flaky. Inspect the list output or JSON to confirm one staff performance pass per project.

- [ ] **Step 5: Add the focused reproducibility command only if it has no shared-script conflict.**

  Add `test:e2e:mobile-performance:repeat` to `frontend/package.json` with the exact command:

  ```text
  playwright test tests/e2e/performance-smoke.spec.ts --project=mobile-chromium --workers=1 --repeat-each=10
  ```

  Do not change existing `test:e2e`, `test:e2e:report`, `retries`, reporters, `fullyParallel`, base URL, project viewport, or dependency lockfile. If Plan 1 has a concurrent `frontend/package.json` edit, defer adding this convenience script and execute the command directly; record the conflict, rather than overwriting its change.

- [ ] **Step 6: Independent task review and commit.**

  Create `task-02.md` with every mandatory report heading. Before inspecting the base-relative diff, load and validate the recorded base:

  ```powershell
  $plan4BaseSha = (Get-Content -Raw .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/base.sha).Trim()
  if ($plan4BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan4-base-sha' }
  $plan4ResolvedBase = (git rev-parse "$($plan4BaseSha)^{commit}").Trim()
  if ($LASTEXITCODE -ne 0 -or $plan4ResolvedBase -ne $plan4BaseSha) { throw 'unresolvable-plan4-base-sha' }
  git diff "$plan4BaseSha...HEAD" -- frontend/tests/e2e/performance-smoke.spec.ts frontend/package.json
  git diff -- frontend/tests/e2e/performance-smoke.spec.ts frontend/package.json
  ```

  The reviewer must inspect both committed and current changes and execute the focused mobile command once. Record the exact RED/GREEN commands and outcomes, changed files, assumptions, follow-ups, reviewer model/reasoning, and verdict in `task-02.md`; link it from the ledger.

  ```powershell
  git add frontend/tests/e2e/performance-smoke.spec.ts frontend/package.json .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/progress.md .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-02.md
  git commit -m "test: run seeded staff performance smoke on mobile"
  ```

  Omit `frontend/package.json` from `git add` if Step 5 was deferred.

### Task 3: Repetition gate and quality-report/parser proof

**Recommended agent:** `gpt-5.6-terra`, reasoning `high` — repeated browser execution and report interpretation are quality-critical; the higher-than-analysis default is required to diagnose any intermittent timing behavior.

**Required reviewer:** fresh `gpt-5.6-terra`, reasoning `high`, in a separate agent context. The reviewer must read the raw Playwright JSON and generated summary rather than relying on console text alone.

**Files:**

- Modify: `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/progress.md`
- Create: `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-03.md`
- Read-only verification: `frontend/test-results/playwright-results.json`, `frontend/test-results/e2e-summary.json`, `frontend/test-results/e2e-summary.md`, `scripts/quality/test-result-report.ts`, `test/quality/test-result-report.spec.ts`
- Conditionally modify only after a demonstrated defect: `test/quality/test-result-report.spec.ts` and the smallest necessary parser file; this is outside normal Plan 4 scope and requires stop/escalation review before code changes.

**Consumes:** Task 2's all-project test and the existing parser's strict project/result classifications.

**Produces:** a ten-repetition mobile evidence record and a full parser-backed report assertion proving the 87/87/0/0/0 state; no parser semantic weakening.

- [ ] **Step 1: Run the deterministic mobile repetition gate.**

  Use the new script if Task 2 added it; otherwise run its exact underlying command:

  ```powershell
  npm run test:e2e:mobile-performance:repeat --prefix frontend
  ```

  or

  ```powershell
  npm run test:e2e --prefix frontend -- tests/e2e/performance-smoke.spec.ts --project=mobile-chromium --workers=1 --repeat-each=10
  ```

  Expected: exactly 20 first-attempt passes (two performance scenarios × ten repetitions), 0 skipped, 0 failed, 0 retries/flaky. Record command, runner version, elapsed time, and every measured failure (if any) in `task-03.md`. A single retry pass is flaky and fails this plan's gate even though the current parser reports flakes as warnings.

  The focused repeat uses the ordinary Playwright JSON reporter and may overwrite `frontend/test-results/playwright-results.json` with a 20-test focused result. Treat that JSON as repetition evidence only—never as the authoritative quality report. Task 3 Step 3 must run the full producer after the repetition and restore the exact 87-test report before parsing or acceptance.

- [ ] **Step 2: Diagnose real instability without changing the performance contract.**

  If any repetition fails or retries, retain artifacts, record the named navigation and elapsed duration, and rerun the same one-worker command once to classify reproducibility. Inspect only deterministic readiness causes: unawaited route setup, readiness locator before useful content, navigation/action ordering, shared test process contention, or a genuine mobile rendering regression. Correct one demonstrated cause and repeat Steps 1 and 2; do not increase the 2,000 ms ceiling, reduce fixture cardinality, add sleeps, or lower repeat count.

- [ ] **Step 3: Produce the full cross-viewport JSON report.**

  Run:

  ```powershell
  npm run frontend:test:e2e:report
  npm run quality:report:frontend-e2e
  ```

  Expected: both commands exit 0. This fresh full producer overwrites the focused repeat JSON and restores the authoritative 87-test `playwright-results.json`. The parser must emit no global errors, and each of desktop/tablet/mobile must show passed 29, flaky 0, failed 0, skipped 0, total 29, clean pass rate 100%, eventual pass rate 100%.

- [ ] **Step 4: Fail closed on report counts and preserve raw evidence.**

  Run this PowerShell assertion after Step 3:

  ```powershell
  $summary = Get-Content -Raw frontend/test-results/e2e-summary.json | ConvertFrom-Json
  $expectedProjects = 'desktop-chromium', 'tablet-chromium', 'mobile-chromium'
  if ($summary.stream -ne 'frontend-e2e' -or $summary.e2eTests.passed -ne 87 -or $summary.e2eTests.failed -ne 0 -or $summary.e2eTests.flaky -ne 0 -or $summary.e2eTests.skipped -ne 0 -or $summary.e2eTests.total -ne 87 -or -not $summary.gate.passed) { throw 'unexpected-frontend-e2e-summary' }
  foreach ($project in $expectedProjects) {
    $row = $summary.e2eTests.projects.$project
    if ($null -eq $row -or $row.passed -ne 29 -or $row.failed -ne 0 -or $row.flaky -ne 0 -or $row.skipped -ne 0 -or $row.total -ne 29 -or $row.cleanPassRate -ne 100 -or $row.eventualPassRate -ne 100) { throw "unexpected-project-summary:$project" }
  }
  ```

  Expected: exit 0. This checks the existing parser output; it must not be replaced with a hand-counted console claim. Record SHA-256 hashes (or a preserved artifact path supplied by CI) for both the raw `playwright-results.json` and `e2e-summary.json` in the ledger; generated files remain untracked.

- [ ] **Step 5: Exercise the parser's existing skip/flaky protections without changing their contract.**

  Run:

  ```powershell
  npx jest --config ./test/jest-quality.json --runInBand test/quality/test-result-report.spec.ts
  ```

  Expected: pass. Its synthetic cases must still demonstrate that skipped tests are counted separately, flaky retry passes are warnings, final failures block the stream, malformed output rejects, and project summaries are retained. Do not delete the skip/flaky parser fixtures simply because the production report is now clean.

- [ ] **Step 6: Review, ledger, and commit evidence metadata.**

  Create `task-03.md` with every mandatory report heading. The reviewer must confirm that the full report is from a new producer run after the focused repeat, raw and rendered counts agree, no `expectedStatus: 'skipped'` result exists in the new raw report, and no e2e report field was manually edited. Record commands and exit codes, focused and full counts, changed files, assumptions, follow-ups, artifact paths/hashes, reviewer model/reasoning, and verdict in `task-03.md`; link it from the ledger.

  ```powershell
  git add .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/progress.md .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-03.md
  git commit -m "docs: record mobile Playwright quality evidence"
  ```

### Task 4: Full repository verification, Plan 1 merge contract, and final review

**Recommended agent:** `gpt-5.6-sol`, reasoning `high` — whole-plan review and cross-stream integrity are explicitly reserved for the higher-capability model.

**Required reviewer:** fresh `gpt-5.6-sol`, reasoning `high`, in a separate agent context. The final reviewer may not be the Task 2 or Task 3 reviewer.

**Files:**

- Modify: `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/progress.md`
- Create: `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-04.md`
- Read-only: all changed files, both frontend producer configurations, parser/report source, `quality/coverage-baselines.json`, and git history/diff.

**Consumes:** reviewed commits from Tasks 1–3; if merged, the actual Plan 1 commit and its frontend-unit artifacts.

**Produces:** final acceptance ledger, full command evidence, Plan 1 conflict/handoff record, and a revertable commit sequence.

- [ ] **Step 1: Reconcile Plan 1 before final verification.**

  If Plan 1 is unmerged, state that its frontend-unit rerun is an integration handoff requirement, not an unperformed Plan 4 success claim. If Plan 1 is merged, load and validate Plan 4's recorded base before the shared-file diff:

  ```powershell
  $plan4BaseSha = (Get-Content -Raw .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/base.sha).Trim()
  if ($plan4BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan4-base-sha' }
  $plan4ResolvedBase = (git rev-parse "$($plan4BaseSha)^{commit}").Trim()
  if ($LASTEXITCODE -ne 0 -or $plan4ResolvedBase -ne $plan4BaseSha) { throw 'unresolvable-plan4-base-sha' }
  git log --oneline -- frontend/package.json frontend/playwright.config.ts frontend/vitest.config.ts quality/coverage-baselines.json
  git diff "$plan4BaseSha...HEAD" -- frontend/package.json frontend/playwright.config.ts frontend/vitest.config.ts quality/coverage-baselines.json
  ```

  Preserve both plans' intended edits, and run both frontend report sequences from the merged tree before accepting Plan 4.

- [ ] **Step 2: Run all required quality and build gates.**

  Run in this order:

  ```powershell
  npm run test:quality-reporting
  npm run test:cov
  npm run test:e2e:report
  npm run quality:report:backend
  npm run frontend:test:coverage
  npm run quality:report:frontend-unit
  npm run frontend:test:e2e:report
  npm run quality:report:frontend-e2e
  npx eslint "{src,apps,libs,test}/**/*.ts"
  npm run frontend:lint
  npm run build
  npm run frontend:build
  $plan4BaseSha = (Get-Content -Raw .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/base.sha).Trim()
  if ($plan4BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan4-base-sha' }
  $plan4ResolvedBase = (git rev-parse "$($plan4BaseSha)^{commit}").Trim()
  if ($LASTEXITCODE -ne 0 -or $plan4ResolvedBase -ne $plan4BaseSha) { throw 'unresolvable-plan4-base-sha' }
  git diff --check "$plan4BaseSha...HEAD"
  git diff --check
  ```

  Expected: every command exits 0. Backend and frontend coverage baselines are non-decreasing and independent; frontend unit output remains a unit stream; frontend e2e output has the exact Task 3 87 passed/0 failed/0 flaky/0 skipped/87 total count. The direct root ESLint command is intentionally non-fixing; do not replace it with the mutating root lint script.

- [ ] **Step 3: Run the applicable changed-line check.**

  Create the zero-context diff only after coverage producers finish, then run the frontend unit changed-line gate (and backend gate if an integration merge includes backend changes):

  ```powershell
  New-Item -ItemType Directory -Force test-results | Out-Null
  $plan4BaseSha = (Get-Content -Raw .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/base.sha).Trim()
  if ($plan4BaseSha -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan4-base-sha' }
  $plan4ResolvedBase = (git rev-parse "$($plan4BaseSha)^{commit}").Trim()
  if ($LASTEXITCODE -ne 0 -or $plan4ResolvedBase -ne $plan4BaseSha) { throw 'unresolvable-plan4-base-sha' }
  git diff --unified=0 --output=test-results/pull-request.diff "$plan4BaseSha...HEAD"
  npm run quality:report:frontend-unit -- --changed-line-diff test-results/pull-request.diff --changed-line-lcov frontend/coverage/lcov.info
  ```

  Expected: exit 0. The Plan 4 test-only diff ordinarily has no eligible frontend production lines, so the unit changed-line result is `not-applicable`; if a production file entered the final diff through another merged plan, it must satisfy the independent >=80% frontend changed-line requirement. This plan never treats e2e pass rate as coverage.

- [ ] **Step 4: Final independent review.**

  Create `task-04.md` with every mandatory report heading. The final reviewer must verify: (1) `rg -n "test\\.(skip|fixme)|expectedStatus.*skipped" frontend/tests/e2e frontend/playwright.config.ts` finds no newly introduced exclusion; (2) the staff mobile scenario uses the 100/50/35 fixture and meaningful ready states; (3) `node:perf_hooks` `performance.now()` and one shared deadline bound both sequential readiness waits and no legacy wall-clock timing call remains in the spec; (4) no budget or project reduction exists; (5) raw/report/project count contract holds; (6) the Task 3 full producer ran after the focused repeat and restored the authoritative 87-test report; (7) parser skip/flaky cases remain; (8) shared Plan 1 files were merged structurally; (9) generated artifacts and coverage reports are untracked; and (10) the validated-base `git diff --check` is clean. Record every command/result, changed file, assumption, follow-up, finding/resolution, reviewer model/reasoning, and verdict in `task-04.md`; link it from the ledger.

- [ ] **Step 5: Commit final ledger and prepare handoff.**

  ```powershell
  git add .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/progress.md .superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-04.md
  git commit -m "docs: complete mobile Playwright skip elimination"
  ```

  The handoff entry must include base and final commit hashes, all task commit hashes, model/reviewer assignments and substitutions, RED/GREEN and repeat evidence, exact full report counts, Plan 1 merge status, files changed, checks run with exit codes, artifact hash/path, deferred findings, and rollback point.

## Stop Conditions and Escalation

Stop the implementation and request direction—do not weaken the contract—if any of these occurs:

1. The only way to get a stable mobile pass is increasing a 2,000 ms performance budget, changing `toBeVisible` readiness to URL/container-only readiness, reducing the 100 books/50 members/35 borrowings fixture, disabling mobile, adding a skip/fixme, changing retries into acceptance, or using arbitrary delay/sleep.
2. The mobile staff workflow genuinely cannot be usable at 390×844 without a product/UI change beyond an e2e timing/readiness adjustment. Attach the trace/screenshot and name the blocked route/content.
3. The full raw JSON cannot be parsed by the existing quality parser, the parser contract requires a semantic change to represent this clean result, or Plan 1's shared output changes cannot be merged without lowering either plan's guarantees. Supply the raw JSON, parser failure, and exact overlapping diff; do not patch the parser speculatively.
4. Ten one-worker mobile repetitions contain a final failure or retry after one deterministic-cause repair attempt. Preserve artifacts and report whether it is a real performance regression versus an unresolved test harness race.
5. Any final stream has a failure, flaky result, skip, zero tests, global runner error, malformed report, altered coverage baseline, or changed-line gate failure.

Ordinary failing focused tests are not blockers: inspect route setup, click/readiness ordering, and the trace; correct the demonstrated deterministic cause; then rerun the appropriate RED/GREEN and repetition gates.

## Rollback and Recovery

- The changes are test-only and split into three small commits, so recover by reverting the last offending plan commit first, then the behavioral test commit, while retaining the baseline ledger for diagnosis. Do not delete generated artifacts before copying their failure paths/hashes to the ledger.
- If the repeat script conflicts with Plan 1, omit that isolated optional script instead of creating a fragile merge; the exact `playwright test` invocation remains the reproducibility command.
- If a shared Playwright configuration experiment causes collateral failures, revert that configuration hunk and keep the scenario-local explicit readiness helper. Configuration changes are not required for the selected strategy.
- Never roll back by restoring the mobile skip. A rollback that leaves the performance assertion unsatisfied returns the work to its known incomplete state and must be explicitly reported for direction.

## Completion Checklist

- [ ] No staff mobile performance skip/exclusion remains.
- [ ] The staff seeded-scale workflow executes at desktop, tablet, and Pixel 5 mobile under the unchanged 2,000 ms budget per useful-content navigation.
- [ ] Mobile performance-only one-worker repetition: 20/20 first-attempt passed, 0 failed/flaky/skipped.
- [ ] Full Playwright JSON and quality report: 87 passed, 0 failed, 0 flaky, 0 skipped, 87 total; each project is 29/29 with 100% clean/eventual rates.
- [ ] Existing parser tests still verify skips, flakiness, failures, malformed data, and per-project reporting.
- [ ] Required lint, build, quality, e2e, changed-line, whitespace, review, commit, and ledger evidence is complete.
- [ ] Plan 1 parallel/merge contract has been recorded and, when applicable, both frontend reporting streams were rerun from the merged tree.
