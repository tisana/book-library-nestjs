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
