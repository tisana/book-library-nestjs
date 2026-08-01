## Task

Task 4 — Member home and private detail

## Status

re-review-pending

## Requested agent

gpt-5.6-terra, high

## Actual agent

gpt-5.6-terra, high

## Reasoning

Bounded member home, private borrowing-detail, and self-service API behavior coverage.

## Base SHA

aa0aef8976466d2d5a56c5bbd2e9d7fd938b0127

## Starting commit

aa0aef8976466d2d5a56c5bbd2e9d7fd938b0127

## RED command and result

`npm run frontend:test:coverage` exited 0 before Task 4 test additions: 34 files/142 tests; statements 751/1034 (72.63%), branches 554/729 (75.99%), functions 312/443 (70.42%), lines 719/988 (72.77%). Target rows: `member-self-service.ts` 14/24 statements and 9/15 branches; `index.tsx` 0/14 and 0/27; `borrowings.$borrowingId.tsx` 0/12 and 0/12.

## GREEN command and result

The literal PowerShell form of the prescribed command needs the dollar-sign filename quoted (`'src/routes/member/borrowings.$borrowingId.test.tsx'`); the unquoted form exits before Vitest with an unset-variable error. The quoted focused command exited 0: 4 files/27 tests. It covers member home loading for each source, each safe source error, missing profile/policy, tier precedence, active/suspended state, allowance/empty-state behavior, and current-list returned exclusion; plus private detail loading, safe unavailable copy, title fallback, book dates/statuses, returned date, and active returned-copy absence. The real self-service hooks use strict MSW with retry-disabled QueryClients, exact paths, raw/envelope array normalization, and no request for an empty detail ID.

## Focused metrics

Fresh full-coverage target rows: `member-self-service.ts` 22/24 statements and 13/15 branches; `index.tsx` 14/14 and 26/27; `borrowings.$borrowingId.tsx` 12/12 and 11/12. Combined Task 4 gain is 34/50 target statements and 41/45 target branches, exceeding the planned 30/38 and 32/45 minimums.

## Full metrics

Fresh `npm run frontend:test:coverage` exited 0 after Task 4: 37 files/162 tests; statements 787/1034 (76.11%, +36), branches 598/729 (82.03%, +44), functions 325/443 (73.36%, +13), lines 754/988 (76.31%, +35). Both statement and branch totals are above 58%, so no LCOV rerank or Task 5 report addition is needed.

## Files changed

`frontend/src/routes/member/index.test.tsx`, `borrowings.$borrowingId.test.tsx`, `frontend/src/lib/api/member-self-service.test.ts`, this report, and append-only `progress.md` only.

## Commit hash

a4f4fdedab731c6c7527717c3f9ee14da999ca90

## Reviewer

gpt-5.6-terra, high, fresh context, no substitution — functional approval; metadata fix round 1 requires scoped re-review

## Reviewer command and result

Fresh reviewer approved the functional scope and measured coverage at stable implementation SHA `a4f4fdedab731c6c7527717c3f9ee14da999ca90`: 4 focused files/27 tests passed; full coverage was 787/1034 statements and 598/729 branches; target rows gained 34/50 statements and 41/45 branches. The reviewer found one P2 evidence-metadata issue: the report and ledger still said the commit and reviewer were pending after review.

## Findings

self-review found and corrected a test-fixture responder that returned a function instead of its `Response`, corrected the active due-state expectation from `On time` to the actual route label `Open`, and removed an out-of-scope staff-only-copy assertion. Fresh review found one P2/Important metadata issue: this report and `progress.md` retained stale in-progress/pending commit/reviewer values after the stable implementation review.

## Resolutions

The focused suite and full coverage suite passed cleanly after the fixture and label corrections. Fresh review approved the functional scope and recorded the measured metrics. Fix round 1 updates only the stale Task 4 report and ledger metadata; no production, configuration, storage-token, staff-copy, backend, e2e, or baseline files changed.

## Deferred findings

scoped re-review of this metadata-only fix is required before Task 4 completion

## Stop/escalation decision

No stop condition: functional scope is approved and this metadata-only fix is ready for scoped re-review; Task 4 is not complete until that re-review succeeds.
