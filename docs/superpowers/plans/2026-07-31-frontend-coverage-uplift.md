
# Frontend Coverage Uplift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` task-by-task.

**Goal:** Raise independent frontend Vitest statements and branches to >=60.00%, with no metric decrease or denominator change; leave a quantified behavior-ranked backlog to 75%.

**Architecture:** Add MSW/Vitest behavior tests at API, cache mutation, route, and screen seams. Fresh full-source Vitest output is the only ratchet evidence. Backend coverage and Playwright result counts remain separate.

**Tech Stack:** TypeScript 5.9.3, React 19.2.7, TanStack Query 5.101.0, TanStack Router 1.170.15, Vitest/V8 4.1.8, Testing Library, MSW, Playwright 1.60.0.

## Global Constraints

- The executing worktree determines its immutable base in Task 0; do not rely on a historical branch-cleanliness claim.
- Keep current coverage eligibility: every production TS/TSX file in `frontend/src`, excluding test/support/declaration/bootstrap/generated sources. Never change config, baseline, threshold, expected-file count, or denominator to pass.
- Keep backend Jest coverage/e2e, frontend Vitest coverage, frontend Playwright results separate. Never present combined coverage.
- Assert roles/text, method/path/body, invalidation keys, and navigation—not private state or execution-only calls. Use fresh retry-disabled QueryClients and strict MSW.
- Server owns role/permissions; tokens memory-only; generic login failures remain generic. Do not change Playwright tests: Plan 4 owns performance.
- Use isolated worktrees; every implementation/review uses a separate agent context.

## Evidence, Dependency, Files

Baseline frontend: statements 47.00, branches 44.03, functions 41.08, lines 48.27. Inspected stale producer: 484/1034 statements (46.80%) and 317/729 branches (43.48%). Regenerate first; checked-in baseline gates until final ratchet. Target 60% needs >=621 statements (+137) and >=438 branches (+121).

| Rank | Areas (uncovered capacity) | User behavior |
| --- | --- | --- |
| 1 | API books/members/borrowings/catalog/membership/mutations/query keys (142 statements/81 branches) | exact path/query/body, array envelopes, invalidation |
| 2 | new borrowing + staff dashboard (68/83) | loading/error, six blockers, mutation, summaries |
| 3 | staff books/book-detail/member-detail/borrowing-detail (68/81) | search/create, fallback/history, return |
| 4 | member home/private detail/self-service (38/45) | profile/policy states, tier/quota, owned detail |
| 5 | route trees/router/public/legacy/schema (120+/4+) | guards, shell exception, role routing, validation |

- **Required predecessor:** `docs/superpowers/plans/2026-07-26-test-coverage-reporting.md`; consume unchanged `frontend:test:coverage`, `quality:report:frontend-unit`, `quality:report:frontend-e2e`, LCOV, changed-line interfaces.
- **Parallel:** Plan 2 in another worktree and Plan 4 may start independently. **Merge sequentially:** Plans 1 and 4; run frontend unit/e2e reports after each.
- **Shared conflicts:** `quality/coverage-baselines.json`, generated coverage/results. Resolve only from fresh merged coverage.
- **Owned:** listed tests; frontend baseline object only; conditional `frontend/src/test/setup.ts` or mocks only where local MSW cannot express fixture.
- **Prohibited:** coverage/package config, root quality scripts/workflows, backend, README, e2e tests, generated outputs.
- **Ledger/reports:** `.superpowers/sdd/2026-07-29-frontend-coverage-uplift/progress.md`, immutable `.superpowers/sdd/2026-07-29-frontend-coverage-uplift/base.sha`, and `task-00-bootstrap.md` through `task-06-final-ratchet.md`.

## Model Policy

Record requested/actual model, reasoning, and equal-or-greater substitute in ledger before work. No authorization/cache/whole-plan review below sol capability.

| Phase | Recommended agent | Required reviewer | Reason |
| --- | --- | --- | --- |
| Evidence bootstrap | `gpt-5.6-terra`, medium | `gpt-5.6-terra`, high | deterministic repository/report inventory |
| API/query/mutation | `gpt-5.6-terra`, high | `gpt-5.6-terra`, high | behavior-test work |
| Staff/member UI | `gpt-5.6-terra`, high | `gpt-5.6-terra`, high | focused MSW states |
| Router/auth | `gpt-5.6-sol`, high | `gpt-5.6-sol`, high | authorization boundary |
| Ratchet/review | `gpt-5.6-sol`, high | `gpt-5.6-sol`, high | baseline/integration |

Every task report includes RED/GREEN output, metrics, files, commit, concerns, reviewer findings/resolution. Fresh reviewer reruns focused command before dependent work.

