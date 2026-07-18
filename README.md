# Book Library API

NestJS and React application for managing a library book collection, members, membership borrowing limits, borrowing/return workflows, and mobile-first member borrowing status.

## Features

- Staff/admin JWT authentication.
- Book categories with category-based loan periods.
- Aggregate book inventory with total and available quantities.
- Membership types with configurable active-loan limits.
- Member records with policy status and borrowing history.
- Borrowing lifecycle with due dates, overdue checks, returns, audit fields, and MongoDB transactions.
- MongoDB document-based data modeling with explicit collection shapes, references, indexes, and migrations.
- Versioned MongoDB migrations and container-based local runtime.
- Browser-based React staff back office for books, catalog, membership, members, borrowings, overdue follow-up, and sign-out.
- Mobile-first member self-service UI for membership tier, current borrowings, due status, reminders, quota, and sign-out.

## Requirements

- Node.js compatible with the current NestJS 11 project.
- npm.
- Docker and Docker Compose for local MongoDB replica set support.
- MongoDB must run as a replica set for borrow/return transactions.

## Environment

Copy `.env.example` to `.env` for local development and adjust values as needed:

Use [`.env.example`](./.env.example) as the authoritative variable list. At minimum, set the MongoDB URI, JWT issuer/audience/signing secret, cookie secret, audit-correlation key, and exact browser origins. Access tokens default to and cannot exceed `900` seconds. Refresh families default to and cannot exceed `2592000` seconds (30 days), must outlive access tokens, and keep their original absolute expiry through every rotation.

`MONGODB_URI` is used by the API, migration runner, and sample seed scripts. For Docker Compose, the app service uses `mongodb://mongodb:27017/bookstore?replicaSet=rs0`.

The frontend reads its REST API base URL from `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Copy `frontend/.env.example` to `frontend/.env` when you need to override the default API URL. For local development, use `http://localhost:5173` for the UI because the backend CORS default allows that origin.

## Local Setup

Install dependencies:

```bash
npm install
```

Start transaction-capable MongoDB:

```bash
docker compose up -d mongodb
```

Verify the replica set is ready:

```bash
docker compose exec mongodb mongosh --quiet --eval "rs.status().ok"
```

Run migrations:

```bash
npm run migrate:up
npm run migrate:status
```

Seed sample staff/admin users only when needed for manual API testing:

```bash
npm run seed:users
```

Seeded credentials:

| Role | Email | Password |
| --- | --- | --- |
| admin | `admin@example.com` | `AdminPass123!` |
| staff | `staff@example.com` | `StaffPass123!` |

The seed is explicit and idempotent. It is not run during app startup or by default migrations.

Seed demo library data when needed for API client demos or e2e walkthroughs:

```bash
npm run seed:demo
```

The demo seed creates book categories, membership types, books, members, and borrowing records covering available inventory, active loans, returned loans, overdue loans, suspended members, and a member at the borrowing limit. It is explicit and idempotent: it upserts fixed demo records and replaces only borrowing records created by the demo seed actor.

Demo member login credentials:

| Member | Login identifier | Password |
| --- | --- | --- |
| Jane Reader | `M-1001` or `jane.reader@example.test` | `DemoMember#2026` |
| Max Limit | `M-1002` or `max.limit@example.test` | `DemoMember#2026` |
| Sam Suspended | `M-1003` or `sam.suspended@example.test` | `DemoMember#2026` |
| Olivia Overdue | `M-1004` or `olivia.overdue@example.test` | `DemoMember#2026` |

If an existing local database already has demo ISBNs or demo member emails under different identifiers, the seed will reuse and update the matching record instead of inserting a duplicate. For a clean demo/e2e dataset, reset matching demo records and seed again:

```bash
npm run seed:demo:reset
```

The reset command deletes matching demo books, demo members, and borrowings connected to them or created by the demo seed actor before reseeding. It does not run during app startup or migrations.

Start the API:

```bash
npm run start:dev
```

Start the frontend in another terminal:

```bash
npm run frontend:install
npm run frontend:dev
```

Open the shared sign-in UI:

```text
http://localhost:5173
http://localhost:5173/login
```

