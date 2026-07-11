# Contract: Authorization Matrix

## Permission Names

Permission names are stable product-level identifiers used by guards, tests, and admin review screens.

| Permission | Purpose |
| --- | --- |
| `catalog:read` | View catalog and copy data in staff workflows |
| `catalog:manage` | Create, update, deactivate, or restore catalog records |
| `members:read` | View member records in staff workflows |
| `members:manage` | Create, update, suspend, or reactivate member records |
| `membership-types:read` | View membership type and borrowing policy configuration |
| `membership-types:manage` | Create, update, deactivate, or restore membership type and borrowing policy configuration |
| `borrowings:read` | View borrowing records in staff workflows |
| `borrowings:manage` | Create borrowings, return books, and manage borrowing state |
| `staff-users:read` | View staff/admin user accounts |
| `staff-users:manage` | Create, update, suspend, or deactivate staff/admin users |
| `roles:read` | View role-to-permission mapping |
| `roles:manage` | Assign or remove elevated roles |
| `security-events:read` | View security activity |
| `auth-identifiers:read` | Review legacy cross-context sign-in identifier conflicts |
| `auth-identifiers:manage` | Resolve identifier conflicts by assigning unique identifiers |
| `member:self:read` | View the authenticated member's own profile, membership, quota, and borrowings |

## Built-In Role Mapping

| Role | Permissions |
| --- | --- |
| `member` | `member:self:read` |
| `staff` | `catalog:read`, `catalog:manage`, `members:read`, `members:manage`, `membership-types:read`, `membership-types:manage`, `borrowings:read`, `borrowings:manage` |
| `admin` | All staff permissions plus `staff-users:read`, `staff-users:manage`, `roles:read`, `roles:manage`, `security-events:read`, `auth-identifiers:read`, `auth-identifiers:manage` |

## Resource Policies

| Area | Route/Workflow | Required Policy |
| --- | --- | --- |
| Member self-service | `/members/me` | `member:self:read` and token subject must match requested member context |
| Member borrowings | `/members/me/borrowings` | `member:self:read`; member id is derived from token only |
| Staff catalog | `/books`, `/book-categories`, copy management | `catalog:read` for reads, `catalog:manage` for writes |
| Staff members | `/members` staff routes | `members:read` for reads, `members:manage` for writes |
| Membership types | `/membership-types` | `membership-types:read` for reads, `membership-types:manage` for writes |
| Borrowing desk | `/borrowings` staff routes | `borrowings:read` for reads, `borrowings:manage` for state changes |
| Staff users | `/staff-users` | `staff-users:read` for reads, `staff-users:manage` for writes |
| Role management | role assignment/update workflows | `roles:read` for review, `roles:manage` for changes |
| Security activity | security event list/detail | `security-events:read` |
| Identifier conflicts | `/auth/identifier-conflicts` review/resolve | `auth-identifiers:read` for review, `auth-identifiers:manage` for resolution |
| Identifier operation status | `/auth/identifier-operations/:operationId` | `auth-identifiers:read`; administrator role area only |

## Denial Rules

- Deny by default when a route has no explicit public policy.
- Deny member tokens from every staff/admin route.
- Deny staff tokens without admin permissions from staff-user, role, and security-event administration.
- Deny direct object access when the requested member id does not match the token subject.
- Deny access when the account is suspended, inactive, locked, reset-required, or token version is stale.

## Explicit Public Routes

| Route | Policy |
| --- | --- |
| `GET /health` | Public liveness signal containing no database or configuration details |
| `GET /health/ready` | Public readiness signal containing only status and generic dependency categories |

All other routes deny by default unless explicitly declared public. Public-route metadata must be explicit and covered by guard regression tests.

## Required Tests

- Every permission has at least one allow and one deny test.
- Every member self-service endpoint has a horizontal access-control test.
- Every admin-only route rejects regular staff and member tokens.
- Every protected route rejects unauthenticated requests.
- Both health routes succeed or report dependency failure without credentials and never expose connection strings, secrets, stack traces, host details, or account data.
- Authorization coverage is implemented as a data-driven matrix recording HTTP method, route, required permission, allowed role, and denied role for every protected controller action.
- Authorization tests call endpoints directly, not only through frontend navigation.