Use these exact deterministic fixtures in the task snippets that reference them; copy only the objects needed by that test file:

```ts
const book = { id: 'book-1', catalogIdentifier: 'BK-001', title: 'Refactoring', author: 'Martin Fowler', categoryId: 'category-1', totalQuantity: 2, availableQuantity: 1, status: 'active' };
const availableBook = book;
const activeMember = { id: 'member-1', memberNumber: 'M-1001', fullName: 'Jane Reader', email: 'jane@example.test', status: 'active', membershipTypeId: 'tier-1', activeLoanCount: 0 };
const eligiblePolicy = { memberId: 'member-1', membershipStatus: 'active', activeLoanCount: 0, maxActiveLoans: 3, remainingAllowance: 3, eligibleByStatus: true, limitReached: false };
const borrowing = { id: 'borrowing-1', memberId: 'member-1', bookId: 'book-1', bookTitle: 'Refactoring', borrowedAt: '2026-06-01T00:00:00.000Z', dueAt: '2026-06-15T00:00:00.000Z', status: 'active', borrowedByStaffId: 'staff-1' };
const createdBorrowing = borrowing;
const returnedBorrowing = { ...borrowing, status: 'returned', returnedAt: '2026-06-10T00:00:00.000Z' };
const memberAuthResponse = { accessToken: 'member-token', tokenType: 'Bearer', expiresIn: 900, scope: 'member:self:read', permissions: ['member:self:read'], roleArea: 'member', member: { id: 'member-1', memberNumber: 'M-1001', displayName: 'Jane Reader', membershipStatus: 'active', permissions: ['member:self:read'] } };
```

### Task 0: Freeze execution base and create the SDD evidence contract

**Recommended agent:** `gpt-5.6-terra`, medium — deterministic repository and report inventory.

**Required reviewer:** `gpt-5.6-terra`, high, fresh context — confirm the base and all mandatory evidence fields before implementation.

**Files:** Create `.superpowers/sdd/2026-07-29-frontend-coverage-uplift/base.sha`, `progress.md`, and reports `task-00-bootstrap.md` through `task-06-final-ratchet.md`.

**Interfaces:** produces a one-line full SHA consumed by every changed-line command and seven reports with exact headings: `Task`, `Status`, `Requested agent`, `Actual agent`, `Reasoning`, `Base SHA`, `Starting commit`, `RED command and result`, `GREEN command and result`, `Focused metrics`, `Full metrics`, `Files changed`, `Commit hash`, `Reviewer`, `Reviewer command and result`, `Findings`, `Resolutions`, `Deferred findings`, `Stop/escalation decision`.

- [ ] **Step 1: Verify a fresh clean execution state**

