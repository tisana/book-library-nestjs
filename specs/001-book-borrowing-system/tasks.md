# Tasks: Book Borrowing System

**Input**: Design documents from `/specs/001-book-borrowing-system/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.md, quickstart.md

**Tests**: Included because the constitution and plan require automated coverage for authN/authZ, domain rules, migrations, API/database behavior, and transaction consistency.

**Organization**: Tasks are grouped by setup, shared foundation, and prioritized user stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks.
- **[Story]**: Required only for user story implementation phases.
- Every task includes at least one exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare dependencies, configuration, container runtime, health checks, and migration command scaffolding.

- [X] T001 Update dependencies and scripts for config, Swagger, JWT auth, Passport, password hashing, migrations, and MongoDB integration tests in package.json
- [X] T002 [P] Create environment example with `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, and initial admin placeholders in .env.example
- [X] T003 [P] Create database configuration helper in src/config/database.config.ts
- [X] T004 [P] Create auth configuration helper in src/config/auth.config.ts
- [X] T005 Update MongoDB connection to use environment-based configuration in src/app.module.ts
- [X] T006 Enable global validation, DTO transformation, and global exception filter registration in src/main.ts
- [X] T007 Add Swagger bootstrap and bearer auth setup in src/main.ts
- [X] T008 [P] Add production app container definition in Dockerfile
- [X] T009 Configure app and MongoDB replica set services for local transaction support in docker-compose.yml
- [X] T010 [P] Create health endpoint module in src/health/health.module.ts
- [X] T011 [P] Create health endpoint controller in src/health/health.controller.ts
- [X] T012 [P] Create health endpoint service in src/health/health.service.ts
- [X] T013 [P] Create migration runner entrypoint in migrations/migrate.ts
- [X] T014 [P] Document migration usage and rollback-note requirements in migrations/README.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared auth, audit, migration, error, enum, and test infrastructure required before any user story work.

**CRITICAL**: No user story work can begin until this phase is complete.

### Foundational Tests

- [X] T015 [P] Add unit tests for staff/admin password hashing and redaction in src/staff-users/staff-users.service.spec.ts
- [X] T016 [P] Add unit tests for JWT login and inactive-user rejection in src/auth/auth.service.spec.ts and e2e login plus staff-users authorization coverage in test/auth.e2e-spec.ts
- [X] T017 [P] Add unit tests for role authorization guard behavior in src/auth/roles.guard.spec.ts
- [X] T018 [P] Add integration tests for migration apply-once behavior and rollback metadata in test/migrations.e2e-spec.ts
- [X] T019 [P] Add integration test utilities for transaction-capable MongoDB in test/utils/mongo-test-setup.ts
- [X] T020 [P] Add authenticated request helpers for staff/admin roles in test/utils/auth-test-helpers.ts

### Foundational Implementation

