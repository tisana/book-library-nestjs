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

Provides index-enforced normalized identifier ownership across the separate `StaffUser` and `Member` collections without becoming a global user table.

**Fields**

- `_id`
- `normalizedIdentifier`: canonical lower-cased/trimmed sign-in identifier
- `identifierType`: `email`, `member-number`, or `login-identifier`
- `subjectType`: `staff` or `member`
- `subjectId`: owning account id
- `status`: `pending`, `active`, `released`, or `conflict`
- `conflictingSubjects`: present only for a legacy conflict; safe `{ subjectType, subjectId }` references requiring administrator resolution
- `conflictResolutionStatus`: `reviewable` or `manual-repair-required` when status is `conflict`
- `pendingOperationId`: operation currently coordinating this reservation
- `activationGateOperationId`: optional completed parent offline-repair operation that must be checked before an otherwise active reservation can authenticate
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
- An active reservation with `activationGateOperationId` remains blocked unless the referenced parent operation is `completed`; a missing, expired, non-terminal, or failed parent fails closed. Reconciliation removes gates in bounded batches only after parent completion, and the parent cannot receive `expiresAt` until gate cleanup completes.
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
- Sparse `{ activationGateOperationId: 1, status: 1 }`
- Sparse `{ lastOperationId: 1 }`

**Administrator Conflict Resolution**

- Migration records one `conflict` reservation containing safe subject references for administrator review without activating either conflicting account for that identifier.
- Conflict review exposes account ids, subject types, normalized identifier, and safe display labels only.
- Resolution must account for every conflicting subject, may retain the original identifier for at most one explicitly selected subject, and must assign unique replacements to every other subject.
- If no subject retains the original identifier, the original conflict reservation becomes `released`.
- The system must validate and reserve every replacement before changing account aggregates, use a transaction or recoverable saga, keep ambiguity blocked through partial progress, and return the original result when the same retained `operationId` is retried.
- The system must never choose a retained subject automatically.
- Normal API resolution rejects requests above `AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS` with `422 Unprocessable Entity`.
- Migration marks oversized legacy conflicts `manual-repair-required`; they remain blocked and require the authorized offline repair workflow.
- Resolution and failed attempts are recorded as security activity without passwords or conflicting credential data.

## AuthIdentifierOperation

Coordinates one identifier mutation that may affect several reservations and account aggregates.

**Fields**

- `_id`
- `operationId`: client- or server-generated idempotency key
- `operationType`: `claim`, `replace`, `release`, `resolve-conflict`, or `offline-repair`
- `status`: `pending`, `applying`, `compensating`, `finalizing`, `failed-retryable`, `completed`, or `failed-terminal`
- `assignments`: bounded entries containing `assignmentId`, subject reference, action (`retain`, `claim`, `replace`, or `release`), `sourceReservationId`, `targetReservationId`, identifier correlation hash/key version, status (`pending`, `applied`, or `compensated`), and `appliedAt`
- `manifestHash`: optional canonical versioned HMAC of the complete reviewed offline-repair mapping, stored on the parent operation
- `manifestKeyVersion`: audit-correlation key version used to derive the manifest HMAC key
- `retainedSubject`: optional safe subject reference for conflict resolution
- `result`: redacted terminal summary including outcome, safe reason category, and original HTTP status returned for idempotent retries
- `leaseOwner`: application instance currently reconciling the operation
- `leaseExpiresAt`
- `terminalEventId`: deterministic security-event id derived from operation id and terminal outcome
- `terminalEventRecordedAt`
- `cleanupStatus`: `not-required`, `pending`, or `completed`
- `expiresAt`: set only for `completed` or `failed-terminal` operations
- `requestedBy`: safe actor reference
- `lastResumedBy`: optional safe actor reference for the most recent different or repeated authorized resume
- `lastResumedAt`
- `createdAt`, `updatedAt`, `completedAt`

**Validation and Recovery Strategy**

