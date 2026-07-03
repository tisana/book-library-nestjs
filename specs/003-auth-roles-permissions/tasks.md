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

- [X] T001 Add auth environment settings for issuer, audience, access-token TTL, refresh-token TTL, cookie secret, and production-secret validation in src/config/auth.config.ts
- [X] T002 [P] Add permission enum, role-area types, token-claim types, and role-to-permission mapping in src/common/enums/auth-permission.enum.ts
- [X] T003 [P] Add shared auth response and token DTO fields for tokenType, expiresIn, scope, and permissions in src/staff-users/dto/staff-user.dto.ts
- [X] T004 [P] Add shared member auth response DTO fields for tokenType, expiresIn, scope, and permissions in src/auth/dto/member-auth.dto.ts
- [X] T005 Add MongoDB migration for StaffUser authVersion/passwordUpdatedAt/identity-link fields, Member authVersion/identity-link fields, refresh-token family indexes, and security-event indexes in migrations/versions/003-auth-roles-permissions.ts
- [X] T006 Update migration registration to include 003-auth-roles-permissions in migrations/migrate.ts
- [X] T007 [P] Add demo auth seed data updates for authVersion and permission-ready roles in scripts/seed-sample-users.ts
- [X] T008 Add production-safe first administrator bootstrap CLI that creates exactly one admin when no active admin exists in scripts/bootstrap-admin.ts
- [X] T009 [P] Add tests for first administrator bootstrap success, duplicate prevention, password hashing, and no hard-coded production credentials in test/bootstrap-admin.e2e-spec.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth and authorization infrastructure that MUST be complete before any user story can be implemented.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T010 Add refresh token family schema with hashed token fields, status, subject, client, expiry, and TTL indexes in src/auth/schemas/refresh-token-family.schema.ts
- [ ] T011 Add security activity event schema with redacted event context and audit indexes in src/auth/schemas/security-activity-event.schema.ts
- [ ] T012 [P] Add optional auth client schema for OIDC-friendly client ids, scopes, redirect URIs, and status in src/auth/schemas/auth-client.schema.ts
- [ ] T013 Implement permission decorator and metadata key in src/auth/permissions.decorator.ts
- [ ] T014 Implement permission mapping service for roles, roleArea, scopes, and normalized request auth context in src/auth/permissions.service.ts
- [ ] T015 Implement permissions guard with deny-by-default behavior, member-token rejection on staff/admin routes, and ForbiddenException semantics in src/auth/permissions.guard.ts
- [ ] T016 Update JwtStrategy to validate issuer, audience, expiry, authVersion, roleArea, and active account status in src/auth/jwt.strategy.ts
- [ ] T017 Update JwtAuthGuard and current-user/current-member decorators to expose normalized auth context in src/auth/jwt-auth.guard.ts, src/auth/current-user.decorator.ts, and src/auth/current-member.decorator.ts
- [ ] T018 Implement refresh-token hashing, rotation, replay detection, revocation, and cookie helpers in src/auth/token-session.service.ts
- [ ] T019 Implement security activity recording with password/token/request-body redaction in src/auth/security-activity.service.ts
- [ ] T020 Register new schemas, services, and guards in src/auth/auth.module.ts
- [ ] T021 [P] Add focused unit tests for permission mapping and deny-by-default behavior in src/auth/permissions.guard.spec.ts
- [ ] T022 [P] Add focused unit tests for refresh rotation, replay detection, and token hashing in src/auth/token-session.service.spec.ts
- [ ] T023 [P] Add focused unit tests for security activity redaction in src/auth/security-activity.service.spec.ts

**Checkpoint**: Foundation ready. User story implementation can now begin in priority order or in parallel by story.

---

## Phase 3: User Story 1 - Sign in with a persistent account (Priority: P1) MVP

**Goal**: Staff/admin and member users can sign in with persistent accounts, receive OIDC-friendly short-lived JWT access tokens, use rotated refresh sessions, and survive application restarts without in-memory users.

**Independent Test**: Create stored staff and member accounts, sign in, restart the app, sign in again, refresh tokens, and verify generic failure behavior for invalid credentials.

### Tests for User Story 1

