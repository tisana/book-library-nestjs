# Research: Authentication, Roles, and Permissions

## Sources Reviewed

- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [NIST SP 800-63B: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)

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
