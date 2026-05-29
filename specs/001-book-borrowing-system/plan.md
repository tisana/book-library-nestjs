# Implementation Plan: Book Borrowing System

**Branch**: `001-book-borrowing-system` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-book-borrowing-system/spec.md`

## Summary

Build a staff-facing library borrowing API on the existing NestJS service and MongoDB baseline. Extend the current books module from simple quantity storage into a domain model with book categories, membership types, members, and borrowing records. Enforce core library rules in application services: aggregate book availability, membership-type borrowing limits, category-based due dates, overdue borrowing blocks, soft deactivation, validation, and auditable state changes.

## Technical Context

**Language/Version**: TypeScript 5.9.3 on Node.js, NestJS 11.x

**Primary Dependencies**: Existing `@nestjs/common`, `@nestjs/core`, `@nestjs/mongoose`, `mongoose`, `class-validator`, `class-transformer`; recommended additions: `@nestjs/config` for environment configuration, `@nestjs/swagger` for API contract generation, `mongodb-memory-server` for isolated integration tests, and auth libraries if no project auth exists yet (`@nestjs/passport`, `passport-jwt`, `@nestjs/jwt`, password hashing with `bcrypt` or `argon2`)

**Storage**: MongoDB via Mongoose. Existing connection is hardcoded to `mongodb://localhost/bookstore`; plan changes this to environment-driven configuration.

**Testing**: Jest unit tests for domain services and Nest testing utilities plus Supertest for API/e2e tests. Add MongoDB-backed integration tests for borrowing and return consistency.

**Target Platform**: Containerized Linux service with app container plus MongoDB container.

**Project Type**: Backend web service/API.

**Performance Goals**: Staff can complete valid borrowing in under 1 minute; active/overdue member loan lookup in under 30 seconds; common list/search endpoints return within interactive API time under normal library load.

**Constraints**: Preserve borrowing history; no hard delete for historical entities; server-side validation and authorization for non-public actions; deterministic date calculations; aggregate book quantity model for v1.

**Scale/Scope**: Single library-like deployment, no multi-branch, no payment processing, no barcode/RFID, no public discovery portal in this feature.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **User-Centered Library Workflow**: PASS. Feature serves staff workflows for inventory, membership, loans, returns, and overdue tracking.
- **Correctness Over Cleverness**: PASS with documented aggregate-quantity decision. Availability invariant is `availableQuantity >= 0` and `activeLoans <= totalQuantity` instead of per-copy identifiers for v1.
- **Security and Privacy by Default**: PASS with required server-side auth/authorization in API contracts. Existing app lacks auth, so implementation must add or integrate an auth/roles boundary before exposing protected actions.
- **Spec-First, Traceable Changes**: PASS. Plan is derived from clarified spec and records tradeoffs.
- **Test the Rules That Matter**: PASS. Borrowing limit, availability, due-date, overdue block, return idempotency, and authorization tests are required.
- **Maintainable Architecture**: PASS. Add explicit modules/services for domain concepts rather than over-general repositories.
- **Data Integrity and Auditability**: PASS. State-changing records include audit fields and are updated in transactions where consistency matters.
- **Usability and Accessibility**: PASS for backend scope through predictable validation messages, filtering, and status fields.
- **Performance With Practical Limits**: PASS. Indexes planned for list/search and borrowing-state queries.
- **Operability and Observability**: PASS. Add env-based config, container health checks, and safe operational logging.

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
├── config/
│   └── database.config.ts
├── auth/
│   ├── auth.module.ts
│   ├── roles.decorator.ts
│   └── roles.guard.ts
├── books/
│   ├── books.module.ts
│   ├── books.controller.ts
│   ├── books.service.ts
│   ├── dto/
│   ├── interfaces/
│   └── schemas/
├── book-categories/
│   ├── book-categories.module.ts
│   ├── book-categories.controller.ts
│   ├── book-categories.service.ts
│   ├── dto/
│   └── schemas/
├── membership-types/
│   ├── membership-types.module.ts
│   ├── membership-types.controller.ts
│   ├── membership-types.service.ts
│   ├── dto/
│   └── schemas/
├── members/
│   ├── members.module.ts
│   ├── members.controller.ts
│   ├── members.service.ts
│   ├── dto/
│   └── schemas/
├── borrowings/
│   ├── borrowings.module.ts
│   ├── borrowings.controller.ts
│   ├── borrowings.service.ts
│   ├── dto/
│   └── schemas/
└── common/
    ├── dto/
    ├── filters/
    └── audit/

test/
├── app.e2e-spec.ts
└── borrowing.e2e-spec.ts

docker-compose.yml
Dockerfile
```

**Structure Decision**: Keep a single NestJS API application and expand it with feature modules. Reuse and evolve the existing `src/books` module instead of replacing it wholesale. Add new modules for the missing domain concepts and cross-cutting `common`/`auth` helpers only where required by the constitution.

## Complexity Tracking

No constitution gate violations require complexity tracking. The aggregate book quantity model is a deliberate v1 scope choice from the clarified spec and is represented as an aggregate invariant rather than an individual-copy subsystem.

## Phase 0: Research

Completed in [research.md](research.md). All planning unknowns are resolved with decisions for architecture, MongoDB consistency, validation, authorization, testing, containers, and operational configuration.

## Phase 1: Design & Contracts

Completed design artifacts:

- [data-model.md](data-model.md)
- [contracts/openapi.md](contracts/openapi.md)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- **Security and Privacy**: PASS. Contracts require authenticated staff/admin roles; implementation tasks must add role enforcement before non-public endpoints are considered complete.
- **Correctness and Data Integrity**: PASS. Borrow and return workflows use transactional updates and explicit statuses.
- **Auditability**: PASS. Data model includes `createdBy`, `updatedBy`, `borrowedByStaffId`, and `returnedByStaffId` fields for state changes.
- **Testing**: PASS. Quickstart and future tasks require unit and integration/e2e coverage for business-critical rules.
- **Operability**: PASS. Plan includes containerized app/MongoDB, env configuration, health endpoint, and non-sensitive logging.
