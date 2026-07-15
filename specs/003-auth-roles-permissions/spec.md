# Feature Specification: Authentication, Roles, and Permissions

**Feature Branch**: `003-auth-roles-permissions`

**Created**: 2026-07-02

**Status**: Approved

**Input**: User description: "I want to have better authentication and authorize system where I can better handling user and roles. The current in-memory solution is not secure enough to publish the application online. The authentication should be able to have clear roles and permission to access system. Eg. member should not able to access library back office or admin system."

## Clarifications

### Session 2026-07-09

- Q: Should staff and member users use separate login pages or one shared sign-in entry point? → A: Use one shared sign-in page; route after authentication by role area and permissions.

### Session 2026-07-13

- Q: What identifier context may a failed sign-in security event expose? → A: Show an opaque account reference only when the attempt safely resolves to exactly one account; otherwise show only versioned audit correlation. Never expose the submitted or normalized sign-in identifier.
- Q: What default throttling boundaries must acceptance tests enforce? → A: Shared and compatibility sign-in routes share limits of five generic failures per identifier correlation and twenty total attempts per trusted network source in fifteen minutes; every unknown, ambiguous, invalid-password, inactive, suspended, locked, or missing-credential outcome with a normalizable identifier counts, while a malformed request without one counts only against its source. Refresh is limited to thirty attempts per session family and trusted network source in five minutes. Excess requests receive the same generic retry-later outcome until the applicable window expires.
- Q: Which non-sensitive fields may audit-key rotation preflight return? → A: In addition to required key-version numbers and count, it may return fixed status, reason, and configured-capacity fields; it must not return secrets, identifiers, repair records, or infrastructure details.
- Q: How do active throttle windows survive audit-correlation key rotation? → A: Every throttle bucket records its correlation key version; requests look for an unexpired bucket under the current and configured previous versions, continue the existing bucket until expiry, and create a current-version bucket only when none exists. A referenced version remains configured until both repair and throttle references no longer require it.
- Q: How is a trusted network source established behind a proxy? → A: Configure an explicit JSON array of trusted proxy IPv4/IPv6 CIDRs. With an empty array, use the direct peer and ignore forwarding headers. With trusted proxies, resolve right-to-left and stop at the first untrusted address; reject malformed CIDRs and all-address production entries during startup.
- Q: What browser session security contract must every sign-in path follow? → A: Issue an access credential that expires within 15 minutes and a single-use rotating refresh credential whose family expires no later than 30 days after sign-in and is never extended by rotation. Keep the access credential out of persistent browser storage and keep the refresh credential out of scripts and response bodies. In production, refresh continuity uses an HTTPS-only, HTTP-only, host-only cookie restricted to authentication paths with strict same-site behavior. Every browser request that issues, uses, or clears that cookie must come from an exact configured trusted origin; reject missing, opaque, wildcard, or untrusted origins before reading or changing session state.
- Q: How must refresh rotation recover from interruption between replay-marker creation and family rotation? → A: Use a `pending` marker with a unique rotation operation id and a 30-second lease, record that id in the atomic family rotation, and mark the marker `committed` before returning credentials. An expired pending marker whose family still references the presented token may be taken over and retried; a pending marker whose operation id already committed to the family, or whose state cannot be reconciled safely, revokes the family and returns the generic denial. Reconcile at most 100 expired pending markers every 60 seconds per application instance.
- Q: What happens to refresh sessions created before complete replay-marker history exists? → A: Revoke every active legacy refresh family during the security migration and require sign-in again. Do not backfill a partial history or preserve a legacy active session while claiming any-generation replay detection.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with a persistent account (Priority: P1)

A library user signs in with a real account whose identity and role survive application restarts, so the online application no longer depends on insecure in-memory users.

**Why this priority**: Secure, persistent authentication is the foundation for publishing the application online and for enforcing every later permission rule.

**Independent Test**: Can be fully tested by creating or using a stored account, signing in, restarting the application, and confirming the same account can still sign in with the same role and access scope.

**Acceptance Scenarios**:

