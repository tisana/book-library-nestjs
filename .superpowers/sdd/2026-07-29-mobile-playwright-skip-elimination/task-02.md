# Task 2 report — seeded-scale mobile performance contract

## Plan and task identifier

- Plan: `docs/superpowers/plans/2026-07-31-mobile-playwright-skip-elimination.md`
- Task: 2 — Execute the seeded-scale staff performance contract on mobile.

## Requested implementer model and reasoning

- `gpt-5.6-terra`, high.

## Actual implementer model and reasoning

- `gpt-5.6-terra`, high.

## Requested reviewer model and reasoning

- Fresh `gpt-5.6-terra`, high.

## Actual reviewer model and reasoning

- Pending fresh review.

## Substitution reason and approval

- None.

## Execution status

- BLOCKED. This report was created before the Task 2 RED probe, as required.

## Predecessor merge SHA and working base SHA

- Predecessor merge SHA: not-applicable (Wave A has no predecessor merge).
- Working base SHA: `05a426ec944d8305edc621b12497d89a5f20457b`.

## RED probe contract and actual result

- The temporary probe was inserted exactly as mandated, immediately after `loginAsStaff(page)`, with the required `node:perf_hooks` import, `PERFORMANCE_BUDGET_MS = 2_000`, and the staff skip/testInfo removal. It was never committed and has been removed.
- Required intended RED result: the first and second waits resolve, then the elapsed assertion rejects at about 2,100 ms.
- Actual result: the exact empty `<p>` elements do not have a non-zero visible box after `hidden` is cleared. Playwright therefore reports them as `hidden`; the first `toBeVisible` wait exhausts its 2,000 ms timeout. The failure occurs before the sequential-deadline elapsed assertion, which the brief explicitly excludes as acceptable RED evidence.
- This task cannot alter the mandated probe to make the paragraphs visible; that needs plan-owner direction.

## Tests and verification commands with exit status

- Literal prescribed RED command: `npm run frontend:test:e2e -- --project=mobile-chromium tests/e2e/performance-smoke.spec.ts` — exit 1. Exact command forwarding output showed `npm run test:e2e --prefix frontend --project=mobile-chromium tests/e2e/performance-smoke.spec.ts`, then `playwright test tests/e2e/performance-smoke.spec.ts`; it ran 6 tests. Three member cases passed. The desktop, tablet, and mobile staff cases each failed at `expect(page.getByTestId('plan4-deadline-first')).toBeVisible({ timeout: PERFORMANCE_BUDGET_MS })`, with `Expected: visible`, `Received: hidden`, and `Timeout: 2000ms`; output summary: `3 failed`, `3 passed (7.5s)`. npm also warned that `--project` is an unknown CLI config.
- Semantically direct mobile-only RED command: `npm --prefix frontend run test:e2e -- --project=mobile-chromium tests/e2e/performance-smoke.spec.ts` — exit 1. It ran 2 tests: member passed and staff failed at the same first readiness wait. Exact failure fields were `Locator: getByTestId('plan4-deadline-first')`, `Expected: visible`, `Received: hidden`, and `Timeout: 2000ms`; output summary: `1 failed`, `1 passed (4.8s)`.
- No GREEN command was run after the task was blocked. No performance spec or package script remains changed.

## Files changed

- `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-02.md` (new blocked-evidence report, uncommitted).
- `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/progress.md` (append-only blocked status, uncommitted).
- `frontend/tests/e2e/performance-smoke.spec.ts` was temporarily changed only for the mandated RED probe and restored to the approved Task 1 state.
- `frontend/package.json` was not changed.

## Metric numerator, denominator, percentage, and delta

- Not applicable: this is invalid RED evidence, not a GREEN or final-quality run. The approved Task 1 baseline remains unchanged at 86 passed / 87 total with one mobile staff skip.

## Readiness and contract preservation

- The 2,000 ms budget, 100/50/35 fixture, three projects, retries, reporters, viewports, local immediate mocks, independent metrics, locator strategy, and existing configuration remain unchanged.
- No skip/fixme addition, sleep, `networkidle`, external call/image, weakened locator, product-code change, parser/config/lockfile/baseline/root-package change, or package script edit was made.

## Reviewer findings, resolutions, and final decision

- Reviewer not started because the plan-owner directed the task to stop after the exact RED probe produced excluded evidence.
- Resolution required: the plan owner must provide an approved replacement for the exact temporary probe or otherwise change the RED-evidence requirement.

