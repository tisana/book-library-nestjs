# Tasks: Authentication, Roles, and Permissions

**Input**: Design documents from `/specs/003-auth-roles-permissions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included because the specification, constitution, authorization matrix, and quickstart require automated coverage for auth, authorization, ownership, token lifecycle, and audit behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare configuration, enums, and migrations needed by all auth stories.

- [x] T001 Add auth environment settings for issuer, audience, access-token TTL, refresh-token TTL, cookie secret, and production-secret validation in src/config/auth.config.ts
- [x] T002 [P] Add permission enum, role-area types, token-claim types, and role-to-permission mapping in src/common/enums/auth-permission.enum.ts
- [x] T003 [P] Add shared auth response and token DTO fields for tokenType, expiresIn, scope, and permissions in src/staff-users/dto/staff-user.dto.ts
- [x] T004 [P] Add shared member auth response DTO fields for tokenType, expiresIn, scope, and permissions in src/auth/dto/member-auth.dto.ts
- [x] T005 Add MongoDB migration for StaffUser authVersion/passwordUpdatedAt/identity-link fields, Member authVersion/identity-link fields, refresh-token family indexes, and security-event indexes in migrations/versions/003-auth-roles-permissions.ts
- [x] T006 Update migration registration to include 003-auth-roles-permissions in migrations/migrate.ts
- [x] T007 [P] Add demo auth seed data updates for authVersion and permission-ready roles in scripts/seed-sample-users.ts
- [x] T008 Add production-safe first administrator bootstrap CLI that creates exactly one admin when no active admin exists in scripts/bootstrap-admin.ts
- [x] T009 [P] Add tests for first administrator bootstrap success, duplicate prevention, password hashing, and no hard-coded production credentials in test/bootstrap-admin.e2e-spec.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth, identifier ownership, readiness, throttling, and authorization infrastructure that MUST be complete before any user story can be implemented.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T010 Add refresh token family schema with hashed token fields, status, subject, client, expiry, and TTL indexes in src/auth/schemas/refresh-token-family.schema.ts
- [x] T011 Add security activity event schema with redacted event context and audit indexes in src/auth/schemas/security-activity-event.schema.ts
- [x] T012 [P] Add optional auth client schema for OIDC-friendly client ids, scopes, redirect URIs, and status in src/auth/schemas/auth-client.schema.ts
- [x] T013 Implement permission decorator and metadata key in src/auth/permissions.decorator.ts
- [x] T014 Implement permission mapping service for roles, roleArea, scopes, and normalized request auth context in src/auth/permissions.service.ts
- [x] T015 Implement permissions guard with deny-by-default behavior, member-token rejection on staff/admin routes, and ForbiddenException semantics in src/auth/permissions.guard.ts
- [x] T016 Update JwtStrategy to validate issuer, audience, expiry, authVersion, roleArea, and active account status in src/auth/jwt.strategy.ts
- [x] T017 Update JwtAuthGuard and current-user/current-member decorators to expose normalized auth context in src/auth/jwt-auth.guard.ts, src/auth/current-user.decorator.ts, and src/auth/current-member.decorator.ts
- [x] T018 Implement refresh-token hashing, rotation, replay detection, revocation, and cookie helpers in src/auth/token-session.service.ts
- [x] T019 Implement security activity recording with password/token/request-body redaction in src/auth/security-activity.service.ts
- [x] T020 Register new schemas, services, and guards in src/auth/auth.module.ts
- [x] T021 [P] Add focused unit tests for permission mapping and deny-by-default behavior in src/auth/permissions.guard.spec.ts
- [x] T022 [P] Add focused unit tests for refresh rotation, replay detection, and token hashing in src/auth/token-session.service.spec.ts
- [x] T023 [P] Add focused unit tests for security activity redaction in src/auth/security-activity.service.spec.ts
- [ ] T024 Add AuthIdentifier schema with pending/active/released/conflict states, unique normalizedIdentifier, non-unique pendingOperationId/lastOperationId indexes, subject references, and audit fields in src/auth/schemas/auth-identifier.schema.ts
- [ ] T025 Add AuthIdentifierOperation schema with unique operationId, bounded assignments, status/result, requestedBy, and lease indexes in src/auth/schemas/auth-identifier-operation.schema.ts
- [ ] T026 [P] Add unit tests for transaction and saga reservation paths, concurrent collision rejection, multi-reservation operation idempotency, pending-state denial, compensation, and completion-result replay in src/auth/auth-identifier.service.spec.ts
- [ ] T027 Implement transactional identifier mutations and durable AuthIdentifierOperation saga coordination across pending reservations and account aggregates in src/auth/auth-identifier.service.ts
- [ ] T028 Register AuthIdentifier and AuthIdentifierOperation schemas plus service exports in src/auth/auth.module.ts
- [ ] T029 Add `@nestjs/schedule` dependency and ScheduleModule wiring in package.json, src/app.module.ts, and src/auth/auth.module.ts
- [ ] T030 [P] Add configuration tests for current/previous audit-correlation keys and key versions, lease default/range, reconciliation interval/batch size, issuer/audience, TTLs, unsafe secrets, and redacted startup diagnostics in src/config/auth.config.spec.ts
- [ ] T031 Implement production startup validation and rotation-aware loading for JWT/cookie/audit-correlation keys and versions, issuer/audience, TTLs, and identifier lease/reconciliation settings in src/config/auth.config.ts
- [ ] T032 [P] Add reconciliation unit tests for atomic lease acquisition, lease renewal/expiry, five-second skew tolerance, multi-instance exclusion, crash recovery, repeated processing, and HMAC redaction in src/auth/auth-identifier-reconciliation.service.spec.ts
- [ ] T033 [P] Add recovery e2e tests for startup/scheduled reconciliation, bounded batches, competing worker/claim blocking, saga compensation, and non-TTL pending operations in test/auth-identifier-recovery.e2e-spec.ts
- [ ] T034 Implement idempotent startup/scheduled operation reconciliation with MongoDB-time lease acquisition, renewal, bounded batches, and multi-instance ownership in src/auth/auth-identifier-reconciliation.service.ts and src/auth/auth.module.ts
- [ ] T035 [P] Add migration tests for identifier/operation indexes, clean backfill, legacy conflict reporting, safe rollback, and preservation of account/borrowing/audit records in test/auth-identifier-migration.e2e-spec.ts
- [ ] T036 Extend the auth migration to create AuthIdentifier/AuthIdentifierOperation indexes, backfill reservations, block/report conflicts, and preserve history on rollback in migrations/versions/003-auth-roles-permissions.ts
- [ ] T037 Add auth-identifiers:read/manage permissions to the stable permission enum, administrator mapping, and normalized auth context in src/common/enums/auth-permission.enum.ts and src/auth/permissions.service.ts
- [ ] T038 [P] Add guard tests proving explicit public metadata bypasses authentication while unmarked routes remain denied by default in src/auth/jwt-auth.guard.spec.ts and src/auth/permissions.guard.spec.ts
- [ ] T039 Implement an explicit Public decorator and make JwtAuthGuard and PermissionsGuard honor it in src/auth/public.decorator.ts, src/auth/jwt-auth.guard.ts, and src/auth/permissions.guard.ts
- [ ] T040 [P] Add unauthenticated liveness/readiness e2e tests for healthy state, runtime MongoDB/auth-infrastructure failure, five-second response, and connection-string/secret/stack/host/account redaction in test/health.e2e-spec.ts
- [ ] T041 Extend the existing health module with explicitly public GET /health liveness, public GET /health/ready runtime MongoDB/auth-infrastructure readiness, and required Mongoose/config wiring in src/health/health.controller.ts, src/health/health.service.ts, and src/health/health.module.ts
- [ ] T042 Add `@nestjs/throttler` and configure global auth-sensitive defaults before login endpoints depend on throttling in package.json and src/app.module.ts

**Checkpoint**: Foundation ready. User story implementation can now begin in priority order or in parallel by story.

---

## Phase 3: User Story 1 - Sign in with a persistent account (Priority: P1) MVP

**Goal**: Staff/admin and member users can sign in with persistent accounts, receive OIDC-friendly short-lived JWT access tokens, use rotated refresh sessions, and survive application restarts without in-memory users.

**Independent Test**: Create stored staff and member accounts, sign in through the same keyboard-accessible page, verify roleArea/permission landing and generic legacy-conflict failure, restart the app against the same database, sign in again, and rotate refresh tokens.

### Tests for User Story 1

- [x] T043 [P] [US1] Add e2e tests for staff sign-in success, generic failure, token claims, refresh rotation, logout, and logout-all in test/auth.e2e-spec.ts
- [x] T044 [P] [US1] Add e2e tests for member sign-in success, generic failure, authStatus denial, token claims, and refresh rotation in test/member-auth.e2e-spec.ts
- [x] T045 [P] [US1] Add service tests for staff/member login, token claim construction, authVersion denial, and lastLoginAt updates in src/auth/auth.service.spec.ts
- [x] T046 [P] [US1] Add frontend API tests for staff login, member login, refresh, logout, and auth/me responses in frontend/src/lib/api/auth.test.ts
- [x] T047 [P] [US1] Add frontend session tests for memory-only access token behavior and refresh/sign-out cache clearing in frontend/src/lib/auth/session.test.ts

### Implementation for User Story 1

- [x] T048 [US1] Update AuthService to issue tokenType/expiresIn/scope/permissions, set refresh cookies, record security events, and use generic credential failures in src/auth/auth.service.ts
- [x] T049 [US1] Add refresh, logout, logout-all, and auth/me endpoints with cookie handling in src/auth/auth.controller.ts
- [x] T050 [US1] Update StaffUser schema/service to persist authVersion/passwordUpdatedAt, touch lastLoginAt, and revoke sessions on status changes in src/staff-users/schemas/staff-user.schema.ts and src/staff-users/staff-users.service.ts
- [x] T051 [US1] Update Member schema/service to persist authVersion, support active auth checks, touch lastLoginAt, and revoke sessions on status/authStatus changes in src/members/schemas/member.schema.ts and src/members/members.service.ts
- [x] T052 [US1] Add token issuer/audience/authVersion claims and refresh cookie settings to frontend API auth types in frontend/src/lib/api/types.ts
- [x] T053 [US1] Update staff auth client functions for login, refresh, logout, logout-all, and auth/me in frontend/src/lib/api/auth.ts
- [x] T054 [US1] Update member auth client functions for member login, refresh, logout, and auth/me in frontend/src/lib/api/member-auth.ts
- [x] T055 [US1] Establish the legacy staff/member login baseline for generic errors, refresh continuity, and returned permissions before shared-page convergence in frontend/src/features/auth/staff-login.tsx and frontend/src/features/auth/member-login.tsx
- [x] T056 [US1] Establish the legacy sign-out baseline for logout, memory-session clearing, query-cache clearing, and role-specific redirects before shared-route convergence in frontend/src/lib/auth/sign-out.ts

### Shared Sign-In Clarification Tasks

- [ ] T057 [P] [US1] Add AuthService tests for reservation-based shared identifier resolution, staff/member success, no-role authentication with no protected access, legacy ambiguity denial, generic failures, and redacted audit context in src/auth/auth.service.spec.ts
- [ ] T058 [P] [US1] Add API e2e tests for POST /auth/login with staff, admin, and member credentials plus ambiguous identifiers and compatibility-wrapper parity in test/auth.e2e-spec.ts
- [ ] T059 [P] [US1] Add frontend API tests for the unified login request, discriminated staff/member response, and generic failure behavior in frontend/src/lib/api/auth.test.ts
- [ ] T060 [P] [US1] Add frontend tests for one shared sign-in form, roleArea/permission-based landing, accessible names, announced errors, deterministic failure focus, pending-state duplicate prevention, protected-route redirects, and generic errors in frontend/src/features/auth/shared-login.test.tsx
- [ ] T061 [P] [US1] Add Playwright coverage for keyboard-only staff/admin/member shared sign-in, accessible errors, legacy-login redirects, and sign-out return behavior in frontend/tests/e2e/shared-sign-in.spec.ts and frontend/tests/e2e/accessibility.spec.ts
- [ ] T062 [P] [US1] Add restart-persistence e2e coverage that recreates the Nest application against the same database and verifies staff/member roles, scope, ownership, and refresh continuity in test/auth-persistence.e2e-spec.ts
- [ ] T063 [US1] Add a validated shared login request DTO and discriminated staff/member response types in src/auth/dto/shared-login.dto.ts
- [ ] T064 [US1] Implement AuthIdentifier reservation lookup, exact-one-context enforcement, legacy conflict denial, generic credential denial, no-role context handling, and redacted ambiguity events in src/auth/auth.service.ts
- [ ] T065 [US1] Add POST /auth/login and make POST /auth/staff-login and POST /auth/member-login delegate to the shared token, cookie, throttling, and audit behavior in src/auth/auth.controller.ts
- [ ] T066 [US1] Consolidate frontend login types and API calls around POST /auth/login while retaining compatibility exports only where still required in frontend/src/lib/api/types.ts, frontend/src/lib/api/auth.ts, and frontend/src/lib/api/member-auth.ts
- [ ] T067 [US1] Replace role-specific sign-in screens with one keyboard-accessible shared page with announced errors, deterministic focus and duplicate-submit prevention; route from roleArea/permissions, redirect legacy URLs, and send sign-out to the shared route in frontend/src/features/auth/shared-login.tsx, frontend/src/app/router.tsx, and frontend/src/lib/auth/sign-out.ts

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Block members from staff and admin areas (Priority: P1)

**Goal**: Members can access only their own self-service area and are denied from all staff/admin routes and actions, including direct API requests.

**Independent Test**: Sign in as a member, exercise the data-driven route matrix directly and through UI navigation, and confirm every protected action returns the expected allow, unauthenticated, permission-denied, ownership-denied, or member-denied outcome without exposing staff/admin data.

### Tests for User Story 2

- [x] T068 [P] [US2] Add direct API e2e tests that member tokens are denied from books, book-categories, members staff routes, borrowings staff routes, and staff-users routes in test/authorization.e2e-spec.ts
- [x] T069 [P] [US2] Add direct API e2e tests that member tokens and unauthorized staff tokens are denied from membership-type read/manage routes requiring membership-types:read and membership-types:manage in test/membership-authorization.e2e-spec.ts
- [x] T070 [P] [US2] Add horizontal member ownership e2e tests for /members/me and member borrowing details in test/member-self-service.e2e-spec.ts
- [x] T071 [P] [US2] Add frontend route-guard tests for member-vs-staff/admin navigation denial in frontend/src/lib/auth/route-guards.test.ts
- [x] T072 [P] [US2] Add Playwright e2e coverage for member denial from staff/admin screens and direct route attempts in frontend/tests/e2e/member-privacy.spec.ts
- [ ] T073 [P] [US2] Add a data-driven allow, permission-deny, member-deny, ownership-deny, and unauthenticated test for every protected controller action in test/authorization-matrix.e2e-spec.ts

### Implementation for User Story 2

- [x] T074 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/books/books.controller.ts
- [x] T075 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/book-categories/book-categories.controller.ts
- [x] T076 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/members/members.controller.ts
- [x] T077 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/borrowings/borrowings.controller.ts
- [x] T078 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and membership-types:read/manage decorators on src/membership-types/membership-types.controller.ts
- [x] T079 [US2] Update MemberAuthGuard to require roleArea member plus member:self:read and reject staff/admin contexts in src/auth/member-auth.guard.ts
- [x] T080 [US2] Update member self-service services to derive member id only from CurrentMember and reject user-supplied member ids in src/members/members.service.ts and src/borrowings/borrowings.service.ts
- [x] T081 [US2] Update frontend route guards to use returned roleArea and permissions, route denied users to unauthorized, and avoid rendering protected stale data in frontend/src/lib/auth/route-guards.ts
- [x] T082 [US2] Update API client unauthorized/forbidden handling to clear invalid sessions on 401 and preserve access-denied UX on 403 in frontend/src/lib/api/client.ts and frontend/src/lib/api/errors.ts

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Manage staff roles and permissions (Priority: P2)

**Goal**: Administrators can create, update, deactivate, and assign approved roles to staff users and resolve legacy identifier conflicts, while regular staff cannot manage users, roles, permissions, or identifier ownership.

**Independent Test**: Sign in as admin and regular staff, assign roles, confirm changed permissions take effect without restart, list and resolve a legacy identifier conflict without changing passwords, and confirm non-admin users are denied role, user, and identifier-conflict management.

### Tests for User Story 3

- [ ] T083 [P] [US3] Add e2e tests for admin staff-user create/update/deactivate/role assignment and regular-staff denial in test/auth.e2e-spec.ts
- [ ] T084 [P] [US3] Add service tests for role validation, transactional identifier reservation, cross-context collision rejection, approved role assignment, authVersion bump, and session revocation in src/staff-users/staff-users.service.spec.ts
- [ ] T085 [P] [US3] Add frontend tests for staff-user role assignment forms and access-denied states in frontend/src/features/auth/staff-role-management.test.tsx
- [ ] T086 [P] [US3] Add Playwright acceptance test that an administrator can create a staff account, assign a role, sign in as that staff user, and confirm permitted access within 5 minutes in frontend/tests/e2e/staff-role-management.spec.ts
- [ ] T087 [P] [US3] Add e2e tests for transaction and saga conflict resolution, operation-status retrieval, retained/no-retained subjects, multi-claimant assignments, replacement collision, idempotent retry, compensation, unchanged passwords, safe redaction, and security events in test/auth-identifier-conflicts.e2e-spec.ts
- [ ] T088 [P] [US3] Add frontend tests for conflict listing, safe account labels, replacement validation, successful resolution, and forbidden states in frontend/src/features/auth/identifier-conflicts.test.tsx

### Implementation for User Story 3

- [ ] T089 [US3] Update staff-user DTOs to expose permissions, validate approved roles, and redact credential fields in src/staff-users/dto/staff-user.dto.ts
- [ ] T090 [US3] Update StaffUsersService to create/update/deactivate staff users with transactional AuthIdentifier reserve/release, validate roles, hash passwords, bump authVersion, revoke sessions, and record role/account security events in src/staff-users/staff-users.service.ts
- [ ] T091 [US3] Update StaffUsersController to require staff-users:read, staff-users:manage, roles:read, and roles:manage permissions per route in src/staff-users/staff-users.controller.ts
- [ ] T092 [US3] Add a role/permission review endpoint or service method for admin review in src/auth/auth.controller.ts and src/auth/permissions.service.ts
- [ ] T093 [US3] Update frontend staff-user API types and mutations for permissions, role assignment, deactivation, and role review in frontend/src/lib/api/types.ts and frontend/src/lib/api/mutations.ts
- [ ] T094 [US3] Add or update staff-user management UI for role assignment, deactivation, and permission review in frontend/src/features/auth/staff-role-management.tsx
- [ ] T095 [US3] Update member identifier-changing workflows to reserve/release AuthIdentifier transactionally and record safe conflict events in src/members/members.service.ts
- [ ] T096 [US3] Add deterministic conflict DTOs plus administrator resolve/status endpoints for transaction or recoverable saga execution, complete claimant accounting, replacement pre-reservation, compensation, redacted results, and operationId idempotency in src/auth/dto/auth-identifier.dto.ts, src/auth/auth.controller.ts, and src/auth/auth-identifier.service.ts
- [ ] T097 [US3] Add frontend conflict/operation-status API types, queries, polling, and resolution mutation in frontend/src/lib/api/types.ts and frontend/src/lib/api/auth.ts
- [ ] T098 [US3] Add administrator conflict review/resolution UI with pending, applying, compensating, completed, and failed operation states in frontend/src/features/auth/identifier-conflicts.tsx and frontend/src/app/router.tsx

**Checkpoint**: User Stories 1, 2, and 3 work independently.

---

## Phase 6: User Story 4 - Review authentication and authorization activity (Priority: P3)

**Goal**: Administrators can review sign-in, denied access, role change, account status, refresh replay, revocation, and sign-out activity without exposing secrets.

**Independent Test**: Trigger failed and ambiguous sign-in, denied member access, role change, identifier-conflict resolution, refresh replay, and sign-out events; then sign in as admin and verify event records are visible, filterable, and redacted.

### Tests for User Story 4

- [ ] T099 [P] [US4] Add e2e tests for identifier-conflict-detected/resolved and identifier-reservation-recovered events, security activity filtering, admin-only access, and regular staff/member denial in test/security-activity.e2e-spec.ts
- [ ] T100 [P] [US4] Add service tests for conflict/recovery event vocabulary, versioned HMAC-SHA-256 correlation, equal-identifier correlation, key rotation, rejection of ordinary hashes/raw identifiers, operation/result context, filtering, pagination, and redaction in src/auth/security-activity.service.spec.ts
- [ ] T101 [P] [US4] Add frontend tests for security activity table, empty state, filters, and forbidden state in frontend/src/features/auth/security-activity.test.tsx

### Implementation for User Story 4

- [ ] T102 [US4] Add conflict/recovery event types with versioned HMAC-SHA-256 identifier correlation using AUTH_AUDIT_CORRELATION_SECRET, redacted operation context, query, pagination, filters, and DTOs in src/auth/schemas/security-activity-event.schema.ts, src/auth/security-activity.service.ts, and src/auth/dto/security-activity.dto.ts
- [ ] T103 [US4] Add administrator-only security activity endpoints requiring security-events:read in src/auth/auth.controller.ts
- [ ] T104 [US4] Wire authorization-denied event recording from PermissionsGuard and MemberAuthGuard in src/auth/permissions.guard.ts and src/auth/member-auth.guard.ts
- [ ] T105 [US4] Add frontend API functions and types for security activity listing in frontend/src/lib/api/auth.ts and frontend/src/lib/api/types.ts
- [ ] T106 [US4] Add administrator security activity route and table UI in frontend/src/features/auth/security-activity.tsx and frontend/src/app/router.tsx

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening, documentation, and final validation across all stories.

- [ ] T107 [P] Add frontend Playwright coverage for staff/admin role boundaries and sign-out refresh revocation in frontend/tests/e2e/staff-auth-permissions.spec.ts
- [ ] T108 [P] Add operational documentation for auth environment variables, liveness/readiness usage, identifier conflict recovery, performance verification, token TTLs, shared sign-in behavior, and future Keycloak migration notes in ./README.md
- [ ] T109 [P] Add e2e abuse tests for shared login, compatibility login, and refresh endpoint throttling limits, recovery windows, and generic responses in test/auth.e2e-spec.ts
- [ ] T110 Apply shared login, compatibility login, and refresh throttling policies using the foundational throttler configuration in src/auth/auth.module.ts and src/auth/auth.controller.ts
- [ ] T111 [P] Add history-preservation regression coverage for role changes, deactivation/reactivation, identifier correction, borrowing records, actor references, and security events in test/auth-history-preservation.e2e-spec.ts
- [ ] T112 [P] Add deterministic e2e coverage that role/authVersion changes affect the next protected request and always within 60 seconds in test/authorization.e2e-spec.ts
- [ ] T113 [P] Add test-only equivalent unprotected/protected benchmark handlers and production AppModule route-graph/build exclusion assertions in test/performance/auth-benchmark.module.ts, test/performance/auth-benchmark.controller.ts, and test/performance/auth-benchmark-isolation.spec.ts
- [ ] T114 Implement the production-build benchmark runner with dedicated seeded MongoDB, disabled logging, 100 warm-ups, 500 requests at concurrency 10, nearest-rank auth-boundary overhead p95, 10,000 security events, runtime/hardware metadata, npm command, and evidence output in scripts/verify-auth-performance.ts, package.json, and specs/003-auth-roles-permissions/evidence/auth-performance.md
- [ ] T115 Prepare the moderated script, consent language, role-specific goals, timing/failure definitions, anonymized template, and production release gate in specs/003-auth-roles-permissions/evidence/shared-sign-in-usability.md
- [ ] T116 Have product owner or QA conduct the study with 8 members, 8 staff users, and 4 administrators and record only aggregate first-attempt and 30-second results in specs/003-auth-roles-permissions/evidence/shared-sign-in-usability.md
- [ ] T117 Run and document backend verification commands from quickstart.md with npm test, npm run test:e2e, and npm run verify:auth-performance in specs/003-auth-roles-permissions/quickstart.md
- [ ] T118 Run and document frontend verification commands from quickstart.md with npm run frontend:test and npm run frontend:test:e2e in specs/003-auth-roles-permissions/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational completion.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.
- **Critical task dependencies**: schemas T024-T025 precede coordinator T027 and migration T036; coordinator/module/scheduler/config T027-T031 precede reconciliation T032-T034; backfill T036 and reconciliation T034 precede shared resolver T064 and account integration T090/T095/T096; permissions T037 precede conflict endpoint T096; public policy T039 precedes health T041; foundational throttling T042 precedes abuse tests T109 and policy implementation T110, with T109 before T110; HMAC config T031 precedes security activity T102; security activity T102 and isolated handlers T113 precede benchmark runner T114; shared page T067 and study preparation T115 precede human acceptance T116.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational. MVP and prerequisite for real authenticated sessions.
- **User Story 2 (P1)**: Starts after Foundational, but practical end-to-end validation depends on US1 token/session behavior.
- **User Story 3 (P2)**: Starts after Foundational and builds on permission mapping from US2.
- **User Story 4 (P3)**: Starts after Foundational and becomes most meaningful once US1-US3 generate security events.

### Within Each User Story

- Tests first, expected to fail before implementation.
- Schema/migration work before persistence services.
- Services before controllers/endpoints.
- Backend auth behavior before frontend integration.
- Story complete before moving to the next priority when working sequentially.

## Parallel Opportunities

- Setup tasks T002, T003, T004, T007, and T009 can run in parallel.
- Foundational test tasks T021-T023, T026, T030, T032-T033, T035, T038, and T040 can run in parallel within their dependency groups.
- User Story 1 baseline tests T043-T047 and shared sign-in tests T057-T062 can run in parallel within their respective test groups.
- User Story 2 tests T068-T073 can run in parallel.
- User Story 3 tests T083-T088 can run in parallel.
- User Story 4 tests T099-T101 can run in parallel.
- Frontend work for a story can proceed in parallel with backend implementation once API contracts are stable.

## Parallel Example: User Story 1

```bash
Task: "Add e2e tests for staff sign-in success, generic failure, token claims, refresh rotation, logout, and logout-all in test/auth.e2e-spec.ts"
Task: "Add e2e tests for member sign-in success, generic failure, authStatus denial, token claims, and refresh rotation in test/member-auth.e2e-spec.ts"
Task: "Add AuthService tests for reservation-based shared identifier resolution, no-role access, legacy ambiguity denial, and generic failures in src/auth/auth.service.spec.ts"
Task: "Add frontend tests for one accessible shared sign-in form, deterministic error focus, pending state, and roleArea/permission-based landing in frontend/src/features/auth/shared-login.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Add direct API e2e tests that member tokens are denied from books, book-categories, members staff routes, borrowings staff routes, and staff-users routes in test/authorization.e2e-spec.ts"
Task: "Add horizontal member ownership e2e tests for /members/me and member borrowing details in test/member-self-service.e2e-spec.ts"
Task: "Add frontend route-guard tests for member-vs-staff/admin navigation denial in frontend/src/lib/auth/route-guards.test.ts"
Task: "Add a data-driven authorization test for every protected controller action in test/authorization-matrix.e2e-spec.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add e2e tests for admin staff-user create/update/deactivate/role assignment and regular-staff denial in test/auth.e2e-spec.ts"
Task: "Add service tests for role validation, transactional identifier reservation, role assignment, authVersion bump, and session revocation in src/staff-users/staff-users.service.spec.ts"
Task: "Add frontend tests for staff-user role assignment forms and access-denied states in frontend/src/features/auth/staff-role-management.test.tsx"
Task: "Add e2e tests for administrator-only identifier conflict listing and resolution in test/auth-identifier-conflicts.e2e-spec.ts"
```

## Parallel Example: User Story 4

```bash
Task: "Add e2e tests for security activity filtering, identifier-conflict events, admin-only access, and regular staff/member denial in test/security-activity.e2e-spec.ts"
Task: "Add service tests for security event filtering, pagination, and redaction in src/auth/security-activity.service.spec.ts"
Task: "Add frontend tests for security activity table, empty state, filters, and forbidden state in frontend/src/features/auth/security-activity.test.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate the shared sign-in page for staff/admin/member routing, ambiguous identifier denial, persistence across restart, generic failures, token claims, refresh rotation, logout, and memory-only frontend session behavior.
5. Demo or deploy only if protected routes are still blocked by existing guards until US2 is complete.

