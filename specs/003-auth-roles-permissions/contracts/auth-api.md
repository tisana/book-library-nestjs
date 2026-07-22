# Contract: Authentication API

## Goals

- Provide a solid NestJS-owned authentication system for the current single-library app.
- Issue short-lived JWT access tokens with OIDC-friendly claims.
- Rotate refresh tokens and store only hashes.
- Keep the API guard boundary ready for future Keycloak token validation.
- Enforce library-specific permissions and member ownership inside NestJS.
- Support one shared sign-in entry point for staff, administrators, and members.

## Browser Session Boundary

The following endpoints issue, use, or clear the refresh cookie and therefore require the browser-session boundary before DTO handling, cookie parsing, throttling, or credential/session lookup or mutation:

- `POST /auth/login`
- `POST /auth/staff-login`
- `POST /auth/member-login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`

Boundary contract:

- `AUTH_TRUSTED_BROWSER_ORIGINS` is a JSON array and the single source of truth for credentialed CORS and session-origin decisions. Outside production, omission defaults to `["http://localhost:5173","http://127.0.0.1:5173"]`; production has no default and requires at least one exact HTTPS origin.
- Each configured value contains only scheme, host, and effective port. Reject credentials, paths other than `/`, query strings, fragments, `null`, wildcards, regexes, duplicate canonical origins, non-HTTP(S) schemes, and production HTTP origins at startup.
- Require exactly one syntactically valid `Origin` header and compare its canonical complete origin with the configured set. Do not use suffix matching or `Referer` fallback. Missing, opaque/`null`, multiple, malformed, and untrusted values are denied.
- Origin denial returns `403 Forbidden` with one generic browser-session-denied body, no `Set-Cookie`, and no cookie parsing, throttle increment, credential/session lookup, authentication-state mutation, or persistent security-event write. Operational visibility is limited to fixed-cardinality route/reason telemetry sampled to at most one redacted warning per dimension per minute per application instance, carrying a suppressed count forward and never including the supplied origin/header, cookie, token, or account reference.
- CORS preflight uses the same exact allowlist and credentialed responses include the matched origin rather than `*`; CORS is transport policy and does not replace the server-side origin guard.
- Successful production refresh-cookie writes use `HttpOnly`, `Secure`, `SameSite=Strict`, path `/auth`, no `Domain`, and `Max-Age` no greater than the family lifetime remaining. Clear operations use the same path and security attributes with an expired lifetime.
- Access credentials expire no later than 900 seconds after issuance and are returned only in the response body for memory-only client use. Refresh credentials are returned only in the protected cookie, never in a response body or script-readable store.

Generic origin-denial response:

```json
{
  "statusCode": 403,
  "message": "Browser session request denied",
  "error": "Forbidden"
}
```

## Shared Sign-In

### `POST /auth/login`

Authenticates a staff/admin or member user from a shared sign-in request.

Request fields:

- `identifier`: staff email, member login identifier, member number, or another approved normalized account identifier
- `password`

Success response for staff/admin:

```json
{
  "accessToken": "jwt-access-token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "scope": "catalog:read catalog:manage borrowings:manage",
  "roleArea": "staff",
  "user": {
    "id": "staff-user-id",
    "email": "admin@example.com",
    "displayName": "Library Admin",
    "roles": ["admin"],
    "permissions": ["catalog:manage", "roles:manage"]
  }
}
```

Success response for member:

```json
{
  "accessToken": "jwt-access-token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "scope": "member:self:read",
  "roleArea": "member",
  "member": {
    "id": "member-id",
    "memberNumber": "M-1001",
    "displayName": "Member Name",
    "email": "member@example.com"
  }
}
```

Expected behavior:

- Normalize the submitted identifier before lookup and audit correlation.
- Resolve an active `AuthIdentifier` reservation to exactly one staff/admin or member account context.
- Reject missing, released, conflict-marked, or legacy-ambiguous identifiers with the same generic sign-in failure.
- Verify password using the configured password hasher.
- Require active staff/admin status for staff/admin accounts.
- Require active member status and active auth status.
- Derive member self-service identity from the authenticated member record when `roleArea` is `member`.
- Return a generic sign-in failure for unknown identifier, ambiguous identifier, invalid password, inactive staff/admin status, inactive membership, locked auth status, or missing credentials.
- Set the refresh cookie according to the Browser Session Boundary with `Max-Age` equal to the positive absolute family lifetime remaining and never more than 30 days from sign-in.
- Record sign-in success/failure without passwords, raw tokens, or submitted/normalized identifiers. A failed event may include an opaque account reference only after exact-one account resolution; otherwise include only versioned identifier correlation.
- Return `roleArea` and permissions so the frontend can route staff/admin users to staff/admin areas and members to member self-service.

## Identifier Conflict Administration

### `GET /auth/identifier-conflicts`

Requires `auth-identifiers:read`.

Expected behavior:

- Return paginated legacy `AuthIdentifier` conflict records with normalized identifier, safe subject references, and safe account display labels.
- Include `resolutionStatus` as `reviewable` or `manual-repair-required` without returning oversized assignment payloads.
- Exclude passwords, password hashes, token data, borrowing history, and unrelated profile fields.
- Reject regular staff and member identities.

### `POST /auth/identifier-conflicts/:id/resolve`

Requires `auth-identifiers:manage`.

Request fields:

- `retainedSubject`: optional `{ subjectType, subjectId }` allowed to keep the original identifier
- `reassignments`: array of `{ subjectType, subjectId, newIdentifier }` entries for every other conflicting subject
- `operationId`: client-generated idempotency key

Expected behavior:

- Require every conflicting subject to be retained or reassigned, and allow at most one explicitly selected retained subject.
- Normalize and reserve every replacement before changing account aggregates.
- If one subject is retained, activate the original reservation for that subject after all replacements succeed; if none is retained, release the original reservation.
- In transaction-capable deployments, complete replacement reservations, aggregate updates, and the original-reservation transition atomically.
- Without transactions, create one durable `AuthIdentifierOperation`, move all affected reservations to `pending`, apply assignments idempotently, and keep the original conflict blocked until the saga completes or is safely compensated.
- Pending replacement reservations store normalized identifiers and are referenced by operation assignments; HMAC correlation values are never used to reconstruct identifiers.
- Reject replacements already reserved by another account and never choose a retained subject automatically.
- Reject operations above `AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS` with `422 Unprocessable Entity`; oversized legacy conflicts remain blocked with `manual-repair-required` status.
- While a terminal operation is retained, return its original redacted result and original HTTP status when the same `operationId` is retried, whether the terminal outcome is `completed` or `failed-terminal`; never re-execute it. After terminal expiry, require a new operation id.
- Never modify passwords.
- Record success and failure as redacted security activity.

### `GET /auth/identifier-operations/:operationId`

Requires `auth-identifiers:read` and administrator role area.

Expected behavior:

- Return a redacted operation status of `pending`, `applying`, `compensating`, `finalizing`, `failed-retryable`, `completed`, or `failed-terminal`.
- Treat only `completed` and `failed-terminal` as terminal. `failed-retryable` remains eligible for reconciliation and must not be presented as expired or permanently failed.
- Include only safe subject references, current step category, completion time, and redacted result/reason category.
- Return the stored redacted terminal result and original HTTP status for idempotent client recovery from either `completed` or `failed-terminal`.
- Guarantee completion-result replay only during `AUTH_IDENTIFIER_OPERATION_RETENTION_DAYS`; after terminal expiry return `404 Not Found` and require a new operation id.
- Exclude raw identifiers, passwords, token data, lease-owner infrastructure details, and internal stack traces.

## Compatibility Sign-In Wrappers

### `POST /auth/staff-login`

Optional compatibility wrapper for existing staff/admin clients.

Expected behavior:

- Accept legacy staff/admin request shapes when needed.
- Delegate to the same credential verification, token issuing, refresh cookie, permission mapping, throttling, and audit behavior as shared sign-in.
- Do not become the primary frontend sign-in flow.

### `POST /auth/member-login`

Optional compatibility wrapper for existing member clients.

Expected behavior:

- Accept legacy member request shapes when needed.
- Delegate to the same credential verification, token issuing, refresh cookie, permission mapping, throttling, and audit behavior as shared sign-in.
- Do not become the primary frontend sign-in flow.

