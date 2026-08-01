# Task

Plan 2, Task 1 — Reusable fixtures and staff-account lifecycle.

# Implementer model and reasoning

- Requested: gpt-5.6-sol, high
- Actual: gpt-5.6-sol, high
- Substitution: none

# Reviewer model and reasoning

- Requested: separate-context gpt-5.6-sol, high
- Actual: gpt-5.6-sol, high
- Substitution: none

# Base SHA

- Predecessor merge SHA: not-applicable — Wave A has no predecessor merge.
- Working base SHA: `05a426ec944d8305edc621b12497d89a5f20457b`
- Initialization/validation block: exit 0

# Files changed

- `.superpowers/sdd/2026-07-29-plan-2-backend-coverage/base.sha`
- `.superpowers/sdd/2026-07-29-plan-2-backend-coverage/progress.md`
- `.superpowers/sdd/2026-07-29-plan-2-backend-coverage/task-01.md`
- `src/staff-users/staff-users.service.spec.ts`
- `test/support/backend-coverage-fixtures.ts`
- Fix round 1 metadata-only change: `.superpowers/sdd/2026-07-29-plan-2-backend-coverage/progress.md` and this report.

# RED command and exit

`npx jest --runInBand staff-users/staff-users.service.spec.ts --coverage --collectCoverageFrom=staff-users/staff-users.service.ts --coverageReporters=text`

Exit: 1

# RED evidence

The suite failed before the fixture implementation with TS2307: `Cannot find module '../../test/support/backend-coverage-fixtures'`. The run reported 0/180 covered branches and no executed tests. The first compilation also identified incomplete `AuditActor` test inputs; GREEN supplied the public actor fields required by the contract.

# GREEN command and exit

`npx jest --runInBand staff-users/staff-users.service.spec.ts --coverage --collectCoverageFrom=staff-users/staff-users.service.ts --coverageReporters=text`

Exit: 0

# GREEN evidence

33 tests passed in one suite with zero failures and zero snapshots. The tests exercise public `create`, `update`, `findAll`, `findByEmailWithPassword`, `findActiveById`, `touchLastLogin`, `bumpAuthVersion`, and `toResponse` behavior, asserting returned DTOs and complete model requests rather than private members.

# Focused metrics

- Baseline staff-users branches: 92/180 (51.11%).
- GREEN staff-users branches: 163/180 (90.55%).
- Delta: +71 covered branches, +39.44 percentage points.
- Required floor: at least 159/180; exceeded by 4 covered branches.
- Statements: 98.80%; functions: 100%; lines: 100%.
- Focused lint: `npx eslint src/staff-users/staff-users.service.spec.ts test/support/backend-coverage-fixtures.ts`, exit 0.

# Full-suite commands and exits

not-applicable — Task 1 requires the focused staff-users service command; full-suite verification is reserved for Task 6.

# Changed-line result

not-applicable — Task 1 changes test/support and report files only; the plan runs the changed-line gate in Task 6.

# Commit hash

Implementation commit: `38c6dc40f3950e6e72b2f9e7e72b7c9353a02237`

Fix round 1 metadata commit: `477986556e0cb3e28e5802fb3ae5b4cfcc599231`

Reviewed completion range: `05a426e..4779865`, covering the reviewed implementation+fix range.

# Deferred findings

None. Self-review confirmed the compensation filter/update, audit prior-value contexts, public credential redaction, exact recorded call arrays, owned-file boundary, and absence of production/config/frontend or Plan 3 spec changes.

# Reviewer decision

Approved. Fresh review by gpt-5.6-sol, high found no functional or specification issues beyond the stale commit/status evidence gap. Fix round 1 recorded the implementation SHA, reviewer, finding, and resolution. Scoped re-review found that finding addressed, with no new breakage or out-of-scope observations, across the reviewed implementation+fix range `05a426e..4779865`.

## Final whole-branch fix round 2/5

- Senior reviewer: `/root/plan2_final_branch_review` using gpt-5.6-sol, high; substitution none.
- Senior decision: `CHANGES_REQUIRED` with two Task 1 test-security findings.
- Finding 1: the successful create coverage did not prove that the exact raw DTO password is sent only to the password hasher, that only the `hashed-value` sentinel reaches the constructed staff document, or that the raw `password` property is absent from that constructor input.
- Finding 2: the authentication lookup coverage named password-hash selection but did not assert that the returned query double received `select('+passwordHash')`.
- Historical at-authoring implementation disposition: 2 addressed, 0 open at the implementer fix stage; fresh senior re-review was pending. This pending marker is superseded by stable fix `20e1e94e969ee4ca83e672cb5201f3f11d328bca` and security-fix review record `606b6ed34e93f16758880941f744f893689521ca`.
- Scope: only `src/staff-users/staff-users.service.spec.ts` plus this Task 1 report and `progress.md`; no production, fixture, baseline, configuration, frontend, migration, generated-artifact, or other-test change.

