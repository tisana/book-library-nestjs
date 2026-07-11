# Implementation Plan: Authentication, Roles, and Permissions

**Branch**: `003-auth-roles-permissions` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-auth-roles-permissions/spec.md`

## Summary

Replace the publish-risky in-memory/session-light authentication surface with a solid NestJS-owned authentication and authorization system for the current single-library application. The default implementation keeps credentials, account lifecycle, short-lived JWT access tokens, rotated refresh sessions, role assignment, permission mapping, and security activity inside the existing NestJS/MongoDB application.

The user-facing sign-in experience is a single shared entry point for staff, administrators, and members. Authentication resolves the account context from an atomically reserved normalized identifier, rejects legacy ambiguity with a generic failure, and routes authenticated users from returned role area and permissions rather than from a user-selected login type.

The design intentionally keeps the token and role model OIDC-friendly: access tokens use issuer, subject, audience, expiry, token id, role area, and scope/permission-style claims; protected resources validate tokens through a narrow auth boundary; application authorization uses clear permission guards and member ownership checks. Keycloak remains an evaluated future option for SSO, MFA, password reset, federation, or multi-application identity, but it is not the default implementation for this feature.

## Technical Context

**Language/Version**: TypeScript 5.9.x; NestJS 11.x backend; React/Vite/TypeScript frontend from the existing `frontend/` app.

**Primary Dependencies**: Existing `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcryptjs`, `@nestjs/config`, `@nestjs/mongoose`, Mongoose, class-validator, Jest, Supertest, Vitest, Testing Library, Playwright, and MSW. Add `@nestjs/throttler` for login/refresh throttling and `@nestjs/schedule` for bounded identifier-operation reconciliation. Add or evaluate `jose` for more standards-friendly JWT/JWK/JWKS handling if current `@nestjs/jwt` support is insufficient. Keycloak is not a runtime dependency in the default path.

**Storage**: Existing MongoDB remains the source of truth. Staff credentials remain in `StaffUser`; member credentials remain embedded in `Member`; `AuthIdentifier` enforces normalized ownership and `AuthIdentifierOperation` coordinates idempotent multi-reservation mutations, recovery leases, and redacted results. Bounded authentication documents also store OAuth/OIDC-friendly clients, optional authorization codes, refresh-token families, and security activity events.

**Document Model Design**: Keep credentials and lifecycle data on their owning account aggregates. `AuthIdentifier` holds unique normalized ownership and references one account context; `AuthIdentifierOperation` holds the globally unique operation id, bounded assignments, status, redacted result, and reconciliation lease for changes spanning several reservations/aggregates. Transaction-capable deployments apply all steps atomically. Other deployments use a durable idempotent saga: reservations remain `pending` and unusable until every assignment completes or safe compensation/recovery occurs. Reconciliation runs at startup and through `@nestjs/schedule`, acquires operations atomically by expired lease, and processes bounded batches. Identifier audit correlation uses versioned HMAC-SHA-256 with a dedicated secret. The registry stores no credentials, roles, profile data, or tokens. Add separate documents for `AuthClient`, `AuthorizationCode`, `RefreshTokenFamily`, `SecurityActivityEvent`, and optionally `RoleDefinition`.

**Testing**: Backend Jest tests cover identifier ownership, operation coordination, transaction and saga paths, idempotent retry, lease acquisition/renewal/expiry, multi-instance reconciliation, deterministic conflict resolution, HMAC correlation/redaction, shared sign-in, token/session behavior, permission mapping, member ownership, startup validation, and audit events. E2e tests cover public health, restart persistence, exhaustive route permissions, history preservation, role propagation, identifier recovery and operation status, conflict resolution, and security activity. Frontend tests cover accessible shared sign-in, routing, guards, sign-out, role management, and conflict UI. Performance handlers live only in a test module bootstrapped by the benchmark script, with an assertion that production `AppModule` cannot expose them. Human usability evidence remains separate.

**Target Platform**: Browser-based web application and NestJS REST API deployed online behind HTTPS.

**Project Type**: Full-stack web application in one repository: NestJS API under `src/`, React/Vite frontend under `frontend/`.

**Performance Goals**: In a Node production build against a dedicated seeded MongoDB, disable access logging, send 100 warm-up requests, then measure 500 requests at concurrency 10 using nearest-rank p95. Complete authentication-and-authorization boundary overhead is the protected-handler duration minus an equivalent unprotected baseline-handler duration and must not exceed 50 ms p95. Record Node/MongoDB versions, CPU description, sample count, p50, p95, and maximum. At least 19 of 20 first-time participants (8 members, 8 staff, 4 administrators) complete valid shared sign-in and reach the authorized landing area within 30 seconds. Role changes affect the next protected request and always within 1 minute. The first 50 of 10,000 security events return within 2 seconds. Runtime readiness fails within 5 seconds after dependency loss.

**Constraints**: Server-side authorization is authoritative. `/health` and `/health/ready` are explicitly public and redacted; all unmarked routes deny by default. Invalid production auth configuration, including missing/unsafe `AUTH_AUDIT_CORRELATION_SECRET` or `AUTH_AUDIT_CORRELATION_KEY_VERSION`, aborts startup; optional `AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS` preserves versioned correlation during rotation. Cross-context uniqueness uses `AuthIdentifier`; one globally unique `AuthIdentifierOperation.operationId` coordinates multi-document changes. `AUTH_IDENTIFIER_LEASE_SECONDS` defaults to 300 (30-3600), reconciliation interval defaults to 60 seconds, batch size defaults to 100, and lease comparisons use MongoDB time where practical with 5-second skew tolerance. Benchmark handlers must not be imported by production `AppModule` or emitted as production routes. Access tokens are short-lived and audience/scope restricted; refresh tokens rotate and are hash-only; browser tokens avoid localStorage; passwords use an accepted slow hash; login/token endpoints are rate-limited. OAuth browser flow, if added, uses authorization code with PKCE only.

**Scale/Scope**: Single-library deployment, first-party web client, staff/admin/member roles, shared sign-in entry point, unique identifier reservations, explicit permission names for existing catalog/member/borrowing/security workflows, up to 10,000 security events in the verification dataset, and bounded audit history. Keycloak, Auth.js, external IdP federation, MFA, password reset, social login, multi-tenant authorization, and fine-grained custom role builders are deferred unless later specs add them.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **User-Centered Library Workflow**: PASS. The plan separates member, staff, and administrator outcomes while giving all users one predictable sign-in entry point and keeping permission names aligned with library workflows.
- **Correctness Over Cleverness**: PASS. Authorization is explicit, testable, and enforced by guards/services rather than UI-only checks.
- **Security and Privacy by Default**: PASS. Authentication is required for protected areas, member access is scoped to the member's own records, secrets are hashed/redacted, ambiguous identifiers fail closed, and tokens are restricted.
- **Spec-First, Traceable Changes**: PASS. Artifacts map to `specs/003-auth-roles-permissions/spec.md`, including the 2026-07-09 shared sign-in clarification.
- **Test the Rules That Matter**: PASS. Authorization, shared sign-in routing, token lifecycle, refresh replay, member ownership, and audit redaction receive automated tests.
- **Maintainable Architecture**: PASS. The design extends existing NestJS modules and MongoDB aggregates without introducing a separate IdP service for the current scope.
- **Data Integrity and Auditability**: PASS. Role changes, denied access, sign-in outcomes, token revocation, ambiguous identifier failures, and account status changes are auditable.
- **Document-Oriented MongoDB Data Modeling**: PASS. Account credentials are embedded in owned account documents; growing session/event records are referenced and indexed separately with TTL.
- **Usability and Accessibility**: PASS. A shared sign-in entry point reduces role-choice friction; user-facing denial states and sign-in outcomes remain clear; admin permission review is explicit.
- **Performance With Practical Limits**: PASS. Indexed account identifier, subject/client/token, and audit lookups avoid full scans and keep auth checks bounded.
- **Operability and Observability**: PASS. Configuration is environment-based, auth health is verifiable, and logs exclude sensitive values.

## Project Structure

### Documentation (this feature)

```text
specs/003-auth-roles-permissions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── auth-api.md
│   └── authorization-matrix.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── auth/
│   ├── dto/
│   ├── schemas/
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth-identifier.service.ts
│   ├── auth-identifier-reconciliation.service.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   ├── permission.decorator.ts
│   ├── permissions.guard.ts
│   ├── member-auth.guard.ts
│   ├── password-hasher.service.ts
│   ├── token-session.service.ts
│   └── security-activity.service.ts
├── staff-users/
├── members/
├── common/
│   ├── audit/
│   └── enums/
└── config/

