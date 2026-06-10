# UI Route Contract: Library User Interface

Routes use role-specific layouts and guards. Staff routes favor dense, task-focused desktop/tablet views. Member routes favor phone-first summaries and touch-friendly interactions.

## Public Routes

| Route | Purpose | Entry Conditions | Success State |
| --- | --- | --- | --- |
| `/` | Redirect based on active session | Any user | Staff users go to `/staff`; member users go to `/member`; anonymous users go to login |
| `/staff/login` | Staff/librarian sign in | Anonymous or expired staff session | Authenticated staff session and redirect to `/staff` |
| `/member/login` | Member sign in | Anonymous or expired member session | Authenticated member session and redirect to `/member` |
| `/unauthorized` | Permission error | Authenticated user lacks access | Clear message and route back to allowed area |

## Staff Routes

| Route | Purpose | Primary UI | Required Data | Key States |
| --- | --- | --- | --- | --- |
| `/staff` | Back office dashboard | Summary metrics, attention list, quick actions | books, members, borrowings, overdue records | loading, partial summary, empty, error |
| `/staff/books` | Book collection management | searchable table, filters, add/edit sheet | book list, catalog classifications | loading, empty, no results, validation, save error |
| `/staff/books/$bookId` | Book detail | detail summary, availability, borrowing history link | book detail | not found, inactive, save error |
| `/staff/catalog` | Catalog classification management | table and add/edit form | catalog classifications | loading, empty, validation |
| `/staff/membership-types` | Membership tier management | table and add/edit form | membership tiers | loading, empty, validation |
| `/staff/members` | Member management | searchable table, status filters, add/edit sheet | member list, membership tiers | loading, empty, no results, validation |
| `/staff/members/$memberId` | Member detail and policy status | profile, quota, eligibility, active/history tabs | member detail, policy status, borrowings | not found, suspended, inactive, loading tabs |
| `/staff/borrowings` | Borrowing records | table with status/member/book filters | borrowing list | loading, empty, no results |
| `/staff/borrowings/new` | Record borrowing | member selector, book selector, eligibility summary | members, books, policy status | blocked, validation, conflict, success |
| `/staff/borrowings/overdue` | Overdue attention list | overdue table and member/book links | overdue borrowings | loading, empty, no results |
| `/staff/borrowings/$borrowingId` | Borrowing detail and return action | detail, due status, return form | borrowing detail | returned, overdue, return error |

## Member Routes

| Route | Purpose | Primary UI | Required Data | Key States |
| --- | --- | --- | --- | --- |
| `/member` | Mobile member home | tier/status card, quota summary, reminders, borrowed books | current member, policy status, active borrowings | loading, no borrowings, due soon, due today, overdue, quota reached, suspended |
| `/member/borrowings` | Current and recent borrowing list | phone-first list with filters | member-scoped borrowings | loading, empty, no results |
| `/member/borrowings/$borrowingId` | Borrowing detail | book title, dates, status, return guidance | member-owned borrowing detail | not found, forbidden, returned, overdue |

## Guard Rules

- Staff routes require an active staff/librarian/admin session.
- Member routes require an active member session.
- Member routes must not include arbitrary `memberId` route parameters.
- Staff users without permission see `/unauthorized` or disabled actions with explanatory text.
- A 401 response clears the active session and redirects to the relevant login route.
- A 403 response keeps the session but displays permission-denied state.

## Responsive Rules

- Staff shell uses persistent side navigation on desktop and collapsible navigation on tablet/smaller widths.
- Staff data tables keep dense desktop layouts but provide readable column priority and horizontal overflow handling on tablet.
- Member shell uses one-column phone layout first, with larger screens using constrained content width instead of stretching cards across the viewport.
- Long book/member/catalog text must wrap or truncate with accessible full text where needed.

## Query State Contract

Staff list routes store search state in the URL:

```text
?page=1&pageSize=20&search=&sortBy=title&sortDirection=asc&status=active
```

Rules:

- Unknown query parameters are ignored.
- Invalid page and page size values fall back to defaults.
- Filters must map to backend-supported fields where available.
- Route changes must not lose unsaved form changes without warning.
