# Contract: Keycloak OIDC Integration and Protected Auth API

## Goals

- Use Keycloak as the OAuth2/OIDC identity provider and authorization server.
- Keep NestJS as the protected resource server for library APIs.
- Validate Keycloak-issued tokens consistently.
- Enforce library-specific permissions and member ownership inside NestJS.

## Keycloak OIDC Endpoints

The frontend and backend consume the configured Keycloak realm metadata.

Required realm endpoints:

- Authorization endpoint: `/realms/{realm}/protocol/openid-connect/auth`
- Token endpoint: `/realms/{realm}/protocol/openid-connect/token`
- Logout endpoint: `/realms/{realm}/protocol/openid-connect/logout`
- UserInfo endpoint: `/realms/{realm}/protocol/openid-connect/userinfo`
- Revocation endpoint: `/realms/{realm}/protocol/openid-connect/revoke`
- JWKS endpoint: `/realms/{realm}/protocol/openid-connect/certs`

## Browser Sign-In Flow

The frontend signs in through Keycloak using authorization code with PKCE.

Required request properties:

- `response_type=code`
- configured `client_id`
- exact configured `redirect_uri`
- `scope=openid profile email`
- `state`
- `nonce`
- `code_challenge`
- `code_challenge_method=S256`

Expected behavior:

- Keycloak authenticates the user and owns credential/session handling.
- The frontend never receives passwords.
- The frontend does not store access or refresh tokens in localStorage.
- Redirect URIs are exact configured values.

## Token Validation in NestJS

Every protected API request uses a bearer access token issued by Keycloak.

NestJS must validate:

- signature against Keycloak JWKS
- `iss`
- `aud`
- `exp`
- `iat` tolerance
- `sub`
- role/group/scope claims used for permission mapping
- linked local staff/member account status

## Current User

### `GET /auth/me`

Requires valid Keycloak access token.

Success response for staff/admin:

```json
{
  "roleArea": "staff",
  "user": {
    "id": "staff-user-id",
    "identitySubject": "keycloak-sub",
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
    "identitySubject": "keycloak-sub",
    "memberNumber": "M-1001",
    "displayName": "Member Name",
    "email": "member@example.com"
  },
  "permissions": ["member:self:read"]
}
```

## Identity Linking

### `POST /auth/identity-links/staff`

Administrator-only endpoint to link an existing staff/admin profile to a Keycloak subject.

Required permission: `staff-users:manage`

Request fields:

- `staffUserId`
- `identityProvider`
- `identitySubject`

### `POST /auth/identity-links/member`

Staff/admin endpoint to link an existing member profile to a Keycloak subject.

Required permission: `members:manage`

Request fields:

- `memberId`
- `identityProvider`
- `identitySubject`

## Protected Resource Requirements

- Every protected endpoint requires a valid Keycloak access token.
- Every protected endpoint declares required permission or ownership policy.
- Member self-service endpoints derive member id from the linked token subject.
- Staff/admin endpoints reject member identities.
- Admin endpoints require admin permissions, not merely an authenticated staff identity.

## Error Semantics

- Missing, expired, invalid, wrong-issuer, or wrong-audience token: `401 Unauthorized`.
- Valid token with no linked local account: `403 Forbidden` or onboarding-specific denial.
- Authenticated but insufficient permission: `403 Forbidden`.
- Member token on staff/admin endpoint: `403 Forbidden`.
- Sign-in failures are handled by Keycloak and must not leak through API logs.

## Token Claim Mapping

Required or expected Keycloak claims:

- `iss`
- `sub`
- `aud`
- `exp`
- `iat`
- `azp`
- `scope`
- realm roles, client roles, or groups for `member`, `staff`, and `admin`

NestJS maps these claims to the permission names documented in [authorization-matrix.md](authorization-matrix.md).

## Security Events

The API records local events for:

- authorization denied
- identity link created/changed
- role/permission mapping changes
- account status changes
- protected resource access denied by ownership policy

Keycloak remains the source for primary login/session events. If the implementation synchronizes Keycloak events into MongoDB, synced records must exclude passwords, raw tokens, token hashes, and full sensitive payloads.
