# Quickstart: Book Borrowing System

## Prerequisites

- Node.js compatible with the current NestJS 11 project.
- npm.
- Docker and Docker Compose.
- MongoDB running as a replica set. Borrow and return workflows use MongoDB transactions, so standalone MongoDB is not sufficient for full local verification.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start MongoDB in replica set mode:

   ```bash
   docker compose up -d mongodb
   ```

3. Verify MongoDB is transaction-capable:

   ```bash
   docker compose exec mongodb mongosh --quiet --eval "rs.status().ok"
   ```

   Expected result:

   ```text
   1
   ```

4. Configure the application with `.env`:

   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/bookstore?replicaSet=rs0
   JWT_SECRET=replace-with-local-secret
   JWT_EXPIRES_IN=1h
   ```

5. Run migrations and verify status:

   ```bash
   npm run migrate:up
   npm run migrate:status
   ```

   Expected status output should show the versioned library migration as applied.

6. Seed local staff/admin users for manual testing:

   ```bash
   npm run seed:users
   ```

7. Start the NestJS app:

   ```bash
   npm run start:dev
   ```

8. Verify readiness:

   ```bash
   curl http://localhost:3000/health
   ```

## Auth Verification

Log in as the seeded admin:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}'
```

Use the returned access token:

```bash
curl http://localhost:3000/members \
  -H "Authorization: Bearer <accessToken>"
```

Confirm protected endpoints reject missing credentials:

```bash
curl -i http://localhost:3000/members
```

Expected result: `401 Unauthorized`.

## Seed Data for Borrowing Tests

Create these records through authenticated staff/admin APIs before manual borrowing tests:

1. Book category:
   - `code`: `STANDARD`
   - `loanPeriodDays`: `14`
   - `status`: `active`

2. Membership type:
   - `code`: `STANDARD`
   - `maxActiveLoans`: `5`
   - `status`: `active`

3. Member:
   - Active status.
   - Assigned to the `STANDARD` membership type.

4. Book:
   - Active status.
   - Assigned to the `STANDARD` category.
   - `totalQuantity`: `2`
   - `availableQuantity`: `2`

## Verification Scenarios

- Create a borrowing and confirm the due date is based on the book category loan period.
- Confirm book availability decreases by one after borrowing.
- Return the borrowing and confirm availability increases exactly once.
- Attempt to return the same borrowing twice and confirm the second return is blocked.
- Attempt to borrow when `availableQuantity` is zero and confirm the request is blocked.
- Attempt to borrow beyond the membership-type limit and confirm the request is blocked.
- Create or simulate an overdue loan and confirm the member cannot borrow another book.
- Attempt to borrow with an inactive member and confirm the request is blocked.
- Confirm protected endpoints require bearer auth and staff/admin authorization.
- Confirm migrations apply once and retain rollback notes.
- Confirm borrow and return tests run against transaction-capable MongoDB.

## Test Commands

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
npm run migrate:status
```

## Container Baseline

Start the full app stack:

```bash
docker compose up --build
```

After startup:

```bash
curl http://localhost:3000/health
npm run migrate:status
```

The app container uses `mongodb://mongodb:27017/bookstore?replicaSet=rs0`. The local host workflow uses `mongodb://localhost:27017/bookstore?replicaSet=rs0`.
