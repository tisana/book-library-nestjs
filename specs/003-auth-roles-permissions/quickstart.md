# Quickstart: Validate Authentication, Roles, and Permissions

## Prerequisites

- Node.js version supported by the existing project.
- MongoDB available through the current project configuration.
- Local or deployed Keycloak 26.x realm configured for the library application.
- Environment variables configured with production-safe values for deployed runs:
  - `KEYCLOAK_ISSUER`
  - `KEYCLOAK_JWKS_URI`
  - `KEYCLOAK_AUDIENCE`
  - `KEYCLOAK_FRONTEND_CLIENT_ID`
  - `KEYCLOAK_REALM`
  - first-party OAuth client redirect URIs

## Setup

```powershell
npm install
npm run frontend:install
npm run migrate:up
npm run seed:demo
```

Import or apply the local Keycloak realm configuration from `infra/keycloak/` when that artifact exists.

## Backend Verification

Run backend unit and e2e tests:

```powershell
npm test
npm run test:e2e
```

Expected coverage:

- Keycloak-issued access token succeeds only with the configured issuer and audience.
- Access token rejects wrong issuer, audience, expiry, or unknown signing key.
- JWT validation refreshes JWKS on key rotation.
- Keycloak role/group claims map to the expected local permission set.
- Member token cannot access staff/admin routes.
- Staff token without admin permissions cannot manage users, roles, or security events.
- Member self-service derives member id from token and blocks horizontal access.
- Generic sign-in failures are handled by Keycloak and are not logged by the API with secrets.
- Security events exclude passwords, raw tokens, token hashes, and full sensitive payloads.

## Frontend Verification

```powershell
npm run frontend:test
npm run frontend:test:e2e
```

Expected coverage:

- Unauthenticated users are routed to Keycloak sign-in before protected member/staff areas.
- Signed-in members can open member self-service and cannot open staff/admin screens.
- Signed-in staff can open assigned staff workflows and cannot open admin-only screens without permissions.
- Signed-in administrators can manage staff accounts/roles and review security activity.
- Sign-out clears memory session state, clears frontend cached data, uses Keycloak logout, and redirects to the correct signed-out route.

## Manual Acceptance Scenarios

1. Create or import the Keycloak realm and frontend/API clients.
2. Create Keycloak users for administrator, staff, and member identities.
3. Link those Keycloak subjects to existing staff/member records in the library app.
4. Sign in as administrator and create or update a staff profile.
5. Assign staff role/group and confirm the user can manage catalog/borrowing workflows but cannot manage roles.
6. Create or configure a member self-service identity.
7. Sign in as member and confirm only the member's own membership and borrowing data is visible.
8. Try direct URLs or direct requests from the member session to staff/admin workflows and confirm denial.
9. Suspend the member or staff account in the app or Keycloak and confirm protected API access no longer succeeds.
10. Review security activity and confirm denied access, identity-link, role-change, and account-status events are visible without secrets.

## Operational Checks

- Confirm no production deployment accepts the development issuer or audience.
- Confirm Keycloak production mode uses a supported database, backup, HTTPS/proxy, and realm export process.
- Confirm Keycloak client redirect URIs match exact deployed URLs.
- Confirm logs and security activity redact passwords, raw tokens, token hashes, and request bodies.
- Confirm HTTPS and Secure cookies are enabled outside local development.
