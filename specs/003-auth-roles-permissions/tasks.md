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
- [ ] T024 Add AuthIdentifier schema with pending/active/released/conflict states, manual-repair-required conflict status, unique normalizedIdentifier, non-unique pendingOperationId/lastOperationId indexes, activationGateOperationId fail-closed lookup/index support, subject references, and audit fields in src/auth/schemas/auth-identifier.schema.ts
- [ ] T025 Add AuthIdentifierOperation schema with explicit operation/cleanup states, bounded assignments, manifest metadata, deterministic terminalEventId, original/resuming actor fields, partial compound repair-key-policy index, lease indexes, and terminal/cleanup TTL rules in src/auth/schemas/auth-identifier-operation.schema.ts
- [ ] T026 Add AuthIdentifierRepairBatch schema after the shared operation assignment shape is available, with bounded assignments, idempotent batch states, checkpoint HMAC metadata, unique parent-operation/batch-number index, parent/status index, and post-cleanup TTL in src/auth/schemas/auth-identifier-repair-batch.schema.ts
- [ ] T027 [P] Extend SecurityActivityEvent with unique eventId plus foundational identifier-conflict-resolved and identifier-repair-resumed event types required by operation finalization and repair in src/auth/schemas/security-activity-event.schema.ts
- [ ] T028 [P] Add unit tests for transaction/saga paths, valid state transitions, failed-retryable reconciliation, finalizing audit-before-TTL crash boundaries, duplicate terminal-event prevention, completed/failed-terminal replay with original HTTP status, reservation-reference attachment after crashes, operation idempotency within retention, assignment limits 19/20/21, pending/gated denial, compensation, and result replay in src/auth/auth-identifier.service.spec.ts
- [ ] T029 Implement transactional mutations and durable AuthIdentifierOperation saga coordination using explicit recoverable/finalizing/terminal states, pending and activation-gated reservation references, cleanup status, terminal replay, assignment bounds, compensation, and account aggregate updates in src/auth/auth-identifier.service.ts
- [ ] T030 Implement foundational idempotent terminal-event and identifier-repair-resumed writes before TTL eligibility with deterministic eventId and redacted original/resuming actor context in src/auth/security-activity.service.ts
- [ ] T031 [P] Add migration tests for identifier/operation/repair-batch/terminal-event/TTL indexes, partial repair-key-policy index with explain assertion that the required-version query avoids COLLSCAN, unique parent-batch checkpoints, clean backfill, oversized-conflict quarantine, migration-required readiness, safe rollback, and history preservation in test/auth-identifier-migration.e2e-spec.ts
- [ ] T032 Extend the auth migration to create identifier/operation/repair-batch/terminal-event/terminal-TTL indexes, including the partial compound repair-key-policy index, unique parent-operation/batch-number checkpoints, and activation-gate lookup, then backfill reservations, quarantine oversized conflicts, block/report ambiguity, and preserve history on rollback in migrations/versions/003-auth-roles-permissions.ts
- [ ] T033 Register migrated AuthIdentifier/AuthIdentifierOperation/AuthIdentifierRepairBatch schemas without runtime index creation in src/auth/auth.module.ts
- [ ] T034 Add `@nestjs/schedule` dependency and ScheduleModule wiring in package.json, src/app.module.ts, and src/auth/auth.module.ts
- [ ] T035 [P] Add configuration tests for strict previous-key JSON format/count/version/length, rotation-aware key lookup exposure to repair consumers, operation retention, online/repair-batch assignment limits, lease/reconciliation settings, issuer/audience, TTLs, unsafe secrets, and redacted startup diagnostics in src/config/auth.config.spec.ts
- [ ] T036 Implement production validation and rotation-aware loading for JWT/cookie/audit-correlation keys and previous-key JSON, exposing versioned key lookup without deriving repair keys, plus operation retention, online/repair-batch assignment limits, issuer/audience, TTLs, and lease/reconciliation settings in src/config/auth.config.ts
- [ ] T037 [P] Add AuthIdentifierRepairKeyPolicyService tests for indexed required-version queries, missing-key readiness, worker denial without mutation, restoration recovery, two-previous-key rotation preflight, repair-key-rotation-blocked diagnostics, and safe version/count output in src/auth/auth-identifier-repair-key-policy.service.spec.ts
- [ ] T038 Implement AuthIdentifierRepairKeyPolicyService as the single owner of required-version queries, missing-key readiness, worker allow/deny decisions, and rotation preflight using the partial compound operation index in src/auth/auth-identifier-repair-key-policy.service.ts
- [ ] T039 Register and export AuthIdentifierRepairKeyPolicyService for reconciliation and health consumers in src/auth/auth.module.ts
- [ ] T040 [P] Add reconciliation unit tests for reservation discovery by pendingOperationId, valid recoverable/finalizing transitions, audit-before-TTL crash recovery, idempotent terminal events, gated-parent completion checks, bounded gate/batch cleanup before TTL, atomic lease acquisition, renewal/expiry, skew tolerance, multi-instance exclusion, clean terminal-operation ignore, and HMAC redaction in src/auth/auth-identifier-reconciliation.service.spec.ts
- [ ] T041 [P] Add recovery e2e tests for migration-before-start, migration-required readiness, startup/scheduled reconciliation, bounded batches, competing workers/claims, reservation-reference repair, failed-retryable recovery, saga compensation, finalizing audit persistence, activation-gate fail-closed/unlock/cleanup behavior, shared key-policy repair-key-required no-mutation/restoration recovery, and non-TTL incomplete-cleanup operations in test/auth-identifier-recovery.e2e-spec.ts
- [ ] T042 Implement idempotent post-migration startup/scheduled reconciliation with pending-reservation discovery, recoverable/finalizing state handling, foundational terminal-event persistence before TTL eligibility, AuthIdentifierRepairKeyPolicyService worker decisions, MongoDB-time leases, renewal, bounded activation-gate/repair-batch cleanup, clean terminal ignore, and multi-instance ownership in src/auth/auth-identifier-reconciliation.service.ts and src/auth/auth.module.ts
- [ ] T043 Add auth-identifiers:read/manage permissions to the stable permission enum, administrator mapping, and normalized auth context in src/common/enums/auth-permission.enum.ts and src/auth/permissions.service.ts
- [ ] T044 [P] Add guard tests proving explicit public metadata bypasses authentication while unmarked routes remain denied by default in src/auth/jwt-auth.guard.spec.ts and src/auth/permissions.guard.spec.ts
- [ ] T045 Implement an explicit Public decorator and make JwtAuthGuard and PermissionsGuard honor it in src/auth/public.decorator.ts, src/auth/jwt-auth.guard.ts, and src/auth/permissions.guard.ts
- [ ] T046 [P] Add unauthenticated liveness/readiness e2e tests for healthy state, runtime MongoDB/auth-infrastructure failure, AuthIdentifierRepairKeyPolicyService referenced-key removal/restoration with repair-key-required response, five-second response, and connection-string/secret/stack/host/account redaction in test/health.e2e-spec.ts
- [ ] T047 Extend the existing health module with explicitly public GET /health liveness and public GET /health/ready runtime MongoDB/auth-infrastructure checks plus AuthIdentifierRepairKeyPolicyService readiness evaluation, returning redacted repair-key-required without mutating repair state, in src/health/health.controller.ts, src/health/health.service.ts, and src/health/health.module.ts
- [ ] T048 Add `@nestjs/throttler` and configure global auth-sensitive defaults before login endpoints depend on throttling in package.json and src/app.module.ts

