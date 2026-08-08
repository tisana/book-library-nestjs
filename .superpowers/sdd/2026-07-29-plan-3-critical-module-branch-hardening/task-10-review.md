# Task 10 review

## Task

Task 10 — Independent whole-plan review and Plan 5 handoff

## Reviewer model and reasoning

`gpt-5.6-sol`, high; fresh separate-context reviewer identity
`/root/plan3_task10_implementer/plan3_task10_review`; substitution none.

## Reviewed commit

`f2498e66a64826c66970228f03bc2c9b8e5c2600`
(`docs: record critical module handoff`) against Task 10 starting commit
`0f11a6cd7f281027bf12bd429b37d2a49613aabc` and Plan 3 base
`e52711c7f6fd1174f4ff85280152ced174724bfe`.

## Commands and exits

- Read the Task 10 brief, current project plan, all Plan 2 task/ledger evidence,
  all Plan 3 task/review reports, the candidate handoff report, and the ledger;
  exit `0`. The handoff report was treated as untrusted.
- `git status --short`, branch/HEAD inspection, candidate `git show`, and
  `git diff-tree`: exit `0`. The worktree was clean before this reviewer-owned
  file changed. The candidate subject is exact and the candidate changes only
  `task-10-report.md` and `progress.md`; it does not change production, tests,
  baseline, source/report configuration, generated artifacts, or this review.
- Plan 2/3 ancestry checks: exit `0`. Reviewed Plan 2 head
  `dc42a12e91529da35f362aa545ff704d89dcdf4d` is an ancestor of final Plan 2
  handoff `f7836f5f9671b86d1478e87ced01d55d9a65a0d2`; that handoff is an ancestor
  of reviewed merge/Plan 3 base `e52711c7f6fd1174f4ff85280152ced174724bfe`;
  the Plan 3 base and Task 10 start are ancestors of the candidate.
- Complete Plan 3 commit/subject/path audit: exit `0`. All recorded
  implementation, fix, review-closeout, ratchet, and handoff SHAs exist in the
  candidate chain and have the recorded subjects. Base SHA storage is exactly
  `40` bytes and resolves to a commit.
- `git diff --name-status` and `git diff --check` for Plan 3 base-to-candidate:
  exit `0`. The allowed path classes are correct, but exact enumeration is
  `29`, not the recorded `28`. Base-to-Task-10-start is also exactly `29`.
- Read-only comparison of every added direct/parameterized test title and its
  assertions with the pre-Plan-3 versions of all five critical specs and the
  complete Plan 2 reports: exit `0`; duplicated behavior `0`. Public-path
  reconciliation coverage is distinct from the retained legacy private-helper
  coverage and is expressly required by Tasks 4-5.
- Generated `test-results/backend-unit.json` inspection: `35/35` suites,
  `469/469` tests, failed `0`, pending `0`, interrupted `false`.
- Generated `test-results/backend-e2e.json` inspection: `29/29` suites,
  `242/242` tests, failed `0`, pending `0`, interrupted `false`; final failures
  and flaky tests in `backend-summary.json` are both `0`.
- Fresh `npm run test:quality-reporting`: exit `0`; `4/4` suites and `68/68`
  tests passed.
- Generated coverage/report inspection: exit `0`; exactly `87` backend files;
  statements `2960/3659`, branches `2103/2815`, functions `492/605`, lines
  `2841/3496`; report gate passed with no reasons or warnings.
- Exact six-file coverage extraction: token session `89/103`, identifier repair
  `103/110`, reconciliation `181/191`, members `164/188`, borrowings `105/116`,
  permissions `71/74`; all denominators and floors pass.
- Exact line-for-line comparison of `test-results/plan-3-backend.diff` with a
  fresh in-memory `git diff --unified=0 e52711c...0f11a6c`: exit `0`; both have
  `5286` lines and comparison delta `0`. `backend-summary.json` records changed
  line `not-applicable`, passed, `0/0`, minimum `80`.
- Baseline comparison: backend advanced monotonically from
  `78.81/70.87/79.83/79.26` to `80.89/74.70/81.32/81.26`; frontend remains
  `47/44.03/41.08/48.27`. The `75%` branch threshold is `2112/2815`, so the
  verified backlog is `9`.
- Export inspection: all five Plan 2 exports and all eight Plan 3 exports named
  by the handoff are present. Coverage, LCOV, unit/e2e JSON, summary, diff, and
  build outputs are ignored; pre-review status remained clean.
- Broad unit/e2e producers, ESLint, and build were not rerun: their fresh
  persisted artifacts and the independent Task 9 review resolve the relevant
  evidence, while the candidate is documentation-only. Only the unpersisted
  quality-reporting count was rerun.

## Scope, duplication, and handoff validation

- Candidate-commit scope and subject: compliant.
- Complete Plan 3 allowed path classes: compliant; production source,
  reporting/source-set configuration, scripts, CI, e2e specs, frontend, Plan 2
  tests/fixtures, permission source/spec, and tracked generated artifacts are
  unchanged.
- Exact recorded scope count: noncompliant; see Important I1.
- Added behavior duplication: `0`.
- Plan 2 final SHA, Plan 3 base/start/task/fix/review/ratchet SHAs, and
  implementer/reviewer `gpt-5.6-sol` high provenance are internally consistent.
- The five focused commands are recorded verbatim for Tasks 1, 3, 5, 7, and 8.
- Exported invariants are supported by the reviewed tests: no
  authorization/ownership bypass; no refresh-family replay/revocation bypass;
  no illegal borrowing transition; and no terminal TTL before durable event
  recording and required cleanup.
