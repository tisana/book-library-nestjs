# REST Integration Contract: Library User Interface

The UI consumes the existing NestJS REST API and adds only the member-scoped support required by the UI spec. Backend validation and authorization remain authoritative.

## Existing Staff-Facing REST Surface

The current `openapi.json` exposes these REST areas:

| Capability | Existing Endpoint Area | UI Usage |
| --- | --- | --- |
| Staff login | `POST /auth/login` | Staff sign in |
| Staff users | `/staff-users` | Admin staff management where role permits |
| Health | `GET /health` | Local readiness checks |
| Catalog classifications | `/book-categories` | Staff catalog screens |
| Books | `/books` and `/books/{id}` | Staff collection screens and borrowing book selection |
| Membership tiers | `/membership-types` | Staff membership tier screens |
| Members | `/members` and `/members/{id}` | Staff member screens |
| Member policy status | `/members/{id}/policy-status` | Staff borrowing eligibility display |
| Member borrowings | `/members/{id}/borrowings` | Staff member borrowing tabs |
| Borrowings | `/borrowings`, `/borrowings/{id}`, `/borrowings/overdue`, `/borrowings/{id}/return` | Staff lending, return, detail, and overdue workflows |

## Required Member-Scoped REST Additions

The mobile member experience requires member authentication and "current member" endpoints. Names below are the planned contract unless implementation discovers a stronger existing pattern.

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| `POST` | `/auth/member-login` | Authenticate a member user | anonymous |
| `GET` | `/members/me` | Return current member profile and membership tier summary | member |
| `GET` | `/members/me/policy-status` | Return current member quota and eligibility summary | member |
| `GET` | `/members/me/borrowings` | Return current member borrowings with status filters | member |
| `GET` | `/members/me/borrowings/{id}` | Return one current-member-owned borrowing record | member |

Rules:

- Member endpoints derive member identity from the authenticated session, not from client-provided member IDs.
- Member endpoints must not expose other members' identity details or borrowing history.
- Member login responses follow the same session safety rules as staff login.
- If the backend chooses HTTP-only cookies, frontend auth adapters must not require bearer token access.

## Shared Query Parameters

List endpoints should support these query concepts where relevant:

| Parameter | Meaning | Default |
| --- | --- | --- |
| `page` | 1-based page number | `1` |
| `pageSize` | page size for list views | `20` staff, `10` member |
| `search` | free-text search | empty |
| `sortBy` | sortable field | endpoint default |
| `sortDirection` | `asc` or `desc` | endpoint default |
| `status` | domain status filter | all |
| `overdueOnly` | overdue borrowing filter | `false` |

## Response Shape Expectations

Frontend adapters normalize responses into view models. The UI must tolerate either plain arrays or paginated envelopes where existing endpoints already define them.

Preferred paginated envelope:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalItems": 0,
  "totalPages": 0
}
```

Error handling expectations:

| Status | UI Behavior |
| --- | --- |
| `400` | Show field or request validation errors |
| `401` | Clear session and redirect to role-appropriate login |
| `403` | Show permission-denied state |
| `404` | Show not-found state with safe navigation |
| `409` | Show domain conflict, such as unavailable book or borrowing limit reached |
| `500` | Show general error without sensitive details |

## TanStack Query Key Contract

Use structured query keys so reads, mutations, and invalidation are predictable:

```text
['staff', 'books', listQuery]
['staff', 'book', bookId]
['staff', 'members', listQuery]
['staff', 'member', memberId]
['staff', 'member-policy', memberId]
['staff', 'borrowings', listQuery]
['staff', 'borrowing', borrowingId]
['member', 'me']
['member', 'policy-status']
['member', 'borrowings', listQuery]
['member', 'borrowing', borrowingId]
```

Mutation invalidation rules:

- Creating or updating books invalidates staff books and affected book detail.
- Creating borrowing invalidates staff books, borrowings, member policy, member borrowings, and member self-service borrowings for the affected member.
- Returning borrowing invalidates affected borrowing detail, books, borrowings, member policy, and member self-service borrowings.
- Updating membership tier invalidates membership tier lists and affected member policy views.

## Security Rules

- UI role guards are convenience only; backend authorization remains mandatory.
- Tokens, passwords, and sensitive identity details must not be logged.
- Member UI never calls staff `/members/{id}` endpoints.
- Staff UI must include authenticated actor context through the backend session/token flow.