**Checkpoint**: Foundation ready. User story implementation can now begin in priority order or in parallel by story.

---

## Phase 3: User Story 1 - Sign in with a persistent account (Priority: P1) MVP

**Goal**: Staff/admin and member users can sign in with persistent accounts, receive OIDC-friendly short-lived JWT access tokens, use rotated refresh sessions, and survive application restarts without in-memory users.

**Independent Test**: Create stored staff and member accounts, sign in through the same keyboard-accessible page, verify roleArea/permission landing and generic legacy-conflict failure, restart the app against the same database, sign in again, and rotate refresh tokens.

### Tests for User Story 1

- [x] T049 [P] [US1] Add e2e tests for staff sign-in success, generic failure, token claims, refresh rotation, logout, and logout-all in test/auth.e2e-spec.ts
- [x] T050 [P] [US1] Add e2e tests for member sign-in success, generic failure, authStatus denial, token claims, and refresh rotation in test/member-auth.e2e-spec.ts
- [x] T051 [P] [US1] Add service tests for staff/member login, token claim construction, authVersion denial, and lastLoginAt updates in src/auth/auth.service.spec.ts
- [x] T052 [P] [US1] Add frontend API tests for staff login, member login, refresh, logout, and auth/me responses in frontend/src/lib/api/auth.test.ts
- [x] T053 [P] [US1] Add frontend session tests for memory-only access token behavior and refresh/sign-out cache clearing in frontend/src/lib/auth/session.test.ts

