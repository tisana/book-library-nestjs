# Quickstart: Validate Authentication, Roles, and Permissions

## Prerequisites

- Node.js version supported by the existing project.
- MongoDB available through the current project configuration.
- Environment variables configured with production-safe values for deployed runs:
  - `JWT_ISSUER`
  - `JWT_AUDIENCE`
  - `JWT_SECRET` or asymmetric signing keys
  - `ACCESS_TOKEN_TTL_SECONDS`
  - `REFRESH_TOKEN_TTL_SECONDS`
  - `AUTH_COOKIE_SECRET`

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

- Staff/admin sign-in succeeds for an active account with valid credentials.
- Member sign-in succeeds for an active member with active auth status and valid credentials.
- Sign-in failure is generic for unknown account, wrong password, inactive account, suspended member, locked member, or missing credentials.
- Access token succeeds only with configured issuer, audience, signature, expiry, subject, role area, and auth version.
- Access token rejects wrong issuer, audience, expiry, signature, role area, or stale auth version.
- Refresh token rotates on every successful refresh.
- Reused refresh token revokes the family and records a replay event.
- Member token cannot access staff/admin routes.
- Staff token without admin permissions cannot manage users, roles, or security events.
- Member self-service derives member id from token and blocks horizontal access.
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

1. Create an administrator through the first-admin setup path or seed script.
2. Sign in as administrator and create a staff account.
3. Assign staff role and confirm the user can manage catalog/borrowing workflows but cannot manage roles.
4. Create or configure a member self-service account.
5. Sign in as member and confirm only the member's own membership and borrowing data is visible.
6. Try direct URLs or direct requests from the member session to staff/admin workflows and confirm denial.
7. Suspend the member or staff account and confirm refresh/sign-in no longer succeeds.
8. Review security activity and confirm sign-in, denied access, role change, refresh replay, sign-out, and account-status events are visible without secrets.

## Future Keycloak Readiness Check

These checks do not require Keycloak for v1. They verify that a future IdP can replace the login authority without rewriting resource authorization.

- Access token claims include issuer, subject, audience, expiry, token id, role area, and scope/permission-style fields.
- Permission guards consume a normalized request context, not raw local JWT payload shapes.
- Staff/member records have optional identity-link fields available for a future external subject.
- Library authorization tests use permissions and ownership checks that would still apply to Keycloak-issued identities.

## Operational Checks

- Confirm no production deployment uses `development-only-secret`.
- Confirm refresh-token and authorization-code TTL indexes exist when their collections are enabled.
- Confirm token issuer and audience match deployed configuration.
- Confirm logs and security activity redact passwords, raw tokens, token hashes, and request bodies.
- Confirm HTTPS and Secure cookies are enabled outside local development.