```powershell
$status = git status --porcelain=v1
if ($LASTEXITCODE -ne 0 -or $status) { throw "frontend-coverage-uplift-requires-clean-worktree`n$status" }
$base = git rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $base -notmatch '^[0-9a-f]{40}$') { throw 'invalid-base-sha' }
```

Expected: no status lines and one 40-character SHA. Any pre-existing change stops Task 0; do not stash, reset, or overwrite it.

- [ ] **Step 2: Create the immutable base and exact report templates**

Create `base.sha` containing only `$base` plus a newline. Create `progress.md` with columns `Task | Status | Requested agent | Actual agent | Reasoning | Starting commit | Commit | Reviewer | Findings resolved`. Create each report with the exact headings in **Interfaces** and status `not-started`; Task 0 fills its own command results, all other evidence fields remain the literal value `not-run` until that task executes.

```powershell
$recorded = (Get-Content -Raw .superpowers/sdd/2026-07-29-frontend-coverage-uplift/base.sha).Trim()
if ($recorded -ne $base) { throw 'base-sha-mismatch' }
$reports = Get-ChildItem .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-*.md
if ($reports.Count -ne 7) { throw "expected-7-task-reports-found-$($reports.Count)" }
```

Expected: exact SHA match and seven reports.

- [ ] **Step 3: Fresh review and commit**

The reviewer does not rerun Step 1's pristine-worktree assertion after the
ledger files exist. Instead, in a fresh context it verifies that `HEAD` still
equals the recorded base and that the only status entries are the nine expected
ledger files:

```powershell
$ledgerRoot = '.superpowers/sdd/2026-07-29-frontend-coverage-uplift'
$recorded = (Get-Content -Raw "$ledgerRoot/base.sha").Trim()
$head = (git rev-parse HEAD).Trim()
if ($recorded -notmatch '^[0-9a-f]{40}$' -or $head -ne $recorded) { throw 'bootstrap-base-or-head-mismatch' }
$expectedStatus = @(
  "?? $ledgerRoot/base.sha",
  "?? $ledgerRoot/progress.md",
  "?? $ledgerRoot/task-00-bootstrap.md",
  "?? $ledgerRoot/task-01-api-contracts.md",
  "?? $ledgerRoot/task-02-staff-console.md",
  "?? $ledgerRoot/task-03-staff-details.md",
  "?? $ledgerRoot/task-04-member-workflows.md",
  "?? $ledgerRoot/task-05-routing-auth.md",
  "?? $ledgerRoot/task-06-final-ratchet.md"
) | Sort-Object
$actualStatus = @(git status --porcelain=v1 --untracked-files=all -- $ledgerRoot) | Sort-Object
$unexpected = @(Compare-Object $expectedStatus $actualStatus)
if ($unexpected.Count -ne 0) { throw "unexpected-bootstrap-status`n$($unexpected | Out-String)" }
$requiredHeadings = @('Task','Status','Requested agent','Actual agent','Reasoning','Base SHA','Starting commit','RED command and result','GREEN command and result','Focused metrics','Full metrics','Files changed','Commit hash','Reviewer','Reviewer command and result','Findings','Resolutions','Deferred findings','Stop/escalation decision')
foreach ($report in Get-ChildItem "$ledgerRoot/task-*.md") {
  $body = Get-Content -Raw $report.FullName
  foreach ($heading in $requiredHeadings) {
    if ($body -notmatch "(?m)^## $([regex]::Escape($heading))$") { throw "missing-$heading-in-$($report.Name)" }
  }
}
```

Expected: exact base/HEAD match, exactly the nine allowed new files, and every
mandatory heading present. The reviewer then runs:

```powershell
git add .superpowers/sdd/2026-07-29-frontend-coverage-uplift/base.sha .superpowers/sdd/2026-07-29-frontend-coverage-uplift/progress.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-00-bootstrap.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-01-api-contracts.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-02-staff-console.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-03-staff-details.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-04-member-workflows.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-05-routing-auth.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-06-final-ratchet.md
git commit -m "chore: initialize frontend coverage evidence"
```

### Task 1: API, query-key, and invalidation contracts

**Recommended agent:** `gpt-5.6-terra`, high — deterministic behavior tests.

**Required reviewer:** `gpt-5.6-terra`, high, fresh context — verify public contracts, not query internals.

**Files:** Create `frontend/src/lib/api/books.test.ts`, `members.test.ts`, `borrowings.test.ts`, `catalog.test.ts`, `membership-types.test.ts`, `mutations.test.ts`, `query-keys.test.ts`. Read matching sources/types. Report `task-01-api-contracts.md`. Member self-service belongs only to Task 4.

**Interfaces:** consume staff API list/detail/create/update functions, `queryKeys`, exported `invalidate*Mutation`. Produce `T[] | { items: T[] }` normalization and exact invalidation behavior.

- [ ] **Step 1: RED**

```powershell
npm run frontend:test:coverage
Get-Content frontend/coverage/coverage-summary.json
```

Expected: exit 0; target rows low/zero; record exact metrics.

- [ ] **Step 2: Exact API/envelope tests**

```ts
import { http, HttpResponse } from 'msw';
import { afterEach, expect, it, vi } from 'vitest';
import { apiBaseUrl as API_BASE_URL } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { listBorrowings } from './borrowings';

afterEach(() => vi.restoreAllMocks());
it('serializes filtered borrowings and unwraps items', async () => {
  server.use(http.get(API_BASE_URL + '/borrowings', ({ request }) => {
    expect(new URL(request.url).search).toBe('?status=active&page=2&limit=20');
    return HttpResponse.json({ items: [borrowing] });
  }));
  await expect(listBorrowings({ status: 'active', page: 2, limit: 20 })).resolves.toEqual([borrowing]);
});
```

Also test raw-array books; exact detail/policy/history paths; every create/update body; overdue endpoint; default `returnBorrowing('borrowing-1')` sends `{}`.

- [ ] **Step 3: Exact key tests**

```ts
await invalidateBookMutation();
expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['staff', 'books'] });
expect(queryKeys.staff.overdueBorrowings({ limit: 10 }))
  .toEqual(['staff', 'borrowings', 'overdue', { limit: 10 }]);