### Implementation for User Story 1

- [x] T054 [US1] Update AuthService to issue tokenType/expiresIn/scope/permissions, set refresh cookies, record security events, and use generic credential failures in src/auth/auth.service.ts
- [x] T055 [US1] Add refresh, logout, logout-all, and auth/me endpoints with cookie handling in src/auth/auth.controller.ts
- [x] T056 [US1] Update StaffUser schema/service to persist authVersion/passwordUpdatedAt, touch lastLoginAt, and revoke sessions on status changes in src/staff-users/schemas/staff-user.schema.ts and src/staff-users/staff-users.service.ts
- [x] T057 [US1] Update Member schema/service to persist authVersion, support active auth checks, touch lastLoginAt, and revoke sessions on status/authStatus changes in src/members/schemas/member.schema.ts and src/members/members.service.ts
- [x] T058 [US1] Add token issuer/audience/authVersion claims and refresh cookie settings to frontend API auth types in frontend/src/lib/api/types.ts
- [x] T059 [US1] Update staff auth client functions for login, refresh, logout, logout-all, and auth/me in frontend/src/lib/api/auth.ts
- [x] T060 [US1] Update member auth client functions for member login, refresh, logout, and auth/me in frontend/src/lib/api/member-auth.ts
- [x] T061 [US1] Establish the legacy staff/member login baseline for generic errors, refresh continuity, and returned permissions before shared-page convergence in frontend/src/features/auth/staff-login.tsx and frontend/src/features/auth/member-login.tsx
- [x] T062 [US1] Establish the legacy sign-out baseline for logout, memory-session clearing, query-cache clearing, and role-specific redirects before shared-route convergence in frontend/src/lib/auth/sign-out.ts

### Shared Sign-In Clarification Tasks

- [ ] T063 [P] [US1] Add AuthService tests for reservation-based shared identifier resolution, staff/member success, completed activation-gate acceptance, missing/non-terminal/failed gate fail-closed behavior, no-role authentication with no protected access, legacy ambiguity denial, generic failures, HMAC-only sign-in correlation, and redacted audit context in src/auth/auth.service.spec.ts
- [ ] T064 [P] [US1] Add API e2e tests for POST /auth/login with staff, admin, and member credentials plus ambiguous identifiers and compatibility-wrapper parity in test/auth.e2e-spec.ts
- [ ] T065 [P] [US1] Add frontend API tests for the unified login request, discriminated staff/member response, and generic failure behavior in frontend/src/lib/api/auth.test.ts
- [ ] T066 [P] [US1] Add frontend tests for one shared sign-in form, roleArea/permission-based landing, accessible names, announced errors, deterministic failure focus, pending-state duplicate prevention, protected-route redirects, and generic errors in frontend/src/features/auth/shared-login.test.tsx
- [ ] T067 [P] [US1] Add Playwright coverage for keyboard-only staff/admin/member shared sign-in, accessible errors, legacy-login redirects, and sign-out return behavior in frontend/tests/e2e/shared-sign-in.spec.ts and frontend/tests/e2e/accessibility.spec.ts
- [ ] T068 [P] [US1] Add restart-persistence e2e coverage that recreates the Nest application against the same database and verifies staff/member roles, scope, ownership, and refresh continuity in test/auth-persistence.e2e-spec.ts
- [ ] T069 [US1] Add a validated shared login request DTO and discriminated staff/member response types in src/auth/dto/shared-login.dto.ts
- [ ] T070 [US1] Implement AuthIdentifier reservation lookup, exact-one-context enforcement, activationGateOperationId parent-completion verification with fail-closed missing/expired/non-terminal/failed behavior, legacy conflict denial, generic credential denial, no-role context handling, and HMAC-only redacted ambiguity/sign-in events in src/auth/auth.service.ts
- [ ] T071 [US1] Add POST /auth/login and make POST /auth/staff-login and POST /auth/member-login delegate to the shared token, cookie, throttling, and audit behavior in src/auth/auth.controller.ts
- [ ] T072 [US1] Consolidate frontend login types and API calls around POST /auth/login while retaining compatibility exports only where still required in frontend/src/lib/api/types.ts, frontend/src/lib/api/auth.ts, and frontend/src/lib/api/member-auth.ts
- [ ] T073 [US1] Replace role-specific sign-in screens with one keyboard-accessible shared page with announced errors, deterministic focus and duplicate-submit prevention; route from roleArea/permissions, redirect legacy URLs, and send sign-out to the shared route in frontend/src/features/auth/shared-login.tsx, frontend/src/app/router.tsx, and frontend/src/lib/auth/sign-out.ts

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Block members from staff and admin areas (Priority: P1)

