# Data Model: Authentication, Roles, and Permissions

## Document Ownership Summary

Authentication uses existing account aggregates where credentials are read with the account:

- Staff/admin credentials and role assignments are owned by `StaffUser`.
- Member credentials are owned by `Member` because member self-service identity, membership status, and borrowing access are read together.
- The **Member Authentication Link** is embedded on `Member`; it is not a separate collection.
- Normalized sign-in identifier ownership is stored in `AuthIdentifier`, a credential-free uniqueness registry referencing exactly one staff or member account context.
- Multi-reservation mutations are coordinated by `AuthIdentifierOperation`, which provides one idempotency and recovery boundary for all affected reservations and account aggregates.
- Authorization codes, refresh-token records, clients, and security events are separate documents because they expire, grow independently, or need audit pagination.
- Optional future IdP link fields are allowed so Keycloak can later become the token issuer without changing library authorization.
- The shared sign-in flow resolves a submitted identifier against staff/admin and member account aggregates, but v1 does not introduce a separate global user collection.

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
- `authVersion`: increments when sessions should be invalidated
- `identityProvider`: optional future external IdP name, for example `keycloak`
- `identitySubject`: optional future external IdP subject
- `identityLinkedAt`
- audit fields: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

**Validation**

- Email must be normalized and unique.
- Email must have an active `AuthIdentifier` reservation before it becomes usable for shared sign-in.
- Password hash must never be returned in response DTOs.
- Active sign-in requires active status and valid password verification.
- Protected staff access requires active status and a token subject that maps to the account.
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
- `authVersion`: increments when sessions should be invalidated
- `identityProvider`: optional future external IdP name, for example `keycloak`
- `identitySubject`: optional future external IdP subject
- `identityLinkedAt`
- `status`: membership lifecycle status
- `membershipTypeId`
- `activeLoanCount`
- audit fields

**Validation**

- Member self-service sign-in requires active membership status, active auth status, configured login identifier, and valid password verification.
- Every enabled member sign-in identifier must have an active `AuthIdentifier` reservation before it becomes usable for shared sign-in.
- Suspended/inactive/deleted members cannot retain active member access.
- Member protected reads must use authenticated member id, not user-submitted member id.

**Indexes**

- Unique `{ memberNumber: 1 }`
- Sparse unique `{ email: 1 }`
- Sparse unique `{ loginIdentifier: 1 }`
- Sparse unique `{ identityProvider: 1, identitySubject: 1 }`
- `{ status: 1, membershipTypeId: 1 }`
- `{ authStatus: 1 }`

## AuthIdentifier

Provides atomic normalized identifier ownership across the separate `StaffUser` and `Member` collections without becoming a global user table.

**Fields**

- `_id`
- `normalizedIdentifier`: canonical lower-cased/trimmed sign-in identifier
- `identifierType`: `email`, `member-number`, or `login-identifier`
- `subjectType`: `staff` or `member`
- `subjectId`: owning account id
- `status`: `pending`, `active`, `released`, or `conflict`
- `conflictingSubjects`: present only for a legacy conflict; safe `{ subjectType, subjectId }` references requiring administrator resolution
- `pendingOperationId`: operation currently coordinating this reservation
- `lastOperationId`: most recently completed operation that changed this reservation
- `pendingAction`: `claim`, `replace`, `release`, or `resolve-conflict` while status is `pending`
- `releasedAt`
- audit fields: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

**Validation and Write Strategy**

- Exactly one active account context may own a normalized identifier.
- Account creation or identifier change reserves the new identifier before enabling it for sign-in.
- In transaction-capable deployments, reservation, aggregate update, and old-identifier release occur in one MongoDB transaction.
- Without transaction support, the unique reservation insert is the commit point; a failed aggregate update must release the new reservation, and the old reservation remains active until the aggregate update succeeds.
- A pending reservation blocks sign-in and competing claims; it must never be removed automatically by a TTL index.
- Reservation mutations are idempotent through the referenced `AuthIdentifierOperation`.
- After an operation lease expires, reconciliation compares every affected reservation with its account aggregate: finalize `active` when the aggregate contains the assigned identifier, otherwise compensate or leave the operation safely recoverable.
- Reconciliation must be safe to repeat and must record a redacted security event.
- Concurrent staff/member claims for the same identifier must yield one successful unique insert and one conflict response.
- Released identifiers are not accepted for sign-in and may be reclaimed only through the account-management workflow.
- The registry stores no password hashes, roles, profile attributes, token values, or borrowing data.

