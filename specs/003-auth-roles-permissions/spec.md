# Feature Specification: Authentication, Roles, and Permissions

**Feature Branch**: `003-auth-roles-permissions`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "I want to have better authentication and authorize system where I can better handling user and roles. The current in-memory solution is not secure enough to publish the application online. The authentication should be able to have clear roles and permission to access system. Eg. member should not able to access library back office or admin system."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with a persistent account (Priority: P1)

A library user signs in with a real account whose identity and role survive application restarts, so the online application no longer depends on insecure in-memory users.

**Why this priority**: Secure, persistent authentication is the foundation for publishing the application online and for enforcing every later permission rule.

**Independent Test**: Can be fully tested by creating or using a stored account, signing in, restarting the application, and confirming the same account can still sign in with the same role and access scope.

**Acceptance Scenarios**:

1. **Given** an active staff account exists, **When** the staff user signs in with valid credentials, **Then** the system authenticates the user and identifies their assigned role.
2. **Given** an active member account exists, **When** the member signs in with valid credentials, **Then** the system authenticates the member and identifies them as a member user.
3. **Given** a user enters invalid credentials, **When** they attempt to sign in, **Then** the system denies access without revealing whether the account identifier or secret was wrong.
4. **Given** the application restarts, **When** a previously created active account signs in again, **Then** the account, role assignments, and access scope are still available.

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

---

### User Story 4 - Review authentication and authorization activity (Priority: P3)

An administrator can review security-relevant events such as failed sign-in attempts, role changes, and denied access attempts to understand suspicious activity and support audits.

**Why this priority**: Security events improve operational visibility and accountability after the core sign-in and authorization controls are in place.

**Independent Test**: Can be fully tested by causing a failed sign-in, denying a member access to staff screens, changing a staff role, and confirming each event is visible to an authorized administrator without exposing sensitive secrets.

**Acceptance Scenarios**:

1. **Given** a failed sign-in attempt, **When** an authorized administrator reviews security activity, **Then** the event is listed with time, account identifier if known, and outcome.
2. **Given** a user attempts an action outside their permissions, **When** an authorized administrator reviews security activity, **Then** the denied action is listed with actor, action, time, and reason category.
3. **Given** an administrator changes a user's roles, **When** security activity is reviewed, **Then** the change records who performed it, who was changed, and when it happened.

### Edge Cases

- A deactivated user must not be able to sign in or continue using protected areas.
- A user with no assigned role must authenticate only if the account is valid, then receive no protected access until a role is assigned.
- A member who is also employed by the library must use an explicit staff/admin role assignment before accessing back office workflows.
- Deleted or suspended member records must not leave behind active member access.
- Role changes must not require manual server restarts or in-memory updates to take effect.
- Security-related errors must avoid exposing passwords, secrets, full protected payloads, or unrelated member borrowing history.
- Repeated failed sign-in attempts should be slowed or blocked enough to reduce automated guessing without locking out normal users too aggressively.

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
- **FR-009**: System MUST define named permissions for protected workflows, including catalog management, member management, borrowing/return management, staff account management, role management, and security activity review.
- **FR-010**: System MUST map each role to a clear set of permissions that can be reviewed by an administrator.
- **FR-011**: System MUST reject protected actions when the signed-in user lacks the required permission, even when the request bypasses the user interface.
- **FR-012**: System MUST store user secrets securely and never store or display recoverable passwords.
- **FR-013**: System MUST provide sign-in failure messages that do not reveal whether a specific account exists.
- **FR-014**: System MUST support account deactivation so a user can be prevented from signing in without removing historical audit context.
- **FR-015**: System MUST record security-relevant events, including successful sign-in, failed sign-in, sign-out when available, denied authorization, account deactivation, and role changes.
- **FR-016**: System MUST ensure security event records include enough context for audit review while excluding passwords, tokens, and sensitive request bodies.
- **FR-017**: System MUST provide administrator-only access to view security activity.
- **FR-018**: System MUST protect role and permission management so only administrators can grant, remove, or change elevated access.
- **FR-019**: System MUST validate account identifiers, role assignments, and account status changes before saving them.
- **FR-020**: System MUST preserve borrowing history and staff action history when authentication or role records change.
- **FR-021**: System MUST provide a clear access-denied outcome for authenticated users who lack permission and a sign-in-required outcome for unauthenticated users.
- **FR-022**: System MUST support a first administrator setup path so the system can be initialized without relying on hard-coded production credentials.
- **FR-023**: System MUST allow member authentication to be linked to the existing member record so member self-service access is scoped to the correct person.
- **FR-024**: System MUST keep role and permission names understandable to administrators and aligned with library workflows rather than internal implementation labels.

### Key Entities *(include if feature involves data)*

- **User Account**: Represents a person or login identity allowed to authenticate. Key attributes include account identifier, active/deactivated status, credential status, assigned roles, linked member record when applicable, creation time, and last access information.
- **Role**: Represents a named access category such as member, staff, or administrator. A role groups permissions for a common library responsibility.
- **Permission**: Represents an allowed protected capability such as managing catalog records, managing borrowing workflows, managing members, managing staff accounts, managing roles, or viewing security activity.
- **Member Authentication Link**: Represents the member-owned authentication fields and optional future external identity link embedded on the existing member profile, ensuring self-service access is scoped to the correct member.
- **Security Activity Event**: Represents security-relevant activity including sign-in attempts, denied access, role changes, and account status changes. Events include actor when known, target when applicable, event type, time, and outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of protected member, staff, and admin workflows require authentication before protected data is displayed or changed.
- **SC-002**: 100% of member attempts to access staff or admin workflows are denied in authorization tests.
- **SC-003**: Administrators can create a staff account, assign a role, and confirm access in under 5 minutes during acceptance testing.
- **SC-004**: Role changes take effect for protected workflows within 1 minute without an application restart.
- **SC-005**: 100% of security-sensitive events defined in this spec are recorded without passwords, tokens, or full sensitive payloads.
- **SC-006**: At least 95% of legitimate users can complete sign-in on the first attempt when using correct credentials during usability testing.
- **SC-007**: Protected workflow access decisions are consistent across direct requests and normal UI navigation in all acceptance tests.

## Assumptions

- The application has no public library portal requirement in this feature; all member, staff, and admin areas are protected.
- Email, username, or member number may be used as an account identifier, but the exact identifier format can be selected during planning based on existing data.
- Member self-service accounts should link to existing member records rather than creating a separate duplicate member identity.
- Staff and administrator users may be separate from member profiles unless a person needs both member and staff access.
- Administrator users are trusted to manage staff accounts and role assignment.
- Password reset and external single sign-on are not required for the first version unless added in a later spec.
- Existing borrowing, catalog, and member-management workflows remain governed by their current business rules; this feature adds authentication and authorization boundaries around them.
