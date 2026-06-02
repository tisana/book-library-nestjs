# Book Library API

Staff-facing NestJS API for managing a library book collection, members, membership borrowing limits, and borrowing/return workflows.

## Features

- Staff/admin JWT authentication.
- Book categories with category-based loan periods.
- Aggregate book inventory with total and available quantities.
- Membership types with configurable active-loan limits.
- Member records with policy status and borrowing history.
- Borrowing lifecycle with due dates, overdue checks, returns, audit fields, and MongoDB transactions.
- Versioned MongoDB migrations and container-based local runtime.

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

Start the API:

```bash
npm run start:dev
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
- `/staff-users` for admin-managed staff users.
- `/book-categories` and `/books` for catalog and inventory management.
- `/membership-types` and `/members` for member policy and borrowing-limit management.
- `/borrowings` for borrowing creation, return, list, overdue checks, and member borrowing history.
- `/health` for runtime readiness.

## Migrations

Migration files live under `migrations/versions` and record applied versions in MongoDB.

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