## Reviewer verdict

Blocked before review.

## Remaining risks and explicit handoff notes

- Do not proceed to the GREEN helper, mobile execution, all-project verification, repeat script, or commit until plan-owner direction resolves the impossible RED evidence condition.
- The only remaining uncommitted files are this report and the append-only ledger update.

## Authorized resume

- The plan owner authorized Task 2 to resume after the blocked attempt.
- The sole authorized amendment to the temporary, uncommitted RED probe is adding `first.textContent = 'first ready';` and `second.textContent = 'second ready';`. The hidden state, 1,100/2,100 ms timers, independent 2,000 ms waits, and named elapsed assertion remain unchanged.
- The amended probe will be removed in full before GREEN. No other Task 2 contract is changed.

## Valid resumed RED evidence

- Literal root command: `npm run frontend:test:e2e -- --project=mobile-chromium tests/e2e/performance-smoke.spec.ts` — exit 1. Nested npm again consumed the selector and ran 6 cases: 3 member passes and 3 staff failures. All staff failures reached the named assertion `sequential readiness waits must share one 2,000 ms deadline`; received elapsed values were desktop `2140.1552000000006` ms, tablet `2129.5471000000002` ms, and mobile `2121.1347` ms. Output summary: `3 failed`, `3 passed (8.4s)`.
- Direct focused command: `npm --prefix frontend run test:e2e -- --project=mobile-chromium tests/e2e/performance-smoke.spec.ts` — exit 1. It ran exactly 2 mobile cases: member passed; staff reached the named shared-deadline assertion and received `2109.8413` ms against `<= 2000`. Output summary: `1 failed`, `1 passed (4.9s)`.
- In both commands, the two independent visibility waits resolved before the elapsed assertion failed. This is the required executable RED evidence. The authorized probe remained uncommitted and is removed before GREEN.

## Completed resumed implementation

- Removed the temporary probe in full before GREEN while retaining the `node:perf_hooks` import, `PERFORMANCE_BUDGET_MS = 2_000`, removed `testInfo`, and removed mobile skip.
- Added the exact `assertUsefulContentWithinBudget` helper. The action and every useful-content readiness assertion share one monotonic 2,000 ms deadline.
- Staff list, detail, and borrowings each measure the link click and assert both exact Task 1 useful-content locators. Member home measures only the sign-in click and asserts the `Jane Reader` heading plus `Demo Book 001` within `Current borrowed books`; the independent `waitForURL` was removed.
- The 100/50/35 seeded fixture and local immediate route mocks remain unchanged. No sleep, `networkidle`, external request/image, retry, catch/reclassification, project-specific timeout, URL-only readiness, or weakened locator was introduced.

## Resumed GREEN evidence

- Literal focused root command: `npm run frontend:test:e2e -- --project=mobile-chromium tests/e2e/performance-smoke.spec.ts` — exit 0. Nested npm again consumed the project selector, so Playwright ran all 6 cases: desktop 2/2, tablet 2/2, mobile 2/2; 0 skipped, 0 failed, no retries. Output summary: `6 passed (5.4s)`.
- Direct focused command: `npm --prefix frontend run test:e2e -- --project=mobile-chromium tests/e2e/performance-smoke.spec.ts` — exit 0. Exactly 2 mobile cases passed on first attempt; staff completed in 1.2 s and member in 863 ms. Output summary: `2 passed (3.0s)`.
- Exact all-project command: `npm run frontend:test:e2e -- tests/e2e/performance-smoke.spec.ts` — exit 0 with one staff and one member pass in each configured project; output summary: `6 passed (5.3s)`.
- Fresh final-tree all-project verification after adding the repeat script: the same exact command exited 0 with desktop 2/2, tablet 2/2, mobile 2/2; 0 skipped, 0 failed, 0 flaky, no retries. Mobile staff completed in 1.1 s. Output summary: `6 passed (5.4s)`.
- The staff mobile test proves the list heading/book text, detail heading/barcode, and borrowing member/book text at the configured 390×844 viewport; it does not use navigation completion as readiness.

## Repeat-script conflict decision