Open API docs:

```text
http://localhost:3000/docs
```

Health check:

```bash
curl http://localhost:3000/health
```

## Auth

Log in through the shared staff/member contract:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@example.com","password":"AdminPass123!"}'
```

Use the returned access token for protected endpoints:

```bash
curl http://localhost:3000/books \
  -H "Authorization: Bearer <accessToken>"
```

Protected management endpoints require a valid bearer token and explicit permissions. A member cannot enter the staff area; ordinary staff cannot enter administrator workflows.

## API Areas

- `POST /auth/login` for shared staff/admin/member sign-in.
- `POST /auth/staff-login` and `POST /auth/member-login` as compatibility wrappers over the shared resolver.
- `POST /auth/refresh`, `/auth/logout`, and `/auth/logout-all` for session lifecycle.
- `GET /auth/security-activity` for administrators with `security-events:read`.
- `/staff-users` for admin-managed staff users.
- `/book-categories` and `/books` for catalog and inventory management.
- `/membership-types` and `/members` for member policy and borrowing-limit management.
- `/members/me`, `/members/me/policy-status`, and `/members/me/borrowings` for member self-service reads.
- `/borrowings` for borrowing creation, return, list, overdue checks, and member borrowing history.
- `/health` for process liveness and `/health/ready` for deployment readiness.

## Authentication Operations

### Browser origins, CORS, cookies, and proxy identity

`AUTH_TRUSTED_BROWSER_ORIGINS` is a JSON array and the single source of truth for credentialed CORS and the pre-session origin guard. Development omission defaults to `["http://localhost:5173","http://127.0.0.1:5173"]`. Production requires a non-empty array of exact HTTPS origins. Wildcards, `null`, credentials, non-root paths, queries, fragments, duplicates, malformed values, and production HTTP origins abort startup. Shared/compatibility sign-in, refresh, current-session sign-out, and all-session sign-out require one exact configured `Origin` before cookie parsing or auth/throttle/session mutation. Denials use fixed route/reason warning dimensions, never persist a security event, and emit at most once per dimension per application instance per minute while carrying a bounded suppressed count.

The refresh cookie is host-only: no `Domain`, path `/auth`, `HttpOnly`, `SameSite=Strict`, production `Secure`, and `Max-Age` no longer than the immutable family lifetime remaining. Set and clear operations use the same scope/security attributes.

`AUTH_TRUSTED_PROXY_CIDRS` is an exact JSON array and defaults to `[]`. With no trust, the direct peer is the source and forwarding headers are ignored. Behind a proxy, list only its CIDR, for example `["10.20.0.0/16"]`; the source is resolved right-to-left to the first untrusted hop. A direct client that supplies `X-Forwarded-For` is still identified by its peer. A trusted proxy chain such as client `198.51.100.8` -> trusted `10.20.1.4` resolves to the client. An untrusted intermediate proxy stops resolution at that proxy. Malformed CIDRs, duplicates, and production `0.0.0.0/0` or `::/0` abort startup.

### Sessions, revocation, and throttling

Refresh tokens are stored only as hashes and rotate once. A replay of any exchanged generation revokes the family. Rotation first inserts a uniquely indexed `pending` marker with a 30-second ownership lease, records its operation ID in the family compare-and-swap, commits the marker, and only then returns credentials. Each instance reconciles at most 100 expired pending markers every 60 seconds. Interrupted post-CAS or inconsistent state is revoked; pre-CAS work can be taken over after lease expiry. Required marker/family indexes are created only by migration.

Migration 003 forcibly revokes every active legacy family as `security-upgrade-reauth`, clears recoverable token hashes, and requires sign-in again because historical replay markers cannot be reconstructed. This revocation is irreversible: rollback must never restore those hashes or reactivate legacy sessions. Current-session sign-out revokes only the presented family and remains idempotent with a missing cookie. All-session sign-out revokes every subject family and increments `authVersion`, so prior access tokens fail the next protected request.

Sign-in throttling defaults to 5 generic failures per normalized identifier correlation and 20 attempts per trusted source in 900 seconds. Refresh defaults to 30 attempts per family and source in 300 seconds. Override with `AUTH_SIGNIN_IDENTIFIER_FAILURE_LIMIT`, `AUTH_SIGNIN_SOURCE_LIMIT`, `AUTH_SIGNIN_WINDOW_SECONDS`, `AUTH_REFRESH_THROTTLE_LIMIT`, and `AUTH_REFRESH_THROTTLE_WINDOW_SECONDS`. Shared and compatibility routes consume the same persistent counters. Expired windows recover automatically.

### Audit-correlation key rotation

`AUTH_AUDIT_CORRELATION_SECRET` is an unpadded base64url secret of at least 32 decoded bytes. `AUTH_AUDIT_CORRELATION_KEY_VERSION` is a positive integer. `AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS` is a JSON object with at most two positive-integer versions, no current-version entry, and the same secret requirements. Keep a previous key until every repair referencing it is terminal with cleanup complete and every throttle bucket referencing it has expired. Readiness fails closed as `repair-key-required` or `throttle-key-required` when referenced material is missing; affected workers/requests make no mutation.

Before promotion, pipe metadata only to the preflight command:

```powershell
'{"candidateCurrentVersion":4,"candidatePreviousVersions":[2,3]}' | npm run auth:key-rotation:preflight
```

Input permits only `candidateCurrentVersion` and `candidatePreviousVersions`; secrets and unknown fields are rejected. Output is fixed non-sensitive JSON containing status, reason, configured capacity, required versions, and count. Exit `0` means allowed, exit `1` means invalid input/runtime failure, and exit `2` means `repair-key-rotation-blocked`. The command performs no writes. Online identifier conflicts recover through idempotent operations. Oversized offline repair requires a short-lived administrator token through stdin, validates it before dry-run and every batch, uses canonical versioned manifests, processes bounded batches, removes activation gates before terminal TTL eligibility, and replays retained terminal results without re-execution. Rotate/retire manifest keys only after the same repair and throttle retention checks.

### Health, release verification, and Keycloak

Use `/health` only for liveness and `/health/ready` for deployment readiness. Readiness diagnostics are redacted and include indexed `migration-required`, `repair-key-required`, and `throttle-key-required` states. Run `npm run verify:auth-performance` for a production-mode build with a dedicated seeded MongoDB, 100 warm-ups per handler, 500 measured requests per handler at concurrency 10, nearest-rank p95, and 10,000 security events. Evidence is written to `specs/003-auth-roles-permissions/evidence/auth-performance.md`.

Shared sign-in usability is a production release gate. Product or QA must follow `specs/003-auth-roles-permissions/evidence/shared-sign-in-usability.md`; at least 19 of 20 first-time participants (8 members, 8 staff, 4 administrators) must reach the authorized landing area on the first attempt within 30 seconds.

Keycloak remains an evaluated future option, not a runtime dependency. A migration should validate Keycloak issuer/audience/signature through JWKS, map `sub`, roles/groups/scopes into the existing normalized auth context and permission names, link the external subject to existing staff/member records, and retain library ownership/permission checks in NestJS.

## Migrations

Migration files live under `migrations/versions` and record applied versions in MongoDB.
Data model changes should be designed as MongoDB document models first, documenting
collection shape, embedding versus reference choices, denormalized fields, indexes, and
rollback considerations rather than defaulting to relational table-style decomposition.

```bash
npm run migrate:up
npm run migrate:status
```

Migration commands read `MONGODB_URI`; if it is missing, the runner falls back to `mongodb://localhost:27017/bookstore`.

## Tests and Verification

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

Frontend checks:

```bash
npm run frontend:lint
npm run frontend:test
npm run frontend:test:e2e
npm run frontend:build
```

Run migration verification against a local MongoDB instance:

```bash
npm run migrate:status
```

## Containers

Build and start the app plus MongoDB replica set:

```bash
docker compose up --build
```

Run only MongoDB for local development:

```bash
docker compose up -d mongodb
```

Stop containers:

```bash
docker compose down
```

Remove the local MongoDB volume only when intentionally resetting local data:

```bash
docker compose down -v
```
