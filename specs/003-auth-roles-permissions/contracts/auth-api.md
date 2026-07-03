# Contract: Authentication API

## Goals

- Provide a solid NestJS-owned authentication system for the current single-library app.
- Issue short-lived JWT access tokens with OIDC-friendly claims.
- Rotate refresh tokens and store only hashes.
- Keep the API guard boundary ready for future Keycloak token validation.
- Enforce library-specific permissions and member ownership inside NestJS.

## Staff Sign-In

### `POST /auth/login`

Authenticates a staff/admin user.

Request fields:

- `email`
- `password`

Success response:

```json
{
  "accessToken": "jwt-access-token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "scope": "catalog:read catalog:manage borrowings:manage",
  "user": {
    "id": "staff-user-id",
    "email": "admin@example.com",
    "displayName": "Library Admin",
    "roles": ["admin"],
    "permissions": ["catalog:manage", "roles:manage"]
  }
}
```

Expected behavior:

- Verify password using the configured password hasher.
- Require active staff/admin status.
- Return a generic sign-in failure for invalid email, invalid password, inactive status, or missing credentials.
- Set a Secure, HTTP-only, SameSite refresh cookie when refresh continuity is enabled.
- Record sign-in success/failure without passwords or raw tokens.

## Member Sign-In

### `POST /auth/member-login`

Authenticates a member self-service user.

Request fields:

- `loginIdentifier`
- `password`

Success response:

```json
{
  "accessToken": "jwt-access-token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "scope": "member:self:read",
  "member": {
    "id": "member-id",
    "memberNumber": "M-1001",
    "displayName": "Member Name",
    "email": "member@example.com"
  }
}
```

Expected behavior:

- Verify password using the configured password hasher.
- Require active member status and active auth status.
- Derive member self-service identity from the authenticated member record.
- Return a generic sign-in failure for invalid identifier, invalid password, inactive membership, locked auth status, or missing credentials.
- Set a Secure, HTTP-only, SameSite refresh cookie when refresh continuity is enabled.

## Token Refresh

### `POST /auth/refresh`

Refreshes the access token using the current refresh cookie.

Expected behavior:

- Validate refresh-token hash against the active token family.
- Rotate refresh token on every successful refresh.
- Revoke the token family on replay detection.
- Deny refresh when the subject account is inactive, suspended, locked, reset-required, or has a newer `authVersion`.
- Return a new access token with current roles and permissions.

## Revocation and Sign-Out

### `POST /auth/logout`

Revokes the current refresh-token family when present.

Expected behavior:

- Clear refresh cookie.
- Revoke matching refresh family.
- Return success even if there is no active refresh token.
- Record sign-out/token-revocation event without raw token values.

### `POST /auth/logout-all`

Requires authentication.

Expected behavior:

- Increment `authVersion` or revoke all active refresh-token families for the subject.
- Clear current refresh cookie.
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

## Security Events

The API records events for:

- sign-in success/failure
- authorization denied
- role assignment changes
- account status changes
- token refresh
- refresh replay detection
- revocation/sign-out

Events must exclude passwords, raw tokens, token hashes, and full sensitive payloads.