### Incremental Delivery

1. Complete Setup + Foundational.
2. Add US1 for persistent accounts, restart continuity, accessible shared sign-in, and secure sessions.
3. Add US2 for exhaustive member/staff/admin access boundaries.
4. Add US3 for administrator role, staff account, and identifier-conflict management.
5. Add US4 for security activity review.
6. Polish with history regression, timing/performance verification, usability evidence, rate limiting, operational checks, and full quickstart validation.

### Parallel Team Strategy

With multiple developers:

1. Complete Setup + Foundational together.
2. Backend developer A: US1 token/session/auth service work.
3. Backend developer B: US2 permission guard/controller conversion.
4. Frontend developer: US1 shared sign-in, US2 route guard, and sign-out integration after API contracts stabilize.
5. After US1-US2, split US3 admin role management and US4 security activity.

## Notes

- [P] tasks = different files, no dependency on incomplete same-file work.
- [US1]-[US4] labels map tasks to specific user stories for traceability.
- Each user story should be independently completable and testable at its checkpoint.
- Verify tests fail before implementing.
- T116 is a product-owner/QA acceptance task requiring human participants; coding agents may prepare T115 but must not fabricate T116 evidence.
- Avoid storing passwords, raw tokens, token hashes, or full sensitive payloads in logs or security activity records.