## Authentication Throttling

Shared, staff compatibility, and member compatibility sign-in routes use the same counters and generic response contract.

- Count every sign-in request against a trusted-source boundary of 20 attempts per 15 minutes.
- Count every generic unknown, ambiguous, invalid-password, inactive, suspended, locked, or missing-credential outcome against a versioned identifier-correlation boundary of 5 failures per 15 minutes whenever the request contains a normalizable identifier. A malformed request without one counts only against the source boundary.
- Count every refresh request against both a refresh-family and trusted-source boundary of 30 attempts per 5 minutes.
- Deny the request when either applicable boundary is exceeded with `429 Too Many Requests`, a generic retry-later body, and a bounded `Retry-After` value; do not reveal which boundary matched or whether an account exists.
- Shared and compatibility routes cannot create independent buckets for the same identifier correlation or trusted source.
- Configure trusted proxies only through `AUTH_TRUSTED_PROXY_CIDRS`, a JSON array of validated IPv4/IPv6 CIDRs. Empty trust uses the direct peer and ignores forwarding headers; configured trust resolves right-to-left to the first untrusted address. Reject malformed and all-address production entries at startup.
- Persist only audit-correlation key version, purpose-separated HMAC bucket key, count, window start, and expiry. Never persist raw identifiers, source addresses, cookies, family ids, or tokens in throttle state.
- For each dimension, derive candidate keys under current and configured previous versions, continue an unexpired existing bucket through key rotation, and create a current-version bucket only when none exists. Missing referenced key material fails closed with the same generic response and no counter mutation.
- Expired windows become eligible again without administrator action; configuration changes apply to new windows and must retain the documented defaults for acceptance testing.

## Token Refresh

### `POST /auth/refresh`

Refreshes the access token using the current refresh cookie.

Expected behavior:

- Validate refresh-token hash against the active token family.
- Reject families whose immutable absolute expiry has passed; rotation never extends family expiry.
- Before changing the family current hash, persist a unique hash-only replay marker in `pending` state with a unique rotation operation id, 30-second lease, and family expiry.
- Rotate the current hash with an atomic active/unexpired compare-and-swap that also records the marker operation id. Commit the marker for that same operation id before returning a replacement credential.
- Return the generic denial without family mutation when another unexpired pending lease owns the credential. After lease expiry, take over pending work only while the family still references the presented hash. If the family records the pending operation id, finalize the marker and revoke the orphaned family; revoke on any other marker/family inconsistency.
- Each application instance reconciles at most 100 expired pending markers every 60 seconds, finalizing and revoking orphaned or inconsistent rotations while leaving pre-CAS work available for request takeover.
- Revoke the token family when any retained committed marker matches, including tokens older than the immediately previous generation. Concurrent exchanges permit at most one family compare-and-swap and never create two active successors.
- Before this contract is enabled after migration, revoke every active legacy family, clear its legacy current/previous hashes, preserve its absolute expiry and audit history, and require reauthentication; do not backfill partial replay history.
- Deny refresh when the subject account is inactive, suspended, locked, reset-required, or has a newer `authVersion`.
- Return a new access token with current roles and permissions, `expiresIn` no greater than 900, and a refresh cookie whose lifetime is the family expiry remaining.
- Return the same generic `401 Unauthorized` response for malformed, invalid, expired, revoked, replayed, inactive-account, and stale-authorization refresh outcomes.

## Revocation and Sign-Out

### `POST /auth/logout`

Revokes the current refresh-token family when present.

Expected behavior:

- Clear refresh cookie.
- Revoke matching refresh family.
- Return success even if there is no active refresh token.
- Return the same success shape when the cookie is missing, malformed, expired, already revoked, or otherwise invalid after the trusted-origin boundary succeeds.
- Record sign-out/token-revocation event without raw token values.

### `POST /auth/logout-all`

Requires authentication.

Expected behavior:

- Increment `authVersion` or revoke all active refresh-token families for the subject.
- Clear current refresh cookie.
- Ensure access credentials issued before the operation fail the next protected-request authorization-version check.
- Record security activity.

## Current User

### `GET /auth/me`

Requires valid access token.

Success response for staff/admin:

