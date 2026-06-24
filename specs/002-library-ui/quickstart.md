# Quickstart: Library User Interface

This guide describes how to validate the planned UI feature after implementation.

## Prerequisites

- Node.js compatible with the current backend and Vite requirements.
- npm.
- Docker and Docker Compose for local MongoDB.
- Existing backend environment configured from `.env.example`.

## Backend Setup

Install backend dependencies from the repository root:

```bash
npm install
```

Start local MongoDB:

```bash
docker compose up -d mongodb
```

Run migrations and seed demo data:

```bash
npm run migrate:up
npm run seed:users
npm run seed:demo
```

Start the backend:

```bash
npm run start:dev
```

Expected:

- Health check succeeds at `http://localhost:3000/health`.
- API docs remain available at `http://localhost:3000/docs`.
- Seeded staff/admin users can authenticate.

## Frontend Setup

From the frontend app directory:

```bash
cd frontend
npm install
npm run dev
```

Expected:

- Frontend dev server starts.
- Frontend can reach the backend REST base URL configured for local development.
- Staff login screen is available.
- Member login screen is available once member auth support is implemented.

## Validation Scenario 1: Staff Back Office

1. Sign in as a seeded staff/admin user.
2. Open the staff dashboard.
3. Confirm summaries for books, members, active borrowings, overdue borrowings, unavailable books, and attention states.
4. Open the books screen.
5. Search, filter, sort, and paginate the list.
6. Create or update a book.
7. Open the dashboard attention list and confirm overdue rows show book title and member name/member number, not only a borrowing id.

Expected:

- Staff navigation is visible on laptop/desktop.
- Table loading, empty, and no-result states are intentional.
- Successful save updates visible data.
- Validation errors appear next to fields.
- Attention rows are understandable without copying internal IDs.

## Validation Scenario 2: Borrowing and Return

1. Open a member detail screen.
2. Confirm member policy status and remaining quota.
3. Create a valid borrowing for an available book.
4. Confirm due date and quota update.
5. Return the borrowing.
6. Confirm book availability and borrowing history update.
7. Open `/staff/borrowings` and `/staff/borrowings/overdue` and confirm rows use member name/member number and book title/catalog identifier as primary labels.

Expected:

- Borrowing and return complete within the spec success criteria.
- Backend conflict responses display clear blocking reasons.
- Borrowing history remains visible after return.
- Borrowing and overdue tables do not use raw `memberId` or `bookId` as primary visible labels.

## Validation Scenario 3: Blocked Borrowing

Test attempts for:

- Unavailable book.
- Inactive member.
- Suspended member.
- Member with overdue loans.
- Member at borrowing limit.

Expected:

- UI prevents or rejects submission safely.
- User sees the specific blocking reason.
- No successful borrowing is shown after a blocked attempt.

## Validation Scenario 4: Member Mobile Home

1. Sign in as a demo member account.
2. Open the member home page at a phone viewport such as 390x844.
3. Confirm membership tier, status, active borrowed count, maximum limit, and remaining quota.
4. Confirm current borrowed books show title, borrowed date, due date, and due status.
5. Check due-soon, due-today, overdue, quota-reached, suspended, and no-borrowing demo states.

Expected:

- Member sees only their own information.
- Primary status and next action are visible without horizontal scrolling.
- Overdue and quota-reached states are prominent and understandable.

## Validation Scenario 5: Responsive and Accessibility

Run manual and automated checks for:

- Staff dashboard at 1440x900, 1024x768, and 768x1024.
- Member home at 390x844 and 430x932.
- Keyboard navigation through login, staff list filters, dialogs/sheets, and forms.
- Screen-reader labels for inputs, icon buttons, menus, dialogs, and status badges.
- Long book titles, member names, and catalog identifiers.
- Staff and member sign-out controls with keyboard and screen-reader labels.

Expected:

- No overlapping text or unusable controls.
- Icon-only controls have accessible names.
- Color is not the only status signal.
- Sign-out can be reached by keyboard in both staff and member shells.

## Validation Scenario 6: Performance Smoke Checks

Run automated checks against the seeded demo dataset for:

- Staff list and detail views.
- Member home on a phone-sized viewport.

Use seeded demo data with at least 100 books, 50 members, 25 active borrowings, 10 overdue borrowings, and member accounts covering no-borrowing, due-soon, due-today, overdue, quota-reached, suspended, and inactive states.

Expected:

- Staff list/detail views and member home render useful content within 2 seconds.
- If a larger local dataset is added later, document the record counts used for validation.

## Validation Scenario 7: Sign Out

1. Sign in as a seeded staff/admin user.
2. Use the staff sign-out control.
3. Confirm the app routes to `/staff/login`.
4. Navigate directly to `/staff` and confirm protected staff data is not visible without signing in again.
5. Sign in as a demo member user.
6. Use the member sign-out control.
7. Confirm the app routes to `/member/login`.
8. Navigate directly to `/member` and confirm the previous member's data is not visible without signing in again.

Expected:

- Sign-out clears memory-only access token state.
- Staff and member query data from the previous session is not visible after sign-out.
- The sign-out controls have accessible labels and remain usable at phone widths.

## Verification Commands

Backend:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

Frontend:

```bash
cd frontend
npm run lint
npm run test
npm run test:e2e
npm run build
```

Expected:

- All commands pass.
- Playwright tests cover staff happy path, blocked borrowing, member mobile home, member privacy, sign-out, human-readable staff borrowing rows, responsive layouts, accessibility, and performance smoke checks.