**Indexes**

- Unique `{ normalizedIdentifier: 1 }`
- `{ subjectType: 1, subjectId: 1, status: 1 }`
- `{ status: 1, updatedAt: -1 }`
- Sparse `{ pendingOperationId: 1, status: 1 }`
- Sparse `{ lastOperationId: 1 }`

**Administrator Conflict Resolution**

- Migration records one `conflict` reservation containing safe subject references for administrator review without activating either conflicting account for that identifier.
- Conflict review exposes account ids, subject types, normalized identifier, and safe display labels only.
- Resolution must account for every conflicting subject, may retain the original identifier for at most one explicitly selected subject, and must assign unique replacements to every other subject.
- If no subject retains the original identifier, the original conflict reservation becomes `released`.
- The system must validate and reserve every replacement before changing account aggregates, complete all changes atomically or leave the conflict unchanged, and return the original result when the same `operationId` is retried.
- The system must never choose a retained subject automatically.
- Resolution and failed attempts are recorded as security activity without passwords or conflicting credential data.

## AuthIdentifierOperation

Coordinates one identifier mutation that may affect several reservations and account aggregates.

**Fields**

- `_id`
- `operationId`: client- or server-generated idempotency key
- `operationType`: `claim`, `replace`, `release`, or `resolve-conflict`
- `status`: `pending`, `applying`, `completed`, `compensating`, or `failed`
- `assignments`: bounded safe entries containing subject reference, source identifier correlation hash when applicable, target normalized identifier correlation hash, and intended action
- `retainedSubject`: optional safe subject reference for conflict resolution
- `result`: redacted completion summary returned for idempotent retries
- `leaseOwner`: application instance currently reconciling the operation
- `leaseExpiresAt`
- `requestedBy`: safe actor reference
- `createdAt`, `updatedAt`, `completedAt`

**Validation and Recovery Strategy**

- `operationId` is globally unique and one operation may reference many `AuthIdentifier` documents.
- In transaction-capable deployments, apply operation, reservation, and aggregate changes in one MongoDB transaction.
- Without transactions, create the durable operation first, move affected reservations to `pending`, apply assignments idempotently, and keep every ambiguous identifier blocked until the operation is complete.
- A failed saga compensates completed steps when safe or remains recoverable; it must not silently enable partial ownership.
- Repeating a completed `operationId` returns the stored redacted result.
- Reconciliation acquires an expired operation lease with one atomic `findOneAndUpdate`; only the lease owner may process that operation.
- Reconciliation runs once at startup and on the configured schedule in bounded batches.
- `AUTH_IDENTIFIER_LEASE_SECONDS` defaults to 300, accepts 30-3600, and uses a 5-second clock-skew tolerance.
- `AUTH_IDENTIFIER_RECONCILIATION_INTERVAL_SECONDS` defaults to 60 and `AUTH_IDENTIFIER_RECONCILIATION_BATCH_SIZE` defaults to 100.
- Lease acquisition/comparison uses MongoDB server-side time where practical; an active worker renews before one-third of the lease duration remains, and no worker may reclaim a non-expired lease.

**Indexes**

- Unique `{ operationId: 1 }`
- `{ status: 1, leaseExpiresAt: 1 }`
- `{ leaseOwner: 1, leaseExpiresAt: 1 }`
- `{ createdAt: -1 }`

## AuthClient

Represents a first-party client allowed to receive tokens. This keeps the local model OIDC-friendly and provides a migration path if Keycloak later owns clients.

**Fields**

- `_id`
- `clientId`: public identifier
- `displayName`
- `type`: `public` for browser SPA or `confidential` for server-side clients
- `redirectUris`: exact allowed redirect URIs if authorization-code flow is enabled
- `postLogoutRedirectUris`: exact allowed post-logout redirect URIs
- `allowedScopes`: approved scopes
- `status`: `active` or `inactive`
- `createdAt`, `updatedAt`

**Validation**

- Redirect URIs must be exact registered URIs.
- Public browser clients must require PKCE with S256 if authorization-code flow is implemented.
- Inactive clients cannot receive tokens.