- [ ] T024 [P] [US1] Add e2e tests for staff sign-in success, generic failure, token claims, refresh rotation, logout, and logout-all in test/auth.e2e-spec.ts
- [ ] T025 [P] [US1] Add e2e tests for member sign-in success, generic failure, authStatus denial, token claims, and refresh rotation in test/member-auth.e2e-spec.ts
- [ ] T026 [P] [US1] Add service tests for staff/member login, token claim construction, authVersion denial, and lastLoginAt updates in src/auth/auth.service.spec.ts
- [ ] T027 [P] [US1] Add frontend API tests for staff login, member login, refresh, logout, and auth/me responses in frontend/src/lib/api/auth.test.ts
- [ ] T028 [P] [US1] Add frontend session tests for memory-only access token behavior and refresh/sign-out cache clearing in frontend/src/lib/auth/session.test.ts

### Implementation for User Story 1

- [ ] T029 [US1] Update AuthService to issue tokenType/expiresIn/scope/permissions, set refresh cookies, record security events, and use generic credential failures in src/auth/auth.service.ts
- [ ] T030 [US1] Add refresh, logout, logout-all, and auth/me endpoints with cookie handling in src/auth/auth.controller.ts
- [ ] T031 [US1] Update StaffUser schema/service to persist authVersion/passwordUpdatedAt, touch lastLoginAt, and revoke sessions on status changes in src/staff-users/schemas/staff-user.schema.ts and src/staff-users/staff-users.service.ts
- [ ] T032 [US1] Update Member schema/service to persist authVersion, support active auth checks, touch lastLoginAt, and revoke sessions on status/authStatus changes in src/members/schemas/member.schema.ts and src/members/members.service.ts
- [ ] T033 [US1] Add token issuer/audience/authVersion claims and refresh cookie settings to frontend API auth types in frontend/src/lib/api/types.ts
- [ ] T034 [US1] Update staff auth client functions for login, refresh, logout, logout-all, and auth/me in frontend/src/lib/api/auth.ts
- [ ] T035 [US1] Update member auth client functions for member login, refresh, logout, and auth/me in frontend/src/lib/api/member-auth.ts
- [ ] T036 [US1] Update staff and member login components to handle generic errors, refresh continuity, and returned permissions in frontend/src/features/auth/staff-login.tsx and frontend/src/features/auth/member-login.tsx
- [ ] T037 [US1] Update sign-out behavior to call logout, clear memory session, clear query cache, and route to the correct login page in frontend/src/lib/auth/sign-out.ts

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Block members from staff and admin areas (Priority: P1)

**Goal**: Members can access only their own self-service area and are denied from all staff/admin routes and actions, including direct API requests.

**Independent Test**: Sign in as a member, try staff catalog, borrowing, member-management, staff-user, and admin routes directly and through UI navigation, and confirm no staff/admin data is shown.

### Tests for User Story 2

- [ ] T038 [P] [US2] Add direct API e2e tests that member tokens are denied from books, book-categories, members staff routes, borrowings staff routes, and staff-users routes in test/authorization.e2e-spec.ts
- [ ] T039 [P] [US2] Add direct API e2e tests that member tokens and unauthorized staff tokens are denied from membership-type read/manage routes requiring membership-types:read and membership-types:manage in test/membership-authorization.e2e-spec.ts
- [ ] T040 [P] [US2] Add horizontal member ownership e2e tests for /members/me and member borrowing details in test/member-self-service.e2e-spec.ts
- [ ] T041 [P] [US2] Add frontend route-guard tests for member-vs-staff/admin navigation denial in frontend/src/lib/auth/route-guards.test.ts
- [ ] T042 [P] [US2] Add Playwright e2e coverage for member denial from staff/admin screens and direct route attempts in frontend/tests/e2e/member-privacy.spec.ts

### Implementation for User Story 2

- [ ] T043 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/books/books.controller.ts
- [ ] T044 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/book-categories/book-categories.controller.ts
- [ ] T045 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/members/members.controller.ts
- [ ] T046 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/borrowings/borrowings.controller.ts
- [ ] T047 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and membership-types:read/manage decorators on src/membership-types/membership-types.controller.ts
- [ ] T048 [US2] Update MemberAuthGuard to require roleArea member plus member:self:read and reject staff/admin contexts in src/auth/member-auth.guard.ts
- [ ] T049 [US2] Update member self-service services to derive member id only from CurrentMember and reject user-supplied member ids in src/members/members.service.ts and src/borrowings/borrowings.service.ts
- [ ] T050 [US2] Update frontend route guards to use returned roleArea and permissions, route denied users to unauthorized, and avoid rendering protected stale data in frontend/src/lib/auth/route-guards.ts
- [ ] T051 [US2] Update API client unauthorized/forbidden handling to clear invalid sessions on 401 and preserve access-denied UX on 403 in frontend/src/lib/api/client.ts and frontend/src/lib/api/errors.ts

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Manage staff roles and permissions (Priority: P2)

