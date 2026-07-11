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
npm run verify:auth-performance
```

Expected coverage:

- Staff/admin sign-in succeeds through the shared sign-in contract for an active account with valid credentials.
- Member sign-in succeeds through the shared sign-in contract for an active member with active auth status and valid credentials.
- Staff/member accounts, roles, and sign-in scope remain available after closing and recreating the Nest application against the same test database.
- Sign-in failure is generic for unknown account, ambiguous identifier, wrong password, inactive account, suspended member, locked member, or missing credentials.
- Concurrent staff/member claims for one normalized identifier produce exactly one reservation; legacy conflicts remain blocked until administrator resolution.
- Access token succeeds only with configured issuer, audience, signature, expiry, subject, role area, and auth version.
- Access token rejects wrong issuer, audience, expiry, signature, role area, or stale auth version.
- Refresh token rotates on every successful refresh.
- Reused refresh token revokes the family and records a replay event.
- Member token cannot access staff/admin routes.
- Staff token without admin permissions cannot manage users, roles, or security events.
- Member self-service derives member id from token and blocks horizontal access.
- A data-driven authorization matrix verifies allow, permission-deny, member-deny, and unauthenticated outcomes for every protected controller action.
- Security events exclude passwords, raw tokens, token hashes, and full sensitive payloads.
- Account role, status, and identifier changes preserve borrowing records, staff action history, actor references, and security events.
- `/health` remains a liveness signal and `/health/ready` fails within 5 seconds when MongoDB or mandatory auth configuration is unavailable.
- The documented performance environment verifies permission evaluation at no more than 50 ms p95 over 500 warmed requests and the first 50 of 10,000 security events within 2 seconds.

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
- Sign-out clears memory session state, clears frontend cached data, revokes refresh state, and redirects to the shared sign-in route.

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
10. Review security activity and confirm sign-in, ambiguous sign-in failure, conflict resolution, denied access, role change, refresh replay, sign-out, and account-status events are visible without secrets.

## Shared Sign-In Usability Protocol

- Recruit at least 20 representative staff, administrator, and member users who have not used the shared sign-in page before.
- Give each participant valid credentials and their normal landing-area goal without telling them which account context the system will resolve.
- Record first-attempt completion, elapsed time to the authorized landing area, keyboard-only completion when applicable, and any validation or navigation confusion.
- Pass when at least 19 of 20 participants complete sign-in correctly on the first attempt within 30 seconds.
- Record only aggregate results and non-sensitive observations; do not record credentials, tokens, or full account identifiers.

## Future Keycloak Readiness Check

These checks do not require Keycloak for v1. They verify that a future IdP can replace the login authority without rewriting resource authorization.

- Access token claims include issuer, subject, audience, expiry, token id, role area, and scope/permission-style fields.
- Permission guards consume a normalized request context, not raw local JWT payload shapes.
- Staff/member records have optional identity-link fields available for a future external subject.
- Library authorization tests use permissions and ownership checks that would still apply to Keycloak-issued identities.

## Operational Checks

- Confirm no production deployment uses `development-only-secret`.
- Confirm refresh-token and authorization-code TTL indexes exist when their collections are enabled.
- Confirm the unique `AuthIdentifier.normalizedIdentifier` index exists and migration conflict reports contain no secrets.
- Confirm token issuer and audience match deployed configuration.
- Confirm logs and security activity redact passwords, raw tokens, token hashes, and request bodies.
- Confirm HTTPS and Secure cookies are enabled outside local development.
- Confirm `/health/ready` is used for deployment readiness and `/health` is used only for process liveness.
