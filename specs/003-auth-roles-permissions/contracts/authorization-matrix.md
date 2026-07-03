# Contract: Authorization Matrix

## Permission Names

Permission names are stable product-level identifiers used by guards, tests, and admin review screens.

| Permission | Purpose |
| --- | --- |
| `catalog:read` | View catalog and copy data in staff workflows |
| `catalog:manage` | Create, update, deactivate, or restore catalog records |
| `members:read` | View member records in staff workflows |
| `members:manage` | Create, update, suspend, or reactivate member records |
| `borrowings:read` | View borrowing records in staff workflows |
| `borrowings:manage` | Create borrowings, return books, and manage borrowing state |
| `staff-users:read` | View staff/admin user accounts |
| `staff-users:manage` | Create, update, suspend, or deactivate staff/admin users |
| `roles:read` | View role-to-permission mapping |
| `roles:manage` | Assign or remove elevated roles |
| `security-events:read` | View security activity |
| `member:self:read` | View the authenticated member's own profile, membership, quota, and borrowings |

## Built-In Role Mapping

| Role | Permissions |
| --- | --- |
| `member` | `member:self:read` |
| `staff` | `catalog:read`, `catalog:manage`, `members:read`, `members:manage`, `borrowings:read`, `borrowings:manage` |
| `admin` | All staff permissions plus `staff-users:read`, `staff-users:manage`, `roles:read`, `roles:manage`, `security-events:read` |

## Resource Policies

| Area | Route/Workflow | Required Policy |
| --- | --- | --- |
| Member self-service | `/members/me` | `member:self:read` and token subject must match requested member context |
| Member borrowings | `/members/me/borrowings` | `member:self:read`; member id is derived from token only |
| Staff catalog | `/books`, `/book-categories`, copy management | `catalog:read` for reads, `catalog:manage` for writes |
| Staff members | `/members` staff routes | `members:read` for reads, `members:manage` for writes |
| Borrowing desk | `/borrowings` staff routes | `borrowings:read` for reads, `borrowings:manage` for state changes |
| Staff users | `/staff-users` | `staff-users:read` for reads, `staff-users:manage` for writes |
| Role management | role assignment/update workflows | `roles:read` for review, `roles:manage` for changes |
| Security activity | security event list/detail | `security-events:read` |

## Denial Rules

- Deny by default when a route has no explicit public policy.
- Deny member tokens from every staff/admin route.
- Deny staff tokens without admin permissions from staff-user, role, and security-event administration.
- Deny direct object access when the requested member id does not match the token subject.
- Deny access when the account is suspended, inactive, locked, reset-required, or token version is stale.

## Required Tests

- Every permission has at least one allow and one deny test.
- Every member self-service endpoint has a horizontal access-control test.
- Every admin-only route rejects regular staff and member tokens.
- Every protected route rejects unauthenticated requests.
- Authorization tests call endpoints directly, not only through frontend navigation.
