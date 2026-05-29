# Quickstart: Book Borrowing System

## Prerequisites

- Node.js compatible with the current NestJS 11 project
- npm
- Docker and Docker Compose

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start MongoDB:

   ```bash
   docker compose up -d mongodb
   ```

3. Configure the application:

   ```bash
   MONGODB_URI=mongodb://localhost:27017/bookstore
   PORT=3000
   ```

4. Start the NestJS app:

   ```bash
   npm run start:dev
   ```

5. Verify readiness:

   ```bash
   curl http://localhost:3000/health
   ```

## Container Deployment Baseline

The implementation should add:

- `Dockerfile` for the NestJS app
- App service in `docker-compose.yml`
- Environment-based `MONGODB_URI`
- Health check endpoint and container health check
- No secrets committed to source control

Expected local container flow:

```bash
docker compose up --build
curl http://localhost:3000/health
```

## Seed Data for Manual Testing

Create these records before testing borrowing:

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

- Create a valid borrowing and confirm book availability decreases by one.
- Return the borrowing and confirm availability increases exactly once.
- Attempt to borrow when `availableQuantity` is zero and confirm the request is blocked.
- Attempt to borrow beyond the membership-type limit and confirm the request is blocked.
- Create or simulate an overdue loan and confirm the member cannot borrow another book.
- Attempt to borrow with an inactive member and confirm the request is blocked.
- Confirm staff/admin authorization is required for state-changing endpoints.

## Test Commands

```bash
npm run test
npm run test:e2e
npm run lint
npm run build
```