- [X] T021 [P] Define shared status, role, and loan-state enums in src/common/enums/library-status.enum.ts
- [X] T022 [P] Define shared pagination and list query DTOs in src/common/dto/pagination-query.dto.ts
- [X] T023 [P] Define audit field schema helper for Mongoose documents in src/common/audit/audit-fields.schema.ts
- [X] T024 [P] Implement current-user audit context type in src/common/audit/audit-context.ts
- [X] T025 [P] Implement domain exception helper for business rule conflicts in src/common/exceptions/domain-conflict.exception.ts
- [X] T026 Implement HTTP exception filter for validation and domain errors in src/common/filters/http-exception.filter.ts
- [X] T027 [P] Create Staff/Admin User schema with password hash, roles, status, and audit fields in src/staff-users/schemas/staff-user.schema.ts
- [X] T028 [P] Create Staff/Admin User DTOs for create, login-safe response, and query operations in src/staff-users/dto/staff-user.dto.ts
- [X] T029 Implement Staff Users service with password hashing, credential redaction, role assignment, and active-user checks in src/staff-users/staff-users.service.ts
- [X] T030 Implement admin-guarded Staff Users controller endpoints and module wiring in src/staff-users/staff-users.controller.ts and src/staff-users/staff-users.module.ts
- [X] T031 [P] Implement current user decorator for authenticated actor access in src/auth/current-user.decorator.ts
- [X] T032 [P] Implement roles decorator for staff/admin route authorization in src/auth/roles.decorator.ts
- [X] T033 Implement JWT strategy for bearer token validation and active staff/admin lookup in src/auth/jwt.strategy.ts
- [X] T034 Implement role guard for server-side staff/admin authorization in src/auth/roles.guard.ts
- [X] T035 Implement Auth service for first-party staff/admin login and JWT issuance in src/auth/auth.service.ts
- [X] T036 Implement Auth controller login endpoint in src/auth/auth.controller.ts
- [X] T037 Create Auth module wiring JWT, Passport, Staff Users, strategy, and guards in src/auth/auth.module.ts
- [X] T038 Register Auth, Staff Users, Health, and global exception filter providers in src/app.module.ts
- [X] T039 [P] Define Migration Record schema or migration metadata collection contract in migrations/versions/000-migration-record.ts
- [X] T040 Create initial library-core migration for indexes, reference data, and initial admin seed support in migrations/versions/001-library-core.ts
- [X] T041 Wire migration commands and status output to npm scripts in package.json

**Checkpoint**: Foundation ready; user story implementation can now begin.

---

## Phase 3: User Story 1 - Manage Borrowable Book Collection (Priority: P1) MVP

**Goal**: Staff can manage book categories and aggregate book records with visible total and available quantities.

**Independent Test**: Add a category, create a book with quantity, view availability, and confirm zero-availability books display as unavailable in collection views.

### Tests for User Story 1

- [X] T042 [P] [US1] Add unit tests for book category validation and loan period rules in src/book-categories/book-categories.service.spec.ts
- [X] T043 [P] [US1] Add unit tests for book aggregate quantity, unavailable display status, and deactivation rules in src/books/books.service.spec.ts
- [X] T044 [P] [US1] Add authorization tests for category and book management endpoints in test/book-collection-authorization.e2e-spec.ts
- [X] T045 [P] [US1] Add e2e tests for category and book collection endpoints in test/book-collection.e2e-spec.ts

### Implementation for User Story 1

- [X] T046 [P] [US1] Create Book Category schema with unique code, status, loan period, audit fields, and indexes in src/book-categories/schemas/book-category.schema.ts
- [X] T047 [P] [US1] Create Book Category DTOs for create, update, and query operations in src/book-categories/dto/book-category.dto.ts
- [X] T048 [US1] Implement Book Categories service with create, list, update, deactivation, and active loan-period validation in src/book-categories/book-categories.service.ts
- [X] T049 [US1] Implement Book Categories controller endpoints with staff/admin guards in src/book-categories/book-categories.controller.ts
- [X] T050 [US1] Create Book Categories module with Mongoose model registration in src/book-categories/book-categories.module.ts
- [X] T051 [US1] Expand Book schema with catalog identifier, category reference, total quantity, available quantity, status, audit fields, and indexes in src/books/schemas/book.schema.ts
- [X] T052 [US1] Update Book DTOs for create, update, and query operations with aggregate quantity validation in src/books/dto/book.dto.ts
- [X] T053 [US1] Update Book interface or document type to match the planned data model in src/books/interfaces/book.interface.ts
- [X] T054 [US1] Update Books service for create, list, detail, zero-availability display, quantity update, deactivation, and active-loan quantity checks in src/books/books.service.ts
- [X] T055 [US1] Update Books controller endpoints, query parameters, and staff/admin guards in src/books/books.controller.ts
- [X] T056 [US1] Register Book Categories module and updated Books module dependencies in src/app.module.ts
- [X] T057 [US1] Add book and category indexes to initial migration in migrations/versions/001-library-core.ts

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Track Member Borrowing Limits (Priority: P2)

