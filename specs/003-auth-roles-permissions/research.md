# Research: Authentication, Roles, and Permissions

## Sources Reviewed

- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [NIST SP 800-63B: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [Keycloak Documentation 26.6.4](https://www.keycloak.org/documentation)
- [Keycloak OIDC Application Security](https://www.keycloak.org/securing-apps/oidc-layers)
- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/)
- [Auth.js Getting Started](https://authjs.dev/getting-started)
- [Auth.js OAuth Concepts](https://authjs.dev/concepts/oauth)
- [Auth.js Session Strategies](https://authjs.dev/concepts/session-strategies)

## Decision: Build NestJS-Owned Auth First

Build a solid NestJS authentication and authorization system as the default implementation for this feature. Keep account lifecycle, credential hashes, short-lived JWT access tokens, refresh-token rotation, role assignment, permission checks, member ownership checks, and security activity in the existing application and MongoDB.

**Rationale**: The current product is a single library application with one NestJS API, one React frontend, and a simple role model (`member`, `staff`, `admin`). Running Keycloak now would add a second service, separate database, realm/client configuration, backups, upgrades, deployment hardening, local dev complexity, and identity-linking work before the app clearly needs SSO, federation, or MFA. A focused NestJS implementation satisfies the current security requirements with lower operational cost.

**Alternatives considered**:

- Keycloak as default: strong production IdP choice, but over-sized for the current single-app scope.
- Auth.js as default: useful for JavaScript application sessions and OAuth provider sign-in, but not a central auth layer for this NestJS API plus Vite SPA.
- Keep current simple JWT login unchanged: rejected because the spec requires stronger persistent auth, roles, permissions, revocation/session handling, and auditability.

## Decision: Keep Keycloak as an Evaluated Future Option

Design the NestJS auth boundary so Keycloak can replace the login authority later without rewriting library authorization. Future migration should validate Keycloak-issued tokens at the same guard boundary, map Keycloak roles/groups/scopes into the same local permission names, and link Keycloak `sub` values to existing staff/member records.

**Rationale**: Keycloak is a dedicated open-source identity and access management server with OIDC/SAML, admin console, users/roles/clients, JWKS, revocation, token policies, identity provider delegation, LDAP/AD, and account management. Those features become valuable when the product needs SSO, MFA, password reset, federation, multiple apps, or centralized account operations. Keeping the current token/role model OIDC-friendly makes that migration incremental.

**Alternatives considered**:

- Ignore Keycloak entirely: rejected because the user explicitly wants standards-aligned protocol readiness and may need IdP features later.
- Encode all future authorization in Keycloak Authorization Services: deferred because member ownership and library workflow rules should remain near the protected NestJS services and tests.

## Decision: Do Not Use Auth.js as the Primary Auth System

Do not use Auth.js as the primary auth implementation for this architecture. Reconsider it only if the frontend becomes a server-rendered JavaScript app or if the project adds a backend-for-frontend.

**Rationale**: Auth.js is a runtime-agnostic JavaScript authentication library with OAuth, magic links, credentials, WebAuthn, many providers, framework integrations, and optional database adapters. Its session model is application-centric. This project already has a NestJS API that must enforce protected resources directly, so Auth.js would still leave API authorization, role/permission mapping, and member ownership checks to NestJS while adding another auth layer.

**Alternatives considered**:

- Use Auth.js directly in the Vite SPA: rejected because Auth.js needs a server-side integration point.
- Add Auth.js through Express inside NestJS: possible but awkward, duplicates NestJS auth structure, and does not solve resource authorization.
- Use Auth.js with Keycloak provider later: acceptable only with a future BFF/server-rendered frontend.

## Decision: Use a Shared Sign-In Entry Point

Use one user-facing sign-in page and one primary sign-in contract for staff, administrators, and members. Keep staff/admin credentials on `StaffUser` and member credentials on `Member`; store normalized identifier ownership in a small credential-free `AuthIdentifier` registry with a unique index so cross-collection uniqueness is atomic. The auth service resolves an active reservation to exactly one eligible account context before password verification and token issuing. Legacy conflicts fail closed with the same generic sign-in failure used for invalid credentials until an administrator assigns a unique replacement identifier.

**Rationale**: The product has distinct library authorization rules after authentication, but users should not have to choose a role before proving identity. Routing from returned `roleArea` and permissions is simpler for users, easier to test, and avoids UI-selected role confusion. A read-before-write check across `StaffUser` and `Member` is race-prone because MongoDB cannot enforce one unique index across two collections; the reservation registry provides one ownership boundary without becoming a global user profile or credential table. One `AuthIdentifierOperation` coordinates every reservation affected by a request, while assignments reference pending reservation documents so recovery never needs to reverse an identifier hash. Transaction-capable deployments update reservations and aggregates atomically; other deployments use a durable saga with leased reconciliation and compensation. Terminal operation retention bounds idempotency storage, oversized conflicts remain blocked for offline repair, and audit correlation uses a dedicated versioned HMAC secret because ordinary hashes of low-entropy identifiers are reversible by guessing.

**Alternatives considered**:

- Keep separate staff and member login pages: rejected because it pushes authorization context selection onto the user and conflicts with the clarified shared login UX.
- Merge staff and member identities into one new user collection now: deferred because existing `StaffUser` and `Member` aggregates already own different lifecycle rules and member self-service scoping.
- Check both account collections before every identifier save: rejected because concurrent writes can pass both checks and create an ambiguous identifier.
- Try both login endpoints from the frontend: rejected because it leaks implementation shape into the UI and makes ambiguous identifier handling harder to audit consistently.

## Comparison: Build vs Keycloak vs Auth.js

| Option | Best Fit | Strengths | Costs/Risks | Fit for This Project |
| --- | --- | --- | --- | --- |
| Build in NestJS | Single app needing clear roles, permissions, and simple deployment | Fits current MongoDB/NestJS model; no separate service; direct member/staff linking; library authorization stays close to domain code | Must implement password policy, token lifecycle, refresh rotation, rate limiting, audit events, and tests carefully | Preferred default now |
| Keycloak | Dedicated IdP/SSO for multiple apps or advanced identity needs | OIDC/SAML, admin console, users/roles/clients, JWKS, revocation endpoint, token lifespans, federation, LDAP/AD, account console | Separate Java service, separate supported database, realm/client config, deployment/backup/monitoring, theme/customization, identity linking | Future option when scope grows |
| Auth.js | JavaScript app auth/session layer and OAuth client integration | Easy OAuth provider login, framework integrations, HTTP-only cookie sessions, database adapters including MongoDB, supports Keycloak as provider | Not a central IdP for a separate NestJS API; framework-centric; API still needs independent authorization | Not primary; future BFF option |

## Decision: Use OIDC-Friendly JWT Access Tokens

Issue short-lived signed JWT access tokens with standard-style claims: issuer, subject, audience, issued-at, expiry, token id, role area, and scope/permission claims. Protected endpoints must validate signature, expiry, issuer, audience, account status, token subject, and required permission/ownership.

**Rationale**: The current app already uses NestJS JWT/passport. Keeping claims OIDC-friendly reduces future migration risk if Keycloak becomes the issuer. RFC 9700 recommends least-privilege, audience-restricted, resource/action-restricted access tokens to reduce token-leakage impact.

**Alternatives considered**:

- Opaque access tokens only: stronger centralized revocation, but adds database lookup to every protected request and is less aligned with current code. Can be added later for high-risk endpoints.
- Long-lived JWTs: rejected because revocation and role-change propagation become weaker.

## Decision: Rotate Refresh Tokens and Store Only Hashes

Store refresh tokens only as hashes, bind them to a token family, rotate on every refresh, invalidate reused tokens, and revoke the family on replay detection or account deactivation.

**Rationale**: RFC 9700 requires public-client refresh tokens to be sender-constrained or rotated. Hashing stored refresh tokens limits damage if the database is exposed.

**Alternatives considered**:

- No refresh tokens and force full reauthentication: secure but poor usability for staff workflows.
- Static refresh tokens: rejected because theft can remain useful until expiry and replay is harder to detect.

## Decision: Keep Tokens Out of Browser localStorage

Store the access token in memory only. Use an HTTP-only, Secure, SameSite cookie for refresh/session continuity when the frontend and API are same-site. Sign-out clears in-memory state, clears frontend server-state cache, and revokes the refresh-token family.

**Rationale**: OWASP notes that browser localStorage persists across restarts and is exposed to XSS. HTTP-only cookies reduce JavaScript token exposure, while SameSite and CSRF defenses are required for cookie-backed token flows.

**Alternatives considered**:

- Store access and refresh tokens in localStorage: rejected due to XSS and persistence risk.
- Store access token in sessionStorage: better than localStorage but still exposed to XSS and not sufficient for refresh-token protection.

## Decision: Use RBAC Role Assignment with Permission Guards and Ownership Checks

Use role assignments for member, staff, and administrator categories, map roles to named permissions, and enforce permissions through a server-side guard. Use explicit ownership checks for member self-service resources so a member can only access their own membership and borrowing records.

**Rationale**: OWASP recommends least privilege, deny by default, permission validation on every request, and authorization tests. Pure RBAC is too coarse for member object ownership, so member ownership must be checked separately.

**Alternatives considered**:

- Role-only guards: rejected because they are too coarse for catalog/member/borrowing/security workflows and do not express ownership.
- Full custom policy engine: deferred because the current single-library scope can be handled with explicit permission and ownership checks.

## Decision: Follow NIST/OWASP Password and Sign-In Guidance

Require strong password handling, allow long passwords, block known weak/compromised choices where practical, avoid arbitrary periodic rotation, rate-limit failed attempts, return generic failure messages, and hash passwords with an accepted slow password hashing algorithm.

**Rationale**: NIST SP 800-63B requires minimum password length, blocklist comparison, rate limiting, and secure password processing. OWASP recommends proper password strength controls, secure storage, and generic authentication failure behavior.

**Alternatives considered**:

- Composition-only password rules: rejected because NIST discourages arbitrary composition requirements.
- Detailed login failure messages: rejected because they can leak account existence or status.

## Decision: Persist Security Activity Events Separately

Record sign-in success/failure, denied authorization, role assignment changes, account deactivation, refresh-token replay, token revocation, and sign-out/revocation activity in a separate append-only audit-style collection.

**Rationale**: The constitution requires auditability for important state changes and sensitive operations. OWASP authorization guidance calls out logging and authorization tests so access-control failures are detectable and attributable.

**Alternatives considered**:

- Only application logs: rejected because logs may rotate, are harder to query in the admin UI, and risk leaking sensitive request data.
- Embed events on account documents: rejected because events grow without a predictable bound.
