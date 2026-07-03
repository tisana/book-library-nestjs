# Quickstart: Validate Authentication, Roles, and Permissions

## Prerequisites

- Node.js version supported by the existing project.
- MongoDB available through the current project configuration.
- Environment variables configured with production-safe values for deployed runs:
  - `JWT_ISSUER`
  - `JWT_AUDIENCE`
  - `JWT_PRIVATE_KEY` or `JWT_SECRET` for local development only
  - `JWT_PUBLIC_KEY` when asymmetric signing is used
  - `ACCESS_TOKEN_TTL_SECONDS`
  - `REFRESH_TOKEN_TTL_SECONDS`
  - `AUTH_COOKIE_SECRET`
  - first-party OAuth client redirect URIs

## Setup

```powershell
npm install
npm run frontend:install
npm run migrate:up
npm run seed:demo
```

## Backend Verification

Run backend unit and e2e tests:

```powershell
npm test
npm run test:e2e
```

Expected coverage:

- Authorization code with PKCE succeeds for valid first-party client.
- Authorization code cannot be reused.
- Token endpoint rejects missing or wrong PKCE verifier.
- Access token rejects wrong issuer, audience, expiry, or stale token version.
- Refresh token rotates on every successful refresh.
- Reused refresh token revokes the family and records a replay event.
- Member token cannot access staff/admin routes.
- Staff token without admin permissions cannot manage users, roles, or security events.
- Member self-service derives member id from token and blocks horizontal access.
- Generic sign-in failures do not reveal account existence or status.
- Security events exclude passwords, raw tokens, token hashes, and full sensitive payloads.

## Frontend Verification

```powershell
npm run frontend:test
npm run frontend:test:e2e
```

Expected coverage:

- Unauthenticated users are routed to sign-in before protected member/staff areas.
- Signed-in members can open member self-service and cannot open staff/admin screens.
- Signed-in staff can open assigned staff workflows and cannot open admin-only screens without permissions.
- Signed-in administrators can manage staff accounts/roles and review security activity.
- Sign-out clears memory session state, clears frontend cached data, revokes refresh state, and redirects to the correct sign-in route.

## Manual Acceptance Scenarios

1. Create an administrator through the first-admin setup path.
2. Sign in as administrator and create a staff account.
3. Assign staff role and confirm the user can manage catalog/borrowing workflows but cannot manage roles.
4. Create or configure a member self-service account.
5. Sign in as member and confirm only the member's own membership and borrowing data is visible.
6. Try direct URLs or direct requests from the member session to staff/admin workflows and confirm denial.
7. Suspend the member or staff account and confirm refresh/sign-in no longer succeeds.
8. Review security activity and confirm sign-in, denied access, role change, and revocation events are visible without secrets.

## Operational Checks

- Confirm no production deployment uses `development-only-secret`.
- Confirm refresh-token and authorization-code TTL indexes exist.
- Confirm auth client redirect URIs match exact deployed URLs.
- Confirm logs and security activity redact passwords, raw tokens, token hashes, and request bodies.
- Confirm HTTPS and Secure cookies are enabled outside local development.