**Goal**: Staff can manage membership types and members, and the system can show member borrowing eligibility by policy status and remaining allowance.

**Independent Test**: Create a membership type with a limit, create an active member assigned to it, set or view active borrowed count, and confirm the system shows whether the member is within or at the configured limit.

### Tests for User Story 2

- [X] T058 [P] [US2] Add unit tests for membership type limit validation and deactivation rules in src/membership-types/membership-types.service.spec.ts
- [X] T059 [P] [US2] Add unit tests for member status, remaining allowance, and membership type eligibility in src/members/members.service.spec.ts
- [X] T060 [P] [US2] Add authorization tests for membership type and member endpoints in test/membership-authorization.e2e-spec.ts
- [X] T061 [P] [US2] Add e2e tests for membership type and member policy status endpoints in test/membership.e2e-spec.ts

### Implementation for User Story 2

- [X] T062 [P] [US2] Create Membership Type schema with unique code, max active loans, status, audit fields, and indexes in src/membership-types/schemas/membership-type.schema.ts
- [X] T063 [P] [US2] Create Membership Type DTOs for create, update, and query operations in src/membership-types/dto/membership-type.dto.ts
- [X] T064 [US2] Implement Membership Types service with active policy validation in src/membership-types/membership-types.service.ts
- [X] T065 [US2] Implement Membership Types controller endpoints with staff/admin guards in src/membership-types/membership-types.controller.ts
- [X] T066 [US2] Create Membership Types module with Mongoose model registration in src/membership-types/membership-types.module.ts
- [X] T067 [P] [US2] Create Member schema with member number, membership type reference, status, active loan count, audit fields, and indexes in src/members/schemas/member.schema.ts
- [X] T068 [P] [US2] Create Member DTOs for create, update, query, and policy status response operations in src/members/dto/member.dto.ts
- [X] T069 [US2] Implement Members service with create, update, list, remaining allowance, status eligibility, and membership type lookup in src/members/members.service.ts
- [X] T070 [US2] Implement Members controller endpoints including policy status and staff/admin guards in src/members/members.controller.ts
- [X] T071 [US2] Create Members module with Mongoose model registration and Membership Types dependency in src/members/members.module.ts
- [X] T072 [US2] Register Membership Types and Members modules in src/app.module.ts
- [X] T073 [US2] Add membership type and member indexes to initial migration in migrations/versions/001-library-core.ts

**Checkpoint**: User Stories 1 and 2 work independently and expose the data needed for borrowing eligibility.

---

## Phase 5: User Story 3 - Manage Borrowing Lifecycle (Priority: P3)

**Goal**: Staff can create borrowing records, calculate due dates from book category, return books, and identify overdue loans while enforcing availability, member limits, overdue blocks, auth, audit, and transaction consistency.

**Independent Test**: Lend an available book to an eligible member, verify due date and availability decrease, return it once, verify availability increase, and confirm unavailable, limit-exceeded, inactive-member, unauthorized, and overdue-member attempts are blocked.

### Tests for User Story 3

- [X] T074 [P] [US3] Add unit tests for due date calculation from book category in src/borrowings/borrowings.service.spec.ts
- [X] T075 [P] [US3] Add unit tests for non-persisted Borrowing Policy eligibility failures in src/borrowings/borrowings-rules.service.spec.ts
- [X] T076 [P] [US3] Add integration tests for transactional borrow and return consistency in test/borrowing.e2e-spec.ts
- [X] T077 [P] [US3] Add authorization tests for borrowing state-changing endpoints in test/authorization.e2e-spec.ts
- [X] T078 [P] [US3] Add e2e tests for overdue listing and overdue borrowing block in test/borrowing-overdue.e2e-spec.ts

### Implementation for User Story 3