```

Spy on `queryClient.invalidateQueries`; cover absent/present optional IDs and
the implemented borrowing invalidations: staff books/borrowings, borrowing ID,
policy ID, member-history ID, and `['member']`.

- [ ] **Step 4: GREEN**

```powershell
npm run test --prefix frontend -- src/lib/api/books.test.ts src/lib/api/members.test.ts src/lib/api/borrowings.test.ts src/lib/api/catalog.test.ts src/lib/api/membership-types.test.ts src/lib/api/mutations.test.ts src/lib/api/query-keys.test.ts
```

Expected: exit 0; strict MSW; all path/body/envelope/key assertions pass.

```powershell
npm exec --prefix frontend -- vitest run src/lib/api/books.test.ts src/lib/api/members.test.ts src/lib/api/borrowings.test.ts src/lib/api/catalog.test.ts src/lib/api/membership-types.test.ts src/lib/api/mutations.test.ts src/lib/api/query-keys.test.ts --coverage --coverage.include=src/lib/api/books.ts --coverage.include=src/lib/api/members.ts --coverage.include=src/lib/api/borrowings.ts --coverage.include=src/lib/api/catalog.ts --coverage.include=src/lib/api/membership-types.ts --coverage.include=src/lib/api/mutations.ts --coverage.include=src/lib/api/query-keys.ts
```

Expected task gain: at least 120/142 previously uncovered statements and 65/81 branches. Run full coverage afterward; if cumulative statements or branches are >4 percentage points below the linear path to 60%, rerank remaining LCOV by uncovered branches before Task 2 and record the new order without changing ownership.

- [ ] **Step 5: Review/commit**

Fresh reviewer reruns Step 4, rejects broad cache assertions/missing optional variants; resolve/report then:

```powershell
git add frontend/src/lib/api/books.test.ts frontend/src/lib/api/members.test.ts frontend/src/lib/api/borrowings.test.ts frontend/src/lib/api/catalog.test.ts frontend/src/lib/api/membership-types.test.ts frontend/src/lib/api/mutations.test.ts frontend/src/lib/api/query-keys.test.ts .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-01-api-contracts.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/progress.md
git commit -m "test: cover frontend API cache contracts"
```

### Task 2: Staff dashboard and borrowing console

**Recommended agent:** `gpt-5.6-terra`, high — bounded UI behavior tests.

**Required reviewer:** `gpt-5.6-terra`, high, fresh context — ensure six separate source blockers.

**Files:** Create `frontend/src/features/staff-dashboard/staff-dashboard.test.tsx`, `frontend/src/routes/staff/borrowings.new.test.tsx`; read `staff-dashboard.tsx:17-133`, `borrowings.new.tsx:11-134`; report `task-02-staff-console.md`.

**Interfaces:** existing GET books/members/borrowings/overdue/policy and POST borrowing hooks. Produces dashboard/loading/error and eligibility/mutation evidence.

- [ ] **Step 1: RED**

```powershell
npm run frontend:test:coverage
Select-String frontend/coverage/coverage-summary.json -Pattern 'borrowings.new.tsx|staff-dashboard.tsx'
```

Expected: the two target source entries exist; record their exact
covered/total statement and branch counts, including zero covered counts.

- [ ] **Step 2: Dashboard and console cases**

Dashboard fixtures: unavailable/inactive books, member count 3, six overdue/recent records. Assert summary 2/1/6, five attention items, `New borrowing` route, loading/error/empty. Console independently asserts `Member is suspended`, `Member is inactive`, `Quota reached`, `Book is inactive`, `Book has no available copies`, `Member has overdue borrowings`. Clear state asserts `Eligible to borrow`, enabled submit, exact POST `{ memberId: 'member-1', bookId: 'book-1' }`, `Borrowing recorded`; 409 safe error/no notice; loading/unavailable.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { StaffNewBorrowingRoute } from './borrowings.new';

function renderRoute(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { user: userEvent.setup(), ...render(<QueryClientProvider client={client}>{node}</QueryClientProvider>) };
}
afterEach(() => vi.restoreAllMocks());
it('submits an eligible borrowing with the exact public request', async () => {
  server.use(
    http.get(`${apiBaseUrl}/members`, () => HttpResponse.json([activeMember])),
    http.get(`${apiBaseUrl}/books`, () => HttpResponse.json([availableBook])),
    http.get(`${apiBaseUrl}/borrowings/overdue`, () => HttpResponse.json([])),
    http.get(`${apiBaseUrl}/members/member-1/policy-status`, () => HttpResponse.json(eligiblePolicy)),
    http.post(`${apiBaseUrl}/borrowings`, async ({ request }) => {
      expect(await request.json()).toEqual({ memberId: 'member-1', bookId: 'book-1' });
      return HttpResponse.json(createdBorrowing, { status: 201 });
    }),
  );
  const { user } = renderRoute(<StaffNewBorrowingRoute />);
  await user.selectOptions(await screen.findByLabelText('Member'), 'member-1');
  await user.selectOptions(screen.getByLabelText('Book'), 'book-1');
  await user.click(screen.getByRole('button', { name: 'Record borrowing' }));
  expect(await screen.findByText('Borrowing recorded')).toBeInTheDocument();
});
```

- [ ] **Step 3: GREEN**