- `operationId` is globally unique and one operation may reference many `AuthIdentifier` documents.
- In transaction-capable deployments, apply operation, reservation, and aggregate changes in one MongoDB transaction.
- Without transactions, create the durable operation first, move affected reservations to `pending`, apply assignments idempotently, and keep every ambiguous identifier blocked until the operation is complete.
- Replacement identifiers are recovered from referenced pending `AuthIdentifier` documents; operation HMAC fields are never reversed or treated as identifier values.
- Saga creation order is operation shell, pending reservations with `pendingOperationId`, assignment reservation references, account updates, reservation activation, then operation completion.
- If a crash occurs before assignment references are stored, reconciliation discovers reservations by `pendingOperationId` and attaches them idempotently.
- A recoverable failure enters `failed-retryable`; reconciliation may return it to `applying` or `compensating`, and it must not silently enable partial ownership.
- `finalizing` means identifier and aggregate changes have reached their intended or safely compensated state, but the permanent terminal security event has not yet been durably recorded.
- In transaction-capable deployments, the security-event insert and transition from `finalizing` to `completed` or `failed-terminal` occur in one transaction.
- Without transactions, reconciliation writes the event idempotently using `terminalEventId`, then atomically sets `terminalEventRecordedAt` and terminal status. It sets `expiresAt` in that write only when cleanup is not required; otherwise bounded cleanup sets `expiresAt` after `cleanupStatus` becomes `completed`. TTL eligibility must never precede durable event persistence or required cleanup.
- Repeating a retained `completed` operation returns the stored redacted success and original HTTP status without re-execution. Repeating a retained `failed-terminal` operation returns the stored redacted failure and original HTTP status without re-execution. After terminal expiry, callers must use a new operation id.
- Reconciliation acquires an expired operation lease with one atomic `findOneAndUpdate`; only the lease owner may process that operation.
- Reconciliation runs once at startup and on the configured schedule in bounded batches.
- `AUTH_IDENTIFIER_LEASE_SECONDS` defaults to 300, accepts 30-3600, and uses a 5-second clock-skew tolerance.
- `AUTH_IDENTIFIER_RECONCILIATION_INTERVAL_SECONDS` defaults to 60 and `AUTH_IDENTIFIER_RECONCILIATION_BATCH_SIZE` defaults to 100.
- `AUTH_IDENTIFIER_OPERATION_RETENTION_DAYS` defaults to 90 and accepts 7-365; completion-result idempotency is guaranteed only within that retention window.
- `AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS` defaults to 20 and accepts 2-100.
- Lease acquisition/comparison uses MongoDB server-side time where practical; an active worker renews before one-third of the lease duration remains, and no worker may reclaim a non-expired lease.
- Reconciliation ignores `completed` and `failed-terminal` only when `cleanupStatus` is not `pending`. Terminal expiry removes operation/idempotency state only after `terminalEventId`, `terminalEventRecordedAt`, and completed required cleanup prove that permanent audit and gate cleanup are durable.

**Offline Repair Key Policy, Authorization, and Batching**