- [X] T079 [P] [US3] Create Borrowing Record schema with member, book, category snapshot, dates, status, staff audit fields, and indexes in src/borrowings/schemas/borrowing.schema.ts
- [X] T080 [P] [US3] Create Borrowing DTOs for create, return, and query operations in src/borrowings/dto/borrowing.dto.ts
- [X] T081 [P] [US3] Implement non-persisted Borrowing Policy rules service for availability, membership limit, member status, overdue block, and category loan-period validation in src/borrowings/borrowings-rules.service.ts
- [X] T082 [US3] Implement Borrowings service with MongoDB transaction for create borrowing, due date calculation, actor audit fields, and aggregate count updates in src/borrowings/borrowings.service.ts
- [X] T083 [US3] Implement return workflow with transaction, idempotency guard, actor audit fields, and aggregate count updates in src/borrowings/borrowings.service.ts
- [X] T084 [US3] Implement overdue query and deterministic overdue status evaluation in src/borrowings/borrowings.service.ts
- [X] T085 [US3] Implement Borrowings controller endpoints from the contract with staff/admin guards in src/borrowings/borrowings.controller.ts
- [X] T086 [US3] Create Borrowings module with Mongoose model registration and dependencies on Books, Members, Book Categories, and Membership Types in src/borrowings/borrowings.module.ts
- [X] T087 [US3] Wire member borrowing history route to Borrowings service with authorization in src/members/members.controller.ts
- [X] T088 [US3] Register Borrowings module in src/app.module.ts
- [X] T089 [US3] Add borrowing record indexes to initial migration in migrations/versions/001-library-core.ts

**Checkpoint**: All user stories are independently functional and the complete borrowing lifecycle is testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish documentation, generated API docs, operational readiness, and full verification.

- [ ] T090 [P] Update project README with library API setup, auth, migrations, replica set MongoDB, environment variables, tests, and container commands in README.md
- [ ] T091 [P] Add OpenAPI annotations to auth DTOs in src/auth/auth.controller.ts
- [ ] T092 [P] Add OpenAPI annotations to staff user DTOs in src/staff-users/dto/staff-user.dto.ts
- [ ] T093 [P] Add OpenAPI annotations to book DTOs in src/books/dto/book.dto.ts
- [ ] T094 [P] Add OpenAPI annotations to book category DTOs in src/book-categories/dto/book-category.dto.ts
- [ ] T095 [P] Add OpenAPI annotations to membership type DTOs in src/membership-types/dto/membership-type.dto.ts
- [ ] T096 [P] Add OpenAPI annotations to member DTOs in src/members/dto/member.dto.ts
- [ ] T097 [P] Add OpenAPI annotations to borrowing DTOs in src/borrowings/dto/borrowing.dto.ts
- [ ] T098 Update quickstart verification examples for auth, migrations, and transaction-capable MongoDB in specs/001-book-borrowing-system/quickstart.md
- [ ] T099 Remove unsafe console logging and sensitive data exposure from existing controller and middleware code in src/books/books.controller.ts
- [ ] T100 Run and fix `npm run lint` issues across source and test files in package.json
- [ ] T101 Run and fix `npm run test` failures across unit specs in package.json
- [ ] T102 Run and fix `npm run test:e2e` failures across e2e specs in package.json
- [ ] T103 Run and fix `npm run migrate:status` and migration command failures in package.json
- [ ] T104 Run and fix `npm run build` production compilation issues in package.json
- [ ] T105 Validate container startup, MongoDB replica set readiness, migrations, and health check with `docker compose up --build` using docker-compose.yml

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; recommended MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; can proceed after shared foundation.
- **User Story 3 (Phase 5)**: Depends on US1 and US2 domain modules because borrowing needs books, categories, members, membership types, auth, and migration support.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 - Manage Borrowable Book Collection**: First deliverable and MVP; no dependency on US2 or US3.
- **US2 - Track Member Borrowing Limits**: Independent member policy-status deliverable; no dependency on US3.
- **US3 - Manage Borrowing Lifecycle**: Requires US1 and US2 data/services plus foundational auth, migrations, and transaction-capable MongoDB.

### Within Each User Story

