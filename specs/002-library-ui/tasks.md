# Tasks: Library User Interface

**Input**: Design documents from `/specs/002-library-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the plan and constitution require frontend component/e2e coverage, backend authorization coverage, and validation of staff/member user flows.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the frontend app and shared tooling beside the existing NestJS API.

- [ ] T001 Create the frontend project directory structure in frontend/src, frontend/src/app, frontend/src/routes, frontend/src/features, frontend/src/components, frontend/src/lib, frontend/src/test, and frontend/tests/e2e
- [ ] T002 Initialize frontend/package.json with React, Vite, TypeScript, Tailwind CSS, shadcn/ui support, Radix UI, lucide-react, TanStack Query, TanStack Router, TanStack Table, React Hook Form, Zod, date-fns, Vitest, Testing Library, Playwright, and MSW dependencies
- [ ] T003 Configure Vite and TypeScript in frontend/vite.config.ts, frontend/tsconfig.json, frontend/tsconfig.node.json, and frontend/index.html
- [ ] T004 Configure Tailwind CSS and shadcn/ui base paths in frontend/src/styles.css, frontend/components.json, and frontend/src/components/ui
- [ ] T005 [P] Configure frontend linting and formatting scripts in frontend/package.json and frontend/eslint.config.js
- [ ] T006 [P] Configure Vitest and Testing Library setup in frontend/vitest.config.ts and frontend/src/test/setup.ts
- [ ] T007 [P] Configure Playwright projects for desktop, tablet, and mobile validation in frontend/playwright.config.ts
- [ ] T008 [P] Configure MSW browser and test handlers in frontend/src/test/mocks/server.ts and frontend/src/test/mocks/handlers.ts
- [ ] T009 Add root convenience scripts for frontend development and validation in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core app shell, API, auth, design-system, and member-backend foundations that block all user stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T010 Document MongoDB document shape, embedding/reference decisions, indexes, and migration impact for member authentication support in specs/002-library-ui/data-model.md
- [ ] T011 Add member credential fields, schema validation notes, and required indexes to src/members/schemas/member.schema.ts
- [ ] T012 Create MongoDB migration for member authentication fields and indexes in migrations/versions/002-member-auth.ts
- [ ] T013 Register the member authentication migration in migrations/versions/index.ts
- [ ] T014 Add member password hashing and credential validation support in src/members/members.service.ts
- [ ] T015 Add member login DTOs and response DTOs in src/auth/dto/member-auth.dto.ts
- [ ] T016 Extend JWT payload role-area support for staff and member sessions in src/auth/auth.service.ts and src/auth/jwt.strategy.ts
- [ ] T017 Add member login endpoint POST /auth/member-login in src/auth/auth.controller.ts
- [ ] T018 Add member-only auth guard and current-member decorator in src/auth/member-auth.guard.ts and src/auth/current-member.decorator.ts
- [ ] T019 Add member-scoped read endpoints GET /members/me, GET /members/me/policy-status, GET /members/me/borrowings, and GET /members/me/borrowings/:id in src/members/members.controller.ts
- [ ] T020 Add backend unit tests for member credential validation and member JWT payload handling in src/auth/auth.service.spec.ts
- [ ] T021 Add backend authorization tests proving members cannot access staff member IDs in test/member-auth.e2e-spec.ts
- [ ] T022 Update demo seed data with member login credentials and due-state scenarios in scripts/seed-demo-data.ts
- [ ] T023 Update OpenAPI documentation generation for member auth and member-scoped endpoints in src/main.ts and related DTO decorators
- [ ] T024 Create frontend API client with base URL, error normalization, session-expired handling, and typed request helpers in frontend/src/lib/api/client.ts
- [ ] T025 Create frontend API type and view-model definitions in frontend/src/lib/api/types.ts
- [ ] T026 Create TanStack Query client and invalidation helpers in frontend/src/app/query-client.ts and frontend/src/lib/api/query-keys.ts
- [ ] T027 Create auth session store with memory-only access token handling in frontend/src/lib/auth/session.ts
- [ ] T028 Create route guards for staff and member role areas in frontend/src/lib/auth/route-guards.ts
- [ ] T029 Create TanStack Router root, public routes, staff route shell, member route shell, and unauthorized route in frontend/src/app/router.tsx and frontend/src/routes
- [ ] T030 Create app providers for router, query client, auth session, tooltip, and toast support in frontend/src/app/providers.tsx
- [ ] T031 Create shared date utilities for due-soon, due-today, overdue, and local date formatting in frontend/src/lib/dates/due-status.ts
- [ ] T032 Create Zod schemas for auth, books, catalog, membership tiers, members, borrowings, returns, list queries, and member self-service view models in frontend/src/lib/validation/schemas.ts
- [ ] T033 Create shared shadcn/ui composition components for page headers, status badges, empty states, loading skeletons, error panels, form fields, and confirmation dialogs in frontend/src/components
- [ ] T034 Create reusable data-table wrapper using TanStack Table and shadcn/ui table components in frontend/src/components/data-table/data-table.tsx
- [ ] T035 Create responsive layout components for staff shell and member shell in frontend/src/components/layout

**Checkpoint**: Foundation ready; staff and member story implementation can begin.

---

## Phase 3: User Story 1 - Manage Library Back Office (Priority: P1) MVP

**Goal**: Staff can sign in, navigate the back office, manage books/catalog/memberships/members, and record borrowing and return workflows with clear blocked-state feedback.

**Independent Test**: Sign in as staff, add or update a book, find a member, review eligibility, record a valid borrowing or return, and confirm inventory/member status updates.

### Tests for User Story 1

- [ ] T036 [P] [US1] Add Playwright staff login and dashboard smoke test in frontend/tests/e2e/staff-dashboard.spec.ts
- [ ] T037 [P] [US1] Add Playwright staff book create/update test in frontend/tests/e2e/staff-books.spec.ts
- [ ] T038 [P] [US1] Add Playwright staff borrowing and return happy-path test in frontend/tests/e2e/staff-borrowing.spec.ts
- [ ] T039 [P] [US1] Add Playwright blocked borrowing scenarios for unavailable, inactive, suspended, overdue, and quota-reached states in frontend/tests/e2e/staff-blocked-borrowing.spec.ts
- [ ] T040 [P] [US1] Add component tests for reusable staff data-table loading, empty, no-result, and error states in frontend/src/components/data-table/data-table.test.tsx
- [ ] T041 [P] [US1] Add component tests for staff form validation messages in frontend/src/features/books/book-form.test.tsx

### Implementation for User Story 1

- [ ] T042 [P] [US1] Implement staff login API adapter and form in frontend/src/features/auth/staff-login.tsx and frontend/src/lib/api/auth.ts
- [ ] T043 [P] [US1] Implement staff dashboard API composition and summary cards in frontend/src/features/staff-dashboard/staff-dashboard.tsx
- [ ] T044 [P] [US1] Implement book list API adapter, query hooks, and route screen in frontend/src/lib/api/books.ts and frontend/src/routes/staff/books.tsx
- [ ] T045 [US1] Implement book create/edit form with React Hook Form and Zod in frontend/src/features/books/book-form.tsx
- [ ] T046 [P] [US1] Implement book detail route with availability and inactive states in frontend/src/routes/staff/books.$bookId.tsx
- [ ] T047 [P] [US1] Implement catalog classification API adapter, table, and form in frontend/src/lib/api/catalog.ts and frontend/src/routes/staff/catalog.tsx
- [ ] T048 [P] [US1] Implement membership tier API adapter, table, and form in frontend/src/lib/api/membership-types.ts and frontend/src/routes/staff/membership-types.tsx
- [ ] T049 [P] [US1] Implement member list API adapter, query hooks, filters, and route screen in frontend/src/lib/api/members.ts and frontend/src/routes/staff/members.tsx
- [ ] T050 [US1] Implement member detail route with profile, eligibility, quota, active borrowings, and history tabs in frontend/src/routes/staff/members.$memberId.tsx
- [ ] T051 [P] [US1] Implement borrowing list and overdue routes in frontend/src/lib/api/borrowings.ts, frontend/src/routes/staff/borrowings.tsx, and frontend/src/routes/staff/borrowings.overdue.tsx
- [ ] T052 [US1] Implement borrowing creation workflow with member selector, book selector, eligibility summary, calculated due date display, and conflict handling in frontend/src/routes/staff/borrowings.new.tsx
- [ ] T053 [US1] Implement borrowing detail and return workflow with confirmation and invalidation in frontend/src/routes/staff/borrowings.$borrowingId.tsx
- [ ] T054 [US1] Wire mutation invalidation for books, members, member policy, borrowings, and affected member self-service queries in frontend/src/lib/api/mutations.ts
- [ ] T055 [US1] Add permission-denied, session-expired, validation, conflict, and general error UI handling across staff routes in frontend/src/routes/staff
- [ ] T056 [US1] Verify staff shell keyboard navigation, labels, icon button names, and table accessibility in frontend/src/components/layout/staff-shell.tsx and frontend/src/components/data-table/data-table.tsx

**Checkpoint**: User Story 1 is fully functional and independently testable as the MVP.

---

## Phase 4: User Story 2 - View Member Borrowing Status on Mobile (Priority: P2)

**Goal**: Members can sign in on mobile and see their membership tier, status, quota, current borrowings, and due statuses without seeing staff-only or other-member information.

**Independent Test**: Sign in as a member on a phone-sized viewport and confirm tier, quota, borrowed books, due dates, due statuses, and privacy boundaries.

### Tests for User Story 2

- [ ] T057 [P] [US2] Add Playwright member login and mobile home status test in frontend/tests/e2e/member-home.spec.ts
- [ ] T058 [P] [US2] Add Playwright member privacy test proving member routes never expose arbitrary member IDs in frontend/tests/e2e/member-privacy.spec.ts
- [ ] T059 [P] [US2] Add component tests for member quota, no-borrowings, and borrowing-card states in frontend/src/features/member-home/member-home.test.tsx
- [ ] T060 [P] [US2] Add backend e2e tests for GET /members/me and GET /members/me/borrowings ownership enforcement in test/member-self-service.e2e-spec.ts

### Implementation for User Story 2

- [ ] T061 [P] [US2] Implement member login API adapter and form in frontend/src/features/auth/member-login.tsx and frontend/src/lib/api/member-auth.ts
- [ ] T062 [P] [US2] Implement member-scoped API adapters and query hooks in frontend/src/lib/api/member-self-service.ts
- [ ] T063 [US2] Implement mobile-first member home route with membership tier, account status, quota summary, and active borrowed count in frontend/src/routes/member/index.tsx
- [ ] T064 [US2] Implement current borrowed books list with title, borrowed date, due date, and due status in frontend/src/features/member-home/borrowed-books-list.tsx
- [ ] T065 [US2] Implement member borrowings list and detail routes in frontend/src/routes/member/borrowings.tsx and frontend/src/routes/member/borrowings.$borrowingId.tsx
- [ ] T066 [US2] Implement no-current-borrowings and quota-available empty states in frontend/src/features/member-home/member-empty-states.tsx
- [ ] T067 [US2] Enforce member route privacy by deriving identity only from the active session in frontend/src/lib/auth/route-guards.ts and frontend/src/lib/api/member-self-service.ts
- [ ] T068 [US2] Apply responsive mobile layout constraints and long-text handling for member cards in frontend/src/components/layout/member-shell.tsx and frontend/src/features/member-home

**Checkpoint**: User Story 2 is fully functional and independently testable on mobile.

---

## Phase 5: User Story 3 - Receive Borrowing Reminders and Limit Warnings (Priority: P3)

**Goal**: Members see prominent in-app reminders for due-soon, due-today, overdue, suspended, inactive, and quota-reached states.

**Independent Test**: View demo members with due-soon, due-today, overdue, quota-reached, suspended, inactive, and no-borrowing states and confirm each state shows a distinct reminder and next step.

### Tests for User Story 3

- [ ] T069 [P] [US3] Add unit tests for due-soon, due-today, overdue, returned, and mixed due-state classification in frontend/src/lib/dates/due-status.test.ts
- [ ] T070 [P] [US3] Add component tests for reminder ordering, severity, and copy in frontend/src/features/member-home/reminders.test.tsx
- [ ] T071 [P] [US3] Add Playwright mobile reminder and quota warning scenarios in frontend/tests/e2e/member-reminders.spec.ts

### Implementation for User Story 3

- [ ] T072 [US3] Implement reminder derivation for due-soon, due-today, overdue, suspended, inactive, and quota-reached states in frontend/src/features/member-home/reminders.ts
- [ ] T073 [US3] Implement reminder banner/list UI with severity badges and accessible status text in frontend/src/features/member-home/reminders-panel.tsx
- [ ] T074 [US3] Integrate reminder panel above lower-priority member content in frontend/src/routes/member/index.tsx
- [ ] T075 [US3] Add quota-reached and overdue next-step copy using consistent terminology in frontend/src/features/member-home/quota-status-card.tsx
- [ ] T076 [US3] Ensure reminders refresh across date boundaries and after borrowing/return invalidation in frontend/src/lib/api/member-self-service.ts and frontend/src/app/query-client.ts

**Checkpoint**: User Story 3 is fully functional and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, documentation, accessibility, responsiveness, and maintainability cleanup across all stories.

- [ ] T077 [P] Update README.md with frontend setup, environment variables, scripts, and member demo credentials
- [ ] T078 [P] Update specs/002-library-ui/quickstart.md with final frontend commands and expected local URLs
- [ ] T079 [P] Add frontend environment example file in frontend/.env.example
- [ ] T080 Run responsive visual checks for staff dashboard/list screens at 1440x900, 1024x768, and 768x1024 in frontend/tests/e2e/responsive-staff.spec.ts
- [ ] T081 Run responsive visual checks for member home and borrowings at 390x844 and 430x932 in frontend/tests/e2e/responsive-member.spec.ts
- [ ] T082 Add accessibility checks for forms, route guards, dialogs, menus, status badges, and icon-only controls in frontend/tests/e2e/accessibility.spec.ts
- [ ] T083 Audit frontend source for token logging, sensitive data exposure, and localStorage token persistence in frontend/src
- [ ] T084 Run backend verification commands npm run lint, npm run test, npm run test:e2e, and npm run build from package.json
- [ ] T085 Run frontend verification commands npm run lint, npm run test, npm run test:e2e, and npm run build from frontend/package.json
- [ ] T086 Execute quickstart validation scenarios from specs/002-library-ui/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and can be built after or parallel to US1 once shared auth/API shell is ready.
- **User Story 3 (Phase 5)**: Depends on US2 member home structure and due-status utilities.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 Manage Library Back Office**: Independent MVP after foundation.
- **US2 View Member Borrowing Status on Mobile**: Independent after foundation, but benefits from shared auth and API primitives already used by US1.
- **US3 Receive Borrowing Reminders and Limit Warnings**: Extends US2 member home and should start after US2 member data and layout are in place.

### Within Each User Story

- Tests MUST be written and fail before implementation.
- Backend contract/auth tests before backend member endpoint implementation.
- MongoDB document model, index, and migration decisions before persistence code.
- API adapters before route screens.
- Shared components before feature screens that consume them.
- Story complete before moving to the next priority unless work is deliberately parallelized across separate files.

### Parallel Opportunities

- Setup tasks T005-T008 can run in parallel after T001-T004 path/config decisions.
- Foundational backend tasks T011-T023 and frontend tasks T024-T035 can proceed in parallel after T010.
- US1 tests T036-T041 can run in parallel.
- US1 independent feature areas T044, T047, T048, T049, and T051 can run in parallel after shared API/client setup.
- US2 tests T057-T060 can run in parallel.
- US2 member login/API tasks T061-T062 can run in parallel with layout task T068 after foundation.
- US3 tests T069-T071 can run in parallel.
- Polish documentation tasks T077-T079 can run in parallel.

---

## Parallel Example: User Story 1

```bash
Task: "T036 [P] [US1] Add Playwright staff login and dashboard smoke test in frontend/tests/e2e/staff-dashboard.spec.ts"
Task: "T037 [P] [US1] Add Playwright staff book create/update test in frontend/tests/e2e/staff-books.spec.ts"
Task: "T038 [P] [US1] Add Playwright staff borrowing and return happy-path test in frontend/tests/e2e/staff-borrowing.spec.ts"
Task: "T039 [P] [US1] Add Playwright blocked borrowing scenarios for unavailable, inactive, suspended, overdue, and quota-reached states in frontend/tests/e2e/staff-blocked-borrowing.spec.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T057 [P] [US2] Add Playwright member login and mobile home status test in frontend/tests/e2e/member-home.spec.ts"
Task: "T058 [P] [US2] Add Playwright member privacy test proving member routes never expose arbitrary member IDs in frontend/tests/e2e/member-privacy.spec.ts"
Task: "T059 [P] [US2] Add component tests for member quota, no-borrowings, and borrowing-card states in frontend/src/features/member-home/member-home.test.tsx"
Task: "T060 [P] [US2] Add backend e2e tests for GET /members/me and GET /members/me/borrowings ownership enforcement in test/member-self-service.e2e-spec.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T069 [P] [US3] Add unit tests for due-soon, due-today, overdue, returned, and mixed due-state classification in frontend/src/lib/dates/due-status.test.ts"
Task: "T070 [P] [US3] Add component tests for reminder ordering, severity, and copy in frontend/src/features/member-home/reminders.test.tsx"
Task: "T071 [P] [US3] Add Playwright mobile reminder and quota warning scenarios in frontend/tests/e2e/member-reminders.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational prerequisites.
3. Complete Phase 3: US1 staff back office.
4. Stop and validate staff login, dashboard, books, members, borrowing, return, blocked borrowing, accessibility, and error states.
5. Demo/deploy the staff MVP if ready.

### Incremental Delivery

1. Setup + Foundation: frontend app shell, backend member support, API/auth primitives.
2. US1: staff operational back office MVP.
3. US2: member mobile self-service status.
4. US3: member reminders and quota warnings.
5. Polish: responsive, accessibility, documentation, and full verification.

### Parallel Team Strategy

1. One developer handles backend member auth and member-scoped endpoints T010-T023.
2. One developer handles frontend shell, design system, API client, and auth T024-T035.
3. After foundation, staff workflows, member home, and reminder logic can proceed in separate feature folders with coordination around shared API types.

---

## Notes

- [P] tasks are parallelizable because they touch different files and do not depend on incomplete tasks.
- Each user story has explicit tests and can be validated independently.
- Member self-service requires backend support before US2 can be safely completed.
- UI must not duplicate backend borrowing rules; it displays backend decisions and conflict responses.
- MongoDB document-model decisions must precede persistence changes for member authentication support.
