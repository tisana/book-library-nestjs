# Data Model: Book Borrowing System

## Book

Represents a borrowable title/catalog record tracked by aggregate quantity.

**Fields**

- `id`: unique identifier
- `title`: required string
- `author`: optional string
- `isbn`: optional string, unique when present
- `catalogIdentifier`: required string, unique
- `categoryId`: required reference to Book Category
- `totalQuantity`: required integer, minimum 0
- `availableQuantity`: required integer, minimum 0
- `status`: `active` or `deactivated`
- `createdAt`, `updatedAt`: timestamps
- `createdBy`, `updatedBy`: staff/admin actor identifiers

**Validation Rules**

- `availableQuantity` must not exceed `totalQuantity`.
- `totalQuantity` cannot be reduced below active loans for the book.
- Deactivated books cannot be borrowed.

**Indexes**

- Unique index on `catalogIdentifier`.
- Unique sparse index on `isbn`.
- Search indexes for `title`, `author`, and `status`.
- Index on `categoryId`.

## Book Category

Represents the book category or collection type that determines loan period.

**Fields**

- `id`: unique identifier
- `code`: required unique string
- `name`: required string
- `loanPeriodDays`: required integer, minimum 1
- `status`: `active` or `deactivated`
- `createdAt`, `updatedAt`
- `createdBy`, `updatedBy`

**Validation Rules**

- Only active categories can be assigned to new borrowable books.
- Borrowing requires an active category with a valid `loanPeriodDays`.

## Membership Type

Represents borrowing policy for a member category.

**Fields**

- `id`: unique identifier
- `code`: required unique string
- `name`: required string
- `maxActiveLoans`: required integer, minimum 0
- `status`: `active` or `deactivated`
- `createdAt`, `updatedAt`
- `createdBy`, `updatedBy`

**Validation Rules**

- Members can borrow only when their membership type is active.
- `maxActiveLoans` determines the member borrowing limit.

## Member

Represents a person registered with the library.

**Fields**

- `id`: unique identifier
- `memberNumber`: required unique string
- `fullName`: required string
- `email`: optional string, unique when present
- `phone`: optional string
- `membershipTypeId`: required reference to Membership Type
- `status`: `active`, `suspended`, or `inactive`
- `activeLoanCount`: required integer, minimum 0, default 0
- `createdAt`, `updatedAt`
- `createdBy`, `updatedBy`

**Validation Rules**

- Only members with status `active` can borrow.
- New borrowing is blocked when `activeLoanCount >= membershipType.maxActiveLoans`.
- New borrowing is blocked when the member has any active overdue loan.
- Deactivation does not remove borrowing history.

**Indexes**

- Unique index on `memberNumber`.
- Unique sparse index on `email`.
- Index on `status` and `membershipTypeId`.

## Borrowing Record

Represents one borrowed copy of a book catalog record.

**Fields**

- `id`: unique identifier
- `memberId`: required reference to Member
- `bookId`: required reference to Book
- `bookCategoryId`: required reference copied from Book at borrow time
- `borrowedAt`: required date
- `dueAt`: required date
- `returnedAt`: optional date
- `status`: `active`, `returned`, `overdue`, `cancelled`
- `borrowedByStaffId`: required actor identifier
- `returnedByStaffId`: optional actor identifier
- `createdAt`, `updatedAt`

**Validation Rules**

- `dueAt` is calculated as `borrowedAt + bookCategory.loanPeriodDays`.
- `dueAt` cannot be earlier than `borrowedAt`.
- Only `active` or `overdue` records can be returned.
- Returning a record more than once must not increase availability more than once.
- Overdue records are active records whose due date has passed and `returnedAt` is empty.

**Indexes**

- Compound index on `memberId`, `status`.
- Compound index on `bookId`, `status`.
- Index on `dueAt` and `status` for overdue queries.

## State Transitions

```text
Book: active -> deactivated
Member: active -> suspended -> active
Member: active -> inactive
Borrowing Record: active -> overdue -> returned
Borrowing Record: active -> returned
Borrowing Record: active -> cancelled
```

## Consistency Rules

- Borrowing transaction:
  - Validate member, membership type, book, and category.
  - Block inactive/suspended members.
  - Block members at their membership-type limit.
  - Block members with active overdue loans.
  - Block unavailable or deactivated books.
  - Create borrowing record.
  - Decrement `Book.availableQuantity`.
  - Increment `Member.activeLoanCount`.

- Return transaction:
  - Validate borrowing record is active or overdue.
  - Set `returnedAt` and `status = returned`.
  - Increment `Book.availableQuantity` exactly once.
  - Decrement `Member.activeLoanCount` exactly once.

- Overdue evaluation:
  - Overdue status is determined consistently from due date and return state.
  - Implementation may update status on read, scheduled job, or borrowing eligibility check, but tests must verify deterministic behavior.