**Goal**: Administrators can create, update, deactivate, and assign approved roles to staff users, while regular staff cannot manage users, roles, or permissions.

**Independent Test**: Sign in as admin and regular staff, assign roles to accounts, confirm changed permissions take effect without restart, and confirm non-admin users are denied role/user management.

### Tests for User Story 3

- [ ] T052 [P] [US3] Add e2e tests for admin staff-user create/update/deactivate/role assignment and regular-staff denial in test/auth.e2e-spec.ts
- [ ] T053 [P] [US3] Add service tests for role validation, approved role assignment, authVersion bump, and session revocation in src/staff-users/staff-users.service.spec.ts
- [ ] T054 [P] [US3] Add frontend tests for staff-user role assignment forms and access-denied states in frontend/src/features/auth/staff-role-management.test.tsx
- [ ] T055 [P] [US3] Add Playwright acceptance test that an administrator can create a staff account, assign a role, sign in as that staff user, and confirm permitted access within 5 minutes in frontend/tests/e2e/staff-role-management.spec.ts

### Implementation for User Story 3

- [ ] T056 [US3] Update staff-user DTOs to expose permissions, validate approved roles, and redact credential fields in src/staff-users/dto/staff-user.dto.ts
- [ ] T057 [US3] Update StaffUsersService to create/update/deactivate staff users, validate roles, hash passwords, bump authVersion, revoke sessions, and record role/account security events in src/staff-users/staff-users.service.ts
- [ ] T058 [US3] Update StaffUsersController to require staff-users:read, staff-users:manage, roles:read, and roles:manage permissions per route in src/staff-users/staff-users.controller.ts
- [ ] T059 [US3] Add a role/permission review endpoint or service method for admin review in src/auth/auth.controller.ts and src/auth/permissions.service.ts
- [ ] T060 [US3] Update frontend staff-user API types and mutations for permissions, role assignment, deactivation, and role review in frontend/src/lib/api/types.ts and frontend/src/lib/api/mutations.ts
- [ ] T061 [US3] Add or update staff-user management UI for role assignment, deactivation, and permission review in frontend/src/features/auth/staff-role-management.tsx

**Checkpoint**: User Stories 1, 2, and 3 work independently.

---

## Phase 6: User Story 4 - Review authentication and authorization activity (Priority: P3)

**Goal**: Administrators can review sign-in, denied access, role change, account status, refresh replay, revocation, and sign-out activity without exposing secrets.

**Independent Test**: Trigger failed sign-in, denied member access, role change, refresh replay, and sign-out events; then sign in as admin and verify event records are visible and redacted.

### Tests for User Story 4

- [ ] T062 [P] [US4] Add e2e tests for security activity list filtering, admin-only access, and regular staff/member denial in test/security-activity.e2e-spec.ts
- [ ] T063 [P] [US4] Add service tests for security event filtering, pagination, and redaction in src/auth/security-activity.service.spec.ts
- [ ] T064 [P] [US4] Add frontend tests for security activity table, empty state, filters, and forbidden state in frontend/src/features/auth/security-activity.test.tsx

### Implementation for User Story 4

- [ ] T065 [US4] Implement security activity query, pagination, filters, and response DTOs in src/auth/security-activity.service.ts and src/auth/dto/security-activity.dto.ts
- [ ] T066 [US4] Add administrator-only security activity endpoints requiring security-events:read in src/auth/auth.controller.ts
- [ ] T067 [US4] Wire authorization-denied event recording from PermissionsGuard and MemberAuthGuard in src/auth/permissions.guard.ts and src/auth/member-auth.guard.ts
- [ ] T068 [US4] Add frontend API functions and types for security activity listing in frontend/src/lib/api/auth.ts and frontend/src/lib/api/types.ts
- [ ] T069 [US4] Add administrator security activity route and table UI in frontend/src/features/auth/security-activity.tsx and frontend/src/app/router.tsx

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening, documentation, and final validation across all stories.