- `AuthIdentifierRepairKeyPolicyService` is the single owner of indexed required-version queries, missing-key readiness evaluation, worker allow/deny decisions, and rotation preflight. Reconciliation, health readiness, and `AuthIdentifierRepairService` consume this service rather than implementing independent key-policy queries.
- Rotation preflight computes the candidate previous-key map after promoting the current key and unions it with versions referenced by `pending`, `applying`, `compensating`, `finalizing`, `failed-retryable`, or cleanup-pending repairs. If more than two previous versions are required, it rejects the rotation as `repair-key-rotation-blocked` before configuration changes and returns only required version numbers and count.
- `AuthIdentifierRepairAuthorizationService` owns token and current-account authorization revalidation. `AuthIdentifierRepairService` owns manifest verification, parent/batch state transitions, compensation, activation gates, parent completion, audit, and cleanup. The CLI is a thin adapter for stdin token/input parsing, confirmation, service invocation, redacted output, and exit codes.
- The CLI accepts a short-lived access token only through standard input and never accepts an actor-id override or logs the token. Before dry-run data access and before every mutating batch or parent-completion transaction, the service validates signature, issuer, audience, expiry, active account status, `authVersion`, administrator role area, and `auth-identifiers:manage`.
- If authorization expires or changes between batches, the current batch is not started and the repair remains safely resumable. A later invocation may use another authorized administrator: `requestedBy` remains the original actor, `lastResumedBy`/`lastResumedAt` record the current actor, and an `identifier-repair-resumed` event is written without token or identifier data. Authorization failures return no conflict details.
- Dry run creates one parent `offline-repair` operation in `pending`. It canonicalizes `{ conflictId, retainedSubject, reassignments }` as UTF-8 RFC 8785 JSON after identifier normalization and sorting reassignments by `subjectType` then `subjectId`. It derives a 32-byte key with HKDF-SHA-256 using the audit-correlation secret as IKM, UTF-8 salt `book-library/auth-identifier-repair-manifest/v1`, info `key-version:<manifestKeyVersion>`, and output length 32; it then stores `manifestHash = base64url(HMAC-SHA-256(derivedKey, canonicalJson))` and `manifestKeyVersion`. Published deterministic test vectors define canonical bytes, derived key, and final HMAC.
- Deterministic vector: key version `7`; IKM base64url `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8`; canonical UTF-8 JSON `{"conflictId":"conflict-001","reassignments":[{"newIdentifier":"member.new@example.com","subjectId":"member-001","subjectType":"member"}],"retainedSubject":{"subjectId":"staff-001","subjectType":"staff"}}`; derived key base64url `mWdLVTX6hitMZ4E7rjsVHqUliKHvF1nNhlt1uNYGOn4`; manifest HMAC base64url `Zdp_WIBI_lfYpBPJhebXfWQxwyvuOqsiX4EJOF72fok`.
- Confirmed apply recomputes the HMAC with the persisted current or previous key version, uses constant-time comparison, and atomically moves the parent from `pending` to `applying` before creating batches. A mapping difference fails closed and requires a new repair id and dry run.
- A key version cannot be removed while any `pending`, `applying`, `compensating`, `finalizing`, `failed-retryable`, or cleanup-pending repair references it. Startup reconciliation and `/health/ready` report `repair-key-required` if a referenced version is unavailable; workers leave data unchanged until the key is restored. No key rebinding is allowed.
- Each `AuthIdentifierRepairBatch` contains no more than `AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS`, creates replacement reservations as `pending`, updates account aggregates idempotently, and records its checkpoint. The original conflict and all replacement reservations remain blocked while preparation is incomplete.
- After every batch is prepared, bounded activation passes mark replacement reservations `active` with `activationGateOperationId` still referencing the parent. Sign-in remains blocked because the parent is not completed.
- When every batch is `activated`, the service atomically moves the parent from `applying` to `finalizing`. One bounded transaction then resolves or releases the single original conflict reservation, inserts the parent's terminal security event, and moves the parent from `finalizing` to `completed` with `cleanupStatus: pending`. This one-document parent transition logically unlocks every gated reservation without an unbounded transaction.
- A retryable preparation/activation failure moves `applying -> failed-retryable -> applying`; cancellation moves `applying | failed-retryable -> compensating`, compensates prepared/activated batches in reverse order, then moves `compensating -> finalizing -> failed-terminal` while leaving the original conflict blocked as `manual-repair-required`.
- Reconciliation removes `activationGateOperationId` and expires repair-batch documents in bounded batches, then marks parent cleanup completed and sets parent `expiresAt`. It does not change a repair whose manifest key is unavailable. A failed batch resumes from its unique checkpoint.

**Indexes**

- Unique `{ operationId: 1 }`
- Unique sparse `{ terminalEventId: 1 }`
- Partial `{ operationType: 1, status: 1, cleanupStatus: 1, manifestKeyVersion: 1 }` for documents where `operationType` is `offline-repair` and `manifestKeyVersion` exists; readiness, reconciliation, and rotation preflight must use this index to enumerate non-terminal or cleanup-pending required key versions without a collection scan
- `{ status: 1, leaseExpiresAt: 1 }`
- `{ leaseOwner: 1, leaseExpiresAt: 1 }`
- `{ createdAt: -1 }`
- TTL `{ expiresAt: 1 }`; non-terminal operations omit `expiresAt`

## AuthIdentifierRepairBatch

Stores bounded, resumable offline-repair work without giving batch documents the lifecycle or permanent-audit semantics of `AuthIdentifierOperation`.

**Fields**

- `_id`
- `parentOperationId`: parent offline-repair operation id
- `batchNumber`, `batchCount`
- `status`: `pending`, `prepared`, `activated`, or `compensated`
- `assignments`: bounded reservation-reference entries using the same assignment shape and configured maximum as online operations
- `checkpointHash`: HMAC of canonical batch assignment references for retry validation, using the same parent `manifestKeyVersion` and purpose-separated repair-manifest key
- `preparedAt`, `activatedAt`, `compensatedAt`
- `expiresAt`: set only after parent cleanup makes the batch disposable
- `createdAt`, `updatedAt`

**Validation and Indexes**

