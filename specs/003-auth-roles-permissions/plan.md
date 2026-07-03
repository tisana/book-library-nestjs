# Implementation Plan: Authentication, Roles, and Permissions

**Branch**: `003-auth-roles-permissions` | **Date**: 2026-07-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-auth-roles-permissions/spec.md`

## Summary

Replace the publish-risky in-memory/session-light authentication surface with a persistent, standards-aligned authentication and authorization system. Additional research compared building an authorization server inside this app with using open-source IdP/framework options. The revised plan prefers Keycloak as the production identity provider and OAuth2/OIDC authorization server, while keeping the existing NestJS API as the resource server that validates tokens, maps IdP roles/groups to library permissions, and enforces member ownership.

Auth.js is not selected as the primary auth system for this architecture because it is an application authentication/session framework and OAuth client toolkit rather than a central IdP for a NestJS API plus Vite SPA. A custom in-app OAuth2/OIDC implementation remains a fallback only if operating Keycloak is rejected during implementation planning.

## Technical Context

**Language/Version**: TypeScript 5.9.x; NestJS 11.x backend; React/Vite/TypeScript frontend from the existing `frontend/` app.

**Primary Dependencies**: Keycloak 26.x as the external IdP/auth server; existing `@nestjs/passport`, `passport-jwt`, `@nestjs/config`, `@nestjs/mongoose`, Mongoose, class-validator, Jest, Supertest, Vitest, Testing Library, Playwright, and MSW. Add or evaluate `jose` for JWKS/JWT validation if `passport-jwt` is insufficient for issuer/audience/key-rotation handling. Existing `@nestjs/jwt` and `bcryptjs` remain only for migration compatibility or local test helpers, not as the long-term production credential/token authority.

**Storage**: Keycloak owns credentials, login sessions, OAuth/OIDC clients, authorization codes, refresh tokens, federation settings, and protocol metadata in its own supported production database. Existing MongoDB remains the source of truth for library domain data, staff/member profile links, local permission mapping, and library security activity summaries.

**Document Model Design**: Add stable IdP linkage to existing `StaffUser` and `Member` documents, such as `identityProvider`, `identitySubject`, and `identityLinkedAt`. Do not store new production passwords or refresh tokens in MongoDB. Keep library permissions as code-owned or Mongo-backed role mapping inside the API, because catalog/member/borrowing/member-ownership policies are application-specific. Security activity events remain separate MongoDB documents for audit pagination and correlation with library entities.

**Testing**: Backend Jest unit tests for JWKS/JWT validation, issuer/audience enforcement, IdP role/group mapping, permission mapping, member ownership, and audit event redaction. Backend e2e tests with Supertest for protected resource denial, member ownership, admin-only role/account management, and security activity access using representative Keycloak-issued JWT fixtures. Frontend Vitest/MSW tests for OIDC redirect/session states. Playwright e2e tests against a local Keycloak test realm for staff/admin/member sign-in boundaries and sign-out behavior.

**Target Platform**: Browser-based web application and NestJS REST API deployed online behind HTTPS.

**Project Type**: Full-stack web application in one repository: NestJS API under `src/`, React/Vite frontend under `frontend/`.

**Performance Goals**: Protected API authorization checks add no more than 50 ms p95 overhead under normal library usage. Users complete sign-in in under 30 seconds. Role/permission changes affect protected requests within 1 minute. Security activity list returns the first page within 2 seconds for normal audit volume.

**Constraints**: Browser sign-in must use Keycloak/OpenID Connect authorization code with PKCE. Direct access grants/password grants and implicit flow are out of scope. Access tokens must be short-lived and audience/scope restricted. Browser storage must avoid localStorage for tokens. Server-side authorization in NestJS remains authoritative for library resources; frontend route guards are convenience only. No passwords, tokens, token hashes, full protected payloads, or sensitive request bodies may be logged. Production deployment now includes operating and backing up Keycloak and its database.

**Scale/Scope**: Single-library deployment, Keycloak realm for the library, first-party web client, staff/admin/member roles or groups, explicit permission names for existing catalog/member/borrowing/security workflows, and bounded security audit history. Keycloak can later enable MFA, password reset, social login, LDAP/AD federation, and account self-service without rewriting library resource authorization. Multi-tenant authorization and fine-grained custom role builders are deferred unless later specs add them.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **User-Centered Library Workflow**: PASS. The plan separates member, staff, and administrator outcomes and keeps permission names aligned with library workflows.
- **Correctness Over Cleverness**: PASS. Authorization is explicit, testable, and enforced by guards/services rather than UI-only checks.
- **Security and Privacy by Default**: PASS. Authentication is required for protected areas, member access is scoped to the member's own records, secrets are hashed/redacted, and tokens are restricted.
- **Spec-First, Traceable Changes**: PASS. Artifacts map to `specs/003-auth-roles-permissions/spec.md`.
- **Test the Rules That Matter**: PASS. Authorization, token lifecycle, refresh replay, member ownership, and audit redaction receive automated tests.
- **Maintainable Architecture**: PASS. The design delegates standards-heavy identity protocol behavior to Keycloak and keeps application-specific authorization in NestJS.
- **Data Integrity and Auditability**: PASS. Role changes, denied access, sign-in outcomes, token revocation, and account status changes are auditable.
- **Document-Oriented MongoDB Data Modeling**: PASS. MongoDB stores library domain profiles, IdP links, permission mapping, and audit summaries; Keycloak-owned protocol/session state is not duplicated into MongoDB.
- **Usability and Accessibility**: PASS. User-facing denial states and sign-in outcomes remain clear; admin permission review is explicit.
- **Performance With Practical Limits**: PASS. Indexed subject/client/token/audit lookups avoid full scans and keep auth checks bounded.
- **Operability and Observability**: PASS. Configuration is environment-based, health of auth configuration is verifiable, and logs exclude sensitive values.

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
│   ├── keycloak-jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   ├── permission.decorator.ts
│   ├── permissions.guard.ts
│   ├── member-auth.guard.ts
│   ├── password-hasher.service.ts
│   ├── identity-link.service.ts
│   └── security-activity.service.ts
├── staff-users/
├── members/
├── common/
│   ├── audit/
│   └── enums/
└── config/

test/
├── auth.e2e-spec.ts
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

infra/
└── keycloak/
    ├── realm-export.json
    └── docker-compose.override.example.yml
```

