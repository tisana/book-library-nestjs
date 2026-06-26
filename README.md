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

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/bookstore?replicaSet=rs0
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1h
```

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

Open the UI:

```text
http://localhost:5173
http://localhost:5173/staff/login
http://localhost:5173/member/login
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

Log in with a seeded staff/admin user:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}'
```

Use the returned access token for protected endpoints:

```bash
curl http://localhost:3000/books \
  -H "Authorization: Bearer <accessToken>"
```

Protected management endpoints require a valid bearer token and an allowed staff/admin role.

## API Areas

- `POST /auth/login` for staff/admin login.
- `POST /auth/member-login` for member login.
- `/staff-users` for admin-managed staff users.
- `/book-categories` and `/books` for catalog and inventory management.
- `/membership-types` and `/members` for member policy and borrowing-limit management.
- `/members/me`, `/members/me/policy-status`, and `/members/me/borrowings` for member self-service reads.
- `/borrowings` for borrowing creation, return, list, overdue checks, and member borrowing history.
- `/health` for runtime readiness.

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