test/
├── auth.e2e-spec.ts
├── auth-persistence.e2e-spec.ts
├── auth-history-preservation.e2e-spec.ts
├── auth-identifier-recovery.e2e-spec.ts
├── authorization-matrix.e2e-spec.ts
├── health.e2e-spec.ts
├── performance/
│   ├── auth-benchmark.module.ts
│   └── auth-benchmark.controller.ts
├── authorization.e2e-spec.ts
├── member-auth.e2e-spec.ts
└── utils/

frontend/
├── src/
│   ├── features/auth/
│   ├── lib/api/
│   ├── lib/auth/
│   ├── routes/member/
│   └── routes/staff/
└── tests/e2e/

migrations/
└── versions/

scripts/
└── verify-auth-performance.ts

specs/003-auth-roles-permissions/evidence/
├── auth-performance.md
└── shared-sign-in-usability.md
```

**Structure Decision**: Keep the existing NestJS API and React/Vite frontend structure. Add auth-owned schemas and services for unique identifier reservations, refresh-token/session records, optional auth clients/authorization codes, permissions, and security activity. Extend the existing health module with separate liveness and readiness endpoints. Replace role-only decorators/guards with permission-level authorization while preserving current role-specific API endpoints only as compatibility wrappers. The frontend converges on one accessible shared sign-in page and routes users by returned role area and permissions.

## Complexity Tracking

No constitution violations require exceptions.

## Phase 0: Research

Completed in [research.md](research.md). Key decisions: build NestJS-owned auth as the default for current scope, keep Keycloak as an evaluated future option, reject Auth.js as the primary auth system for this NestJS/Vite architecture, use one shared sign-in entry point backed by existing staff/member aggregates and an atomic credential-free identifier registry, reject legacy ambiguous identifiers, use short-lived audience/scope-restricted JWT access tokens, rotate refresh tokens with hashed persistence, keep tokens out of localStorage, combine RBAC role assignments with permission checks and member ownership checks, use NIST/OWASP password guidance, and log security activity without secrets.

## Phase 1: Design & Contracts

Completed design artifacts:

- [data-model.md](data-model.md)
- [contracts/auth-api.md](contracts/auth-api.md)
- [contracts/authorization-matrix.md](contracts/authorization-matrix.md)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- **User-Centered Library Workflow**: PASS. Contracts define one sign-in entry point, member self-service, staff back office, administrator role/account management, and denial outcomes.
- **Correctness Over Cleverness**: PASS. Permission checks, shared sign-in resolution, and ownership checks are explicit and covered by contract tests.
- **Security and Privacy by Default**: PASS. Token, password, refresh, storage, ambiguous identifier rejection, and logging choices follow current security guidance and prevent member access to staff/admin workflows.
- **Spec-First, Traceable Changes**: PASS. Design artifacts trace to the feature spec and are ready for task generation.
- **Test the Rules That Matter**: PASS. Quickstart requires unit, integration, and e2e coverage for the security-sensitive behavior.
- **Maintainable Architecture**: PASS. The plan extends local auth/staff/member modules and avoids an IdP service until scope justifies it.
- **Data Integrity and Auditability**: PASS. Account status, role changes, token revocation, replay detection, denied access, and ambiguous sign-in resolution are auditable.
- **Document-Oriented MongoDB Data Modeling**: PASS. Data model documents aggregate ownership, references, TTL indexes, uniqueness, future IdP links, and migration impact.
- **Usability and Accessibility**: PASS. Frontend contracts preserve shared sign-in, sign-out, unauthorized, and forbidden user flows.
- **Performance With Practical Limits**: PASS. Indexes and short token validation paths keep authorization checks bounded.
- **Operability and Observability**: PASS. Quickstart includes config, local validation, and sensitive-log checks.
