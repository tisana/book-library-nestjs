# Task 01 review

## Task
Task 1 — Refresh rotation race boundaries and critical builders

## Reviewer model and reasoning
`gpt-5.6-sol`, high; identity `/root/plan3_task1_review`; fresh separate-context final task reviewer; substitution none

## Reviewed commit
`25e37048c05c2b3dd81256d1ab31eb21bad192ec`

## Commands and exits
- Supplied review package `review-e52711c..25e3704.diff`: read-only inspection, exit 0; commit list contains only `25e3704 test: harden refresh rotation races`, and the stat confines implementation changes to the owned ledger, `src/auth/token-session.service.spec.ts`, and `test/support/critical-auth-fixtures.ts`.
- Read-only line-numbered inspection of `test/support/critical-auth-fixtures.ts`, `src/auth/token-session.service.spec.ts`, `task-01-review.md`, and `progress.md`: exit 0.
- Targeted read-only comparison with the five builder schemas, Plan 2 `test/support/backend-coverage-fixtures.ts`, and the relevant `TokenSessionService` rotation/recovery branches: exit 0.
- Implementer RED evidence relied on: exact focused Jest command exited 1 for the missing fixture module, then exited 1 for two unmodeled race outcomes, then exited 1 for the complementary post-CAS uncertainty micro-cycle.
- Implementer GREEN evidence relied on: `npx jest --runInBand auth/token-session.service.spec.ts --coverage --collectCoverageFrom=auth/token-session.service.ts --coverageReporters=text`: exit 0; `25/25` tests; branches `89/103`.
- Implementer focused lint evidence relied on: `npx eslint src/auth/token-session.service.spec.ts test/support/critical-auth-fixtures.ts`: exit 0.
- Implementer full backend regression evidence relied on: `npm run test:cov`: exit 0; `35/35` suites and `386/386` tests.
- Bootstrap evidence relied on: exact Step 0 ledger validation exit 0; `git diff --check` exit 0; Plan 2 handoff and reviewed merge ancestry checks exit 0; bootstrap reviewer `/root/plan3_task1_bootstrap_review` approved with no findings.
- Reviewer test reruns: not-run, because code inspection left no specific doubt unanswered and the supplied focused/full-suite evidence was sufficient under the review method.

## Findings
none

## Resolutions verified
- No final-review finding required resolution; there are no open findings.
- Verified the bootstrap approval preceded spec edits, recorded the exact Plan 2 base `e52711c7f6fd1174f4ff85280152ced174724bfe`, and approved the complete ten-task report/review ledger with future fields left `not-run`.
- Verified all five Plan 5-stable builders return valid deterministic baseline documents, use `Types.ObjectId` for persisted identifiers, use fixed UTC dates, and apply caller overrides last.
- Verified `criticalQueryResult` delegates to Plan 2 `queryResult` and adds only `lean`, `sort`, and `limit`; it does not copy `select`, `session`, or `exec`.
- Verified `createCriticalModelHarnesses` consumes Plan 2 `createStaffDocument`, `createStaffModelHarness`, and `createIdentifierModelHarness`; `deferred` is imported directly into the token-session spec.
- Verified the four required public `rotate` race cases: disappeared duplicate marker, missing lease, lost expired-marker takeover, and uncertain pre-CAS failure with takeover eligibility. The complementary post-CAS uncertainty case is distinct and behavior-focused.
- Verified every denial asserts only the generic `Invalid refresh session` text, hash-only storage remains intact, the pre-CAS uncertain marker remains pending and takeover-eligible, and the post-CAS uncertain marker is finalized before family revocation is observed.
- Verified new assertions cover observable exceptions and family/marker state only; no private method is called or spied on, no unstable UUID/date snapshot is introduced, and no requested case duplicates another branch.
- Verified the focused denominator remains exactly `103` branches and `89` are covered, satisfying the minimum of `88` covered branches.
- Verified no production source, Plan 2 test/helper, coverage denominator/configuration, frontend baseline, e2e behavior, or generated evidence artifact is changed by the reviewed commit.

## Verdict
approved