- A batch belongs to exactly one `offline-repair` parent and never emits its own terminal security event; the parent is the idempotency, authorization, and permanent-audit boundary.
- Batch transitions are `pending -> prepared -> activated` or `pending | prepared | activated -> compensated`; every transition is idempotent.
- Unique `{ parentOperationId: 1, batchNumber: 1 }` prevents duplicate checkpoints during retries.
- `{ parentOperationId: 1, status: 1 }` supports bounded preparation, activation, compensation, and cleanup.
- TTL `{ expiresAt: 1 }`; batches omit `expiresAt` until parent cleanup.

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
- `eventId`: optional deterministic idempotency key for operation terminal events
- `eventType`: `sign-in-success`, `sign-in-failure`, `authorization-denied`, `role-changed`, `account-status-changed`, `identifier-conflict-detected`, `identifier-conflict-resolved`, `identifier-reservation-recovered`, `identifier-repair-resumed`, `token-refreshed`, `refresh-replay-detected`, `token-revoked`, `sign-out`
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
- Failed sign-in and rate-limit correlation must use versioned HMAC-SHA-256 identifier correlation; raw or normalized sign-in identifiers are never stored in security activity.
- Ambiguous shared sign-in resolution must be recorded as a sign-in failure reason category without revealing the conflicting account ids to the user.
- Identifier conflict events store only `HMAC-SHA-256(normalizedIdentifier, AUTH_AUDIT_CORRELATION_SECRET)`, `correlationKeyVersion`, safe subject references, conflict count, outcome, and reason category; raw conflicting identifiers and ordinary unkeyed hashes are excluded. New events use `AUTH_AUDIT_CORRELATION_KEY_VERSION`; optional previous version-to-secret mappings remain available only for authorized correlation during rotation.
- Identifier reservation recovery records the operation id, resulting state, outcome, and reason category without raw identifiers.
- Operation terminal events use the operation's deterministic `terminalEventId` as `eventId`; duplicate inserts are idempotent and cannot create duplicate permanent audit records.

**Indexes**

- `{ createdAt: -1 }`
- Unique sparse `{ eventId: 1 }`
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
- Operation transitions are `pending -> applying`, `applying -> finalizing | compensating | failed-retryable`, `compensating -> finalizing | failed-retryable`, `failed-retryable -> applying | compensating`, and `finalizing -> completed | failed-terminal`.
- Only `completed` and `failed-terminal` are terminal and receive `expiresAt`; after expiry, clients must submit a new operation id while security activity preserves the audit record.

## Future Keycloak Migration

When Keycloak becomes justified, use the existing optional identity link fields to map Keycloak `sub` values to `StaffUser` and `Member`. `AuthIdentifier` remains a local account-link and migration aid but is no longer the login authority after external subjects are fully linked. Keep local role-to-permission mapping and member ownership checks in NestJS. Stop issuing local access/refresh tokens only after the API can validate Keycloak issuer, audience, JWKS, and role/group claims at the same guard boundary.

## Migration Impact

- Add missing `passwordUpdatedAt`, `authVersion`, optional identity link fields, and refresh-token/session documents.
- Create `AuthIdentifier` with a unique normalized-identifier index and backfill reservations from staff/member identifiers.
- Create `AuthIdentifierOperation` with unique operation ids, cleanup state, terminal-event, lease/reconciliation indexes, and the partial compound repair-key-policy index used by readiness, workers, and rotation preflight.
- Create `AuthIdentifierRepairBatch` with unique parent-operation/batch-number checkpoints, parent/status access, and post-cleanup TTL indexes; add `AuthIdentifier.activationGateOperationId` lookup support.
- Add terminal-operation TTL retention only after permanent audit and required gate cleanup, and quarantine oversized legacy conflicts as `manual-repair-required` without enabling authentication.
- Abort automatic activation for duplicate legacy identifiers, emit a conflict report for administrator resolution, and never choose a winning account silently.
- Preserve borrowing records, staff action history, and security events during backfill, account identifier correction, role changes, deactivation, and rollback.
- Rollback removes only identifier reservations created by this migration after verifying account aggregates still own their original identifiers; it must not delete or rewrite account, borrowing, or audit history.
- Add collections and indexes for auth clients, optional authorization codes, refresh-token families, and security events.
- Seed one first-party client with exact redirect URIs for local development and deployment if the authorization-code flow is implemented.
- Seed or define approved roles and permission mappings.
- Add a shared sign-in resolver that resolves active reservations to existing staff/member account aggregates and rejects missing, released, or legacy-ambiguous identifiers generically.
- Preserve existing staff/member login endpoints only as compatibility wrappers if routes change; the frontend sign-in experience must use the shared flow and the security behavior must still use the new session/token services.