**Goal**: Members can access only their own self-service area and are denied from all staff/admin routes and actions, including direct API requests.

**Independent Test**: Sign in as a member, exercise the data-driven route matrix directly and through UI navigation, and confirm every protected action returns the expected allow, unauthenticated, permission-denied, ownership-denied, or member-denied outcome without exposing staff/admin data.

### Tests for User Story 2

- [x] T074 [P] [US2] Add direct API e2e tests that member tokens are denied from books, book-categories, members staff routes, borrowings staff routes, and staff-users routes in test/authorization.e2e-spec.ts
- [x] T075 [P] [US2] Add direct API e2e tests that member tokens and unauthorized staff tokens are denied from membership-type read/manage routes requiring membership-types:read and membership-types:manage in test/membership-authorization.e2e-spec.ts
- [x] T076 [P] [US2] Add horizontal member ownership e2e tests for /members/me and member borrowing details in test/member-self-service.e2e-spec.ts
- [x] T077 [P] [US2] Add frontend route-guard tests for member-vs-staff/admin navigation denial in frontend/src/lib/auth/route-guards.test.ts
- [x] T078 [P] [US2] Add Playwright e2e coverage for member denial from staff/admin screens and direct route attempts in frontend/tests/e2e/member-privacy.spec.ts
- [ ] T079 [P] [US2] Add a data-driven allow, permission-deny, member-deny, ownership-deny, and unauthenticated test for every protected controller action in test/authorization-matrix.e2e-spec.ts

### Implementation for User Story 2

- [x] T080 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/books/books.controller.ts
- [x] T081 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/book-categories/book-categories.controller.ts
- [x] T082 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/members/members.controller.ts
- [x] T083 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and explicit permission decorators on src/borrowings/borrowings.controller.ts
- [x] T084 [US2] Replace role-only guards with JwtAuthGuard plus PermissionsGuard and membership-types:read/manage decorators on src/membership-types/membership-types.controller.ts
- [x] T085 [US2] Update MemberAuthGuard to require roleArea member plus member:self:read and reject staff/admin contexts in src/auth/member-auth.guard.ts
- [x] T086 [US2] Update member self-service services to derive member id only from CurrentMember and reject user-supplied member ids in src/members/members.service.ts and src/borrowings/borrowings.service.ts
- [x] T087 [US2] Update frontend route guards to use returned roleArea and permissions, route denied users to unauthorized, and avoid rendering protected stale data in frontend/src/lib/auth/route-guards.ts
- [x] T088 [US2] Update API client unauthorized/forbidden handling to clear invalid sessions on 401 and preserve access-denied UX on 403 in frontend/src/lib/api/client.ts and frontend/src/lib/api/errors.ts

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Manage staff roles and permissions (Priority: P2)

**Goal**: Administrators can create, update, deactivate, and assign approved roles to staff users and resolve legacy identifier conflicts, while regular staff cannot manage users, roles, permissions, or identifier ownership.

**Independent Test**: Sign in as admin and regular staff, assign roles, confirm changed permissions take effect without restart, resolve a reviewable identifier conflict online, repair an oversized conflict through the token-authorized CLI with indexed key-policy readiness/rotation checks and gated parent completion, preserve passwords/history, and confirm non-admin users are denied role, user, and identifier-conflict management.

### Tests for User Story 3

