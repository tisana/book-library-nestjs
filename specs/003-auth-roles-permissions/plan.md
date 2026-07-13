# Implementation Plan: Authentication, Roles, and Permissions

**Branch**: `003-auth-roles-permissions` | **Date**: 2026-07-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-auth-roles-permissions/spec.md`

## Summary

Replace the publish-risky in-memory/session-light authentication surface with a solid NestJS-owned authentication and authorization system for the current single-library application. The default implementation keeps credentials, account lifecycle, short-lived JWT access tokens, rotated refresh sessions, role assignment, permission mapping, and security activity inside the existing NestJS/MongoDB application.

The browser-session boundary is now explicit: access tokens expire within 15 minutes and remain in memory, refresh families have a non-sliding maximum 30-day lifetime, every exchanged refresh token remains detectable through a hash-only replay marker until family expiry, and all endpoints that issue, use, or clear the refresh cookie reject non-exact browser origins before cookie parsing or session mutation. Production refresh cookies are host-only, HTTP-only, Secure, `SameSite=Strict`, limited to `/auth`, and use the remaining absolute family lifetime.

The user-facing sign-in experience is a single shared entry point for staff, administrators, and members. Authentication resolves the account context from a uniquely reserved normalized identifier, rejects legacy ambiguity with a generic failure, and routes authenticated users from returned role area and permissions rather than from a user-selected login type.

The design intentionally keeps the token and role model OIDC-friendly: access tokens use issuer, subject, audience, expiry, token id, role area, and scope/permission-style claims; protected resources validate tokens through a narrow auth boundary; application authorization uses clear permission guards and member ownership checks. Keycloak remains an evaluated future option for SSO, MFA, password reset, federation, or multi-application identity, but it is not the default implementation for this feature.

## Technical Context

**Language/Version**: TypeScript 5.9.x; NestJS 11.x backend; React/Vite/TypeScript frontend from the existing `frontend/` app.

**Primary Dependencies**: Existing `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcryptjs`, `@nestjs/config`, `@nestjs/mongoose`, Mongoose, class-validator, Jest, Supertest, Vitest, Testing Library, Playwright, and MSW. Add direct `proxy-addr`/type dependencies for validated CIDR-based trusted proxy resolution and `@nestjs/schedule` for bounded identifier-operation reconciliation. Authentication throttling is enforced directly through `AuthThrottleService`; `@nestjs/throttler` is not used because generic request guards cannot safely own failure-only identifier counters and would create a second counting path. Add or evaluate `jose` for more standards-friendly JWT/JWK/JWKS handling if current `@nestjs/jwt` support is insufficient. Keycloak is not a runtime dependency in the default path.

**Storage**: Existing MongoDB remains the source of truth. Staff credentials remain in `StaffUser`; member credentials remain embedded in `Member`; `AuthIdentifier` enforces normalized ownership, `AuthIdentifierOperation` coordinates idempotent multi-reservation mutations and parent offline repairs, and `AuthIdentifierRepairBatch` stores bounded resumable repair checkpoints. Bounded authentication documents also store OAuth/OIDC-friendly clients, optional authorization codes, refresh-token families, hash-only refresh replay markers retained until family expiry, short-lived privacy-preserving throttle buckets, and security activity events.

**Document Model Design**: Keep credentials and lifecycle data on their owning account aggregates. `AuthIdentifier` holds unique normalized ownership and references one account context; `AuthIdentifierOperation` holds the globally unique operation id, bounded reservation-referencing assignments, explicit recoverable/finalizing/terminal states, redacted result, deterministic terminal-event reference, and reconciliation lease for changes spanning several reservations/aggregates. Transaction-capable deployments apply all steps atomically. Other deployments use a durable idempotent saga: actual normalized identifiers live only in pending reservation documents, assignments reference those reservation ids, and ambiguity remains blocked until completion or safe compensation/recovery. An operation remains non-terminal until its permanent redacted terminal security event is durably recorded; terminal TTL eligibility additionally waits for required cleanup. Reconciliation runs only after required migrations, at startup and through `@nestjs/schedule`, acquires work atomically by expired lease, and processes bounded batches. `AuthIdentifierRepairKeyPolicyService` uses indexed repair operations and unexpired throttle buckets to determine every required audit-correlation key version, evaluate readiness, and preflight rotation. `AuthIdentifierRepairAuthorizationService` revalidates the token supplied by the CLI and current account authorization at each repair boundary. `AuthIdentifierRepairService` consumes both services and owns oversized repair manifest validation, parent transitions, bounded `AuthIdentifierRepairBatch` preparation, compensation, activation gating, completion, and cleanup; the CLI only parses input, requests confirmation, and delegates. Replacement reservations may be activated in bounded writes but cannot authenticate until one bounded parent-completion transaction unlocks the repair; gate cleanup then runs in bounded background batches before parent TTL eligibility. Identifier, repair-manifest, source, and refresh-family correlation derive purpose-separated keys from the versioned audit-correlation key set. A correlation key version cannot be retired while a non-terminal/cleanup-pending repair or unexpired throttle bucket references it; readiness reports `repair-key-required` or `throttle-key-required` when the corresponding referenced version is unavailable. `AuthThrottleBucket` stores only key version, purpose-separated HMAC bucket key, dimension, counter, and bounded expiry. For each request, `AuthThrottleService` derives candidate keys under the current and configured previous versions, continues any unexpired existing bucket, and creates a current-version bucket only when none exists. Atomic updates and unique indexes make limits consistent across compatibility routes, key rotation, and application instances without retaining raw identifiers, source addresses, or session tokens. The identifier registry and throttle buckets store no credentials, roles, profile data, or tokens.

**Browser Session Design**: `AuthBrowserOriginGuard` is the mandatory pre-session boundary for shared/compatibility sign-in, refresh, current-session sign-out, and all-session sign-out. `AUTH_TRUSTED_BROWSER_ORIGINS` is a JSON array and the single source for both exact credentialed CORS responses and guard decisions. Configuration canonicalizes origins with the platform URL parser and rejects missing production configuration, non-HTTP(S) values, production HTTP, credentials, paths, queries, fragments, `null`, wildcards, regexes, duplicate canonical values, and multiple/malformed `Origin` headers. The guard checks one exact origin before downstream code parses cookies, increments refresh-family counters, sets/clears cookies, or reads/mutates refresh records. A denial appends one redacted security event containing route and safe reason categories only, never the supplied origin/header or cookie. `TokenSessionService` stores a unique hash-only `RefreshTokenReplayMarker` before atomically compare-and-swapping the family current hash; any retained marker match revokes the family. Marker insertion failure leaves the family unchanged, and concurrent reuse fails closed. Family `expiresAt` never changes after sign-in, while cookie `Max-Age` is recalculated from its remaining lifetime.

**Testing**: Backend Jest tests cover identifier ownership, operation coordination, transaction and saga paths, indexed repair/throttle key-policy queries, missing-key readiness, two-key rotation-capacity preflight, repair-manifest test vectors, repair-service parent/batch transitions, per-batch authorization revalidation, idempotent retry, lease acquisition/renewal/expiry, multi-instance reconciliation, deterministic conflict resolution, HMAC correlation/redaction, shared sign-in, token/session behavior, permission mapping, member ownership, startup/readiness validation, audit events, and atomic throttle bucket boundaries. Migration tests assert required-version queries use intended indexes without collection scans and create throttle bucket key-version/unique/TTL indexes. Process-level CLI tests cover audit-key rotation preflight with repair and active-throttle references, fixed non-sensitive output/exit codes/no-mutation behavior, and repair CLI token handling, confirmation, delegation, exit codes, and redaction without duplicating service business-rule tests. Foundational e2e tests cover all generic sign-in failure categories, source-only malformed requests, shared compatibility-route counters, audit-key rotation continuity, multiple application instances, direct/trusted/untrusted proxy chains, startup rejection for malformed/unsafe CIDRs, and automatic window recovery. Other e2e tests cover public health, restart persistence, exhaustive route permissions, history preservation, role propagation, identifier recovery and operation status, conflict resolution, safe failed-sign-in references, and security activity. Frontend tests cover accessible shared sign-in, routing, guards, sign-out, role management, and conflict UI. Performance handlers live only in a test module bootstrapped by the benchmark script, with an assertion that production `AppModule` cannot expose them. Human usability evidence remains separate.

**Security Contract Testing**: Configuration tests cover access lifetime `1..900` seconds, refresh lifetime longer than access and no more than 30 days, exact trusted-origin JSON parsing/canonicalization, local-development defaults, required production HTTPS origins, and rejection of missing/empty production lists, wildcard, `null`, credentials, paths, query/fragment values, duplicates, and non-HTTPS production origins. Guard and e2e tests prove shared/compatibility sign-in, refresh, logout, and logout-all accept each configured exact origin; reject missing, opaque, multiple, malformed, and untrusted origins with one generic response; perform no cookie parsing, throttle mutation, session lookup/mutation, or `Set-Cookie` on rejection; and append exactly one redacted denial event containing no raw origin/header or cookie. Session tests cover 15-minute access expiry, absolute non-sliding 30-day family expiry, cookie attribute parity on set/clear, remaining-lifetime `Max-Age`, replay after multiple rotations, marker-before-CAS failure/retry, concurrent rotation, family revocation, current/all-session sign-out, memory-only frontend storage, and frontend cache clearing.

**Target Platform**: Browser-based web application and NestJS REST API deployed online behind HTTPS.

**Project Type**: Full-stack web application in one repository: NestJS API under `src/`, React/Vite frontend under `frontend/`.

**Performance Goals**: In a Node production build against a dedicated seeded MongoDB, disable access logging, send 100 warm-up requests, then measure 500 requests at concurrency 10 using nearest-rank p95. Complete authentication-and-authorization boundary overhead is the protected-handler duration minus an equivalent unprotected baseline-handler duration and must not exceed 50 ms p95. Record Node/MongoDB versions, CPU description, sample count, p50, p95, and maximum. At least 19 of 20 first-time participants (8 members, 8 staff, 4 administrators) complete valid shared sign-in and reach the authorized landing area within 30 seconds. Role changes affect the next protected request and always within 1 minute. The first 50 of 10,000 security events return within 2 seconds. Runtime readiness fails within 5 seconds after dependency loss.

**Constraints**: Server-side authorization is authoritative. `/health` and `/health/ready` are explicitly public and redacted; all unmarked routes deny by default. Invalid production auth configuration, including missing/unsafe `AUTH_AUDIT_CORRELATION_SECRET` or `AUTH_AUDIT_CORRELATION_KEY_VERSION`, aborts startup. `AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS` is a JSON object with unique positive integer version keys, base64url secrets of at least 32 bytes, at most two previous keys, and no current-version entry. A previous version remains configured until every repair referencing it is terminal with cleanup complete and every throttle bucket referencing it has expired. Removing a repair- or throttle-referenced version fails readiness as `repair-key-required` or `throttle-key-required`; repair workers and affected authentication requests fail closed without changing data. Before promoting the current key, `npm run auth:key-rotation:preflight` reads only candidate current/previous version metadata from stdin, asks `AuthIdentifierRepairKeyPolicyService` to union it with versions required by non-terminal/cleanup-pending repairs and unexpired throttle buckets, and exits nonzero with `repair-key-rotation-blocked` when more than two previous versions would be required. The command rejects secret-bearing/unknown input, returns only required version numbers/count plus fixed status, reason, and configured-capacity fields, performs no writes, and is a local deployment-operator control rather than a public HTTP endpoint. Cross-context uniqueness uses `AuthIdentifier`; one globally unique `AuthIdentifierOperation.operationId` coordinates each bounded online change or one parent offline repair. Lease defaults to 300 seconds (30-3600), reconciliation interval to 60 seconds, batch size to 100, terminal retention to 90 days (7-365), and max assignments per online operation or repair-batch document to 20 (2-100). Offline repair requires a short-lived administrator access token through standard input; every dry-run invocation and every mutating batch revalidates token expiry plus active account, `authVersion`, administrator role area, and `auth-identifiers:manage`. A stopped or expired invocation resumes with a newly validated token, preserves `requestedBy`, records `lastResumedBy`, and emits a redacted resume event. Required migrations must complete before an application version enables reconciliation; missing collections/indexes fail readiness as `migration-required` and are never created implicitly at runtime. Benchmark handlers must not enter production `AppModule` or routes. Access tokens are short-lived; refresh tokens rotate; browser tokens avoid localStorage; passwords use an accepted slow hash. Shared and compatibility sign-in routes call `AuthThrottleService` directly and use common persistent counters with defaults of five generic failures per normalizable identifier correlation and twenty attempts per trusted source in 900 seconds; all generic credential/status/ambiguity outcomes count, while malformed requests without a normalizable identifier count only by source. Refresh uses thirty attempts per family and trusted source in 300 seconds. Counter keys are purpose-separated HMAC values with `keyVersion`; lookup spans current and configured previous audit-correlation keys to preserve active windows across rotation. `AUTH_TRUSTED_PROXY_CIDRS` is a JSON array defaulting to `[]`; production validation rejects malformed CIDRs and `0.0.0.0/0` or `::/0`. Empty trust uses the direct peer and ignores forwarding headers; configured trust uses `proxy-addr` right-to-left resolution to the first untrusted address. Excess requests receive one generic retry-later response, and expired windows recover without administrator action. OAuth browser flow, if added, uses authorization code with PKCE only.

**Session Constraints**: `ACCESS_TOKEN_TTL_SECONDS` defaults to and cannot exceed 900. `REFRESH_TOKEN_TTL_SECONDS` defaults to and cannot exceed 2,592,000, must exceed the access lifetime, and establishes an immutable family expiry. `AUTH_TRUSTED_BROWSER_ORIGINS` defaults outside production to `["http://localhost:5173","http://127.0.0.1:5173"]`; production has no default and requires a non-empty JSON array of exact HTTPS origins. Credential-bearing CORS never uses wildcard or suffix matching. Refresh cookies omit `Domain`, use path `/auth`, `HttpOnly`, production `Secure`, and `SameSite=Strict`; set and clear operations use identical scope/security attributes. No origin rejection path may read a refresh cookie or write authentication or throttle state; its only persistence is one redacted security-denial event with no supplied origin/header or cookie. Refresh denials remain generic across malformed, expired, replayed, revoked, inactive-account, and stale-authorization outcomes.

**Scale/Scope**: Single-library deployment, first-party web client, staff/admin/member roles, shared sign-in entry point, unique identifier reservations, explicit permission names for existing catalog/member/borrowing/security workflows, up to 10,000 security events in the verification dataset, and bounded audit history. Keycloak, Auth.js, external IdP federation, MFA, password reset, social login, multi-tenant authorization, and fine-grained custom role builders are deferred unless later specs add them.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **User-Centered Library Workflow**: PASS. The plan separates member, staff, and administrator outcomes while giving all users one predictable sign-in entry point and keeping permission names aligned with library workflows.
- **Correctness Over Cleverness**: PASS. Authorization is explicit, testable, and enforced by guards/services rather than UI-only checks.
- **Security and Privacy by Default**: PASS. Authentication is required for protected areas, member access is scoped to the member's own records, secrets are hashed/redacted, ambiguous identifiers fail closed, failed sign-in events never expose submitted identifiers, throttle keys are non-reversible, access/refresh lifetimes are bounded, all exchanged refresh credentials remain replay-detectable, browser credentials avoid persistent script-readable storage, and exact-origin checks run before session access.
- **Spec-First, Traceable Changes**: PASS. Artifacts map to `specs/003-auth-roles-permissions/spec.md`, including the 2026-07-09 shared sign-in and 2026-07-13 audit, throttling, rotation-preflight, and browser-session security clarifications.
- **Test the Rules That Matter**: PASS. Authorization, shared sign-in routing, token lifetime, multi-generation refresh replay, trusted-origin rejection before mutation, cookie attributes, sign-out, member ownership, and audit redaction receive automated tests.
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
│   │   └── refresh-token-replay-marker.schema.ts
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth-identifier.service.ts
│   ├── auth-identifier-repair-manifest.ts
│   ├── auth-identifier-repair-key-policy.service.ts
│   ├── auth-identifier-repair-authorization.service.ts
│   ├── auth-identifier-repair.service.ts
│   ├── auth-identifier-reconciliation.service.ts
│   ├── auth-throttle.service.ts
│   ├── auth-source-identity.service.ts
│   ├── auth-browser-origin.guard.ts
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
├── verify-auth-performance.ts
├── preflight-auth-audit-key-rotation.ts
└── resolve-auth-identifier-conflict.ts

specs/003-auth-roles-permissions/evidence/
├── auth-performance.md
└── shared-sign-in-usability.md
```

