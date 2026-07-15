# Quickstart: Validate Authentication, Roles, and Permissions

## Prerequisites

- Node.js version supported by the existing project.
- MongoDB available through the current project configuration.
- Environment variables configured with production-safe values for deployed runs:
  - `JWT_ISSUER`
  - `JWT_AUDIENCE`
  - `JWT_SECRET` or asymmetric signing keys
  - `ACCESS_TOKEN_TTL_SECONDS` (default and maximum `900`)
  - `REFRESH_TOKEN_TTL_SECONDS` (default and maximum `2592000`; must exceed access-token lifetime and never slides after sign-in)
  - `AUTH_COOKIE_SECRET`
  - `AUTH_AUDIT_CORRELATION_SECRET`
  - `AUTH_AUDIT_CORRELATION_KEY_VERSION`
  - `AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS` (optional JSON object such as `{"1":"base64url-secret"}`; maximum two previous keys)
  - `AUTH_IDENTIFIER_LEASE_SECONDS` (default `300`, range `30`-`3600`)
  - `AUTH_IDENTIFIER_RECONCILIATION_INTERVAL_SECONDS` (default `60`)
  - `AUTH_IDENTIFIER_RECONCILIATION_BATCH_SIZE` (default `100`)
  - `AUTH_IDENTIFIER_OPERATION_RETENTION_DAYS` (default `90`, range `7`-`365`)
  - `AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS` (default `20`, range `2`-`100`)
  - `AUTH_SIGNIN_IDENTIFIER_FAILURE_LIMIT` (default `5`)
  - `AUTH_SIGNIN_SOURCE_LIMIT` (default `20`)
  - `AUTH_SIGNIN_WINDOW_SECONDS` (default `900`)
  - `AUTH_REFRESH_THROTTLE_LIMIT` (default `30` for both family and source)
  - `AUTH_REFRESH_THROTTLE_WINDOW_SECONDS` (default `300`)
  - `AUTH_TRUSTED_PROXY_CIDRS` (default `[]`; JSON array of explicit trusted proxy IPv4/IPv6 CIDRs; forwarding headers remain untrusted when empty)
  - `AUTH_TRUSTED_BROWSER_ORIGINS` (JSON array of exact origins; outside production defaults to `["http://localhost:5173","http://127.0.0.1:5173"]`; production has no default, requires at least one HTTPS origin, and rejects wildcard, `null`, credentials, path/query/fragment values, duplicates, and non-HTTPS entries)

## Setup

```powershell
npm install
npm run frontend:install
npm run migrate:up
npm run seed:demo
```

`npm run migrate:up` must finish before starting an application version that enables identifier reconciliation. Missing required collections or indexes must produce redacted `migration-required` readiness rather than runtime index creation.

## Backend Verification

Run backend unit and e2e tests:

```powershell
npm test
npm run test:e2e
npm run verify:auth-performance
```

Expected coverage:

- Staff/admin sign-in succeeds through the shared sign-in contract for an active account with valid credentials.
- Member sign-in succeeds through the shared sign-in contract for an active member with active auth status and valid credentials.
- Staff/member accounts, roles, and sign-in scope remain available after closing and recreating the Nest application against the same test database.
- Sign-in failure is generic for unknown account, ambiguous identifier, wrong password, inactive account, suspended member, locked member, or missing credentials.
- Failed sign-in security activity includes an opaque account reference only after exact-one account resolution; unknown or ambiguous attempts contain only versioned correlation and never the submitted or normalized identifier.
- Shared and compatibility sign-in routes share counters: the sixth generic unknown/ambiguous/password/status/credential failure with one normalizable identifier and the twenty-first trusted-source attempt in 15 minutes return the same generic retry-later response; malformed requests without a normalizable identifier count only by source. Refresh returns that response on the thirty-first family or trusted-source attempt in 5 minutes, and all windows recover automatically.
- Concurrent application instances enforce the same throttle boundaries through `AuthThrottleService`; audit-key rotation continues unexpired buckets under their stored key version, missing referenced key material fails closed, and throttle state retains no raw identifier, source address, cookie, family id, or token.
- Direct requests ignore forwarding headers. Trusted proxy tests configure explicit CIDRs, resolve right-to-left to the first untrusted address, and reject malformed or all-address production entries before startup.
- Concurrent staff/member claims for one normalized identifier produce exactly one reservation; legacy conflicts remain blocked until administrator resolution.
- Multi-reservation changes use one `AuthIdentifierOperation`; transactionless execution remains blocked in `pending` until its idempotent saga completes, compensates, or is reconciled.
- Operation assignments recover identifiers through pending reservation references; HMAC values are never reversed.
- Startup and scheduled reconciliation use atomic leases so multiple application instances cannot process the same operation concurrently.
- Access token succeeds only with configured issuer, audience, signature, expiry no later than 900 seconds after issuance, subject, role area, and auth version.
- Access token rejects wrong issuer, audience, expiry, signature, role area, or stale auth version.
- Refresh token rotates on every successful refresh without changing the family's absolute expiry, which is no later than 30 days after sign-in; the replacement cookie lifetime equals only the family lifetime remaining.
- Every committed exchange leaves a unique hash-only replay marker until family expiry. Reusing the immediately previous or any older exchanged token revokes the family and records one replay outcome without exposing which validation rule failed.
- Marker persistence starts in `pending` state with a unique operation id and 30-second lease before the family compare-and-swap. The family records that operation id, the marker commits before credentials are returned, expired pre-CAS work can be taken over, and committed-or-inconsistent interrupted work revokes the family. Each instance reconciles at most 100 expired markers every 60 seconds. Marker-write failure, compare-and-swap loss, concurrent exchange, and process interruption return no uncommitted credentials and never create two active successors.
- Migration revokes every active legacy refresh family before upgraded refresh traffic, clears legacy current/previous hashes without synthesizing partial replay markers, preserves family expiry and audit history, and requires affected users to sign in again.
- Shared/compatibility sign-in, refresh, logout, and logout-all accept each exact configured browser origin and reject missing, `null`, multiple, malformed, wildcard-derived, and untrusted origins with the same generic `403` before cookie parsing, throttle increment, session lookup/mutation, persistent security-event write, or `Set-Cookie`; fixed-cardinality operational warnings contain no supplied origin/header, cookie, token, or account reference and are sampled to at most one per route/reason category per minute per application instance with suppressed counts carried forward.
- Credentialed CORS returns only the matched configured origin and uses the same allowlist as the session guard; passing CORS configuration alone does not bypass the guard.
- Production set/clear cookie tests require `HttpOnly`, `Secure`, `SameSite=Strict`, path `/auth`, no `Domain`, and identical scope/security attributes. Refresh credentials never appear in response bodies.
- Current-session sign-out revokes the matching family when present and returns the same success when no valid cookie exists. All-session sign-out revokes every family, advances account authorization version, and makes older access credentials fail the next protected request.
- Member token cannot access staff/admin routes.
- Staff token without admin permissions cannot manage users, roles, or security events.
- Member self-service derives member id from token and blocks horizontal access.
- A data-driven authorization matrix verifies allow, permission-deny, member-deny, and unauthenticated outcomes for every protected controller action.
- Security events exclude passwords, raw tokens, token hashes, and full sensitive payloads.
- Account role, status, and identifier changes preserve borrowing records, staff action history, actor references, and security events.
- Invalid mandatory production auth configuration prevents startup with a redacted diagnostic; after successful startup, public `/health/ready` fails within 5 seconds when MongoDB or initialized auth infrastructure becomes unavailable.
- Public `/health` and `/health/ready` require no credentials and expose no connection strings, secrets, stack traces, host details, or account data.
- The performance run uses a production build, dedicated seeded MongoDB, disabled access logging, 100 warm-up requests, 500 measured requests at concurrency 10, nearest-rank p95, and equivalent unprotected/protected handlers from a test-only benchmark module. Results are written to `specs/003-auth-roles-permissions/evidence/auth-performance.md` with runtime and hardware metadata.
- Production `AppModule` does not import or expose test-only benchmark handlers.

## Frontend Verification

```powershell
npm run frontend:test
npm run frontend:test:e2e
```

Expected coverage:

- Unauthenticated users are routed to the shared sign-in page before protected member/staff areas.
- Shared sign-in routes staff/admin users to the appropriate staff/admin landing area from returned role area and permissions.
- Shared sign-in routes member users to member self-service from returned role area and permissions.
- Shared sign-in is operable by keyboard, exposes accessible names, announces errors, moves focus deterministically after failure, and prevents duplicate submission while pending.
- Signed-in members can open member self-service and cannot open staff/admin screens.
- Signed-in staff can open assigned staff workflows and cannot open admin-only screens without permissions.
- Signed-in administrators can manage staff accounts/roles and review security activity.
- Access credentials exist only in runtime memory and are absent from localStorage, sessionStorage, IndexedDB, persisted application state, logs, and error output.
- Current-session and all-session sign-out clear memory session state, clear frontend cached data, revoke the intended refresh state, and redirect to the shared sign-in route even when current-session sign-out begins with no valid refresh cookie.

## Manual Acceptance Scenarios

1. Create an administrator through `scripts/bootstrap-admin.ts`; seed scripts are for demo data only.
2. Sign in through the shared sign-in page as administrator and create a staff account.
3. Assign staff role and confirm the user can manage catalog/borrowing workflows but cannot manage roles.
4. Create or configure a member self-service account.
5. Sign in through the same shared sign-in page as member and confirm only the member's own membership and borrowing data is visible.
6. Try direct URLs or direct requests from the member session to staff/admin workflows and confirm denial.
7. Suspend the member or staff account and confirm refresh/sign-in no longer succeeds.
8. Configure or seed a duplicate cross-context sign-in identifier and confirm sign-in fails generically until the identifier ambiguity is resolved.
9. Review the conflict as an administrator, assign a unique replacement identifier, and confirm the corrected account can sign in without changing its password.
10. For an oversized `manual-repair-required` conflict, supply a short-lived administrator access token through standard input and run the thin offline repair CLI in dry-run mode. Confirm that `AuthIdentifierRepairAuthorizationService` validates authorization before data access and every mutating batch, `AuthIdentifierRepairKeyPolicyService` validates referenced-key availability, and `AuthIdentifierRepairService` canonicalizes the normalized mapping, records the deterministic salted HKDF/HMAC manifest, transitions the parent through `pending`, `applying`, and `finalizing`, prepares bounded resumable `AuthIdentifierRepairBatch` documents, activates reservations behind the parent repair gate, and requires confirmation before the bounded parent-completion transaction unlocks authentication. Resume with a fresh authorized token and confirm original/resuming actor attribution.
11. Review security activity and confirm sign-in, ambiguous sign-in failure, conflict resolution/recovery, authorized repair resume with original/resuming actors, denied access, role change, refresh replay, sign-out, and account-status events are visible without secrets.
12. Repeat shared sign-in, refresh, current-session sign-out, and all-session sign-out with one trusted exact origin and with missing, `null`, malformed, and untrusted origins. Confirm only the trusted request reaches authentication/session handling; every rejection has no cookie, authentication, or throttle side effect and appends only one redacted route/reason security event.
13. Rotate a refresh credential at least three times, replay the first exchanged credential, and confirm the family is revoked. Verify the newest cookie never outlives the original family expiry.

## Shared Sign-In Usability Protocol

- Product owner or QA prepares the moderated script, consent language, timing instructions, failure definitions, and anonymized result template in `specs/003-auth-roles-permissions/evidence/shared-sign-in-usability.md`.
- Recruit exactly 20 first-time participants comprising 8 members, 8 staff users, and 4 administrators.
- Give each participant valid credentials and their normal landing-area goal without telling them which account context the system will resolve.
- Record first-attempt completion, elapsed time to the authorized landing area, keyboard-only completion when applicable, and any validation or navigation confusion.
- Pass when at least 19 of 20 participants complete sign-in correctly on the first attempt within 30 seconds.
- Record only aggregate results and non-sensitive observations; do not record credentials, tokens, or full account identifiers.
- Missing participants leave SC-006 unverified and block production acceptance unless an explicit specification change defers the criterion.

## Future Keycloak Readiness Check

These checks do not require Keycloak for v1. They verify that a future IdP can replace the login authority without rewriting resource authorization.

