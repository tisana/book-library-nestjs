# Task 12 report — frontend user-state and accessibility coverage

## Scope delivered

- Added behavior-focused component coverage for shared sign-in retry and invalid-form focus, staff role-management loading/empty/safe error/forbidden states, identifier-conflict retry and stale-data removal, member eligibility/allowance/current-borrowing boundaries, and keyboard-activated table row actions.
- Added browser assertions that tokens do not appear in local or session storage after sign-in or sign-out, and that an assigned role remains reflected in the role selector.
- Preserved the configured desktop, tablet, and mobile Playwright projects.

## Strict TDD evidence

The first focused RED run was:

```powershell
npm run test --prefix frontend -- src/features/auth/shared-login.test.tsx src/features/member-home/member-home.test.tsx
```

It failed as intended on two observable defects:

1. An empty shared-login submission left focus on the submit button instead of an invalid field.
2. `BorrowedBooksList` rendered a returned item inside “Current borrowed books.”

The minimal fixes add required, focused validation to the shared-login inputs and filter returned borrowings before the current-list count/render. The same focused command then passed (13/13).

## Verification

| Command | Result |
| --- | --- |
| `npm run test --prefix frontend -- src/features/auth/shared-login.test.tsx src/features/auth/staff-role-management.test.tsx src/features/auth/identifier-conflicts.test.tsx src/features/member-home/member-home.test.tsx src/components/data-table/data-table.test.tsx` | 5 files, 23/23 passed |
| `npm run frontend:test:coverage` | 18 files, 78/78 passed |
| `npm run quality:report:frontend-unit -- --write-baseline` | passed; frontend-only baseline ratcheted |
| `npm run frontend:test:e2e:report` | 86 passed, 0 failed, 0 flaky, 1 explicit mobile performance skip (87 total) |
| `npm run quality:report:frontend-e2e` | passed |
| `npm run frontend:lint` | passed |
| `npm run frontend:build` | passed |

## Coverage baseline

| Metric | Previous | New |
| --- | ---: | ---: |
| Statements | 40.66% | 40.99% |
| Branches | 37.27% | 38.28% |
| Functions | 33.02% | 33.25% |
| Lines | 41.76% | 42.11% |

## Intended changed files

- `frontend/src/components/data-table/data-table.test.tsx`
- `frontend/src/features/auth/identifier-conflicts.test.tsx`
- `frontend/src/features/auth/shared-login.test.tsx`
- `frontend/src/features/auth/shared-login.tsx`
- `frontend/src/features/auth/staff-role-management.test.tsx`
- `frontend/src/features/member-home/borrowed-books-list.tsx`
- `frontend/src/features/member-home/member-home.test.tsx`
- `frontend/tests/e2e/accessibility.spec.ts`
- `frontend/tests/e2e/shared-sign-in.spec.ts`
- `frontend/tests/e2e/staff-role-management.spec.ts`
- `quality/coverage-baselines.json`

## Commit and concerns

- Planned commit: `test: cover frontend user state transitions`.
- `frontend/public/` was already untracked and intentionally remains untouched and unstaged.
- The explicit Playwright skip is the existing mobile staff performance test; it is reported by the quality stream and has no failures or flakes.

## Fix round 1

- RED: history and retry tests failed because a global returned-item filter hid `MemberBorrowingsRoute` history and its API error state offered no retry. GREEN: `BorrowedBooksList` now defaults to current-only behavior while history explicitly opts out, and the history route refetches from a visible retry action (9/9 focused tests).
- Added a real MSW/query-client staff-role integration test. Its server response changes only after PATCH; the UI proves the invalidated query refetched the changed display name. This exposed and fixed mutation invalidation being coupled to the global client rather than the active provider client.
- Shared-login coverage now proves pending `Signing in`/disabled semantics and that a malformed returned role-area/session mismatch produces a generic error without routing.
- Token-storage browser coverage now checks auth-related key names and JWT-shaped values in both local and session storage after sign-in and sign-out. The focused cross-viewport browser suite passed 12/12.
- Latest full unit coverage: 20 files, 84/84 tests; statements 45.33%, branches 42.40%, functions 38.37%, lines 46.53%. Frontend lint and build passed. Full Playwright rerun remains to be run by the parent task after this handoff.

## Fix round 2

- RED: real-hook IdentifierConflicts tests showed no loading feedback and a successful resolution did not invalidate the active query provider, leaving stale conflicts rendered. GREEN: added the visible loading state and provider-scoped invalidation. MSW integration coverage now proves loading, retryable safe failure, post-resolution stale-conflict removal, successful operation status, manual-repair-only, and forbidden states.
- Focused Task 12 components: 8 files, 32/32 passed.
- Full frontend unit coverage: 21 files, 87/87 passed; statements 46.75%, branches 43.66%, functions 41.08%, lines 48.02%. The frontend-only baseline was ratcheted to these values.
- Full Playwright: 86 passed, 0 failed, 0 flaky, 1 explicit mobile performance skip (87 total); desktop 29/29, tablet 29/29, mobile 28/29 with the documented skip. Frontend E2E quality gate passed. Frontend lint and build passed.

## Fix round 3

- RED: a staff-labelled response carrying only a member payload was normalized as a member and stored before the staff wrapper rejected it; history used a misleading “Current borrowed books” accessible heading; and StaffRoleManagement rendered an empty table during a delayed real query. GREEN: normalization now branches strictly on `roleArea`, history labels itself “Borrowing history”, and staff loading renders a status with no table. Real MSW 5xx coverage verifies safe error redaction.
- The strict response contract required updating stale member browser fixtures to include `roleArea: 'member'`. The first full browser run exposed those fixtures (15 timed-out member logins); their focused rerun passed 18/18, and the final full report passed.
- Focused Task 12 suite: 9 files, 45/45 passed. Full unit coverage: 21 files, 89/89 passed; statements 47.00%, branches 44.03%, functions 41.08%, lines 48.27%. Baseline ratcheted. Lint/build passed.
- Final Playwright: 86 passed, 0 final failures, 0 flaky, 1 explicit mobile performance skip (87 total); desktop 29/29, tablet 29/29, mobile 28/29. Frontend E2E quality passed.