- [ ] T070 [P] Add frontend Playwright coverage for staff/admin role boundaries and sign-out refresh revocation in frontend/tests/e2e/staff-auth-permissions.spec.ts
- [ ] T071 [P] Add operational documentation for auth environment variables, production secret requirements, token TTLs, and future Keycloak migration notes in ./README.md
- [ ] T072 Add `@nestjs/throttler` dependency and configure global throttling defaults for auth-sensitive routes in package.json and src/app.module.ts
- [ ] T073 Add login and refresh endpoint throttling plus abuse-case tests in src/auth/auth.module.ts, src/auth/auth.controller.ts, and test/auth.e2e-spec.ts
- [ ] T074 Add production startup validation that rejects development-only JWT secrets and missing cookie secret in src/config/auth.config.ts
- [ ] T075 Run and document backend verification commands from quickstart.md with npm test and npm run test:e2e in specs/003-auth-roles-permissions/quickstart.md
- [ ] T076 Run and document frontend verification commands from quickstart.md with npm run frontend:test and npm run frontend:test:e2e in specs/003-auth-roles-permissions/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational completion.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

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
- Foundational schema/service test tasks T021, T022, and T023 can run in parallel after the corresponding service skeletons exist.
- User Story 1 tests T024-T028 can run in parallel.
- User Story 2 tests T038-T042 can run in parallel.
- User Story 3 tests T052-T055 can run in parallel.
- User Story 4 tests T062-T064 can run in parallel.
- Frontend work for a story can proceed in parallel with backend implementation once API contracts are stable.

## Parallel Example: User Story 1

```bash
Task: "Add e2e tests for staff sign-in success, generic failure, token claims, refresh rotation, logout, and logout-all in test/auth.e2e-spec.ts"
Task: "Add e2e tests for member sign-in success, generic failure, authStatus denial, token claims, and refresh rotation in test/member-auth.e2e-spec.ts"
Task: "Add service tests for staff/member login, token claim construction, authVersion denial, and lastLoginAt updates in src/auth/auth.service.spec.ts"
Task: "Add frontend API tests for staff login, member login, refresh, logout, and auth/me responses in frontend/src/lib/api/auth.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add direct API e2e tests that member tokens are denied from books, book-categories, members staff routes, borrowings staff routes, and staff-users routes in test/authorization.e2e-spec.ts"
Task: "Add horizontal member ownership e2e tests for /members/me and member borrowing details in test/member-self-service.e2e-spec.ts"
Task: "Add frontend route-guard tests for member-vs-staff/admin navigation denial in frontend/src/lib/auth/route-guards.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add e2e tests for admin staff-user create/update/deactivate/role assignment and regular-staff denial in test/auth.e2e-spec.ts"
Task: "Add service tests for role validation, approved role assignment, authVersion bump, and session revocation in src/staff-users/staff-users.service.spec.ts"
Task: "Add frontend tests for staff-user role assignment forms and access-denied states in frontend/src/features/auth/staff-role-management.test.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "Add e2e tests for security activity list filtering, admin-only access, and regular staff/member denial in test/security-activity.e2e-spec.ts"
Task: "Add service tests for security event filtering, pagination, and redaction in src/auth/security-activity.service.spec.ts"
Task: "Add frontend tests for security activity table, empty state, filters, and forbidden state in frontend/src/features/auth/security-activity.test.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate sign-in, persistence across restart, generic failures, token claims, refresh rotation, logout, and memory-only frontend session behavior.
5. Demo or deploy only if protected routes are still blocked by existing guards until US2 is complete.

### Incremental Delivery

1. Complete Setup + Foundational.
2. Add US1 for persistent accounts and secure sessions.
3. Add US2 for member/staff/admin access boundaries.
4. Add US3 for administrator role and staff account management.
5. Add US4 for security activity review.
6. Polish with rate limiting, operational checks, and full quickstart validation.

### Parallel Team Strategy

With multiple developers:

1. Complete Setup + Foundational together.
2. Backend developer A: US1 token/session/auth service work.
3. Backend developer B: US2 permission guard/controller conversion.
4. Frontend developer: US1/US2 login, route guard, and sign-out integration after API contracts stabilize.
5. After US1-US2, split US3 admin role management and US4 security activity.

## Notes

- [P] tasks = different files, no dependency on incomplete same-file work.
- [US1]-[US4] labels map tasks to specific user stories for traceability.
- Each user story should be independently completable and testable at its checkpoint.
- Verify tests fail before implementing.
- Avoid storing passwords, raw tokens, token hashes, or full sensitive payloads in logs or security activity records.