**Structure Decision**: Keep the existing NestJS API and React/Vite frontend structure. Add auth-owned schemas and services for unique identifier reservations, refresh-token/session records plus exchanged-token replay markers, privacy-preserving throttle buckets, direct throttle enforcement, exact browser-origin enforcement, CIDR-based source identity, optional auth clients/authorization codes, permissions, and security activity. Extend the existing health module with separate liveness and readiness endpoints. Replace role-only decorators/guards with permission-level authorization while preserving current role-specific API endpoints only as compatibility wrappers. The frontend converges on one accessible shared sign-in page, keeps access credentials in memory, clears all authentication/server-state caches on sign-out, and routes users by returned role area and permissions.

## Complexity Tracking

No constitution violations require exceptions.

## Phase 0: Research

Completed in [research.md](research.md). Key decisions: build NestJS-owned auth as the default for current scope, keep Keycloak as an evaluated future option, reject Auth.js as the primary auth system for this NestJS/Vite architecture, use one shared sign-in entry point backed by existing staff/member aggregates and a credential-free identifier reservation registry with index-enforced unique claims and transaction-or-saga coordination for multi-document changes, reject legacy ambiguous identifiers, use access credentials capped at 15 minutes and non-sliding refresh families capped at 30 days, rotate refresh tokens with hash-only persistence and full-family replay markers, keep tokens out of localStorage, enforce exact browser origins independently from credentialed CORS before session access, use host-only `SameSite=Strict` refresh cookies, combine RBAC role assignments with permission checks and member ownership checks, use NIST/OWASP password guidance, enforce shared privacy-preserving throttle buckets directly through `AuthThrottleService`, preserve active buckets across correlation-key rotation, resolve trusted proxies from a validated CIDR allowlist, keep failed-sign-in references opaque, and restrict rotation preflight to fixed non-sensitive metadata.