1. **Given** a visitor opens the sign-in experience, **When** they are not authenticated, **Then** the system presents one shared sign-in page instead of asking them to choose staff or member mode.
2. **Given** an active staff account exists, **When** the staff user signs in with valid credentials, **Then** the system authenticates the user, identifies their assigned role, and routes them to the appropriate staff or administrator landing page.
3. **Given** an active member account exists, **When** the member signs in with valid credentials, **Then** the system authenticates the member, identifies them as a member user, and routes them to member self-service.
4. **Given** a user enters invalid credentials, **When** they attempt to sign in, **Then** the system denies access without revealing whether the account identifier or secret was wrong.
5. **Given** the application restarts, **When** a previously created active account signs in again, **Then** the account, role assignments, and access scope are still available.
6. **Given** a user signs in through the browser, **When** the session is established, **Then** the short-lived access credential is available only to the active browser session and the refresh credential is unavailable to scripts, response bodies, and persistent browser storage.
7. **Given** a browser request would issue, refresh, or clear a session, **When** its origin is missing, opaque, wildcard-derived, or not explicitly trusted, **Then** the request is rejected before any refresh credential is read and before session state changes.
8. **Given** a refresh credential has already been exchanged, **When** it is presented again, **Then** the entire related session family is revoked, the attempt is recorded, and no new access is granted.
9. **Given** a signed-in user, **When** they sign out from the current session or choose to sign out from all sessions, **Then** the applicable server-side sessions are revoked and browser-held authentication state is cleared.

---

### User Story 2 - Block members from staff and admin areas (Priority: P1)

A member can access only their own self-service area and cannot reach library back office or administration workflows, even if they know or manually enter those routes.

**Why this priority**: Preventing unauthorized access to staff and admin workflows directly addresses the most important security risk in the current system.

**Independent Test**: Can be fully tested by signing in as a member and attempting to access staff catalog, borrowing management, member management, and admin role-management screens.

**Acceptance Scenarios**:

1. **Given** a signed-in member, **When** the member opens any staff back office screen, **Then** access is denied and no staff data is shown.
2. **Given** a signed-in member, **When** the member attempts a staff-only action such as creating a borrowing for another member or editing the catalog, **Then** the action is rejected.
3. **Given** a signed-in member, **When** the member opens their self-service area, **Then** they can view only their own account, membership, and borrowing information.
4. **Given** an unauthenticated visitor, **When** they open a protected member, staff, or admin area, **Then** they are asked to sign in before any protected data is shown.

---

### User Story 3 - Manage staff roles and permissions (Priority: P2)

An administrator assigns clear roles to staff users so library workers receive only the permissions needed for their responsibilities.

**Why this priority**: Role management makes authorization maintainable as the library adds staff users with different duties.

**Independent Test**: Can be fully tested by assigning one user a limited staff role and another user an administrator role, then confirming each user can perform only the actions allowed by their role.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** they create or update a staff account, **Then** they can assign one or more approved roles to that account.
2. **Given** a staff user without administrator permissions, **When** they try to manage users, roles, or permissions, **Then** the system denies the action.
3. **Given** a staff user with catalog permissions, **When** they manage books and copies, **Then** the system allows catalog actions but blocks unrelated admin-only actions.
4. **Given** a staff user changes roles, **When** they next use a protected workflow, **Then** the system applies the updated permissions.
5. **Given** legacy staff and member records claim the same normalized sign-in identifier, **When** an administrator reviews identifier conflicts, **Then** they can identify the affected account contexts and resolve the conflict by assigning a unique identifier without viewing or changing either account's password.

---

### User Story 4 - Review authentication and authorization activity (Priority: P3)

An administrator can review security-relevant events such as failed sign-in attempts, role changes, and denied access attempts to understand suspicious activity and support audits.

**Why this priority**: Security events improve operational visibility and accountability after the core sign-in and authorization controls are in place.

**Independent Test**: Can be fully tested by causing a failed sign-in, denying a member access to staff screens, changing a staff role, and confirming each event is visible to an authorized administrator without exposing sensitive secrets.