- Future mutation scope is correctly limited to `TokenSessionService`,
  `AuthIdentifierRepairService`, `AuthIdentifierReconciliationService`,
  `MembersService`, and `BorrowingsService`. `PermissionsService` remains an
  unchanged monitored control: isolated evidence is `69/74`, while the
  authoritative full-source run is `71/74` because established guard-spec calls
  cover the roles/auth-version defaults.

## Deferred Minor disposition

Task 3 Minor TQ-2 remains present at
`src/auth/auth-identifier-repair.service.spec.ts:1441`, `:1449`, and `:1626`:
the public aggregate-write assertions accept `expect.any(String)` instead of
the exact replacement/original identifier.

Disposition: **non-load-bearing and explicitly deferred**. The binding Task 3
contract requires correct staff/member field selection and one `authVersion`
increment; those facts, aggregate IDs, session use, terminal ordering, and
compensation request sequence are exact. The retained pre-Plan-3 compensation
unit assertion also pins the original conflict identifier passed to the
aggregate setter. Strengthening the three public values would improve mutation
specificity, but the current weakness does not invalidate a Plan 3 hard gate or
exported invariant. It is not erased and should remain visible to Plan 5 when
mutation design reaches identifier-value substitutions.

## Findings

### Critical

Open: `0`.

### Important

Open: `1`.

- **I1 — The handoff records the complete Plan 3 scope as 28 paths, but the
  exact scope is 29.** `task-10-report.md:111` and `progress.md:232` both state
  `28`. Fresh enumeration from the fixed base to both Task 10 start and the
  candidate returns `29`: 22 Plan 3 record files (`base.sha`, `progress.md`, and
  20 task report/review files), five critical specs, one shared fixture, and one
  backend baseline. The path classes are allowed and there is no extra
  production/configuration file, but the recorded exact evidence is false. The
  Task 10 brief makes any scope mismatch blocking. Correct both records,
  regenerate/revalidate the exact scope evidence, rerun the required Task 10
  gates, and submit a new candidate for fresh review.

### Minor

Open blocking: `0`. Deferred non-blocking: `1` (Task 3 TQ-2, disposition above).

### Counts

- Critical open: `0`.
- Important open: `1`.
- Minor open blocking: `0`.
- Minor deferred non-blocking: `1`.
- Total blocking open findings: `1`.

## Resolutions verified

- All prior Task 1-9 Critical/Important findings are resolved in their recorded
  fix heads and review-closeout chain.
- Task 3 TQ-1, Task 4 lifecycle generation, Task 5 ordering/selectors, and Task
  6 reservation-selector/nonduplication findings remain addressed.
- The sole prior Minor is preserved and triaged above rather than silently
  closed.

## Concerns

No additional functional, security, duplication, denominator, persistent-test,
artifact, export, provenance, mutation-boundary, permission-monitor, or
invariant concern was found. The only blocking concern is I1's exact scope-count
mismatch. Plan 5 remains closed.

## Verdict

**CHANGES_REQUIRED.** Candidate
`f2498e66a64826c66970228f03bc2c9b8e5c2600` is not accepted as the Plan 3
handoff because Important I1 is open. Return the finding to Task 10, rerun the
required scope and verification steps after correction, and obtain a fresh
whole-plan review. Do not start Plan 5.

## Fix Round 1 Re-review

### Reviewed correction

`75d81b17ca826df4f8236fd153f89b155c1d9748`
(`docs: correct Plan 3 handoff scope count`) against fix base
`f2498e66a64826c66970228f03bc2c9b8e5c2600`.

The supplied immutable scoped package
`rereview-f2498e6..75d81b1.diff` was read as the sole fix-round change view.
No Git command, producer suite, coverage command, lint, or build was rerun.

### Finding Verdict

- **Important I1 — ADDRESSED** at `task-10-report.md:111` and
  `progress.md:232`. Both inaccurate `28` statements now record exactly `29`
  paths and enumerate the complete arithmetic: `22` Plan 3 records, five
  critical specs, `test/support/critical-auth-fixtures.ts`, and Task 9-owned
  `quality/coverage-baselines.json`. The appended fix evidence records the
  exact base-to-candidate recomputation command, exit `0`, and result `29`.

### New Breakage

- Critical: `0`.
- Important: `0`.
- Blocking Minor: `0`.
- No production source, test, baseline value, reporting/source configuration,
  generated artifact, permission file, frontend file, script, CI, or e2e spec
  changes appear in the scoped package.
- The scoped package carries this reviewer-authored review record from its
  prior placeholder state. Its content is preserved as authored and is an
  expected administrative review artifact, not implementer-owned functional
  scope or new breakage.
- The correction is evidence-only and does not change any producer or gate
  input. Retaining the already accepted fresh verification evidence without a
  redundant broad rerun is non-blocking for this scoped count correction.

### Deferred Minor Triage

Task 3 Minor TQ-2 remains **non-load-bearing and explicitly deferred**. The
correction neither erases nor changes the ruling or the underlying
`expect.any(String)` assertions. Blocking Minor `0`; deferred non-blocking
Minor `1`.

### Final Counts

- Critical open: `0`.
- Important open: `0`.
- Minor open blocking: `0`.
- Minor deferred non-blocking: `1`.
- Total blocking open findings: `0`.

### Fix Round Verdict

**APPROVED — READY TO MERGE/ACCEPT AS THE REVIEWED PLAN 3 HANDOFF.** Important
I1 is addressed with no new blocking breakage. Reviewed head:
`75d81b17ca826df4f8236fd153f89b155c1d9748`. Plan 5 remains closed until the
parent records this scoped review acceptance.
