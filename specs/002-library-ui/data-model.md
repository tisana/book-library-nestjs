# Data Model: Library User Interface

The frontend introduces no new persistent library domain store. It uses typed view models that mirror backend records and backend-owned borrowing rules. Member self-service requires minimal backend-owned member authentication and member-scoped read models.

## Entity: Auth Session

**Purpose**: Represents the current signed-in user context in the UI.

**Fields**:

- `roleArea`: `staff` or `member`
- `userId`: staff user id or member id
- `displayName`: visible user name
- `roles`: staff/admin roles for back office users, empty or member role for member users
- `status`: active, suspended, inactive, expired
- `accessToken`: memory-only if bearer token flow is used
- `expiresAt`: session expiration time when available

**Rules**:

- Must never persist access tokens in localStorage.
- Must clear on sign out, 401 responses, and session expiration.
- Staff session cannot access member-only routes unless backend explicitly grants a role.
- Member session cannot access staff routes.

## Entity: Staff/Librarian User

**Purpose**: Back office actor for management workflows.

**Fields**:

- `id`
- `email`
- `name`
- `role`
- `status`

**Relationships**:

- Performs state-changing actions for books, catalog classifications, members, membership tiers, borrowings, and returns.

**Rules**:

- UI must hide unavailable actions where permissions are missing.
- Backend authorization remains authoritative.

## Entity: Member User

**Purpose**: Self-service actor viewing only their own membership and borrowing status.

**Fields**:

- `memberId`
- `memberNumber`
- `displayName`
- `email` or configured login identifier
- `membershipStatus`
- `membershipTierId`

**Relationships**:

- Belongs to one membership tier.
- Has zero or more borrowing records.
- Has one quota status.

**Rules**:

- Member routes may only call member-scoped "me" endpoints.
- Member UI must not accept arbitrary member IDs from the URL.

## Entity: Book

**Purpose**: Cataloged library item shown in staff lists, detail screens, borrowing selection, and member borrowing cards.

**Fields**:

- `id`
- `title`
- `author`
- `catalogIdentifier`
- `classificationId`
- `totalQuantity`
- `availableQuantity`
- `status`

**Relationships**:

- Belongs to one catalog classification.
- Can have many borrowing records over time.

**Validation Rules**:

- Required fields must be validated before submit.
- Quantity fields must be non-negative numbers.
- UI must display unavailable state when `availableQuantity` is zero or status is inactive.

## Entity: Catalog Classification

**Purpose**: Organizes books and provides the loan period used by backend borrowing rules.

**Fields**:

- `id`
- `name`
- `loanPeriodDays`
- `status`

**Relationships**:

- Used by many books.

**Validation Rules**:

- `name` is required.
- `loanPeriodDays` must be a positive integer for active classifications.

## Entity: Membership Tier

**Purpose**: Defines borrowing limit for members.

**Fields**:

- `id`
- `name`
- `maxActiveBorrowings`
- `status`

**Relationships**:

- Used by many members.

**Validation Rules**:

- `name` is required.
- `maxActiveBorrowings` must be a positive integer for active tiers.

## Entity: Member

**Purpose**: Registered library member managed by staff and summarized in member self-service.

**Fields**:

- `id`
- `memberNumber`
- `name`
- `email`
- `phone`
- `status`
- `membershipTierId`
- `createdAt`
- `updatedAt`

**Relationships**:

- Belongs to one membership tier.
- Has many borrowing records.
- Has one current quota status derived from membership tier and active borrowings.

**Validation Rules**:

- `memberNumber`, `name`, `status`, and `membershipTierId` are required.
- Staff forms must prevent submission with missing or inactive membership tier where backend would reject the member state.

## Entity: Borrowing Record

**Purpose**: Connects a member to a borrowed book and drives due status in both staff and member UIs.

**Fields**:

- `id`
- `memberId`
- `bookId`
- `bookTitle`
- `borrowedAt`
- `dueAt`
- `returnedAt`
- `status`: active, returned, overdue, cancelled, lost where supported
- `isOverdue`

**Relationships**:

- Belongs to one member.
- Belongs to one book.

**State Transitions**:

- `active` -> `returned` when staff records a return.
- `active` -> `overdue` when due date has passed and the book is not returned.
- Returned borrowings remain visible in history.

**Rules**:

- UI must display backend status and due date decision.
- UI must not compute borrowing eligibility independently.

## Entity: Borrowing Eligibility

**Purpose**: Staff-facing decision display explaining whether a member may borrow.

**Fields**:

- `memberId`
- `eligible`
- `activeBorrowingCount`
- `maxActiveBorrowings`
- `remainingQuota`
- `blockingReasons`
- `hasOverdueBorrowings`
- `membershipStatus`

**Rules**:

- Backend decision is authoritative.
- UI must show blocking reasons before allowing staff to submit borrowing.

## Entity: Quota Status

**Purpose**: Member-facing summary of borrowing allowance.

**Fields**:

- `activeBorrowingCount`
- `maxActiveBorrowings`
- `remainingQuota`
- `limitReached`
- `blockingReasonSummary`

**Rules**:

- `remainingQuota` cannot display below zero; if backend reports an over-limit historical state, UI shows zero remaining and a warning.

## Entity: Reminder

**Purpose**: In-app member notice for due and quota conditions.

**Fields**:

- `type`: due-soon, due-today, overdue, quota-reached, suspended, inactive
- `severity`: info, warning, danger
- `title`
- `message`
- `borrowingId`
- `dueAt`

**Rules**:

- Overdue reminders sort before due-today and due-soon reminders.
- Quota and account-status reminders appear above the borrowing list when they block new borrowing.

## Entity: Staff Dashboard Summary

**Purpose**: Back office overview of operational status.

**Fields**:

- `activeBorrowingsCount`
- `overdueBorrowingsCount`
- `unavailableBooksCount`
- `membersAtLimitCount`
- `membersSuspendedCount`
- `recentBorrowings`

**Rules**:

- Dashboard values may be composed from existing list endpoints in v1 if no dedicated summary endpoint exists.
- Expensive summaries must not block primary navigation.

## Entity: List Query State

**Purpose**: Shared state for staff list routes.

**Fields**:

- `page`
- `pageSize`
- `search`
- `sortBy`
- `sortDirection`
- `filters`

**Rules**:

- Must be reflected in URL search parameters for shareable/back-button-safe staff screens.
- Must use backend pagination when supported.