- [ ] T089 [P] [US3] Add e2e tests for admin staff-user create/update/deactivate/role assignment and regular-staff denial in test/auth.e2e-spec.ts
- [ ] T090 [P] [US3] Add service tests for role validation, transactional identifier reservation, cross-context collision rejection, approved role assignment, authVersion bump, and session revocation in src/staff-users/staff-users.service.spec.ts
- [ ] T091 [P] [US3] Add frontend tests for staff-user role assignment forms and access-denied states in frontend/src/features/auth/staff-role-management.test.tsx
- [ ] T092 [P] [US3] Add Playwright acceptance test that an administrator can create a staff account, assign a role, sign in as that staff user, and confirm permitted access within 5 minutes in frontend/tests/e2e/staff-role-management.spec.ts
- [ ] T093 [P] [US3] Add e2e tests for transaction/saga conflict resolution, explicit operation transitions, failed-retryable recovery, finalizing audit-before-TTL ordering, retained completed/failed-terminal replay with original HTTP status, retained/no-retained subjects, reservation-reference recovery, assignment limits 19/20/21 with 422 response, replacement collision, expiry requiring a new operation id, compensation, unchanged passwords, redaction, and foundational idempotent security events in test/auth-identifier-conflicts.e2e-spec.ts
- [ ] T094 [P] [US3] Add deterministic manifest utility tests for normalized RFC 8785 canonical bytes, fixed HKDF salt/info/output length, published derivation/HMAC vectors, current/previous key selection, constant-time comparison, changed mappings, and unavailable key versions in src/auth/auth-identifier-repair-manifest.spec.ts
- [ ] T095 [P] [US3] Add AuthIdentifierRepairAuthorizationService tests for dry-run secrecy, token signature/issuer/audience/expiry, current account/authVersion/role/permission revalidation before every mutating boundary, expired invocation pause, and redacted denial in src/auth/auth-identifier-repair-authorization.service.spec.ts
- [ ] T096 [P] [US3] Add AuthIdentifierRepairService parent-lifecycle tests for manifest verification, delegated key-policy decisions, different-admin resume attribution/event, and pending/applying/failed-retryable/compensating/finalizing/terminal transitions in src/auth/auth-identifier-repair.service.spec.ts
- [ ] T097 [US3] Add AuthIdentifierRepairService batch tests for unique bounded checkpoints, idempotent preparation/resume, reverse compensation, bounded gated activation, fail-closed authentication before parent completion, atomic parent unlock, and bounded gate/batch cleanup before TTL in src/auth/auth-identifier-repair.service.spec.ts
- [ ] T098 [P] [US3] Add offline repair integration tests for oversized migration quarantine, transaction requirement, history preservation, one idempotent parent terminal event, restart recovery, and no data mutation while the manifest key is unavailable in test/auth-identifier-offline-repair.e2e-spec.ts
- [ ] T099 [P] [US3] Add process-level CLI tests for token-through-stdin, actor-override rejection, dry-run output, confirmation refusal, service delegation, resumable exit codes, and token/identifier redaction in test/auth-identifier-offline-repair-cli.e2e-spec.ts
- [ ] T100 [P] [US3] Add frontend tests for conflict listing, safe account labels, replacement validation, successful resolution, and forbidden states in frontend/src/features/auth/identifier-conflicts.test.tsx

### Implementation for User Story 3