**Acceptance Scenarios**:

1. **Given** a failed sign-in attempt, **When** an authorized administrator reviews security activity, **Then** the event is listed with time and outcome plus an opaque account reference only when the attempt safely resolved to exactly one account, or otherwise only versioned audit correlation, without the submitted or normalized sign-in identifier.
2. **Given** a user attempts an action outside their permissions, **When** an authorized administrator reviews security activity, **Then** the denied action is listed with actor, action, time, and reason category.
3. **Given** an administrator changes a user's roles, **When** security activity is reviewed, **Then** the change records who performed it, who was changed, and when it happened.

### Edge Cases

- A deactivated user must not be able to sign in or continue using protected areas.
- A user with no assigned role must authenticate only if the account is valid, then receive no protected access until a role is assigned.
- A member who is also employed by the library must use an explicit staff/admin role assignment before accessing back office workflows.
- A sign-in identifier that matches more than one account context must not authenticate until the ambiguity is resolved, and the user-facing failure message must remain generic.
- Concurrent staff and member account updates that attempt to claim the same normalized identifier must result in exactly one successful claim.
- Deleted or suspended member records must not leave behind active member access.
- Role changes must not require manual server restarts or in-memory updates to take effect.
- Security-related errors must avoid exposing passwords, secrets, full protected payloads, or unrelated member borrowing history.
- Shared and compatibility sign-in routes must use the same throttling counters so changing routes cannot bypass the limit. By default, the sixth generic failure for one normalizable identifier correlation or the twenty-first total attempt from one trusted network source within fifteen minutes must receive a generic retry-later outcome; unknown, ambiguous, invalid-password, inactive, suspended, locked, and missing-credential failures all count, while malformed requests without a normalizable identifier count only against their source. Normal attempts may resume when the applicable window expires without administrator action.
- By default, the thirty-first refresh attempt for one session family or trusted network source within five minutes must receive a generic retry-later outcome, and normal refresh attempts may resume when the window expires.
- Network-source throttling must use the direct peer unless it belongs to an explicitly configured trusted-proxy CIDR. Trusted proxy chains are evaluated right-to-left to the first untrusted address; untrusted or malformed forwarding data must not create or evade a throttle identity.
- A referenced audit-correlation key version must not be retired while an identifier repair is non-terminal or still cleaning activation gates, or while an unexpired throttle bucket references it. If configuration removes it anyway, readiness and affected authentication requests must fail closed without mutating repair or throttle data until the key is restored.
- An audit-correlation key rotation that would require more than two previous key versions must be rejected before configuration changes, without accepting or displaying key secrets.
- Browser session requests from an untrusted, missing, or opaque origin must not issue, rotate, revoke, or clear a refresh credential, even when a valid cookie is attached.
- A permissive wildcard origin must never be treated as trusted for credential-bearing browser requests, and a trusted origin match must include the complete scheme, host, and port.
- Reuse of an already exchanged refresh credential must revoke its full session family without revealing whether replay detection, expiry, account status, or another validation rule caused the denial.
- A refresh rotation interrupted while its replay marker is pending must never create two active successors or return an uncommitted replacement. Expired pending work may resume only while the family still references the presented credential; an already-committed or inconsistent pending operation must revoke the family and return the generic denial.
- Migration to full-history replay detection must revoke all active legacy refresh families before the upgraded application accepts refresh requests, preserve their absolute expiry and audit history, remove legacy current/previous hashes, and require affected users to sign in again.
- Signing out without an active or valid refresh credential must still clear browser authentication state and return the same non-disclosing completion outcome as ordinary current-session sign-out.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST replace in-memory authentication users with persistent user accounts suitable for deployed online use.
- **FR-002**: System MUST require authentication before any non-public member, staff, or admin action is allowed.
- **FR-003**: System MUST support at least these role categories: member, staff, and administrator.
- **FR-004**: System MUST enforce authorization on the server side for every protected action and protected data read.
- **FR-005**: System MUST prevent member accounts from accessing staff back office and administrator workflows.
- **FR-006**: System MUST limit member accounts to their own membership profile, borrowing status, borrowing history, due status, and account information.
- **FR-007**: System MUST allow administrators to create, deactivate, and update staff/admin user accounts.
- **FR-008**: System MUST allow administrators to assign and remove approved roles for staff/admin users.
- **FR-009**: System MUST define named permissions for catalog management, member management, borrowing/return management, staff account management, role management, identifier-conflict review and resolution, and security activity review.
- **FR-010**: System MUST map each role to a clear set of permissions that can be reviewed by an administrator.
- **FR-011**: System MUST reject protected actions when the signed-in user lacks the required permission, even when the request bypasses the user interface.
- **FR-012**: System MUST store user secrets securely and never store or display recoverable passwords.
- **FR-013**: System MUST provide sign-in failure messages that do not reveal whether a specific account exists.
- **FR-014**: System MUST support account deactivation so a user can be prevented from signing in without removing historical audit context.
- **FR-015**: System MUST record successful and failed sign-in, sign-out, denied authorization, account deactivation, role changes, identifier-conflict detection and resolution, identifier-operation recovery, refresh replay, and token revocation.
- **FR-016**: System MUST ensure security event records include enough context for audit review while excluding passwords, tokens, sensitive request bodies, and raw sign-in identifiers; identifier correlation MUST use versioned HMAC-SHA-256 with a dedicated audit-correlation secret rather than an ordinary hash.
- **FR-017**: System MUST provide administrator-only access to view security activity.
- **FR-018**: System MUST protect role and permission management so only administrators can grant, remove, or change elevated access.
- **FR-019**: System MUST validate account identifiers, role assignments, and account status changes before saving them.
- **FR-020**: System MUST preserve borrowing history and staff action history when authentication or role records change.
- **FR-021**: System MUST provide a clear access-denied outcome for authenticated users who lack permission and a sign-in-required outcome for unauthenticated users.
- **FR-022**: System MUST support a first administrator setup path so the system can be initialized without relying on hard-coded production credentials.
- **FR-023**: System MUST allow member authentication to be linked to the existing member record so member self-service access is scoped to the correct person.
- **FR-024**: System MUST keep role and permission names understandable to administrators and aligned with library workflows rather than internal implementation labels.
- **FR-025**: System MUST provide a single sign-in page for staff, administrators, and members that supports keyboard-only operation, accessible labels, announced validation and authentication errors, deterministic focus after failure, and a loading state that prevents duplicate submission.
- **FR-026**: System MUST route signed-in users to their landing area from authenticated role area and permissions rather than from a user-selected login type.
- **FR-027**: System MUST reserve each normalized sign-in identifier across staff/admin and member contexts, reject concurrent or subsequent conflicting claims, fail closed for legacy ambiguity, and allow only an administrator to resolve conflicts. Multi-document changes MUST use a MongoDB transaction when available or a durable idempotent operation saga that never enables an ambiguous identifier.
- **FR-028**: System MUST reject production startup when mandatory static authentication configuration is missing or unsafe. After successful startup, it MUST expose a public deployment readiness endpoint that reports runtime dependency failure when MongoDB or initialized authentication infrastructure becomes unavailable, without exposing secrets or protected configuration values.
- **FR-029**: System MUST retain every audit-correlation key version referenced by a non-terminal or cleanup-pending identifier repair or an unexpired authentication throttle bucket, fail deployment readiness without mutating repair or throttle state when a referenced version is unavailable, and provide a production-safe operator preflight that rejects an audit-key rotation requiring more than two previous versions before configuration changes. The preflight MUST accept only candidate key-version metadata and MUST return only required version numbers and count plus fixed non-sensitive status, reason, and configured-capacity fields.
- **FR-030**: System MUST apply configurable throttling with default boundaries shared across all sign-in entry points: five generic failures per normalizable identifier correlation and twenty total attempts per trusted network source in fifteen minutes, plus thirty refresh attempts per session family and trusted network source in five minutes. Unknown, ambiguous, invalid-password, inactive, suspended, locked, and missing-credential outcomes MUST count against the identifier boundary when the request contains a normalizable identifier; malformed requests without one MUST count only against the source boundary. Network source MUST resolve from the direct peer unless the peer belongs to a validated configured trusted-proxy CIDR, in which case the chain MUST resolve right-to-left to the first untrusted address. Requests above either applicable boundary MUST receive a generic retry-later outcome, MUST NOT reveal account existence, and MUST be eligible to proceed again when the applicable window expires without administrator action.
- **FR-031**: System MUST use access credentials that expire within 15 minutes and single-use rotating refresh credentials whose family expires no later than 30 days after sign-in and whose expiry is never extended by rotation. The system MUST store only non-recoverable refresh-credential representations server-side and revoke the complete session family when a previously exchanged refresh credential is reused. Refresh rotation MUST use a recoverable `pending`/`committed` replay-marker lifecycle with a unique operation id and 30-second lease: the family compare-and-swap records the operation id, no replacement credential is returned before the marker is committed, expired pending work may be retried only while the family still references the presented credential, and an already-committed or inconsistent pending operation revokes the family. Each application instance MUST reconcile no more than 100 expired pending markers every 60 seconds. Migration to this contract MUST revoke every active legacy refresh family whose complete exchange history is unavailable, clear its legacy token hashes, preserve its absolute expiry and audit history, and require reauthentication before accepting upgraded refresh traffic. Refresh denial MUST remain generic across replay, recovery, expiry, account status, and invalid-credential outcomes.
- **FR-032**: System MUST keep browser access credentials out of persistent browser storage and MUST keep refresh credentials out of scripts and response bodies. In production, refresh continuity MUST use an HTTPS-only, HTTP-only, host-only cookie restricted to authentication paths with strict same-site behavior. Every browser request that issues, uses, or clears this cookie MUST match an explicitly configured trusted origin by complete scheme, host, and port; missing, opaque, wildcard-derived, and untrusted origins MUST be rejected before refresh credentials are read or session state is changed. Origin rejection MUST NOT append a persistent security event or write authentication or throttle state; operational visibility MUST use fixed-cardinality, per-instance telemetry sampled to a bounded rate and MUST exclude the supplied origin/header, cookies, tokens, and account references.
- **FR-033**: System MUST support current-session and all-session sign-out. Current-session sign-out MUST revoke the applicable session family when present, all-session sign-out MUST revoke every active refresh session for the authenticated account, and both MUST clear browser-held authentication state. Current-session sign-out MUST return the same non-disclosing completion outcome when no valid session is present.