## Phase 1: Design & Contracts

Completed design artifacts:

- [data-model.md](data-model.md)
- [contracts/auth-api.md](contracts/auth-api.md)
- [contracts/authorization-matrix.md](contracts/authorization-matrix.md)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- **User-Centered Library Workflow**: PASS. Contracts define one sign-in entry point, member self-service, staff back office, administrator role/account management, and denial outcomes.
- **Correctness Over Cleverness**: PASS. Permission checks, shared sign-in resolution, and ownership checks are explicit and covered by contract tests.
- **Security and Privacy by Default**: PASS. Token, password, refresh, replay-marker, throttle storage, strict host-only cookies, exact pre-session origin enforcement, bounded lifetimes, ambiguous identifier rejection, opaque failed-sign-in references, and logging choices follow current security guidance and prevent member access to staff/admin workflows.
- **Spec-First, Traceable Changes**: PASS. Design artifacts trace to the feature spec and are ready for task generation.
- **Test the Rules That Matter**: PASS. Quickstart requires unit, integration, and e2e coverage for lifetime ceilings, multi-generation replay, cookie scope, trusted-origin rejection before session access, sign-out, and the existing authorization-sensitive behavior.
- **Maintainable Architecture**: PASS. The plan extends local auth/staff/member modules and avoids an IdP service until scope justifies it.
- **Data Integrity and Auditability**: PASS. Account status, role changes, token revocation, replay detection, denied access, and ambiguous sign-in resolution are auditable without exposing submitted identifiers.
- **Document-Oriented MongoDB Data Modeling**: PASS. Data model documents aggregate ownership, bounded family records, independently expiring replay markers, references, throttle/retention TTL indexes, uniqueness, future IdP links, and migration impact.
- **Usability and Accessibility**: PASS. Frontend contracts preserve shared sign-in, sign-out, unauthorized, and forbidden user flows.
- **Performance With Practical Limits**: PASS. Indexes and short token validation paths keep authorization checks bounded.
- **Operability and Observability**: PASS. Quickstart includes config, local validation, and sensitive-log checks.