- [ ] T101 [US3] Update staff-user DTOs to expose permissions, validate approved roles, and redact credential fields in src/staff-users/dto/staff-user.dto.ts
- [ ] T102 [US3] Update StaffUsersService to create/update/deactivate staff users with transactional AuthIdentifier reserve/release, validate roles, hash passwords, bump authVersion, revoke sessions, and record role/account security events in src/staff-users/staff-users.service.ts
- [ ] T103 [US3] Update StaffUsersController to require staff-users:read, staff-users:manage, roles:read, and roles:manage permissions per route in src/staff-users/staff-users.controller.ts
- [ ] T104 [US3] Add a role/permission review endpoint or service method for admin review in src/auth/auth.controller.ts and src/auth/permissions.service.ts
- [ ] T105 [US3] Update frontend staff-user API types and mutations for permissions, role assignment, deactivation, and role review in frontend/src/lib/api/types.ts and frontend/src/lib/api/mutations.ts
- [ ] T106 [US3] Add or update staff-user management UI for role assignment, deactivation, and permission review in frontend/src/features/auth/staff-role-management.tsx
- [ ] T107 [US3] Update member identifier-changing workflows to reserve/release AuthIdentifier transactionally and record safe conflict events in src/members/members.service.ts
- [ ] T108 [US3] Add deterministic conflict DTOs plus administrator resolve/status endpoints for transaction/saga execution, explicit recoverable/finalizing/terminal states, assignment-limit 422 validation, complete claimant accounting, pending/gated reservation references, compensation, retained completed/failed-terminal replay with original HTTP status, retention-scoped idempotency, and redacted results in src/auth/dto/auth-identifier.dto.ts, src/auth/auth.controller.ts, and src/auth/auth-identifier.service.ts
- [ ] T109 [US3] Add frontend conflict/operation-status API types, queries, polling, and resolution mutation in frontend/src/lib/api/types.ts and frontend/src/lib/api/auth.ts
- [ ] T110 [US3] Add administrator conflict review/resolution UI with pending, applying, compensating, finalizing, failed-retryable, completed, failed-terminal, expired, and manual-repair-required states in frontend/src/features/auth/identifier-conflicts.tsx and frontend/src/app/router.tsx
- [ ] T111 [US3] Implement normalized RFC 8785 repair-manifest canonicalization and deterministic HKDF-SHA-256/HMAC derivation using fixed salt, versioned info, 32-byte output, current/previous key lookup, and constant-time comparison in src/auth/auth-identifier-repair-manifest.ts
- [ ] T112 [US3] Implement AuthIdentifierRepairAuthorizationService for validation of the token supplied by the CLI plus current account, authVersion, administrator role area, and auth-identifiers:manage revalidation before data access and every mutating boundary in src/auth/auth-identifier-repair-authorization.service.ts
- [ ] T113 [US3] Implement AuthIdentifierRepairService dry-run parent creation, manifest verification, delegated AuthIdentifierRepairKeyPolicyService decisions, original/resuming actor persistence, resume events, and explicit parent lifecycle transitions using AuthIdentifierRepairAuthorizationService in src/auth/auth-identifier-repair.service.ts
- [ ] T114 [US3] Implement AuthIdentifierRepairService bounded batch preparation, unique checkpoint resume, and reverse compensation while preserving conflict blocking in src/auth/auth-identifier-repair.service.ts
- [ ] T115 [US3] Implement AuthIdentifierRepairService bounded activation gates, applying-to-finalizing transition, atomic parent completion/audit unlock, and post-completion cleanup coordination before TTL eligibility in src/auth/auth-identifier-repair.service.ts
- [ ] T116 [US3] Register AuthIdentifierRepairAuthorizationService, AuthIdentifierRepairService, and their manifest/key dependencies in src/auth/auth.module.ts
- [ ] T117 [US3] Add the thin offline repair CLI adapter for token/input through stdin, explicit mappings, dry-run, confirmation, service invocation, resumable exit codes, and redacted output in scripts/resolve-auth-identifier-conflict.ts

**Checkpoint**: User Stories 1, 2, and 3 work independently.

---

## Phase 6: User Story 4 - Review authentication and authorization activity (Priority: P3)

**Goal**: Administrators can review sign-in, denied access, role change, account status, refresh replay, revocation, and sign-out activity without exposing secrets.

**Independent Test**: Trigger failed and ambiguous sign-in, denied member access, role change, identifier-conflict resolution/recovery, authorized repair resume with original/resuming actors, refresh replay, and sign-out events; then sign in as admin and verify event records are visible, filterable, and redacted.

### Tests for User Story 4

- [ ] T118 [P] [US4] Add e2e tests covering the complete required event catalog for successful/failed sign-in, sign-out, authorization denial, account deactivation, role changes, identifier conflict detection/resolution/recovery, authorized repair resume with original/resuming actors, refresh replay, and token revocation, including HMAC-only sign-in correlation, security activity filtering, admin-only access, and regular staff/member denial in test/security-activity.e2e-spec.ts
- [ ] T119 [P] [US4] Add service tests for conflict/recovery event vocabulary, versioned HMAC-SHA-256 correlation, equal-identifier correlation, key rotation, rejection of ordinary hashes/raw identifiers, operation/result context, filtering, pagination, and redaction in src/auth/security-activity.service.spec.ts
- [ ] T120 [P] [US4] Add frontend tests for security activity table, empty state, filters, and forbidden state in frontend/src/features/auth/security-activity.test.tsx