- Inspected both the Plan 1 committed range through `53be925393d2c17078f77e91a333dce2f59582cc` and its current worktree for `frontend/package.json` changes; both diffs were empty. The assigned Plan 4 worktree also had no pre-existing package change.
- With no actual shared-script conflict, added `test:e2e:mobile-performance:repeat` with exactly `playwright test tests/e2e/performance-smoke.spec.ts --project=mobile-chromium --workers=1 --repeat-each=10`.
- `npm --prefix frontend pkg get "scripts.test:e2e:mobile-performance:repeat"` returned that exact command. Existing scripts, normal full-suite behavior, Playwright configuration, reporters, retries, projects, viewports, base URL, and lockfile remain unchanged.

## Final changed files and scope

- `frontend/tests/e2e/performance-smoke.spec.ts`
- `frontend/package.json`
- `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/task-02.md`
- `.superpowers/sdd/2026-07-29-mobile-playwright-skip-elimination/progress.md`

No product source, root package, parser, Playwright configuration, lockfile, coverage baseline, denominator, or generated artifact is included.

## Final assumptions and follow-ups

- Plan 1 remains unmerged; Task 4 owns reconciliation and the required future integration rerun. Task 2 does not rebase or merge.
- The literal root selector-forwarding defect remains documented and unchanged. Direct frontend invocation supplies the intended mobile-only proof.
- Task 3 repetition/report-parser work is not started here.

## Fresh reviewer completion

- Actual reviewer: fresh `gpt-5.6-terra`, high reasoning, separate agent context; no substitution.
- The reviewer inspected the recorded base-relative and current Task 2 diffs, including the performance spec, exact repeat script, task report, and ledger. It confirmed the exact 2,000 ms monotonic deadline, unchanged 100/50/35 fixture, all required useful-content locators, removal of the mobile skip/testInfo, and absence of forbidden readiness/configuration/artifact changes.
- Reviewer command: `npm --prefix frontend run test:e2e -- --project=mobile-chromium tests/e2e/performance-smoke.spec.ts` — exit 0; exactly 2 passed, 0 skipped, 0 failed, no retries. Staff completed in 1.1 s, member in 784 ms, suite in 2.9 s.
- Findings: none. Administrative follow-up to record the completed review is resolved by this section and the ledger entry below.
- Final reviewer verdict: **Approved**.

## Final decision

- Task 2 approved for the required commit. Keep the branch/worktree in place; do not merge or rebase before Task 4 reconciliation.

## Postcommit evidence-provenance correction — fix round 1/5

### Immutable task provenance

- Task 1 completion commit: `f30a70f01f823f5b19e5f4de004a014ae83ef769` (`docs: record mobile Playwright skip baseline`).
- Task 1 immutable range: `05a426ec944d8305edc621b12497d89a5f20457b..f30a70f01f823f5b19e5f4de004a014ae83ef769`. Any earlier Task 1 range ending in mutable `HEAD` is historical and superseded by this pinned range.
- Task 2 implementation commit: `7a859610de1e2908517f8759843e7500501c00c2` (`test: run seeded staff performance smoke on mobile`).
- Task 2 implementation status: complete. The behavior/test contract is approved; no Task 2 behavior change is part of this provenance correction.

### Reviewer provenance

- The earlier top-level `Actual reviewer model and reasoning` value of `Pending fresh review` records the pre-review report-creation state only. It is historical and superseded by the completed review records below.
- Precommit reviewer identity: `/root/plan4_task2_impl/task2_fresh_review`; fresh `gpt-5.6-terra`, high reasoning, separate agent context. Result: **Approved**, no findings. Its direct mobile rerun passed 2/2 first attempt, 0 skipped/failed/retried.
- Postcommit reviewer identity: `/root/plan4_task2_postcommit_review`; fresh `gpt-5.6-terra`, high reasoning, separate agent context. Result: **CHANGES_REQUIRED for evidence provenance only**; the code and performance contract were approved.
- Postcommit finding 1: Task 2 completion/reviewer provenance was not pinned consistently because the report retained historical pending metadata and did not identify implementation commit `7a859610de1e2908517f8759843e7500501c00c2`. Addressed by the immutable task and reviewer provenance above.
- Postcommit finding 2: the ledger identified Task 1 through a mutable range ending at `HEAD`. Addressed by pinning Task 1 to commit `f30a70f01f823f5b19e5f4de004a014ae83ef769` and immutable range `05a426ec944d8305edc621b12497d89a5f20457b..f30a70f01f823f5b19e5f4de004a014ae83ef769`.

### Fix-round state

- Review fix round: 1/5.
- Findings addressed: 2.
- Findings open: 0.
- Fresh scoped post-fix re-review: pending.