- Access token claims include issuer, subject, audience, expiry, token id, role area, and scope/permission-style fields.
- Permission guards consume a normalized request context, not raw local JWT payload shapes.
- Staff/member records have optional identity-link fields available for a future external subject.
- Library authorization tests use permissions and ownership checks that would still apply to Keycloak-issued identities.

## Operational Checks

- Confirm no production deployment uses `development-only-secret`.
- Confirm refresh-family, refresh replay-marker, and authorization-code TTL indexes exist when their collections are enabled; replay markers have unique token-hash and rotation-operation-id indexes plus family/expiry and pending lease-reconciliation indexes.
- Confirm migration revoked every active legacy refresh family with reason `security-upgrade-reauth`, cleared legacy current/previous hashes, preserved absolute expiry and audit history, created no partial-history replay markers, and cannot reactivate those sessions on rollback.
- Confirm the unique `AuthIdentifier.normalizedIdentifier` index exists and migration conflict reports contain no secrets.
- Confirm unique `AuthIdentifierOperation.operationId`, operation lease indexes, and non-unique reservation `pendingOperationId`/`lastOperationId` indexes exist.
- Confirm terminal operation TTL exists, non-terminal operations omit `expiresAt`, and completion-result replay ends after the configured retention window.
- Confirm token issuer and audience match deployed configuration.
- Confirm logs and security activity redact passwords, raw tokens, token hashes, and request bodies.
- Confirm production refresh cookies are host-only with no `Domain`, `HttpOnly`, `Secure`, `SameSite=Strict`, path `/auth`, and a `Max-Age` bounded by family expiry remaining; clear-cookie attributes match.
- Confirm `AUTH_TRUSTED_BROWSER_ORIGINS` parses only exact canonical HTTPS production origins, drives both credentialed CORS and `AuthBrowserOriginGuard`, and rejects invalid configuration at startup with redacted diagnostics.
- Confirm `/health/ready` is used for deployment readiness and `/health` is used only for process liveness.
- Confirm invalid static auth configuration is tested as startup rejection, not as a runtime readiness response.
- Confirm audit identifier correlation uses versioned HMAC-SHA-256 with `AUTH_AUDIT_CORRELATION_SECRET`; ordinary hashes and raw identifiers are absent.
- Confirm previous correlation keys parse as a JSON object with unique positive integer versions, at least 32 decoded bytes per secret, no current-version entry, and no more than two keys. A key referenced by a non-terminal/cleanup-pending repair or unexpired throttle bucket cannot be retired; removing it produces redacted `repair-key-required` or `throttle-key-required` readiness and no data mutation until restored.
- Before rotation, pipe JSON version metadata such as `{"candidateCurrentVersion":4,"candidatePreviousVersions":[2,3]}` to `npm run auth:key-rotation:preflight`; confirm it includes versions required by repairs and unexpired throttle buckets, exits `0` when at most two previous versions are required, exits `2` with `repair-key-rotation-blocked` when more are required, rejects secret-bearing or unknown fields with exit `1`, reports only required version numbers/count plus fixed status, reason, and configured-capacity fields, and changes no configuration, repair, or throttle data.
- Confirm expired operation leases are claimed atomically, reconciled idempotently in bounded batches, and are never TTL-deleted.
- Confirm requests above the assignment limit return `422`, oversized migration conflicts remain blocked as `manual-repair-required`, and offline repair validates the stdin token before dry-run data access and each mutating batch, rejects actor overrides, detects changed manifests, preserves original/resuming actor audit, resumes uniquely indexed batches, blocks gated authentication until explicit parent finalization/completion, cleans gates before parent TTL eligibility, and produces one redacted idempotent parent audit event.
- Confirm RFC 8785 canonical bytes and HKDF-SHA-256 output match published vectors using salt `book-library/auth-identifier-repair-manifest/v1`, versioned info, and 32-byte output.
- Confirm failed sign-in security events contain an opaque account reference only after exact-one account resolution; unresolved or ambiguous attempts contain only versioned HMAC identifier correlation, and no event contains raw or normalized identifiers.
- Confirm retained `completed` and `failed-terminal` operation retries replay the original redacted result and HTTP status without re-execution, while expired operations require a new operation id.
- Confirm benchmark routes are absent from the normal production application route graph.