- Test tasks should be written first and fail before implementation.
- Schemas and DTOs before services.
- Services before controllers.
- Controllers before e2e verification.
- Migration index tasks land after model shapes are defined.
- Story checkpoint must pass before moving to the next priority unless work is intentionally parallelized.

## Parallel Opportunities

- Setup tasks T002, T003, T004, T008, T010, T011, T012, T013, and T014 can run in parallel.
- Foundational tests T015 through T020 can run in parallel.
- Foundational helper/schema tasks T021 through T028 and T031 through T032 can run in parallel.
- US1 tests T042 through T045 can run in parallel, followed by schema/DTO tasks T046 and T047.
- US2 tests T058 through T061 can run in parallel, followed by schema/DTO tasks T062, T063, T067, and T068.
- US3 tests T074 through T078 can run in parallel, followed by schema/DTO/rules tasks T079, T080, and T081.
- Polish OpenAPI tasks T091 through T097 can run in parallel after DTOs stabilize.

## Parallel Example: User Story 1

```text
Task: "T042 [P] [US1] Add unit tests for book category validation and loan period rules in src/book-categories/book-categories.service.spec.ts"
Task: "T043 [P] [US1] Add unit tests for book aggregate quantity, unavailable display status, and deactivation rules in src/books/books.service.spec.ts"
Task: "T046 [P] [US1] Create Book Category schema with unique code, status, loan period, audit fields, and indexes in src/book-categories/schemas/book-category.schema.ts"
Task: "T047 [P] [US1] Create Book Category DTOs for create, update, and query operations in src/book-categories/dto/book-category.dto.ts"
```

## Parallel Example: User Story 2

```text
Task: "T058 [P] [US2] Add unit tests for membership type limit validation and deactivation rules in src/membership-types/membership-types.service.spec.ts"
Task: "T059 [P] [US2] Add unit tests for member status, remaining allowance, and membership type eligibility in src/members/members.service.spec.ts"
Task: "T062 [P] [US2] Create Membership Type schema with unique code, max active loans, status, audit fields, and indexes in src/membership-types/schemas/membership-type.schema.ts"
Task: "T067 [P] [US2] Create Member schema with member number, membership type reference, status, active loan count, audit fields, and indexes in src/members/schemas/member.schema.ts"
```

## Parallel Example: User Story 3

```text
Task: "T074 [P] [US3] Add unit tests for due date calculation from book category in src/borrowings/borrowings.service.spec.ts"
Task: "T075 [P] [US3] Add unit tests for non-persisted Borrowing Policy eligibility failures in src/borrowings/borrowings-rules.service.spec.ts"
Task: "T079 [P] [US3] Create Borrowing Record schema with member, book, category snapshot, dates, status, staff audit fields, and indexes in src/borrowings/schemas/borrowing.schema.ts"
Task: "T081 [P] [US3] Implement non-persisted Borrowing Policy rules service for availability, membership limit, member status, overdue block, and category loan-period validation in src/borrowings/borrowings-rules.service.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation, including auth, migrations, and transaction-capable test utilities.
3. Complete Phase 3 User Story 1.
4. Stop and validate authenticated category/book APIs, aggregate quantity validation, and zero-availability display.

### Incremental Delivery

1. Deliver US1 for authenticated collection management and availability display.
2. Deliver US2 for member and membership limit management plus policy status.
3. Deliver US3 for borrowing, return, overdue, authorization, audit, and transaction consistency.
4. Finish Phase 6 documentation, OpenAPI metadata, container verification, and full regression.

### Validation Commands

```bash
npm run lint
npm run test
npm run test:e2e
npm run migrate:up
npm run migrate:status
npm run build
docker compose up --build
```

## Notes

- `[P]` tasks touch separate files and can run in parallel after their phase prerequisites are met.
- `[US1]`, `[US2]`, and `[US3]` map directly to the prioritized user stories in `spec.md`.
- Tests are listed before implementation tasks to support fail-first verification for business-critical rules.
- Commit after each phase or cohesive story checkpoint.
