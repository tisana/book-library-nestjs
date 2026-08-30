## Task

Task 1: API, query-key, and invalidation contracts

## Status

complete

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

Fix round 2 focused command and output:

```text
> npm run test --prefix frontend -- src/lib/api/borrowings.test.ts

> book-library-frontend@0.0.1 test
> vitest run src/lib/api/borrowings.test.ts

 RUN  v4.1.8 E:/dev/workspaces/nestjs/book-library-nestjs/.worktrees/wave-a-plan1-frontend-coverage/frontend

 ✓ src/lib/api/borrowings.test.ts (5 tests) 178ms

Test Files  1 passed (1)
     Tests  5 passed (5)
  Start at  10:13:43
  Duration  1.53s (transform 75ms, setup 297ms, import 131ms, tests 178ms, environment 752ms)

JSON report written to E:/dev/workspaces/nestjs/book-library-nestjs/.worktrees/wave-a-plan1-frontend-coverage/frontend/test-results/vitest-results.json
Exit code: 0
```

Fix round 2 exact build command and output after the Task 1 correction:

```text
> npm run frontend:build
> book-library@0.0.1 frontend:build
> npm run build --prefix frontend
> book-library-frontend@0.0.1 build
> tsc -p tsconfig.json && tsc -p tsconfig.node.json && vite build

src/routes/member/index.test.tsx(84,72): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'JsonBodyType'.
src/routes/member/index.test.tsx(87,56): error TS2345: Argument of type 'Response | (() => Response | Promise<Response>) | undefined' is not assignable to parameter of type 'Response | (() => Response | Promise<Response>)'.
  Type 'undefined' is not assignable to type 'Response | (() => Response | Promise<Response>)'.
src/routes/member/index.test.tsx(89,15): error TS2345: Argument of type 'Response | (() => Response | Promise<Response>) | undefined' is not assignable to parameter of type 'Response | (() => Response | Promise<Response>)'.
  Type 'undefined' is not assignable to type 'Response | (() => Response | Promise<Response>)'.
src/routes/member/index.test.tsx(92,15): error TS2345: Argument of type 'Response | (() => Response | Promise<Response>) | undefined' is not assignable to parameter of type 'Response | (() => Response | Promise<Response>)'.
  Type 'undefined' is not assignable to type 'Response | (() => Response | Promise<Response>)'.
src/routes/staff/borrowings.$borrowingId.test.tsx(81,44): error TS2353: Object literal may only specify known properties, and 'returnedAt' does not exist in type '{ id: string; memberId: string; memberDisplayName: string; memberNumber: string; bookId: string; bookTitle: string; bookCatalogIdentifier: string; bookCategoryId: string; borrowedAt: string; dueAt: string; status: string; borrowedByStaffId: string; }'.
Exit code: 1
```

The authoritative Task 1 diagnostic `src/lib/api/borrowings.test.ts(56,42): error TS2554: Expected 1-2 arguments, but got 0.` is absent after the correction. The remaining diagnostics are owned by Task 3/4 and were not changed.

## Focused metrics

Frontend-directory focused coverage, with the seven plan includes: statements 137/137 (100.00%), branches 79/79 (100.00%), functions 101/101 (100.00%), lines 124/124 (100.00%). This covers 132 previously uncovered target statements and 75 previously uncovered target branches versus the fresh RED target rows (the current denominator is 137 statements/79 branches, not the plan's stale 142/81).

## Full metrics

Fresh `npm run frontend:test:coverage` exited 0 after Task 1: 28 files/115 tests; statements 618/1034 (59.76%, +132), branches 396/729 (54.32%, +75), functions 279/443 (62.97%, +97), lines 596/988 (60.32%, +119). Both statement and branch totals are above the linear path to 60%; reranking is not required before Task 2.

## Files changed

Original Task 1: `frontend/src/lib/api/books.test.ts`, `members.test.ts`, `borrowings.test.ts`, `catalog.test.ts`, `membership-types.test.ts`, `mutations.test.ts`, `query-keys.test.ts`, this report, and `progress.md`. Fix round 2 changes only `frontend/src/lib/api/borrowings.test.ts`, this report, and `progress.md`.

## Commit hash

Implementation: a22e9b90d5ac8da08022ed9d9427b3c6a1786098. Reviewed repair: 73444ec111ff86dfe681059a8d52e1641c11165f.

## Reviewer

`/root/plan1_task1_repair_review` (`gpt-5.6-terra`, high, fresh context, no substitution) — APPROVED fix round 2 with 0 findings

## Reviewer command and result

Fresh reviewer `gpt-5.6-terra`, high, no substitution, reran the equivalent focused frontend-directory coverage command: 7 files/26 tests, 100.00% statements/functions/lines and 94.93% branches before the optional-key review fix; all public API/cache contracts passed and functional/spec scope was approved. The post-fix equivalent focused command recorded above passed at 100.00% for all four metrics. Scoped re-review covered the reviewed implementation+fix range `b9435af..c5ff5d2`, confirmed the evidence finding addressed with no new breakage, and approved Task 1. Fix round 2 reviewer `/root/plan1_task1_repair_review` (`gpt-5.6-terra`, high, fresh context, no substitution) freshly reviewed stable repair commit `73444ec111ff86dfe681059a8d52e1641c11165f` and returned APPROVED with no findings: the focused borrowing API suite passed 5/5 and the Task 1 `TS2554` diagnostic was absent.

## Findings

Fresh functional review found P2: `query-keys.test.ts` did not assert both absent/present values for every `query ?? {}` helper; it was resolved before implementation commit `a22e9b90d5ac8da08022ed9d9427b3c6a1786098`. Scoped review then approved functional/spec scope and found one P2 evidence issue: this report still said `ready-to-commit`/`pending fresh review`, and `progress.md` still said `pending commit`, rather than recording the supplied committed head.

Fix round 2 found a load-bearing integration TypeScript error at `borrowings.test.ts:56`: TanStack Query's `mutateAsync` type requires a variables argument even though the hook mutation function defaults its input to `{}`. The direct API contract test independently calls `returnBorrowing('borrowing-1')` and asserts the exact `{}` request body.

Fix round 2 fresh review returned 0 findings; no Task 1 repair issue remains open.

## Resolutions

Added real retry-disabled TanStack Query hook coverage and all absent/present optional-key assertions, then reran focused and full coverage successfully before implementation commit `a22e9b90d5ac8da08022ed9d9427b3c6a1786098`. Fix round 1 records that stable implementation SHA, the actual fresh reviewer/model with no substitution, functional/spec approval, equivalent focused-command evidence, and the evidence finding. Scoped re-review approved the reviewed implementation+fix range with no new breakage.

Fix round 2 passes an explicit typed empty input to `mutateAsync({})`, preserving the hook request behavior while the direct API test continues to prove the default argument serializes exactly `{}`. The focused test passes, and the exact build no longer reports any Task 1 diagnostic.

Stable repair commit `73444ec111ff86dfe681059a8d52e1641c11165f` was freshly reviewed and approved with no findings; Task 1 repair is complete.

## Deferred findings

The literal root-level `--prefix` coverage form cannot resolve the repository's frontend-only Vitest configuration; reproduce the focused coverage command from `frontend/`. No source-contract findings remain.

## Stop/escalation decision

Task 1 fix round 2 is complete after fresh approval of stable repair commit `73444ec111ff86dfe681059a8d52e1641c11165f`; 0 findings remain open.