```powershell
npm run test --prefix frontend -- src/features/staff-dashboard/staff-dashboard.test.tsx src/routes/staff/borrowings.new.test.tsx
```

Expected: exit 0; all states pass.

Expected Task 2 gain: at least 55/68 currently uncovered statements and 60/83 branches. Run full coverage; if either global metric is >3 percentage points below the linear path to 60%, rerank remaining files by uncovered branches in the task report.

- [ ] **Step 4: Review/commit**

Reviewer verifies branches `borrowings.new.tsx:25-36`; resolve/report:

```powershell
git add frontend/src/features/staff-dashboard/staff-dashboard.test.tsx frontend/src/routes/staff/borrowings.new.test.tsx .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-02-staff-console.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/progress.md
git commit -m "test: cover staff dashboard and borrowing console"
```

### Task 3: Staff detail workflows

**Recommended agent:** `gpt-5.6-terra`, high — route behavior tests.

**Required reviewer:** `gpt-5.6-terra`, high, fresh context — confirm safe observable form/return behavior.

**Files:** Create `frontend/src/routes/staff/books.test.tsx`, `books.$bookId.test.tsx`, `members.$memberId.test.tsx`, `borrowings.$borrowingId.test.tsx`; read anchors `books.tsx:20-118`, `books.$bookId.tsx:44-108`, `members.$memberId.tsx:11-99`, `borrowings.$borrowingId.tsx:16-118`; report `task-03-staff-details.md`.

**Interfaces:** real hooks/MSW; mock `useParams` to book/member/borrowing IDs. Produces search/create/fallback/history/return evidence.

- [ ] **Step 1: RED**

```powershell
npm run frontend:test:coverage
Select-String frontend/coverage/coverage-summary.json -Pattern 'routes\\staff\\books.tsx|books.\$bookId.tsx|members.\$memberId.tsx|borrowings.\$borrowingId.tsx'
```

Expected: all four target source entries exist; record each exact
covered/total statement and branch count.

- [ ] **Step 2: Cases and GREEN**

Assert books empty/search, add success `Book saved`/close and 409; detail loading/not-found, `Unknown author`, `Not recorded`, zero availability/image fallback; member loading/not-found/no-email/policy `Unknown`/quota/history error; return loading/not-found/`Not returned`/confirm/success/409/returned disabled zero POST. Run:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';
import { StaffBookDetailRoute } from './books.$bookId';