### Implementation for User Story 4

- [ ] T121 [US4] Extend the foundational unique eventId/idempotent terminal-event support with conflict/recovery event vocabulary, HMAC-only sign-in and identifier correlation using versioned AUTH_AUDIT_CORRELATION_SECRET keys, redacted operation context, query, pagination, filters, and DTOs in src/auth/schemas/security-activity-event.schema.ts, src/auth/security-activity.service.ts, and src/auth/dto/security-activity.dto.ts
- [ ] T122 [US4] Add administrator-only security activity endpoints requiring security-events:read in src/auth/auth.controller.ts
- [ ] T123 [US4] Wire authorization-denied event recording from PermissionsGuard and MemberAuthGuard in src/auth/permissions.guard.ts and src/auth/member-auth.guard.ts
- [ ] T124 [US4] Add frontend API functions and types for security activity listing in frontend/src/lib/api/auth.ts and frontend/src/lib/api/types.ts
- [ ] T125 [US4] Add administrator security activity route and table UI in frontend/src/features/auth/security-activity.tsx and frontend/src/app/router.tsx

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening, documentation, and final validation across all stories.

- [ ] T126 [P] Add frontend Playwright coverage for staff/admin role boundaries and sign-out refresh revocation in frontend/tests/e2e/staff-auth-permissions.spec.ts
- [ ] T127 [P] Add operational documentation for auth environment variables, liveness/readiness usage, indexed repair-key-required diagnostics, two-previous-key rotation preflight and repair-key-rotation-blocked handling, online conflict recovery, token-authorized offline repair through stdin, canonical manifest key rotation/retirement, bounded repair batches and activation-gate cleanup, terminal-result replay/expiry, performance verification, token TTLs, shared sign-in behavior, and future Keycloak migration notes in ./README.md
- [ ] T128 [P] Add e2e abuse tests for shared login, compatibility login, and refresh endpoint throttling limits, recovery windows, and generic responses in test/auth.e2e-spec.ts
- [ ] T129 Apply shared login, compatibility login, and refresh throttling policies using the foundational throttler configuration in src/auth/auth.module.ts and src/auth/auth.controller.ts
- [ ] T130 [P] Add history-preservation regression coverage for role changes, deactivation/reactivation, identifier correction, borrowing records, actor references, and security events in test/auth-history-preservation.e2e-spec.ts
- [ ] T131 [P] Add deterministic e2e coverage that role/authVersion changes affect the next protected request and always within 60 seconds in test/authorization.e2e-spec.ts
- [ ] T132 [P] Add test-only equivalent unprotected/protected benchmark handlers and production AppModule route-graph/build exclusion assertions in test/performance/auth-benchmark.module.ts, test/performance/auth-benchmark.controller.ts, and test/performance/auth-benchmark-isolation.spec.ts
- [ ] T133 Implement the production-build benchmark runner with dedicated seeded MongoDB, disabled logging, 100 warm-ups, 500 requests at concurrency 10, nearest-rank auth-boundary overhead p95, 10,000 security events, runtime/hardware metadata, npm command, and evidence output in scripts/verify-auth-performance.ts, package.json, and specs/003-auth-roles-permissions/evidence/auth-performance.md
- [ ] T134 Prepare the moderated script, consent language, role-specific goals, timing/failure definitions, anonymized template, and production release gate in specs/003-auth-roles-permissions/evidence/shared-sign-in-usability.md
- [ ] T135 Have product owner or QA conduct the study with 8 members, 8 staff users, and 4 administrators and record only aggregate first-attempt and 30-second results in specs/003-auth-roles-permissions/evidence/shared-sign-in-usability.md
- [ ] T136 Run and document backend verification commands from quickstart.md with npm test, npm run test:e2e, and npm run verify:auth-performance in specs/003-auth-roles-permissions/quickstart.md
- [ ] T137 Run and document frontend verification commands from quickstart.md with npm run frontend:test and npm run frontend:test:e2e in specs/003-auth-roles-permissions/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational completion.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.
- **Critical task dependencies**: identifier/operation/repair/event schemas T024-T027 precede coordinator/event writers T029-T030, migration T032, key-policy work T037-T039, reconciliation T042, conflict tests T093, and event expansion T121; migration test T031 precedes migration T032, which must be applied before schema registration T033, key-policy implementation T038, scheduler/reconciliation runtime, readiness runtime, and application startup; configuration test T035 precedes loader T036; key-policy test T037 plus schema/migration/config T025/T032/T036 precede key-policy implementation T038 and registration T039; reconciliation tests T040-T041 and readiness test T046 may be authored before implementation, while registered key policy T039 precedes reconciliation implementation T042, health implementation T047, and repair implementation T113; reconciliation tests T040-T041 precede T042; migration T032 and reconciliation T042 precede shared resolver T070 and account integration T102/T107-T108; permissions T043 precede conflict endpoint T108, repair authorization tests T095, authorization service T112, and CLI T117; public policy T045 and readiness test T046 precede health implementation T047; manifest test T094 precedes utility T111; authorization test T095 precedes authorization service T112; parent lifecycle test T096 precedes repair parent implementation T113; batch test T097 follows T096 and precedes batch/finalization implementation T114-T115; integration test T098 precedes T113-T115; utility T111, authorization service T112, and key policy T039 precede repair parent implementation T113, then batch preparation T114, gated finalization T115, module registration T116, and CLI adapter T117; CLI test T099 precedes T117; foundational event support T027/T030 and key loading/policy T036/T039 precede repair services T112-T115 and security activity expansion T121; foundational throttling T048 precedes abuse tests T128 and policy T129, with T128 before T129; security activity T121 and isolated handlers T132 precede benchmark runner T133; shared page T073 and study preparation T134 precede human acceptance T135.

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
- Foundational schema task T027 and test tasks T021-T023, T028, T031, T035, T037, T040-T041, T044, and T046 can run in parallel within their dependency groups; T026 follows T025 because it uses the shared operation assignment shape.
- User Story 1 baseline tests T049-T053 and shared sign-in tests T063-T068 can run in parallel within their respective test groups.
- User Story 2 tests T074-T079 can run in parallel.
- User Story 3 tests T089-T096 and T098-T100 can run in parallel within their dependency groups; T097 follows T096 because both update the repair-service test file.
- User Story 4 tests T118-T120 can run in parallel.
- Frontend work for a story can proceed in parallel with backend implementation once API contracts are stable.