**Structure Decision**: Keep the existing NestJS API and React/Vite frontend structure. Add Keycloak realm/client configuration under `infra/keycloak/`, validate Keycloak-issued JWTs in `src/auth`, and replace role-only decorators/guards with permission-level authorization while preserving current role endpoints where they are still useful.

## Complexity Tracking

No constitution violations require exceptions.

## Phase 0: Research

Completed in [research.md](research.md). Key decisions: prefer Keycloak over custom in-app OAuth2/OIDC for production, reject Auth.js as the primary IdP for this NestJS/Vite architecture, use OpenID Connect authorization code with PKCE for browser sign-in, avoid implicit and password grants, validate short-lived audience/scope-restricted JWT access tokens, keep tokens out of localStorage, combine IdP role/group assignments with NestJS permission checks and member ownership checks, use NIST/OWASP password guidance, and log security activity without secrets.

## Phase 1: Design & Contracts

Completed design artifacts:

- [data-model.md](data-model.md)
- [contracts/auth-api.md](contracts/auth-api.md)
- [contracts/authorization-matrix.md](contracts/authorization-matrix.md)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- **User-Centered Library Workflow**: PASS. Contracts define member self-service, staff back office, administrator role/account management, and denial outcomes.
- **Correctness Over Cleverness**: PASS. Permission checks and ownership checks are explicit and covered by contract tests.
- **Security and Privacy by Default**: PASS. Keycloak handles standards-heavy credential/session/token lifecycle, while NestJS enforces member/staff/admin resource boundaries.
- **Spec-First, Traceable Changes**: PASS. Design artifacts trace to the feature spec and are ready for task generation.
- **Test the Rules That Matter**: PASS. Quickstart requires unit, integration, and e2e coverage for the security-sensitive behavior.
- **Maintainable Architecture**: PASS. The plan introduces a dedicated IdP intentionally and keeps library authorization local to the API.
- **Data Integrity and Auditability**: PASS. Account status, role changes, token revocation, replay detection, and denied access are auditable.
- **Document-Oriented MongoDB Data Modeling**: PASS. Data model documents IdP links, profile ownership, security events, uniqueness, and migration impact without duplicating Keycloak session state.
- **Usability and Accessibility**: PASS. Frontend contracts preserve clear sign-in, sign-out, unauthorized, and forbidden user flows.
- **Performance With Practical Limits**: PASS. Indexes and short token validation paths keep authorization checks bounded.
- **Operability and Observability**: PASS. Quickstart includes config, local validation, and sensitive-log checks.
