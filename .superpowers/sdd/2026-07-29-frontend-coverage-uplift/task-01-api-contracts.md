## Task

Task 1: API, query-key, and invalidation contracts

## Status

implemented-awaiting-scoped-re-review

## Requested agent

gpt-5.6-terra, high

## Actual agent

gpt-5.6-terra, high

## Reasoning

Deterministic public API, query-key, and cache-invalidation coverage. Task 0 final commit handoff recorded before Task 1 changes: b9435afa78a6c693b82e0fc151180c1d52194fe6.

## Base SHA

05a426ec944d8305edc621b12497d89a5f20457b

## Starting commit

b9435afa78a6c693b82e0fc151180c1d52194fe6

## RED command and result

`npm run frontend:test:coverage` exited 0 before Task 1 tests: 21 files/89 tests; statements 486/1034 (47.00%), branches 321/729 (44.03%), functions 182/443 (41.08%), lines 477/988 (48.27%). Target rows: books 0/23 statements and 0/12 branches; members 0/30 and 0/12; borrowings 0/27 and 0/15; catalog 0/15 and 0/6; membership types 0/15 and 0/6; mutations 0/5 and 0/8; query keys 5/22 and 4/20.

## GREEN command and result

`npm run test --prefix frontend -- src/lib/api/books.test.ts src/lib/api/members.test.ts src/lib/api/borrowings.test.ts src/lib/api/catalog.test.ts src/lib/api/membership-types.test.ts src/lib/api/mutations.test.ts src/lib/api/query-keys.test.ts` exited 0: 7 files/26 tests. The exact root-level `npm exec --prefix frontend -- vitest ... --coverage ...` form exited 1 because Vitest ran from the repository root and did not load `frontend/vitest.config.ts` (unresolved `@` aliases); adding `--config frontend/vitest.config.ts` still resolved its relative setup file from the root. The same specified Vitest arguments executed from `frontend/` with its existing configuration exited 0: 7 files/26 tests.

## Focused metrics

Frontend-directory focused coverage, with the seven plan includes: statements 137/137 (100.00%), branches 79/79 (100.00%), functions 101/101 (100.00%), lines 124/124 (100.00%). This covers 132 previously uncovered target statements and 75 previously uncovered target branches versus the fresh RED target rows (the current denominator is 137 statements/79 branches, not the plan's stale 142/81).

## Full metrics

Fresh `npm run frontend:test:coverage` exited 0 after Task 1: 28 files/115 tests; statements 618/1034 (59.76%, +132), branches 396/729 (54.32%, +75), functions 279/443 (62.97%, +97), lines 596/988 (60.32%, +119). Both statement and branch totals are above the linear path to 60%; reranking is not required before Task 2.

## Files changed

`frontend/src/lib/api/books.test.ts`, `members.test.ts`, `borrowings.test.ts`, `catalog.test.ts`, `membership-types.test.ts`, `mutations.test.ts`, `query-keys.test.ts`, this report, and `progress.md` only.

## Commit hash

a22e9b90d5ac8da08022ed9d9427b3c6a1786098

## Reviewer

gpt-5.6-terra, high, fresh context, no substitution — functional/spec scope approved; scoped evidence re-review pending

## Reviewer command and result

Fresh reviewer `gpt-5.6-terra`, high, no substitution, reran the equivalent focused frontend-directory coverage command: 7 files/26 tests, 100.00% statements/functions/lines and 94.93% branches before the optional-key review fix; all public API/cache contracts passed and functional/spec scope was approved. The post-fix equivalent focused command recorded above passed at 100.00% for all four metrics.

## Findings

Fresh functional review found P2: `query-keys.test.ts` did not assert both absent/present values for every `query ?? {}` helper; it was resolved before implementation commit `a22e9b90d5ac8da08022ed9d9427b3c6a1786098`. Scoped review then approved functional/spec scope and found one P2 evidence issue: this report still said `ready-to-commit`/`pending fresh review`, and `progress.md` still said `pending commit`, rather than recording the supplied committed head.

## Resolutions

Added real retry-disabled TanStack Query hook coverage and all absent/present optional-key assertions, then reran focused and full coverage successfully before implementation commit `a22e9b90d5ac8da08022ed9d9427b3c6a1786098`. Fix round 1 records that stable implementation SHA, the actual fresh reviewer/model with no substitution, functional/spec approval, equivalent focused-command evidence, and the evidence finding. Final completion remains pending scoped re-review of this metadata-only fix.

## Deferred findings

The literal root-level `--prefix` coverage form cannot resolve the repository's frontend-only Vitest configuration; reproduce the focused coverage command from `frontend/`. No source-contract findings remain.

## Stop/escalation decision

No stop condition: the evidence finding is addressed with a metadata-only commit; do not claim final Task 1 completion until scoped re-review.
