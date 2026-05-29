# API Contract: Book Borrowing System

This contract describes the REST API shape to implement in the NestJS service. All non-public endpoints require authenticated staff/admin access unless noted otherwise.

## Common Response Rules

- Validation failures return `400` with a clear message and field details when available.
- Missing resources return `404`.
- Borrowing rule violations return `409` with a business-readable reason.
- Unauthorized requests return `401`.
- Authenticated users without the required role return `403`.
- List endpoints support pagination using `page` and `limit`.

## Book Categories

### `POST /book-categories`

Creates a category or collection type.

**Request**

```json
{
  "code": "STANDARD",
  "name": "Standard Collection",
  "loanPeriodDays": 14
}
```

**Response `201`**

```json
{
  "id": "category-id",
  "code": "STANDARD",
  "name": "Standard Collection",
  "loanPeriodDays": 14,
  "status": "active"
}
```

### `GET /book-categories`

Lists categories, optionally filtered by `status`.

### `PATCH /book-categories/{id}`

Updates name, loan period, or status. Deactivated categories cannot be used for new borrowing.

## Books

### `POST /books`

Creates a title/catalog record with aggregate quantity.

**Request**

```json
{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "9780132350884",
  "catalogIdentifier": "BK-0001",
  "categoryId": "category-id",
  "totalQuantity": 3
}
```

**Response `201`**

```json
{
  "id": "book-id",
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "9780132350884",
  "catalogIdentifier": "BK-0001",
  "categoryId": "category-id",
  "totalQuantity": 3,
  "availableQuantity": 3,
  "status": "active"
}
```

### `GET /books`

Lists books. Filters: `q`, `author`, `categoryId`, `status`, `availableOnly`, `page`, `limit`.

### `GET /books/{id}`

Returns book detail including total and available quantity.

### `PATCH /books/{id}`

Updates catalog details, category, quantity, or status. Quantity updates cannot make `totalQuantity` lower than active loans.

## Membership Types

### `POST /membership-types`

Creates a membership type and borrowing limit.

**Request**

```json
{
  "code": "STANDARD",
  "name": "Standard Member",
  "maxActiveLoans": 5
}
```

### `GET /membership-types`

Lists membership types.

### `PATCH /membership-types/{id}`

Updates name, maximum active loans, or status.

## Members

### `POST /members`

Creates a member.

**Request**

```json
{
  "memberNumber": "M-0001",
  "fullName": "Jane Reader",
  "email": "jane@example.com",
  "phone": "+66000000000",
  "membershipTypeId": "membership-type-id"
}
```

### `GET /members`

Lists members. Filters: `q`, `status`, `membershipTypeId`, `page`, `limit`.

### `GET /members/{id}`

Returns member detail including `activeLoanCount`.

### `PATCH /members/{id}`

Updates member identity details, membership type, or status.

### `GET /members/{id}/borrowings`

Lists a member's active, returned, and overdue borrowing records.

## Borrowings

### `POST /borrowings`

Creates a borrowing record.

**Request**

```json
{
  "memberId": "member-id",
  "bookId": "book-id"
}
```

**Response `201`**

```json
{
  "id": "borrowing-id",
  "memberId": "member-id",
  "bookId": "book-id",
  "borrowedAt": "2026-05-29T00:00:00.000Z",
  "dueAt": "2026-06-12T00:00:00.000Z",
  "status": "active"
}
```

**Conflict Examples**

- `Book is not available for borrowing`
- `Member borrowing limit has been reached`
- `Member has overdue loans`
- `Book category has no active loan period`

### `GET /borrowings`

Lists borrowing records. Filters: `memberId`, `bookId`, `status`, `overdueOnly`, `page`, `limit`.

### `GET /borrowings/{id}`

Returns one borrowing record.

### `POST /borrowings/{id}/return`

Returns a borrowed book.

**Response `200`**

```json
{
  "id": "borrowing-id",
  "status": "returned",
  "returnedAt": "2026-06-01T00:00:00.000Z"
}
```

### `GET /borrowings/overdue`

Lists active loans past their due date.

## Health

### `GET /health`

Returns service readiness for container deployment.

**Response `200`**

```json
{
  "status": "ok"
}
```