**Indexes**

- Unique `{ clientId: 1 }`
- `{ status: 1 }`

## AuthorizationCode

Optional short-lived, one-time-use document for a local authorization-code-with-PKCE flow. If the initial UI keeps direct login endpoints, this document can be deferred.

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
- `eventType`: `sign-in-success`, `sign-in-failure`, `authorization-denied`, `role-changed`, `account-status-changed`, `identifier-conflict-detected`, `identifier-conflict-resolved`, `identifier-reservation-recovered`, `token-refreshed`, `refresh-replay-detected`, `token-revoked`, `sign-out`
- `actorType`: `staff`, `member`, `system`, or `unknown`
- `actorId`
- `targetType`
- `targetId`
- `clientId`
- `subjectType`
- `subjectId`
- `outcome`: `success`, `failure`, or `denied`
- `reasonCategory`
- `identifierCorrelationHash`: optional versioned HMAC output for safe sign-in/conflict correlation
- `correlationKeyVersion`: required when identifier correlation hash is present
- `operationId`: optional identifier-operation id for conflict/recovery audit correlation
- `requestId`
- `ipHash`
- `userAgentHash`
- `createdAt`

**Validation**

- Do not store passwords, raw tokens, token hashes, full request bodies, or protected response bodies.
- Failed sign-in may include normalized identifier only when needed for audit and rate-limit correlation.
- Ambiguous shared sign-in resolution must be recorded as a sign-in failure reason category without revealing the conflicting account ids to the user.
- Identifier conflict events store only `HMAC-SHA-256(normalizedIdentifier, AUTH_AUDIT_CORRELATION_SECRET)`, `correlationKeyVersion`, safe subject references, conflict count, outcome, and reason category; raw conflicting identifiers and ordinary unkeyed hashes are excluded. New events use `AUTH_AUDIT_CORRELATION_KEY_VERSION`; optional previous version-to-secret mappings remain available only for authorized correlation during rotation.
- Identifier reservation recovery records the operation id, resulting state, outcome, and reason category without raw identifiers.

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

### Authentication Identifier Reservation

```text
none -> pending -> active
pending -> released
active -> released
none -> conflict
conflict -> pending -> active
conflict -> pending -> released
```

- `pending` is never accepted for sign-in and blocks competing claims.
- Conflict resolution transitions through `pending` and changes every affected reservation/aggregate under one `AuthIdentifierOperation`.
- Lease expiry triggers reconciliation, not deletion.
- Reconciliation finalizes the state represented by the account aggregates, compensates safe partial steps, or leaves the operation recoverable.

## Future Keycloak Migration

When Keycloak becomes justified, use the existing optional identity link fields to map Keycloak `sub` values to `StaffUser` and `Member`. `AuthIdentifier` remains a local account-link and migration aid but is no longer the login authority after external subjects are fully linked. Keep local role-to-permission mapping and member ownership checks in NestJS. Stop issuing local access/refresh tokens only after the API can validate Keycloak issuer, audience, JWKS, and role/group claims at the same guard boundary.

## Migration Impact

- Add missing `passwordUpdatedAt`, `authVersion`, optional identity link fields, and refresh-token/session documents.
- Create `AuthIdentifier` with a unique normalized-identifier index and backfill reservations from staff/member identifiers.
- Create `AuthIdentifierOperation` with unique operation ids and lease/reconciliation indexes.
- Abort automatic activation for duplicate legacy identifiers, emit a conflict report for administrator resolution, and never choose a winning account silently.
- Preserve borrowing records, staff action history, and security events during backfill, account identifier correction, role changes, deactivation, and rollback.
- Rollback removes only identifier reservations created by this migration after verifying account aggregates still own their original identifiers; it must not delete or rewrite account, borrowing, or audit history.
- Add collections and indexes for auth clients, optional authorization codes, refresh-token families, and security events.
- Seed one first-party client with exact redirect URIs for local development and deployment if the authorization-code flow is implemented.
- Seed or define approved roles and permission mappings.
- Add a shared sign-in resolver that resolves active reservations to existing staff/member account aggregates and rejects missing, released, or legacy-ambiguous identifiers generically.
- Preserve existing staff/member login endpoints only as compatibility wrappers if routes change; the frontend sign-in experience must use the shared flow and the security behavior must still use the new session/token services.
