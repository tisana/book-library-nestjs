# Data Model: Authentication, Roles, and Permissions

## Document Ownership Summary

Revised planning decision: Keycloak owns production credentials, login sessions, OAuth/OIDC clients, authorization codes, refresh tokens, and protocol metadata. MongoDB owns library domain profiles, IdP links, local permission mapping, and security activity summaries.

- Staff/admin profile and application permissions are owned by `StaffUser`.
- Member profile and self-service ownership are owned by `Member`.
- Keycloak subject identifiers are linked into the relevant app document.
- Security activity events are separate documents because they grow independently and need audit pagination.

## StaffUser

Existing document extended as needed.

**Fields**

- `_id`
- `email`: unique normalized staff login identifier
- `displayName`
- `passwordHash`: selected only for credential verification
- `roles`: approved role names such as `staff` or `admin`
- `identityProvider`: `keycloak`
- `identitySubject`: Keycloak `sub` claim for this staff/admin identity
- `identityLinkedAt`
- `status`: `active`, `suspended`, or `inactive`
- `lastLoginAt`
- `passwordUpdatedAt`
- `tokenVersion` or `authVersion`: increments when sessions should be invalidated
- audit fields: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

**Validation**

- Email must be normalized and unique.
- Password hash must never be returned in response DTOs and should not be used for new production sign-ins after Keycloak migration.
- Protected staff access requires active status and a valid Keycloak subject link.
- Role assignments must be from the approved role list.

**Indexes**

- Unique `{ email: 1 }`
- Sparse unique `{ identityProvider: 1, identitySubject: 1 }`
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
- `identityProvider`: `keycloak`
- `identitySubject`: Keycloak `sub` claim for this member identity
- `identityLinkedAt`
- `status`: membership lifecycle status
- `membershipTypeId`
- `activeLoanCount`
- audit fields

**Validation**

- Member self-service access requires active membership status, active auth status, and a valid Keycloak subject link.
- Suspended/inactive/deleted members cannot retain active member access.
- Member protected reads must use authenticated member id, not user-submitted member id.

**Indexes**

- Unique `{ memberNumber: 1 }`
- Sparse unique `{ email: 1 }`
- Sparse unique `{ loginIdentifier: 1 }`
- Sparse unique `{ identityProvider: 1, identitySubject: 1 }`
- `{ status: 1, membershipTypeId: 1 }`
- `{ authStatus: 1 }`

## Keycloak Realm Configuration

Keycloak realm, clients, roles, groups, login policies, authorization code storage, refresh-token storage, and session state are not MongoDB documents in this application. They are managed by Keycloak and exported under `infra/keycloak/realm-export.json` for reproducible local/test environments.

**Required configured objects**

- Realm for the library application.
- Public browser client for the frontend using authorization code with PKCE.
- API audience/client scope for the NestJS resource server.
- Roles or groups for `member`, `staff`, and `admin`.
- Optional client scopes for library permission claims.
- Exact redirect and post-logout redirect URIs.
- Token lifespans aligned with the security plan.

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

- Add `identityProvider`, `identitySubject`, and `identityLinkedAt` fields to staff/member account documents.
- Add unique sparse indexes for identity links.
- Create a migration or admin linking process from existing staff/member records to Keycloak users.
- Stop creating new production password hashes in MongoDB after Keycloak cutover; retain legacy hashes only until migration/rollback policy allows removal.
- Add or update security activity event collection/indexes.
- Seed or export Keycloak realm/client/role configuration for local development and deployment.
- Preserve existing staff/member login endpoints only as temporary compatibility wrappers during cutover; final production sign-in should redirect to Keycloak.
