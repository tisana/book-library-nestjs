# Implementation Plan: Book Borrowing System

**Branch**: `001-book-borrowing-system` | **Date**: 2026-05-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-book-borrowing-system/spec.md`

## Summary

Build a staff-facing library borrowing API on the existing NestJS service and MongoDB baseline. Extend the current books module into explicit modules for book categories, membership types, members, borrowings, staff/admin users, authentication, migrations, and health. Enforce aggregate book availability, membership-type borrowing limits, category-based due dates, overdue borrowing blocks, first-party staff/admin JWT authentication, server-side role authorization, audit actor tracking, versioned MongoDB migrations, and transaction-capable MongoDB consistency for borrow/return workflows.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js, NestJS 11.x

**Primary Dependencies**: Existing `@nestjs/common`, `@nestjs/core`, `@nestjs/mongoose`, `mongoose`, `class-validator`, `class-transformer`; add `@nestjs/config`, `@nestjs/swagger`, `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-jwt`, password hashing with `argon2` or `bcrypt`, and `mongodb-memory-server` for transaction-capable integration tests.

**Storage**: MongoDB via Mongoose. Use environment-driven `MONGODB_URI`. Local, automated test, and container MongoDB configurations must support transactions through replica set mode. MongoDB collection/index/reference-data changes are managed through versioned migration scripts with rollback notes.

**Testing**: Jest unit tests for domain services and auth rules, Nest testing utilities plus Supertest for API/e2e tests, and MongoDB-backed integration tests for migration behavior and borrow/return transaction consistency.

**Target Platform**: Containerized Linux service with app container plus transaction-capable MongoDB container.

**Project Type**: Backend web service/API.

**Performance Goals**: Staff can record books in under 2 minutes, complete valid borrowing in under 1 minute, and retrieve member loan/overdue status in under 30 seconds under normal expected library usage.

**Constraints**: Preserve borrowing history; no hard delete for historical entities; first-party staff/admin JWT auth for protected management actions; server-side role authorization; deterministic date calculations; aggregate book quantity model for v1; Borrowing Policy is non-persisted service-domain logic; no payment, barcode, RFID, mobile app, or multi-branch support.

**Scale/Scope**: Single library-like deployment. Lists must be paginated and indexed for books, members, loans, and overdue records.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **User-Centered Library Workflow**: PASS. User stories now keep US1 and US2 independently testable without requiring borrowing endpoints.
- **Correctness Over Cleverness**: PASS. Borrowing Policy remains explicit non-persisted domain/service logic; borrow/return consistency uses MongoDB transactions in transaction-capable environments.
- **Security and Privacy by Default**: PASS. First-party staff/admin JWT auth, role authorization, password hashing, token secrecy, and actor audit tracking are explicit requirements.
- **Spec-First, Traceable Changes**: PASS. Plan reflects `FR-018` through `FR-024` added by clarification.
- **Test the Rules That Matter**: PASS. AuthN/authZ, domain rules, migrations, and transaction consistency require automated tests.
- **Maintainable Architecture**: PASS. Single NestJS app with feature modules; no microservices.
- **Data Integrity and Auditability**: PASS. State changes record actor/time; MongoDB changes use versioned migration scripts with rollback notes.
- **Usability and Accessibility**: PASS for backend scope through clear status, pagination, validation messages, and predictable API errors.
- **Performance With Practical Limits**: PASS. Indexes and pagination are planned for common queries.
- **Operability and Observability**: PASS. Env config, health endpoint, container health checks, safe logs, transaction-capable MongoDB, and migration commands are planned.

## Project Structure

### Documentation (this feature)

```text
specs/001-book-borrowing-system/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app.module.ts
├── main.ts
├── config/
│   ├── auth.config.ts
│   └── database.config.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── current-user.decorator.ts
│   ├── jwt.strategy.ts
│   ├── roles.decorator.ts
│   └── roles.guard.ts
├── staff-users/
│   ├── staff-users.module.ts
│   ├── staff-users.controller.ts
│   ├── staff-users.service.ts
│   ├── dto/
│   └── schemas/
├── books/
├── book-categories/
├── membership-types/
├── members/
├── borrowings/
│   ├── borrowings.module.ts
│   ├── borrowings.controller.ts
│   ├── borrowings.service.ts
│   ├── borrowings-rules.service.ts
│   ├── dto/
│   └── schemas/
├── health/
│   ├── health.module.ts
│   ├── health.controller.ts
│   └── health.service.ts
└── common/
    ├── audit/
    ├── dto/
    ├── enums/
    ├── exceptions/
    └── filters/

migrations/
├── migrate.ts
├── README.md
└── versions/
    ├── 000-migration-record.ts
    └── 001-library-core.ts

test/
├── utils/
├── auth.e2e-spec.ts
├── book-collection.e2e-spec.ts
├── membership.e2e-spec.ts
├── borrowing.e2e-spec.ts
├── migrations.e2e-spec.ts
└── authorization.e2e-spec.ts

docker-compose.yml
Dockerfile
```

**Structure Decision**: Keep a single NestJS API application and expand it with feature modules. Reuse and evolve the existing `src/books` module. Add `auth` and `staff-users` modules because the clarified spec requires first-party staff/admin authentication. Add `migrations/` for versioned MongoDB changes and rollback notes. Add `health/` and env-based config for container operation.

## Complexity Tracking

No constitution violations require exceptions. The added auth and migration modules are required by the constitution and clarified spec, not optional architectural complexity.

## Phase 0: Research

Completed in [research.md](research.md). Decisions cover NestJS module structure, MongoDB transactions, replica set local/test/container support, first-party JWT auth, versioned migrations, non-persisted Borrowing Policy, validation/error handling, OpenAPI docs, and container deployment.

## Phase 1: Design & Contracts

Completed design artifacts:

- [data-model.md](data-model.md)
- [contracts/openapi.md](contracts/openapi.md)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- **Security and Privacy**: PASS. Contracts include auth endpoints and require bearer auth on management endpoints; data model includes Staff/Admin User.
- **Correctness and Data Integrity**: PASS. Borrow/return workflows use transactions; local/test/container MongoDB must support transactions.
- **Auditability**: PASS. State-changing entities include audit actor fields; authenticated actor context is required.
- **Migration Reviewability**: PASS. Data model and quickstart include migration record and versioned migration flow with rollback notes.
- **Testing**: PASS. Design requires unit, integration, e2e, auth, authorization, migration, and transaction consistency tests.
- **Operability**: PASS. Container stack, replica set requirement, health endpoint, env config, and migration commands are documented.
