# Quickstart: Book Borrowing System

## Prerequisites

- Node.js compatible with the current NestJS 11 project
- npm
- Docker and Docker Compose
- MongoDB configured with replica set support for transactions

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start MongoDB in transaction-capable replica set mode:

   ```bash
   docker compose up -d mongodb
   ```

3. Configure the application:

   ```bash
   MONGODB_URI=mongodb://localhost:27017/bookstore
   PORT=3000
   JWT_SECRET=replace-with-local-secret
   ```

4. Run MongoDB migrations:

   ```bash
   npm run migrate:up
   ```

5. Start the NestJS app:

   ```bash
   npm run start:dev
   ```

6. Verify readiness:

   ```bash
   curl http://localhost:3000/health
   ```

## Container Deployment Baseline

The implementation should add:

- `Dockerfile` for the NestJS app
- App service in `docker-compose.yml`
- Environment-based `MONGODB_URI`
- MongoDB replica set initialization for transaction support
- Migration command for collection/index/reference-data changes
- Health check endpoint and container health check
- No secrets committed to source control

Expected local container flow:

```bash
docker compose up --build
curl http://localhost:3000/health
npm run migrate:status
```

## Seed Data for Manual Testing

Create these records through migrations or authenticated admin/staff APIs before testing borrowing:

0. Staff/admin user:
   - Active status
   - `admin` or `staff` role
   - Password stored only as a hash

1. Book category:
   - `code`: `STANDARD`
   - `loanPeriodDays`: `14`

2. Membership type:
   - `code`: `STANDARD`
   - `maxActiveLoans`: `5`

3. Member:
   - Active status
   - Assigned to `STANDARD` membership type

4. Book:
   - Active status
   - Assigned to `STANDARD` category
   - `totalQuantity`: `2`
   - `availableQuantity`: `2`

## Verification Scenarios

- Authenticate as staff/admin and use the bearer token for protected management endpoints.
- Confirm protected endpoints reject unauthenticated requests.
- Confirm protected endpoints reject authenticated users without the required role.
- Create a valid borrowing and confirm book availability decreases by one.
- Return the borrowing and confirm availability increases exactly once.
- Attempt to borrow when `availableQuantity` is zero and confirm the request is blocked.
- Attempt to borrow beyond the membership-type limit and confirm the request is blocked.
- Create or simulate an overdue loan and confirm the member cannot borrow another book.
- Attempt to borrow with an inactive member and confirm the request is blocked.
- Confirm staff/admin authorization is required for state-changing endpoints.
- Confirm migrations apply once, record their version, and include rollback notes.
- Confirm borrow and return workflows run against transaction-capable MongoDB.

## Test Commands

```bash
npm run test
npm run test:e2e
npm run lint
npm run build
npm run migrate:up
npm run migrate:status
```