### Key Entities *(include if feature involves data)*

- **User Account**: Represents a person or login identity allowed to authenticate. Key attributes include account identifier, active/deactivated status, credential status, assigned roles, linked member record when applicable, creation time, and last access information.
- **Role**: Represents a named access category such as member, staff, or administrator. A role groups permissions for a common library responsibility.
- **Permission**: Represents an allowed protected capability such as managing catalog records, managing borrowing workflows, managing members, managing staff accounts, managing roles, or viewing security activity.
- **Member Authentication Link**: Represents the member-owned authentication fields and optional future external identity link embedded on the existing member profile, ensuring self-service access is scoped to the correct member.
- **Authentication Identifier Reservation**: Represents the unique normalized identifier claimed by exactly one staff or member account context so MongoDB can enforce cross-collection sign-in uniqueness without introducing a global user account table.
- **Security Activity Event**: Represents security-relevant activity including sign-in attempts, denied access, role changes, and account status changes. Events include actor when known, target when applicable, event type, time, and outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of protected member, staff, and admin workflows require authentication before protected data is displayed or changed.
- **SC-002**: 100% of member attempts to access staff or admin workflows are denied in authorization tests.
- **SC-003**: Administrators can create a staff account, assign a role, and confirm access in under 5 minutes during acceptance testing.
- **SC-004**: Role changes take effect for protected workflows within 1 minute without an application restart.
- **SC-005**: 100% of security-sensitive events defined in this spec are recorded without passwords, tokens, or full sensitive payloads.
- **SC-006**: At least 19 of 20 first-time participants, comprising 8 members, 8 staff users, and 4 administrators, can complete shared sign-in on the first attempt with correct credentials and reach their authorized landing area within 30 seconds during moderated usability testing.
- **SC-007**: Protected workflow access decisions are consistent across direct requests and normal UI navigation in all acceptance tests.
- **SC-008**: 100% of staff/admin/member sign-in acceptance tests begin from the shared sign-in page and land on the correct area based on authenticated permissions.
- **SC-009**: Invalid mandatory production authentication configuration prevents startup with a redacted diagnostic. After successful startup, the public deployment readiness endpoint returns a non-success response within 5 seconds when MongoDB or initialized authentication infrastructure becomes unavailable.
- **SC-010**: Shared sign-in is fully operable using only a keyboard, exposes accessible names for every field and action, announces validation and authentication errors, and prevents duplicate submission in automated accessibility tests.
- **SC-011**: The complete authentication-and-authorization boundary adds no more than 50 ms p95 latency compared with an equivalent unprotected baseline across 500 measured requests in the documented verification environment.
- **SC-012**: The first page of 50 security activity events returns within 2 seconds with 10,000 stored events in the documented verification environment.
- **SC-013**: In 100% of rotation acceptance tests, the operator preflight includes versions referenced by non-terminal/cleanup-pending repairs and unexpired throttle buckets, exits successfully when at most two previous versions are required, exits nonzero with `repair-key-rotation-blocked` when more than two are required, accepts no key secrets, changes no configuration, repair, or throttle data, and reports only required version numbers and count plus fixed non-sensitive status, reason, and configured-capacity fields; removing any referenced version makes readiness non-success within 5 seconds until restoration.
- **SC-014**: In 100% of throttling acceptance tests using default settings, the sixth generic failure for one normalizable identifier correlation, the twenty-first sign-in attempt from one trusted network source, and the thirty-first refresh attempt for one session family or trusted network source are denied with the same generic retry-later outcome; every defined generic failure category counts, malformed identifier requests count only by source, switching between shared and compatibility sign-in routes or rotating the audit-correlation key does not bypass an active window, untrusted forwarding data does not alter source identity, and normal requests become eligible again no later than the end of the applicable fifteen-minute or five-minute window.
- **SC-015**: In 100% of browser-session security tests, access credentials expire within 15 minutes and are absent from persistent browser storage; refresh credentials remain unavailable to scripts and response bodies, cannot extend a session family beyond 30 days from sign-in, and are invalidated when successfully exchanged; pending rotation interruption is recovered without creating two successors or returning an uncommitted credential; committed or inconsistent pending state and reuse revoke the full session family; migration revokes all active legacy families lacking complete replay history before upgraded refresh traffic is accepted; current-session and all-session sign-out revoke the intended sessions; and every missing, opaque, wildcard-derived, or untrusted origin is rejected before session state changes without a persistent audit write and with only bounded redacted operational telemetry.

## Assumptions

- The application has no public library portal requirement in this feature; all member, staff, and admin areas are protected.
- Email, username, or member number may be used as an account identifier, but every normalized identifier used by shared sign-in is reserved to exactly one staff or member account context.
- Member self-service accounts should link to existing member records rather than creating a separate duplicate member identity.
- Staff and administrator users may be separate from member profiles unless a person needs both member and staff access.
- Administrator users are trusted to manage staff accounts and role assignment.
- Password reset and external single sign-on are not required for the first version unless added in a later spec.
- Existing borrowing, catalog, and member-management workflows remain governed by their current business rules; this feature adds authentication and authorization boundaries around them.
- Deployment operators can run a local preflight command with database/configuration access before changing audit-correlation key versions; this command is not a public HTTP endpoint and does not replace deployment-platform access controls.
- Deployments behind proxies provide an explicit allowlist of trusted proxy CIDRs; direct deployments leave the allowlist empty and do not trust forwarding headers.
- Production browser clients and the authentication service are deployed on origins that can be enumerated exactly; wildcard credential-bearing origins and cross-site browser session continuity are outside this feature's security contract.