function renderRoute(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

vi.mock('@tanstack/react-router', async () => ({
  ...await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router'),
  useParams: () => ({ bookId: 'book-1', memberId: 'member-1', borrowingId: 'borrowing-1' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/detail">{children}</a>,
}));
afterEach(() => vi.restoreAllMocks());
it('shows the accessible fallback when a cover fails', async () => {
  server.use(http.get(`${apiBaseUrl}/books/book-1`, () => HttpResponse.json({ ...book, title: 'Refactoring', coverImageUrl: '/cover.jpg', availableQuantity: 0 })));
  renderRoute(<StaffBookDetailRoute />);
  const cover = await screen.findByRole('img', { name: 'Cover thumbnail for Refactoring' });
  fireEvent.error(cover);
  expect(screen.getByRole('img', { name: 'No cover thumbnail recorded for Refactoring' })).toBeInTheDocument();
});
```

```powershell
npm run test --prefix frontend -- src/routes/staff/books.test.tsx src/routes/staff/books.$bookId.test.tsx src/routes/staff/members.$memberId.test.tsx src/routes/staff/borrowings.$borrowingId.test.tsx
```

Expected: exit 0, accessible controls and strict MSW.

Expected Task 3 gain: at least 50/68 statements and 55/81 branches. Run full coverage; record actual delta and rerank Task 4/5 if the cumulative target path differs by >2 percentage points.

- [ ] **Step 3: Review/commit**

Reviewer checks return lockout/image accessible fallback; resolve/report:

```powershell
git add frontend/src/routes/staff/books.test.tsx frontend/src/routes/staff/books.$bookId.test.tsx frontend/src/routes/staff/members.$memberId.test.tsx frontend/src/routes/staff/borrowings.$borrowingId.test.tsx .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-03-staff-details.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/progress.md
git commit -m "test: cover staff detail workflows"
```

### Task 4: Member home and private detail

**Recommended agent:** `gpt-5.6-terra`, high — member behavior tests.

**Required reviewer:** `gpt-5.6-terra`, high, fresh context — verify returned exclusion/safe copy.

**Files:** Create `frontend/src/routes/member/index.test.tsx`, `frontend/src/routes/member/borrowings.$borrowingId.test.tsx`, `frontend/src/lib/api/member-self-service.test.ts`; modify `frontend/src/features/member-home/member-home.test.tsx` only if its existing fixtures are reused and changed; report `task-04-member-workflows.md`.

**Interfaces:** profile/policy/borrowings hooks and `useParams`. Produces home state, tier/quota, active-list, private-detail tests.

- [ ] **Step 1: RED**

```powershell
npm run frontend:test:coverage
Select-String frontend/coverage/coverage-summary.json -Pattern 'routes\\member\\index.tsx|borrowings.\$borrowingId.tsx|member-self-service.ts'
```

Expected: all three target source entries exist; record each exact
covered/total statement and branch count.

- [ ] **Step 2: Cases and GREEN**

Assert member loading, every source error, missing profile/policy, tier name/code/id precedence, active/suspended badge, eligibility allowance, empty state; overdue active present/returned absent. Private detail uses real hook/MSW for loading/not-found/title/book/due/status/safe error.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, it, vi } from 'vitest';
import { apiBaseUrl } from '@/lib/api/client';
import { formatLocalDate } from '@/lib/dates/due-status';
import { server } from '@/test/mocks/server';
import { MemberBorrowingDetailRoute } from './borrowings.$borrowingId';

function renderWithClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

vi.mock('@tanstack/react-router', async () => ({
  ...await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router'),
  useParams: () => ({ borrowingId: 'borrowing-1' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/member/borrowings">{children}</a>,
}));
afterEach(() => vi.restoreAllMocks());
it('shows the returned state and returned date', async () => {
  server.use(http.get(`${apiBaseUrl}/members/me/borrowings/borrowing-1`, () => HttpResponse.json(returnedBorrowing)));
  renderWithClient(<MemberBorrowingDetailRoute />);
  expect(await screen.findByText('Returned')).toBeInTheDocument();
  expect(screen.getByText(formatLocalDate(returnedBorrowing.returnedAt!))).toBeInTheDocument();
});
```

For an active borrowing assert `queryByText('Returned')` is absent. Do not assert `Not returned` in member detail; that copy exists only in the staff detail. In `member-self-service.test.ts`, assert exact paths `/members/me`, `/members/me/policy-status`, `/members/me/borrowings?currentOnly=true&limit=10`, and `/members/me/borrowings/borrowing-1`, plus array/envelope normalization and disabled empty detail ID.

```powershell
npm run test --prefix frontend -- src/routes/member/index.test.tsx src/routes/member/borrowings.$borrowingId.test.tsx src/features/member-home/member-home.test.tsx src/lib/api/member-self-service.test.ts
```

Expected: exit 0; no storage token.

Expected Task 4 gain: at least 30/38 statements and 32/45 branches.

Run full coverage after Task 4. If either global metric remains below 58%, rerank the current LCOV by uncovered branches and add the highest user-visible owned route to Task 5's report before implementation; do not change exclusions or borrow Plan 4 files.

- [ ] **Step 3: Review/commit**

Reviewer reruns/safe-copy check; resolve/report:

```powershell
git add frontend/src/routes/member/index.test.tsx frontend/src/routes/member/borrowings.$borrowingId.test.tsx frontend/src/lib/api/member-self-service.test.ts .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-04-member-workflows.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/progress.md
git commit -m "test: cover member home and detail states"
```

If and only if `frontend/src/features/member-home/member-home.test.tsx` changed, add that exact file before committing.

### Task 5: Router, shared-login, and authorization boundaries

**Recommended agent:** `gpt-5.6-sol`, high — authorization-sensitive routing.

**Required reviewer:** `gpt-5.6-sol`, high, fresh context — compare real guards/no client-selected protected area.

**Files:** Create `frontend/src/app/router.test.tsx`, `frontend/src/routes/staff/route.test.tsx`, `frontend/src/routes/member/route.test.tsx`, `frontend/src/routes/public.test.tsx`, `frontend/src/lib/validation/schemas.test.ts`; modify `frontend/src/features/auth/shared-login.test.tsx` and `frontend/src/lib/api/auth.test.ts`; read actual router/public/guards/shared-login/auth/schema sources; report `task-05-routing-auth.md`. Do not create tests for unused `StaffLogin` or `MemberLogin` components.

**Interfaces:** `createStaffRoutes`, `createMemberRoutes`, `router`, `PublicHome`, `LoginRoute` (renders `SharedLogin`), `StaffLoginRoute` and `MemberLoginPlaceholderRoute` (both `<Navigate replace to="/login" />`), shared `login`, `requireStaffSession`, `requireMemberSession`, permission guards, schemas.

- [ ] **Step 1: RED**

```powershell
npm run frontend:test:coverage
Select-String frontend/coverage/coverage-summary.json -Pattern 'app\\router.tsx|routes\\staff\\route.tsx|routes\\member\\route.tsx|routes\\public.tsx|shared-login.tsx|api\\auth.ts|schemas.ts'
```

Expected: all target source entries exist; record each exact covered/total
statement and branch count plus the real route guards.

- [ ] **Step 2: Cases and GREEN**

Build disposable route trees; assert exact real staff/member `beforeLoad`, retained staff permission guards, member detail child. Match `/staff/login` without shell navigation and `/staff/books` with shell/outlet. Render `LoginRoute` and interact with its `SharedLogin`: type `M-1001` and `Password#2026`, MSW `POST ${apiBaseUrl}/auth/login`, assert member navigation; repeat staff/unauthorized/mismatch cases already shaped in `shared-login.test.tsx`. In `public.test.tsx`, mock only `Link` and `Navigate`, assert both compatibility routes call Navigate with `replace` and `to="/login"`. Extend `auth.test.ts` for exact `/auth/login` generic 401/403/429/500/network behavior. Test actual schemas separately.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoginRoute, MemberLoginPlaceholderRoute, StaffLoginRoute } from './public';
import { apiBaseUrl } from '@/lib/api/client';
import { server } from '@/test/mocks/server';

const navigateMock = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-router', async () => ({
  ...await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router'),
  useNavigate: () => navigateMock,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/login">{children}</a>,
  Navigate: (props: { replace: boolean; to: string }) => <output data-replace={String(props.replace)}>{props.to}</output>,
}));
beforeEach(() => navigateMock.mockReset());
afterEach(() => vi.restoreAllMocks());
it('routes a member from the server-returned role area', async () => {
  server.use(http.post(`${apiBaseUrl}/auth/login`, () => HttpResponse.json(memberAuthResponse)));
  render(<LoginRoute />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email or login identifier/i), 'M-1001');
  await user.type(screen.getByLabelText(/password/i), 'Password#2026');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(navigateMock).toHaveBeenCalledWith({ to: '/member' });
});
```

```powershell
npm run test --prefix frontend -- src/app/router.test.tsx src/routes/staff/route.test.tsx src/routes/member/route.test.tsx src/routes/public.test.tsx src/features/auth/shared-login.test.tsx src/lib/api/auth.test.ts src/lib/validation/schemas.test.ts
```

Expected: exit 0; real guards and server routing pass.

- [ ] **Step 3: Review/commit**

Reviewer rejects bypasses; resolve/report:

```powershell
git add frontend/src/app/router.test.tsx frontend/src/routes/staff/route.test.tsx frontend/src/routes/member/route.test.tsx frontend/src/routes/public.test.tsx frontend/src/features/auth/shared-login.test.tsx frontend/src/lib/api/auth.test.ts frontend/src/lib/validation/schemas.test.ts .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-05-routing-auth.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/progress.md
git commit -m "test: cover frontend route authorization"
```

Expected Task 5 gain: at least 80 statements and all guard/public redirect branches targeted. Re-run full coverage and use Task 6's hard >=60 gates rather than predicted totals.

### Task 6: Fresh ratchet and whole-plan review

**Recommended agent:** `gpt-5.6-sol`, high — baseline/integration risk.

**Required reviewer:** `gpt-5.6-sol`, high, fresh context — reproduce evidence before acceptance.

**Files:** Modify frontend object only in `quality/coverage-baselines.json`; create/update final report/ledger. Read generated summary/LCOV/Vitest/e2e artifacts.

**Interfaces:** consumes `base.sha`, fresh summary/LCOV/results/prior baseline, reporter/e2e commands; produces exactly 65 represented frontend source entries, non-decreasing frontend >=60 statements/branches, and changed-line >=80 when applicable.

- [ ] **Step 1: Full-source GREEN**

```powershell
npm run frontend:test:coverage
npm run quality:report:frontend-unit
Get-Content frontend/coverage/coverage-summary.json
Get-Content frontend/test-results/unit-summary.md
$summary = Get-Content -Raw frontend/coverage/coverage-summary.json | ConvertFrom-Json
$sourceEntries = @($summary.psobject.Properties.Name | Where-Object { $_ -ne 'total' })
if ($sourceEntries.Count -ne 65) { throw "expected-65-frontend-source-entries-found-$($sourceEntries.Count)" }
if ($summary.total.statements.pct -lt 60 -or $summary.total.branches.pct -lt 60) { throw 'frontend-60-percent-milestone-not-met' }
```

Expected: pass; exactly 65 source entries; statements/branches >=60; functions/lines >= baseline. A count other than 65 is a denominator-change stop. If target failure, return to highest-ranked uncovered behavior; do not ratchet.

- [ ] **Step 2: Changed line and ratchet**

```powershell
New-Item -ItemType Directory -Force -Path test-results | Out-Null
$base = (Get-Content -Raw .superpowers/sdd/2026-07-29-frontend-coverage-uplift/base.sha).Trim()
if ($base -notmatch '^[0-9a-f]{40}$') { throw 'invalid-recorded-base-sha' }
git cat-file -e "$base`^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'recorded-base-commit-is-unavailable' }
git diff --unified=0 "$base...HEAD" --output=test-results/frontend-coverage-uplift.diff
if ($LASTEXITCODE -ne 0) { throw 'base-diff-generation-failed' }
npm run quality:report:frontend-unit -- --changed-line-diff test-results/frontend-coverage-uplift.diff --changed-line-lcov frontend/coverage/lcov.info --write-baseline
if ($LASTEXITCODE -ne 0) { throw 'frontend-changed-line-or-ratchet-failed' }
Get-Content frontend/test-results/unit-summary.md
git diff -- quality/coverage-baselines.json
```

Expected: the single reporter call preserves changed-line evidence (>=80 or `not-applicable`) while writing the baseline. Diff is frontend-only/non-decreasing with statements/branches >=60. Stop on missing base/backend change/decrease; never substitute `origin/main` or manually edit JSON.

- [ ] **Step 3: Complete verification**

```powershell
npm run test:quality-reporting
npm run test:cov
npm run test:e2e:report
npm run quality:report:backend
npm run frontend:test:coverage
npm run quality:report:frontend-unit
npm run frontend:test:e2e:report
npm run quality:report:frontend-e2e
npx eslint "{src,apps,libs,test}/**/*.ts"
npm run frontend:lint
npm run build
npm run frontend:build
git diff --check
```

Expected: all zero; root ESLint is non-mutating (no `--fix`); backend
unchanged; zero Playwright failures; Plan 1 authors no e2e skip change, while
an already reviewed Plan 4 skip removal is accepted and reproduced after its
sequential merge; no combined metric; whitespace clean.

- [ ] **Step 4: Whole-plan review/commit**

Reviewer reruns Steps 1–3, checks reports/prohibited files/denominator/guards/baseline provenance; resolve all findings, append backlog, then:

```powershell
git add quality/coverage-baselines.json .superpowers/sdd/2026-07-29-frontend-coverage-uplift/task-06-final-ratchet.md .superpowers/sdd/2026-07-29-frontend-coverage-uplift/progress.md
git commit -m "test: ratchet frontend coverage baseline"
```

## Deferred 75% Backlog

At the current denominator, 75% requires `ceil(1034 × .75) = 776` statements and `ceil(729 × .75) = 547` branches. From the minimum 60% milestone (`621`/`438`), the later wave must add at least 155 statements and 109 branches. Task 6 replaces those residuals with fresh measured counts in its report.

| Priority | Areas | Behavior |
| --- | --- | --- |
| 1 | staff list routes: borrowings, overdue, catalog, membership types, members | 53 statements / 26 branches currently uncovered; loading/error/empty/filter/paging and CRUD success/conflict/permission controls |
| 2 | security activity, staff users, identifier conflicts | 13+ statements / 15+ branches currently uncovered across feature/API/route wrappers; redaction, role refresh, resume/terminal, forbidden |
| 3 | reminders, quota, auth, member-auth | 17+ statements / 38 branches currently uncovered; dates/priorities/quota, refresh/401 concurrency |
| 4 | forms, data table, header, states | 3 statements / 13 branches currently uncovered; disabled/error/paging/retry/keyboard |
| 5 | any residual zero-covered lazy route found by post-Task-6 LCOV | use the exact post-Task-6 uncovered counts recorded in `task-06-final-ratchet.md`; loading/error fallback only |

## Stop, Escalation, Recovery

Stop/request direction if target needs denominator/baseline/threshold change, generated/test inclusion, combined metric, weaker auth/privacy/error contract, absent predecessor, unresolved fresh conflict, or material product defect. Ordinary test/MSW/coverage failures are in scope.

For regression, read the exact 40-character task SHA from the task report,
validate it with `git cat-file -e "$taskSha`^{commit}"`, and run
`git revert $taskSha` in the isolated worktree; rerun the focused/full frontend
report and record recovery. Never destructive-reset, lower baseline, or delete
evidence. On ratchet conflict retain the last verified baseline, regenerate
summary/LCOV, and retry Task 6.

## Completion Criteria

- Fresh full-source statements/branches >=60 and all frontend metrics non-decreasing.
- Only frontend baseline changes from fresh evidence.
- Seven tasks (Task 0 through Task 6) have bootstrap or RED/GREEN evidence, fresh review, reports, resolved findings, commits.
- Changed-line >=80 when applicable; backend independent.
- Task 6 test/report/e2e/lint/build/whitespace checks pass.
- 75% backlog recorded, not claimed complete.
