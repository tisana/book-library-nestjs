# Data Model: Authentication, Roles, and Permissions

## Document Ownership Summary

Authentication uses existing account aggregates where credentials are read with the account:

- Staff/admin credentials and role assignments are owned by `StaffUser`.
- Member credentials are owned by `Member` because member self-service identity, membership status, and borrowing access are read together.
- Authorization codes, refresh-token records, clients, and security events are separate documents because they expire, grow independently, or need audit pagination.

## StaffUser

Existing document extended as needed.

**Fields**

- `_id`
- `email`: unique normalized staff login identifier
- `displayName`
- `passwordHash`: selected only for credential verification
- `roles`: approved role names such as `staff` or `admin`
- `status`: `active`, `suspended`, or `inactive`
- `lastLoginAt`
- `passwordUpdatedAt`
- `tokenVersion` or `authVersion`: increments when sessions should be invalidated
- audit fields: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

**Validation**

- Email must be normalized and unique.
- Password hash must never be returned in response DTOs.
- Active sign-in requires active status and valid password verification.
- Role assignments must be from the approved role list.

**Indexes**

- Unique `{ email: 1 }`
- `{ status: 1, roles: 1 }`
- Optional `{ updatedAt: -1 }` for admin lists

## Member

Existing document already contains member authentication fields.

**Fields**

- `_id`
- `memberNumber`: unique library member identifier
- `email`: optional unique normalized email
- `loginIdentifier`: optional unique normalized member login identifier
- `passwordHash`: selected only for credential verification
- `passwordUpdatedAt`
- `lastLoginAt`
- `authStatus`: `active`, `locked`, or `reset-required`
- `status`: membership lifecycle status
- `membershipTypeId`
- `activeLoanCount`
- audit fields

**Validation**

- Member self-service sign-in requires active membership status, active auth status, configured login identifier, and valid password verification.
- Suspended/inactive/deleted members cannot retain active member access.
- Member protected reads must use authenticated member id, not user-submitted member id.

**Indexes**

- Unique `{ memberNumber: 1 }`
- Sparse unique `{ email: 1 }`
- Sparse unique `{ loginIdentifier: 1 }`
- `{ status: 1, membershipTypeId: 1 }`
- `{ authStatus: 1 }`

## AuthClient

Represents an OAuth2/OIDC client allowed to start authorization flows.

**Fields**

- `_id`
- `clientId`: public identifier
- `displayName`
- `type`: `public` for browser SPA or `confidential` for server-side clients
- `redirectUris`: exact allowed redirect URIs
- `postLogoutRedirectUris`: exact allowed post-logout redirect URIs
- `allowedScopes`: approved scopes
- `status`: `active` or `inactive`
- `createdAt`, `updatedAt`

**Validation**

- Redirect URIs must be exact registered URIs.
- Public browser clients must require PKCE with S256.
- Inactive clients cannot start authorization or token flows.

**Indexes**

- Unique `{ clientId: 1 }`
- `{ status: 1 }`

## AuthorizationCode

Short-lived, one-time-use document for the authorization code flow.

**Fields**

- `_id`
- `codeHash`: hash of the authorization code
- `clientId`
- `subjectType`: `staff` or `member`
- `subjectId`
- `redirectUri`
- `codeChallenge`
- `codeChallengeMethod`: `S256`
- `scopes`
- `nonce`
- `stateHash` when server-side state binding is used
- `expiresAt`
- `usedAt`
- `createdAt`

**Validation**

- Code must expire quickly.
- Code may be used once.
- Token exchange must match client id, redirect URI, and PKCE verifier.

**Indexes**

- Unique `{ codeHash: 1 }`
- TTL `{ expiresAt: 1 }`
- `{ clientId: 1, subjectId: 1, createdAt: -1 }`

## RefreshTokenFamily

Tracks refresh-token rotation and replay response.

**Fields**

- `_id`
- `familyId`
- `clientId`
- `subjectType`: `staff` or `member`
- `subjectId`
- `scopes`
- `status`: `active`, `revoked`, or `replayed`
- `currentTokenHash`
- `previousTokenHash`
- `issuedAt`
- `lastRotatedAt`
- `expiresAt`
- `revokedAt`
- `revokedReason`
- `createdAt`, `updatedAt`

**Validation**

- Store hashes only, never raw refresh tokens.
- Refresh success rotates to a new hash and invalidates the previous hash.
- Reuse of an invalidated token marks the family as replayed and revokes active refresh access.

**Indexes**

- Unique `{ familyId: 1 }`
- Unique sparse `{ currentTokenHash: 1 }`
- `{ subjectType: 1, subjectId: 1, status: 1 }`
- TTL `{ expiresAt: 1 }`

## RoleDefinition

May be code-owned reference data in v1. Use a collection only if admin screens must display editable role metadata without deployment.

**Fields**

- `role`
- `displayName`
- `description`
- `permissions`
- `status`
- `updatedAt`

**Validation**

- Permissions must be from the approved permission enum.
- Administrator permission cannot be granted by non-admin users.

**Indexes**

- Unique `{ role: 1 }`
- `{ status: 1 }`

## SecurityActivityEvent

Append-only security event record for audit review.

**Fields**

- `_id`
- `eventType`: `sign-in-success`, `sign-in-failure`, `authorization-denied`, `role-changed`, `account-status-changed`, `token-refreshed`, `refresh-replay-detected`, `token-revoked`, `sign-out`
- `actorType`: `staff`, `member`, `system`, or `unknown`
- `actorId`
- `targetType`
- `targetId`
- `clientId`
- `subjectType`
- `subjectId`
- `outcome`: `success`, `failure`, or `denied`
- `reasonCategory`
- `requestId`
- `ipHash`
- `userAgentHash`
- `createdAt`

**Validation**

- Do not store passwords, raw tokens, token hashes, full request bodies, or protected response bodies.
- Failed sign-in may include normalized identifier only when needed for audit and rate-limit correlation.

**Indexes**

- `{ createdAt: -1 }`
- `{ eventType: 1, createdAt: -1 }`
- `{ actorType: 1, actorId: 1, createdAt: -1 }`
- `{ subjectType: 1, subjectId: 1, createdAt: -1 }`

## State Transitions

### Account Status

```text
active -> suspended -> active
active -> inactive
suspended -> inactive
```

- Suspended or inactive accounts cannot sign in or refresh tokens.
- Moving to suspended/inactive revokes active refresh-token families.

### Member Auth Status

```text
active -> locked -> active
active -> reset-required -> active
locked -> reset-required
```

- Locked and reset-required members cannot complete normal sign-in.
- Unlock/reset actions are admin/staff permissions and must be audited.

### Refresh Token Family

```text
active -> revoked
active -> replayed
replayed -> revoked
```

- Replay detection is terminal for active use.
- Revocation can be triggered by sign-out, account deactivation, password change, or admin action.

## Migration Impact

- Add missing `passwordUpdatedAt` and token invalidation fields to staff/member account documents.
- Add collections and indexes for auth clients, authorization codes, refresh-token families, and security events.
- Seed one first-party web client with exact redirect URIs for local development and deployment.
- Seed or define approved roles and permission mappings.
- Keep existing staff/member login endpoints temporarily as compatibility wrappers only if needed by frontend migration; new implementation should route through the standards-aligned flow.
