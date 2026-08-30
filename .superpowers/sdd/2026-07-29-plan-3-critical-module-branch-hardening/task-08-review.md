# Task 08 review

## Task
Task 8 — Borrowing return boundary stretch and permission monitor

## Reviewer model and reasoning
`gpt-5.6-sol`, high; separate-context reviewer
`/root/plan3_task8_review`; model substitution none.

## Reviewed commit
`04a5d6d74800be30d6a247011475605d326dc0eb` against base
`6fdd9888fb04bcc089e4fc9681b0f806cb7e0ea5`.

## Commands and exits
- Read the required project plan and Task 8 brief before treating
  `task-08-report.md` as untrusted supporting evidence; exit `0`.
- Read the supplied immutable
  `.superpowers/sdd/2026-07-31-critical-module-branch-hardening/review-6fdd988..04a5d6d.diff`
  exactly once as the primary change view; exit `0`.
- Performed read-only, line-numbered inspection of the changed borrowing spec,
  unchanged public `BorrowingsService.returnBorrowing`, approved shared
  `createBorrowingDocument`, unchanged permission service/spec, and established
  guard cross-spec calls; exit `0`.
- An initial combined focused verification invocation hit the review harness
  timeout after borrowing `22/22` passed and interrupted only Istanbul's text
  reporter with `EPIPE`; its incomplete coverage output was discarded. The two
  exact commands were then rerun independently as recorded below.
- `npx jest --runInBand borrowings/borrowings.service.spec.ts --coverage --collectCoverageFrom=borrowings/borrowings.service.ts --coverageReporters=text`:
  exit `0`; `1/1` suite and `22/22` tests passed; statements `134/141`, branches
  exactly `105/116` (`90.51%`), functions `26/26`, and lines `131/138`.
- `npx jest --runInBand auth/permissions.service.spec.ts --coverage --collectCoverageFrom=auth/permissions.service.ts --coverageReporters=text`:
  exit `0`; `1/1` suite and `11/11` tests passed; permission branches exactly
  `69/74` (`93.24%`), reproducing the implementer diagnosis.
- `npx eslint src/borrowings/borrowings.service.spec.ts --no-fix`: exit `0`.
- No Git command or broad suite was rerun. The frozen implementation diff
  contains no generated output; the fresh full-suite `35/35`, `469/469`, and
  permission `71/74` result remains captured implementation evidence and was
  assessed against the unchanged source and established cross-spec calls.

## Findings
### Spec Compliance

- Critical: none.
- Important: none.
- Minor: none.
- ⚠️ Plan conflict: the brief predicts that the exact isolated permission
  command will remain at least `71/74`, but both implementation and independent
  review runs measure `69/74`. This does not represent a Task 8 regression or an
  open finding: the brief also requires stopping to diagnose any lower result;
  the frozen diff changes neither `src/auth/permissions.service.ts` nor its spec,
  and existing real-service guard calls at
  `src/auth/permissions.guard.spec.ts:55` and
  `src/auth/permissions.guard.spec.ts:89` supply the omitted `roles` and
  `authVersion` default branches. The captured fresh full run therefore restores
  the unchanged planning control exactly at `71/74` (`95.94%`). Task 8 satisfies
  the monitor by detecting and explaining this suite-scope drift while preserving
  the permission no-edit constraint; the literal focused expectation in the
  brief is inaccurate.
- ⚠️ `src/borrowings/borrowings.service.spec.ts:260` exercises public
  `returnBorrowing` from `Overdue`, preserves the exact supplied timestamp,
  increments availability, and proves the zero loan-count clamp. Its missing
  optional `id` assertion independently covers the public `_id` fallback, the
  distinct third LCOV-backed branch needed to reach `105/116` without a third
  scenario.
- ⚠️ `src/borrowings/borrowings.service.spec.ts:283` supplies a non-returned
  `Cancelled` record, requires the exact fixed denial message, proves zero
  borrowing/book/member saves, and requires one session end. Together with the
  pre-existing active-return, duplicate-return, and member-ownership cases, this
  covers the required legal/illegal transition and ownership semantics without
  duplicating them.
- ⚠️ Scope is compliant: the frozen diff contains only
  `src/borrowings/borrowings.service.spec.ts` and Task 8 ledger/report artifacts.
  It contains no production, configuration, baseline, denominator, script, e2e,
  frontend, permission, shared-fixture, or generated-output change.

### Task Quality

- Critical: none.
- Important: none.
- Minor: none.
- ⚠️ The lifecycle fixture extension at
  `src/borrowings/borrowings.service.spec.ts:489` is deterministic and limited to
  an optional existing-borrowing override. It consumes the approved shared
  `createBorrowingDocument` at line `553` and leaves production behavior and the
  shared fixture read-only.
- ⚠️ All new behavior is exercised through the public `returnBorrowing` API.
  Assertions are stateful and meaningful rather than snapshots: exact supplied
  time, availability delta, nonnegative member count, stable response identity,
  exact denial text, no writes, and deterministic transaction cleanup.
- ⚠️ Independent focused verification confirms the exact borrowing denominator
  is unchanged at `116` and the hard gate is met at `105/116`. The isolated
  permission result is transparently recorded rather than padded with a
  low-value permission test, while the full-suite planning control remains
  `71/74` with no permission edit.

## Resolutions verified
No prior review findings existed. Open Critical/Important/Minor findings: `0`;
resolved findings: `0`.

## Verdict
approved