```json
{
  "roleArea": "staff",
  "user": {
    "id": "staff-user-id",
    "email": "admin@example.com",
    "displayName": "Library Admin",
    "roles": ["admin"],
    "permissions": ["catalog:manage", "roles:manage"]
  }
}
```

Success response for member:

```json
{
  "roleArea": "member",
  "member": {
    "id": "member-id",
    "memberNumber": "M-1001",
    "displayName": "Member Name",
    "email": "member@example.com"
  },
  "permissions": ["member:self:read"]
}
```

## Optional OIDC-Friendly Metadata

If the implementation adds a local authorization-code-with-PKCE flow, expose compatible metadata and contracts without making Keycloak a runtime dependency.

### `GET /.well-known/oauth-authorization-server`

Returns issuer metadata for the local authorization boundary.

Required fields:

- `issuer`
- `token_endpoint`
- `jwks_uri` when asymmetric signing is enabled
- `grant_types_supported`
- `scopes_supported`

## Token Validation in NestJS

Every protected API request uses a bearer access token issued by this app in v1.

NestJS must validate:

- signature
- `iss`
- `aud`
- `exp`
- `iat` tolerance
- `jti`
- `sub`
- `role_area`
- scope/permission claims
- local staff/member account status
- `auth_version`

## Protected Resource Requirements

- Every protected endpoint requires a valid access token.
- Every protected endpoint declares required permission or ownership policy.
- Member self-service endpoints derive member id from the token subject.
- Staff/admin endpoints reject member identities.
- Admin endpoints require admin permissions, not merely an authenticated staff identity.

## Error Semantics

- Missing, expired, invalid, wrong-issuer, or wrong-audience token: `401 Unauthorized`.
- Authenticated but insufficient permission: `403 Forbidden`.
- Member token on staff/admin endpoint: `403 Forbidden`.
- Sign-in failure: generic `401 Unauthorized` without revealing account existence or status.
- Browser-session origin failure on login, compatibility login, refresh, logout, or logout-all: generic `403 Forbidden` without `Set-Cookie` or authentication-state mutation.

## Token Claim Mapping

Required access token claims:

- `iss`
- `sub`
- `aud`
- `exp`
- `iat`
- `jti`
- `role_area`
- `scope` or `permissions`
- `auth_version`

Future Keycloak migration should map Keycloak `sub`, roles/groups, scopes, issuer, audience, and JWKS validation into this same request context before permission guards run.

## Audit-Correlation Key Rotation Preflight CLI

Command: `npm run auth:key-rotation:preflight`

This is a local deployment-operator command, not an HTTP endpoint. It reads exactly one JSON object from stdin:

```json
{
  "candidateCurrentVersion": 4,
  "candidatePreviousVersions": [2, 3]
}
```

Validation and behavior:

- Accept positive integer versions only; previous versions must be unique and must not contain the candidate current version.
- Reject unknown fields and any field/value intended to carry key secrets.
- Query versions referenced by non-terminal/cleanup-pending repairs and unexpired throttle buckets through `AuthIdentifierRepairKeyPolicyService` and perform no database or configuration writes.
- Exit `0` with `{ "status": "ok", "requiredPreviousVersions": [...], "requiredPreviousCount": n, "maxPreviousKeys": 2 }` when rotation is allowed.
- Exit `2` with the same redacted metadata plus `"reason": "repair-key-rotation-blocked"` when more than two previous versions are required.
- Exit `1` with a generic redacted validation/runtime reason for malformed input or unavailable infrastructure.
- Never output key values, connection strings, account data, identifiers, stack traces, or repair document ids.
- Output is limited to required version numbers/count and fixed `status`, `reason`, and `maxPreviousKeys` fields.

## Security Events

The API records events for:

- sign-in success/failure
- authorization denied
- role assignment changes
- account status changes
- identifier conflict detection, resolution, and reservation recovery
- authorized offline-repair resume, including original and resuming actor references
- token refresh
- refresh replay detection
- revocation/sign-out

Events must exclude passwords, raw tokens, token hashes, raw or normalized sign-in identifiers, and full sensitive payloads. Identifier correlation uses the versioned HMAC contract. Failed sign-in events include an opaque account reference only after exact-one account resolution; unresolved or ambiguous attempts include correlation only.