## Parallel Example: User Story 1

```bash
Task: "Add e2e tests for staff sign-in success, generic failure, token claims, refresh rotation, logout, and logout-all in test/auth.e2e-spec.ts"
Task: "Add e2e tests for member sign-in success, generic failure, authStatus denial, token claims, and refresh rotation in test/member-auth.e2e-spec.ts"
Task: "Add AuthService tests for shared identifier resolution, activation-gate fail-closed behavior, no-role access, legacy ambiguity denial, HMAC-only sign-in correlation, and generic failures in src/auth/auth.service.spec.ts"
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
Task: "Add deterministic manifest utility tests for canonical bytes, fixed HKDF/HMAC vectors, key selection, and unavailable versions in src/auth/auth-identifier-repair-manifest.spec.ts"
Task: "Add repair authorization tests for token/account/authVersion/role/permission revalidation and redacted denial in src/auth/auth-identifier-repair-authorization.service.spec.ts"
Task: "Add offline repair integration tests for transaction requirements, history, parent audit, restart recovery, and missing-key no-mutation behavior in test/auth-identifier-offline-repair.e2e-spec.ts"
```

## Parallel Example: User Story 4

```bash
Task: "Add e2e tests for the complete required security event catalog, HMAC-only sign-in correlation, filtering, admin-only access, and regular staff/member denial in test/security-activity.e2e-spec.ts"
Task: "Add service tests for conflict/recovery vocabulary, versioned HMAC correlation, filtering, pagination, and redaction in src/auth/security-activity.service.spec.ts"
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
5. After US1-US2, split US3 staff/role management, US3 identifier-repair services/CLI, and US4 security activity across separate owners.

## Notes

- [P] tasks = different files, no dependency on incomplete same-file work.
- [US1]-[US4] labels map tasks to specific user stories for traceability.
- Each user story should be independently completable and testable at its checkpoint.
- Verify tests fail before implementing.
- T135 is a product-owner/QA acceptance task requiring human participants; coding agents may prepare T134 but must not fabricate T135 evidence.
- Avoid storing passwords, raw tokens, token hashes, or full sensitive payloads in logs or security activity records.
