# Tasks: Book Borrowing System

**Input**: Design documents from `/specs/001-book-borrowing-system/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.md, quickstart.md

**Tests**: Included because the constitution and implementation plan require automated tests for borrowing rules, authorization-sensitive behavior, and API/database behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks.
- **[Story]**: Maps task to a user story from `spec.md`.
- Every task includes an exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the NestJS/MongoDB service for feature work, container deployment, and documented API behavior.

- [ ] T001 Add recommended dependencies and scripts for config, Swagger, auth, password hashing, and MongoDB integration tests in package.json
- [ ] T002 [P] Create environment example with `MONGODB_URI`, `PORT`, and auth placeholders in .env.example
- [ ] T003 [P] Create database configuration helper in src/config/database.config.ts
- [ ] T004 Update MongoDB connection to use environment-based config in src/app.module.ts
- [ ] T005 Enable global validation and predictable DTO transformation in src/main.ts
- [ ] T006 Add Swagger bootstrap for API documentation in src/main.ts
- [ ] T007 [P] Add production app container definition in Dockerfile
- [ ] T008 Update local container stack with app service, MongoDB service, health check, and env wiring in docker-compose.yml
- [ ] T009 [P] Create health endpoint module, controller, and service in src/health/health.module.ts, src/health/health.controller.ts, and src/health/health.service.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared domain, auth, validation, audit, and testing infrastructure that all user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T010 [P] Define shared status and role enums in src/common/enums/library-status.enum.ts
- [ ] T011 [P] Define shared pagination and list query DTOs in src/common/dto/pagination-query.dto.ts
- [ ] T012 [P] Define audit field schema helper for Mongoose documents in src/common/audit/audit-fields.schema.ts
- [ ] T013 [P] Implement domain exception helpers for business rule conflicts in src/common/exceptions/domain-conflict.exception.ts
- [ ] T014 Implement HTTP exception filter for validation and domain errors in src/common/filters/http-exception.filter.ts
- [ ] T015 [P] Implement staff/admin role decorator in src/auth/roles.decorator.ts
- [ ] T016 Implement roles guard for server-side authorization in src/auth/roles.guard.ts
- [ ] T017 Create auth module that exposes role guard wiring in src/auth/auth.module.ts
- [ ] T018 Register auth module, health module, and global exception filter in src/app.module.ts
- [ ] T019 [P] Create MongoDB integration test setup utilities in test/utils/mongo-test-setup.ts
- [ ] T020 [P] Create authenticated request test helpers for staff/admin roles in test/utils/auth-test-helpers.ts

**Checkpoint**: Foundation ready; user story implementation can now begin.

---

## Phase 3: User Story 1 - Manage Borrowable Book Collection (Priority: P1) MVP

**Goal**: Staff can maintain book categories and aggregate book records with total and available quantities.

**Independent Test**: Add a category, create a book with quantity, list and view availability, and confirm quantity cannot be reduced below active loans.

### Tests for User Story 1

- [ ] T021 [P] [US1] Add unit tests for book category validation and service behavior in src/book-categories/book-categories.service.spec.ts
- [ ] T022 [P] [US1] Add unit tests for book quantity and deactivation rules in src/books/books.service.spec.ts
- [ ] T023 [P] [US1] Add e2e tests for category and book collection endpoints in test/book-collection.e2e-spec.ts

### Implementation for User Story 1

- [ ] T024 [P] [US1] Create Book Category schema with unique code and loan period indexes in src/book-categories/schemas/book-category.schema.ts
- [ ] T025 [P] [US1] Create Book Category DTOs for create, update, and query operations in src/book-categories/dto/book-category.dto.ts
- [ ] T026 [US1] Implement Book Categories service with create, list, update, and active validation in src/book-categories/book-categories.service.ts
- [ ] T027 [US1] Implement Book Categories controller endpoints from the contract in src/book-categories/book-categories.controller.ts
- [ ] T028 [US1] Create Book Categories module with Mongoose model registration in src/book-categories/book-categories.module.ts
- [ ] T029 [US1] Expand Book schema with catalog identifier, category reference, total quantity, available quantity, status, audit fields, and indexes in src/books/schemas/book.schema.ts
- [ ] T030 [US1] Update Book DTOs for create, update, and query operations with aggregate quantity validation in src/books/dto/book.dto.ts
- [ ] T031 [US1] Update Book interface or document type to match the planned data model in src/books/interfaces/book.interface.ts
- [ ] T032 [US1] Update Books service for create, list, detail, update quantity, deactivation, and active-loan quantity checks in src/books/books.service.ts
- [ ] T033 [US1] Update Books controller endpoints and query parameters from the contract in src/books/books.controller.ts
- [ ] T034 [US1] Register Book Categories module and updated Books module dependencies in src/app.module.ts

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Track Member Borrowing Limits (Priority: P2)

**Goal**: Staff can manage membership types and members, and the system can determine each member's borrowing limit from membership type.

**Independent Test**: Create a membership type with a limit, create an active member assigned to it, view active loan count, and confirm inactive or suspended members cannot borrow.

### Tests for User Story 2

- [ ] T035 [P] [US2] Add unit tests for membership type limit validation in src/membership-types/membership-types.service.spec.ts
- [ ] T036 [P] [US2] Add unit tests for member status and membership type eligibility in src/members/members.service.spec.ts
- [ ] T037 [P] [US2] Add e2e tests for membership type and member endpoints in test/membership.e2e-spec.ts

### Implementation for User Story 2

- [ ] T038 [P] [US2] Create Membership Type schema with unique code and max active loans in src/membership-types/schemas/membership-type.schema.ts
- [ ] T039 [P] [US2] Create Membership Type DTOs for create, update, and query operations in src/membership-types/dto/membership-type.dto.ts
- [ ] T040 [US2] Implement Membership Types service with active policy validation in src/membership-types/membership-types.service.ts
- [ ] T041 [US2] Implement Membership Types controller endpoints from the contract in src/membership-types/membership-types.controller.ts
- [ ] T042 [US2] Create Membership Types module with Mongoose model registration in src/membership-types/membership-types.module.ts
- [ ] T043 [P] [US2] Create Member schema with member number, membership type reference, status, active loan count, audit fields, and indexes in src/members/schemas/member.schema.ts
- [ ] T044 [P] [US2] Create Member DTOs for create, update, and query operations in src/members/dto/member.dto.ts
- [ ] T045 [US2] Implement Members service with eligibility checks and membership type lookup in src/members/members.service.ts
- [ ] T046 [US2] Implement Members controller endpoints including member borrowing history route in src/members/members.controller.ts
- [ ] T047 [US2] Create Members module with Mongoose model registration and Membership Types dependency in src/members/members.module.ts
- [ ] T048 [US2] Register Membership Types and Members modules in src/app.module.ts

**Checkpoint**: User Stories 1 and 2 work independently and expose the data needed for borrowing eligibility.

---

## Phase 5: User Story 3 - Manage Borrowing Lifecycle (Priority: P3)

**Goal**: Staff can create borrowing records, get category-calculated due dates, return books, and identify overdue loans while enforcing availability, member limits, and overdue blocks.

**Independent Test**: Lend an available book to an eligible member, verify due date and availability decrease, return it once, verify availability increase, and confirm unavailable, limit-exceeded, inactive-member, and overdue-member borrowing attempts are blocked.

### Tests for User Story 3

- [ ] T049 [P] [US3] Add unit tests for due date calculation from book category in src/borrowings/borrowings.service.spec.ts
- [ ] T050 [P] [US3] Add unit tests for borrow eligibility failures in src/borrowings/borrowings-rules.service.spec.ts
- [ ] T051 [P] [US3] Add integration tests for transactional borrow and return consistency in test/borrowing.e2e-spec.ts
- [ ] T052 [P] [US3] Add authorization tests for borrowing state-changing endpoints in test/authorization.e2e-spec.ts

### Implementation for User Story 3

- [ ] T053 [P] [US3] Create Borrowing Record schema with member, book, category snapshot, dates, status, staff audit fields, and indexes in src/borrowings/schemas/borrowing.schema.ts
- [ ] T054 [P] [US3] Create Borrowing DTOs for create, return, and query operations in src/borrowings/dto/borrowing.dto.ts
- [ ] T055 [P] [US3] Implement borrowing rules service for availability, membership limit, member status, overdue block, and category loan-period validation in src/borrowings/borrowings-rules.service.ts
- [ ] T056 [US3] Implement Borrowings service with MongoDB transaction for create borrowing and aggregate count updates in src/borrowings/borrowings.service.ts
- [ ] T057 [US3] Implement return workflow with idempotency guard and aggregate count updates in src/borrowings/borrowings.service.ts
- [ ] T058 [US3] Implement overdue query and deterministic overdue status evaluation in src/borrowings/borrowings.service.ts
- [ ] T059 [US3] Implement Borrowings controller endpoints from the contract in src/borrowings/borrowings.controller.ts
- [ ] T060 [US3] Create Borrowings module with Mongoose model registration and dependencies on Books, Members, Book Categories, and Membership Types in src/borrowings/borrowings.module.ts
- [ ] T061 [US3] Wire member borrowing history route to Borrowings service in src/members/members.controller.ts
- [ ] T062 [US3] Register Borrowings module in src/app.module.ts

**Checkpoint**: All user stories are independently functional and the complete borrowing lifecycle is testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish documentation, operational readiness, API docs, and regression verification across the full feature.

- [ ] T063 [P] Update project README with library API setup, environment variables, test commands, and container commands in README.md
- [ ] T064 [P] Add OpenAPI annotations to book DTOs in src/books/dto/book.dto.ts
- [ ] T065 [P] Add OpenAPI annotations to member DTOs in src/members/dto/member.dto.ts
- [ ] T066 [P] Add OpenAPI annotations to borrowing DTOs in src/borrowings/dto/borrowing.dto.ts
- [ ] T067 [P] Add OpenAPI annotations to book category DTOs in src/book-categories/dto/book-category.dto.ts
- [ ] T068 [P] Add OpenAPI annotations to membership type DTOs in src/membership-types/dto/membership-type.dto.ts
- [ ] T069 Add API examples and expected validation errors to quickstart documentation in specs/001-book-borrowing-system/quickstart.md
- [ ] T070 Review and remove unsafe console logging from existing controllers and middleware in src/books/books.controller.ts
- [ ] T071 Run and fix `npm run lint` issues across src and test files in package.json
- [ ] T072 Run and fix `npm run test` failures across unit specs in package.json
- [ ] T073 Run and fix `npm run test:e2e` failures across e2e specs in package.json
- [ ] T074 Run and fix `npm run build` production compilation issues in package.json
- [ ] T075 Validate container startup and health check with `docker compose up --build` using docker-compose.yml

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; recommended MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; can be built alongside US1 after shared foundation, but borrowing readiness improves after US1 exists.
- **User Story 3 (Phase 5)**: Depends on US1 and US2 domain modules because borrowing needs books, categories, members, and membership types.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 - Manage Borrowable Book Collection**: First deliverable and MVP; no dependency on US2 or US3.
- **US2 - Track Member Borrowing Limits**: Independent member policy deliverable; no dependency on US3.
- **US3 - Manage Borrowing Lifecycle**: Requires US1 and US2 data and services.

### Within Each User Story

- Test tasks should be written first and fail before implementation.
- Schemas and DTOs before services.
- Services before controllers.
- Controllers before e2e verification.
- Story checkpoint must pass before moving to the next priority unless work is intentionally parallelized.

## Parallel Opportunities

- Setup tasks T002, T003, T007, and T009 can run in parallel.
- Foundational tasks T010, T011, T012, T013, T015, T019, and T020 can run in parallel.
- US1 tests T021, T022, and T023 can run in parallel, followed by schema/DTO tasks T024 and T025.
- US2 tests T035, T036, and T037 can run in parallel, followed by schema/DTO tasks T038, T039, T043, and T044.
- US3 tests T049, T050, T051, and T052 can run in parallel, followed by schema/DTO/rules tasks T053, T054, and T055.
- Documentation tasks T063 through T069 can run in parallel after implementation stabilizes.

## Parallel Example: User Story 1

```text
Task: "T021 [P] [US1] Add unit tests for book category validation and service behavior in src/book-categories/book-categories.service.spec.ts"
Task: "T022 [P] [US1] Add unit tests for book quantity and deactivation rules in src/books/books.service.spec.ts"
Task: "T023 [P] [US1] Add e2e tests for category and book collection endpoints in test/book-collection.e2e-spec.ts"
Task: "T024 [P] [US1] Create Book Category schema with unique code and loan period indexes in src/book-categories/schemas/book-category.schema.ts"
Task: "T025 [P] [US1] Create Book Category DTOs for create, update, and query operations in src/book-categories/dto/book-category.dto.ts"
```

## Parallel Example: User Story 2

```text
Task: "T035 [P] [US2] Add unit tests for membership type limit validation in src/membership-types/membership-types.service.spec.ts"
Task: "T036 [P] [US2] Add unit tests for member status and membership type eligibility in src/members/members.service.spec.ts"
Task: "T038 [P] [US2] Create Membership Type schema with unique code and max active loans in src/membership-types/schemas/membership-type.schema.ts"
Task: "T043 [P] [US2] Create Member schema with member number, membership type reference, status, active loan count, audit fields, and indexes in src/members/schemas/member.schema.ts"
```

## Parallel Example: User Story 3

```text
Task: "T049 [P] [US3] Add unit tests for due date calculation from book category in src/borrowings/borrowings.service.spec.ts"
Task: "T050 [P] [US3] Add unit tests for borrow eligibility failures in src/borrowings/borrowings-rules.service.spec.ts"
Task: "T053 [P] [US3] Create Borrowing Record schema with member, book, category snapshot, dates, status, staff audit fields, and indexes in src/borrowings/schemas/borrowing.schema.ts"
Task: "T055 [P] [US3] Implement borrowing rules service for availability, membership limit, member status, overdue block, and category loan-period validation in src/borrowings/borrowings-rules.service.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation.
3. Complete Phase 3 User Story 1.
4. Stop and validate category/book APIs, aggregate quantity validation, and book availability listing.

### Incremental Delivery

1. Deliver US1 for collection management and availability.
2. Deliver US2 for member and membership limit management.
3. Deliver US3 for borrowing, return, overdue, and eligibility enforcement.
4. Finish Phase 6 documentation, container verification, and full regression.

### Validation Commands

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
docker compose up --build
```

## Notes

- `[P]` tasks touch separate files and can run in parallel after their phase prerequisites are met.
- `[US1]`, `[US2]`, and `[US3]` map directly to the prioritized user stories in `spec.md`.
- Tests are listed before implementation tasks to support fail-first verification for business-critical rules.
- Commit after each phase or cohesive story checkpoint.