The create-success test now keeps the source DTO, verifies one hasher call, and uses boolean-only `Object.is` to prove the forwarded argument is the DTO password without allowing a failed expectation to serialize the credential. It separately proves the recorded constructor input contains `passwordHash: 'hashed-value'` and has no own `password` property. The authentication lookup test obtains the returned query double from `staff.model.findOne.mock.results[0].value` and verifies `select('+passwordHash')`.

The exact focused Task 1 command was used for every RED and GREEN run:

`npx jest --runInBand staff-users/staff-users.service.spec.ts --coverage --collectCoverageFrom=staff-users/staff-users.service.ts --coverageReporters=text`

- RED A: exit 1 after clearing only the recorded hasher and query-double `select` calls; 2 expected failures and 31 passes proved both call assertions. Output contained call counts and the non-secret selector only.
- RED B: exit 1 after changing only the recorded constructor hash to `unexpected-hash`; 1 expected failure and 32 passes proved only the hasher sentinel is accepted by the constructor assertion.
- RED C: exit 1 after adding only a boolean `password` property to the recorded constructor input; 1 expected failure and 32 passes proved raw-password-property rejection with boolean-only failure output.
- GREEN: exit 0 after removing every test-local mutation; 33/33 tests passed. StaffUsersService remained at 163/180 branches (90.55%), 98.80% statements, 100% functions, and 100% lines.

Fresh whole-branch verification after the assertion fix:

- `npm run test:quality-reporting`: exit 0; 4/4 suites and 68/68 tests passed.
- `npm run test:cov`: exit 0; 35/35 suites and 382/382 tests passed. Coverage remained 2,884/3,659 statements (78.81%), 1,995/2,815 branches (70.87%), 483/605 functions (79.83%), and 2,771/3,496 lines (79.26%) across the unchanged 87-file source scope.
- `npm run test:e2e:report`: exit 0; 29/29 suites and 242/242 tests passed with zero failures, flaky tests, or skips.
- `npm run quality:report:backend`: exit 0.
- Validated-base changed-line backend report: exit 0; `not-applicable`, 0/0 eligible lines, 100.00% against the 80.00% minimum.
- `npx eslint "{src,apps,libs,test}/**/*.ts"`: exit 0 and non-fixing.
- `npm run build`: exit 0.
- Validated base-to-working-tree scope and `git diff --check`: exit 0; this round contained only the owned spec before this report/ledger update, and generated `coverage/`, `dist/`, and `test-results/` remained untracked.

Historical at-authoring fix-round commit marker: pending because this report was part of that commit. This marker is superseded by stable fix `20e1e94e969ee4ca83e672cb5201f3f11d328bca` and security-fix review record `606b6ed34e93f16758880941f744f893689521ca`; the fix SHA is no longer pending.

Historical fix-round Gate G1 marker: merge readiness was withdrawn pending a fresh scoped review of this correction. That pending review was fulfilled by the security-fix review recorded in `606b6ed34e93f16758880941f744f893689521ca`; the current Gate G1 state is recorded below and remains closed pending round 3. Plan 3 remains blocked and no merge is authorized.

## Security assertion fix round 3/5 metadata correction

- Stable fix commit: `20e1e94e969ee4ca83e672cb5201f3f11d328bca` (`test: assert staff credential boundaries`).
- Fresh reviewer: `/root/plan2_security_assertions_review` using gpt-5.6-sol, high; substitution none.
- Review result: `CHANGES_REQUIRED` solely for one P2 pending-fix-SHA metadata finding. The reviewer approved the code, tests, security semantics, scope, and all focused/full verification gates with no additional finding.
- Finding: the fix-round report and ledger still described the stable correction SHA as pending even though commit `20e1e94e969ee4ca83e672cb5201f3f11d328bca` existed.
- Disposition: 1 addressed, 0 open at the implementer stage by recording the stable fix SHA and exact reviewer provenance/result in the Task 1 report and progress ledger.
- Historical at-authoring scoped metadata review marker: pending. It was fulfilled by `/root/plan2_security_metadata_rereview` reviewing record `606b6ed34e93f16758880941f744f893689521ca` and returning the round 2 result recorded below.
- Gate G1: remains closed until the fresh scoped metadata review accepts this correction. Plan 3 remains blocked and no merge is authorized.

## Security metadata review round 2/5 correction

- Reviewer: `/root/plan2_security_metadata_rereview` using gpt-5.6-sol, high; substitution none.
- Review result: `CHANGES_REQUIRED` with one P2 stale-pending-provenance finding and no code, test, security, scope, or gate finding.
- Finding: the historical pending statements in the final whole-branch fix section and progress ledger contradicted the later stable fix/review provenance.
- Correction: each historical pending statement now explicitly identifies itself as at-authoring history and is superseded by stable fix `20e1e94e969ee4ca83e672cb5201f3f11d328bca` plus security-fix review record `606b6ed34e93f16758880941f744f893689521ca`.
- Disposition: 1 addressed, 0 open at the implementer stage.
- Fresh round 3 scoped metadata review: pending.
- Gate G1 remains closed and Plan 3 remains blocked until that review accepts the correction.
