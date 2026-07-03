# Contract: Authentication API

## Goals

- Provide an OAuth2/OIDC-aligned first-party browser sign-in flow.
- Issue short-lived JWT access tokens for protected API calls.
- Rotate refresh tokens when refresh is allowed.
- Keep member, staff, and admin authorization server-enforced.

## Authorization Server Metadata

### `GET /.well-known/oauth-authorization-server`

Returns issuer metadata for the first-party authorization server.

Required fields:

- `issuer`
- `authorization_endpoint`
- `token_endpoint`
- `revocation_endpoint`
- `jwks_uri`
- `response_types_supported`: includes `code`
- `grant_types_supported`: includes `authorization_code` and `refresh_token`
- `code_challenge_methods_supported`: includes `S256`
- `scopes_supported`

### `GET /.well-known/jwks.json`

Returns public signing keys for JWT verification when asymmetric signing is enabled.

## Authorization Flow

### `GET /oauth/authorize`

Starts an authorization-code flow.

Required query parameters:

- `response_type=code`
- `client_id`
- `redirect_uri`
- `scope`
- `state`
- `code_challenge`
- `code_challenge_method=S256`

Optional query parameters:

- `nonce`
- `login_hint`
- `role_area`: `member` or `staff`

Expected behavior:

- Reject unknown/inactive clients.
- Reject redirect URIs that are not exact registered values.
- Require PKCE S256 for browser clients.
- Authenticate the user if no active authorization-server session exists.
- Return an authorization code to the exact redirect URI.

### `POST /oauth/token`

Exchanges authorization codes or refresh tokens.

#### Authorization Code Grant

Request fields:

- `grant_type=authorization_code`
- `client_id`
- `code`
- `redirect_uri`
- `code_verifier`

Success response:

```json
{
  "access_token": "jwt-access-token",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "catalog:read borrowings:manage"
}
```

If refresh continuity is enabled, the response also sets a Secure, HTTP-only, SameSite refresh cookie or returns a refresh token only to a client that can store it safely.

#### Refresh Token Grant

Request fields:

- `grant_type=refresh_token`
- `client_id`

Refresh token source:

- HTTP-only refresh cookie for same-site browser client, or explicit `refresh_token` field for approved non-browser clients.

Expected behavior:

- Rotate refresh token on every successful refresh.
- Revoke the token family on replay detection.
- Deny refresh when the subject account is inactive, suspended, locked, reset-required, or has a token invalidation version newer than the session.

## Revocation and Sign-Out

### `POST /oauth/revoke`

Revokes a refresh token family or compatible token.

Request fields:

- `client_id`
- `token` when available
- `token_type_hint`: `refresh_token` or `access_token`

Expected behavior:

- Revoke matching refresh family.
- Clear refresh cookie for browser clients.
- Record a security activity event.

### `POST /auth/logout`

Compatibility endpoint for the existing frontend sign-out workflow.

Expected behavior:

- Revoke the current refresh-token family when present.
- Clear refresh cookie.
- Return success even if there is no active refresh token.

## Current User

### `GET /auth/me`

Requires access token.

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

## Protected Resource Requirements

- Every protected endpoint requires a valid access token.
- Every protected endpoint declares required permission or ownership policy.
- Member self-service endpoints must derive member id from the token subject.
- Staff/admin endpoints must reject member tokens.
- Admin endpoints must require admin permissions, not merely an authenticated staff token.

## Error Semantics

- Unauthenticated or invalid token: `401 Unauthorized`.
- Authenticated but insufficient permission: `403 Forbidden`.
- Sign-in failure: generic `401 Unauthorized` without revealing account existence or account status.
- Invalid OAuth request: `400 Bad Request` with non-sensitive OAuth error code.
- Invalid redirect URI: do not redirect to the untrusted URI.

## Token Claims

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

Staff/admin tokens may include role names. Member tokens must not include staff permissions.

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
