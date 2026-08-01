## Task

Task 5 — Router, shared-login, and authorization boundaries

## Status

implementation-complete-review-pending

## Requested agent

gpt-5.6-sol, high

## Actual agent

gpt-5.6-sol, high

## Reasoning

Authorization-sensitive routing and shared sign-in coverage. Task 4 final evidence SHA `232566e11de65a949b5c8aaf670156da2bdcfd9f` was recorded before Task 5 test changes. No model substitution.

## Base SHA

232566e11de65a949b5c8aaf670156da2bdcfd9f

## Starting commit

232566e11de65a949b5c8aaf670156da2bdcfd9f

## RED command and result

`npm run frontend:test:coverage` exited 0 before Task 5 test additions: 37 files/162 tests; statements 787/1034 (76.11%), branches 598/729 (82.03%), functions 325/443 (73.36%), lines 754/988 (76.31%). Exact target rows: `app/router.tsx` 0/11 statements and 0/0 branches; `routes/staff/route.tsx` 0/69 and 0/2; `routes/member/route.tsx` 0/16 and 0/0; `routes/public.tsx` 0/5 and 0/0; `features/auth/shared-login.tsx` 29/30 and 13/14; `lib/api/auth.ts` 56/67 and 34/53; `lib/validation/schemas.ts` 0/11 and 0/0.

## GREEN command and result

`npm run test --prefix frontend -- src/app/router.test.tsx src/routes/staff/route.test.tsx src/routes/member/route.test.tsx src/routes/public.test.tsx src/features/auth/shared-login.test.tsx src/lib/api/auth.test.ts src/lib/validation/schemas.test.ts` exited 0: 7 files/40 tests. Disposable real route trees retain the exact staff/member session guards, all three staff permission boundaries, the member borrowing-detail child, the `/staff/login` shell bypass, and the `/staff/books` shell/outlet. `LoginRoute` submits the exact shared request to strict MSW and routes from the server-returned member role area; shared-login covers staff, member, permission-denied, and payload-mismatch outcomes. Both compatibility components render exact `<Navigate replace to="/login" />` behavior. Direct shared `login` calls preserve generic 401/403/429/500/network categories, memory-only session storage, and the actual schemas enforce their public boundaries. `npm run lint --prefix frontend` also exited 0.

## Focused metrics

Fresh full-coverage target rows: `app/router.tsx` 11/11 statements and 0/0 branches; `routes/staff/route.tsx` 56/69 and 2/2; `routes/member/route.tsx` 12/16 and 0/0; `routes/public.tsx` 5/5 and 0/0; `features/auth/shared-login.tsx` 29/30 and 14/14; `lib/api/auth.ts` 56/67 and 34/53; `lib/validation/schemas.ts` 11/11 and 0/0. The target rows gained 95 statements and 3 branches; all guard branches, both compatibility redirects, the shared-login role/permission branches, and every schema declaration are exercised. This exceeds the planned minimum gain of 80 statements.

## Full metrics

Fresh final `npm run frontend:test:coverage` exited 0: 42 files/182 tests; statements 882/1034 (85.29%, +95), branches 601/729 (82.44%, +3), functions 361/443 (81.48%, +36), lines 848/988 (85.82%, +94). The Task 6 hard statement/branch gates of 60% are already exceeded; Task 6 was not started.

## Files changed

`frontend/src/app/router.test.tsx`, `frontend/src/routes/staff/route.test.tsx`, `frontend/src/routes/member/route.test.tsx`, `frontend/src/routes/public.test.tsx`, `frontend/src/features/auth/shared-login.test.tsx`, `frontend/src/lib/api/auth.test.ts`, `frontend/src/lib/validation/schemas.test.ts`, this report, and append-only `progress.md` only.

## Commit hash

pending implementation commit

## Reviewer

gpt-5.6-sol, high, fresh context, no substitution — pending controller-owned review; implementer will not spawn reviewer

## Reviewer command and result

Pending controller-owned fresh-context review. Per the task dispatch, the implementer did not spawn a reviewer.

## Findings

Self-review found that the initial disposable-router assertions addressed index children through `routesByPath` instead of guarded parent routes through `routesById`; it also found a synchronous empty-state assertion and teardown-time session clearing that could produce noise. The frontend build additionally reports five pre-existing TypeScript errors in out-of-scope Task 2/4 tests: `src/lib/api/borrowings.test.ts`, `src/routes/member/index.test.tsx` (three diagnostics), and `src/routes/staff/borrowings.$borrowingId.test.tsx`. No Task 5 file appears in the build diagnostics.

## Resolutions

The route assertions now address the guarded parents through `routesById`, explicitly inspect redirect destinations, await the real books empty state, and stub unsupported JSDOM scrolling without production mocks. Memory-only assertions cover both local and session storage. Focused tests, full coverage, lint, and `git diff --check` pass. The unrelated baseline TypeScript errors were not changed because production/config/E2E/backend/baseline and non-listed tests are out of scope.

## Deferred findings

The pre-existing frontend build TypeScript errors listed above remain for a later scoped task.

## Stop/escalation decision

Task 5 implementation is complete and stopped before Task 6. Required fresh `gpt-5.6-sol`, high review remains controller-owned and pending; no reviewer was spawned and no model substitution occurred.
