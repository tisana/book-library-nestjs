# Research: Authentication, Roles, and Permissions

## Sources Reviewed

- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [NIST SP 800-63B: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [Keycloak Documentation 26.6.4](https://www.keycloak.org/documentation)
- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/)
- [Auth.js Getting Started](https://authjs.dev/getting-started)
- [Auth.js OAuth Concepts](https://authjs.dev/concepts/oauth)
- [Auth.js Session Strategies](https://authjs.dev/concepts/session-strategies)

## Decision: Prefer Keycloak as Production IdP and Authorization Server

Use Keycloak as the production identity provider and OpenID Connect authorization server. The React frontend signs in through Keycloak using authorization code with PKCE. The NestJS API validates Keycloak-issued access tokens against issuer, audience, expiry, and JWKS keys, then maps Keycloak roles/groups/scopes to local library permissions.

**Rationale**: Keycloak is a dedicated open-source identity and access management server. Its current documentation covers securing applications with OpenID Connect/SAML, server administration, user/role/client management, authorization services, account management, identity provider delegation, LDAP/Active Directory federation, OIDC endpoints, revocation, JWKS, audiences, role mappings, token lifespan configuration, and production server configuration. These are exactly the areas that are expensive and risky to build correctly inside the library app. Delegating protocol and account lifecycle to Keycloak lets this codebase focus on library-specific authorization: member ownership, borrowing workflows, catalog management, and audit correlation.

**Alternatives considered**:

- Custom in-app OAuth2/OIDC server: maximum local control and simpler deployment topology, but highest security and maintenance burden because the app would own protocol correctness, token rotation, key rotation, session lifecycle, password policies, MFA/password-reset expansion, client registration, and security operations.
- Auth.js as primary auth system: useful for JavaScript app authentication and OAuth sign-in, but it is not a central IdP for this NestJS API plus Vite SPA architecture.
- Managed commercial IdP: operationally attractive, but the user asked for open-source options and the project can evaluate commercial hosting later.

## Decision: Do Not Use Auth.js as the Primary IdP for This Architecture

Auth.js may be useful if the frontend moves to a server-rendered JavaScript application or if a JavaScript backend-for-frontend is introduced. It is not selected as the central authentication system for the current NestJS API plus Vite SPA.

**Rationale**: Auth.js is a runtime-agnostic JavaScript authentication library with OAuth, magic link, credentials, WebAuthn, many providers, framework integrations, and optional database adapters. Its own docs frame resource protection around checking an application session. That is a good fit for a Next.js/SvelteKit/Qwik/Express app boundary, but this project needs a central IdP/authorization server issuing tokens for a separate NestJS resource server and supporting administrator-managed member/staff roles. Auth.js can consume Keycloak as a provider, but Keycloak is the component that acts as the IdP.

**Alternatives considered**:

- Use Auth.js directly in the Vite SPA: rejected because Auth.js needs a server-side integration point and would still leave API authorization, roles, and token validation to NestJS.
- Add Auth.js through Express inside NestJS: possible but awkward, duplicates existing NestJS auth structure, and does not provide Keycloak-level IdP administration.
- Use Auth.js with Keycloak provider later: acceptable only if the app adds a BFF or server-rendered frontend; not needed for the current plan.

## Comparison: Build vs Keycloak vs Auth.js

| Option | Best Fit | Strengths | Costs/Risks | Fit for This Project |
| --- | --- | --- | --- | --- |
| Build custom in NestJS | Small app needing tight local control and minimal services | Fits current MongoDB/NestJS model; no separate service; fully customizable member/staff linking | Must own OAuth/OIDC correctness, key rotation, refresh/session lifecycle, password policies, admin account UI, future MFA/password reset, and security patching | Viable fallback, but not preferred for online production security |
| Keycloak | Dedicated IdP/SSO for browser apps and APIs | OIDC/SAML, admin console, users/roles/clients, JWKS, revocation endpoint, token lifespans, identity provider federation, LDAP/AD, account console, authorization services | Separate Java service, separate supported database, realm/client configuration, deployment/backup/monitoring, theme/customization work, identity linking migration | Preferred production choice |
| Auth.js | JavaScript app auth/session layer and OAuth client integration | Easy OAuth provider login, framework integrations, HTTP-only cookie sessions, database adapters including MongoDB, supports Keycloak as provider | Not a central IdP for a separate NestJS API; framework-centric; API still needs independent authorization and role/permission enforcement | Not primary; useful only with a future BFF/server-rendered frontend |

## Decision: Keep Library Authorization in NestJS Even With Keycloak

Use Keycloak for identity, authentication, login session, protocol endpoints, and high-level role/group assignment. Use NestJS for resource authorization decisions such as `member can only access own borrowings`, `staff can manage borrowings`, and `admin can manage staff accounts`.

**Rationale**: Keycloak roles and scopes can identify who the user is and broad access category. The library API still owns domain-specific object checks and audit context. This avoids encoding borrowing/member ownership rules entirely in the IdP and keeps authorization tests near the protected controllers/services.

**Alternatives considered**:

- Encode all permissions in Keycloak Authorization Services: powerful, but increases configuration complexity and moves library-domain rules away from the code paths and tests that enforce borrowing/member behavior.
- Keep role-only checks in NestJS: rejected because the spec requires clear permissions and member/staff/admin boundaries.

## Decision: Use Authorization Code with PKCE for Browser Sign-In

Use an OAuth2/OIDC-aligned authorization code flow with PKCE for the first-party browser client. Access tokens are issued from the token endpoint, not through URL fragments. The initial implementation supports the first-party web client and keeps external identity-provider federation as a future extension.

**Rationale**: RFC 9700 recommends authorization code responses over implicit-style access-token responses because access tokens are not exposed in URLs, and it requires PKCE for public clients. This aligns with a browser frontend and allows future OIDC federation without changing protected-resource authorization.

**Alternatives considered**:

- Keep direct `/auth/login` bearer-token issuance: simpler, but does not satisfy the requested standards-aligned protocol boundary and resembles the password grant anti-pattern when treated as OAuth.
- OAuth implicit grant: rejected because RFC 9700 recommends using authorization code responses instead.
- Resource owner password credentials grant: rejected because RFC 9700 says it must not be used.

## Decision: Use Short-Lived JWT Access Tokens with Restricted Claims

Issue signed JWT access tokens with a short lifetime, issuer, subject, audience, issued-at, expiry, token id, role area, and scope/permission claims. Protected endpoints must validate signature, expiry, issuer, audience, account status, token subject, and required permission/ownership.

**Rationale**: The current app already uses NestJS JWT/passport. OAuth2 access tokens should be least-privilege and audience/scope restricted; RFC 9700 recommends privilege restriction and resource/action restriction to reduce token-leakage impact.

**Alternatives considered**:

- Opaque access tokens only: stronger centralized revocation, but adds database lookup to every protected request and is less aligned with current code. Can be added later for high-risk endpoints.
- Long-lived JWTs: rejected because revocation and role-change propagation become weaker.

## Decision: Rotate Refresh Tokens and Store Only Hashes

If refresh tokens are issued, store only token hashes, bind them to a token family, rotate on every refresh, invalidate reused tokens, and revoke the family on replay detection or account deactivation.

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

## Decision: Use RBAC for Administration and Permission Checks Plus Ownership Checks

Use role assignments for member, staff, and administrator categories, map roles to named permissions, and enforce permissions through a server-side guard. Use explicit ownership checks for member self-service resources so a member can only access their own membership and borrowing records.

**Rationale**: OWASP recommends least privilege, deny by default, permission validation on every request, and authorization tests. It also cautions that pure RBAC is not enough for fine-grained object access, so member ownership must be checked separately.

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
