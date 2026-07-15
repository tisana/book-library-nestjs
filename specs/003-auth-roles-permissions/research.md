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

Store refresh tokens only as hashes, bind them to a token family with an absolute lifetime of at most 30 days, rotate on every refresh without extending that lifetime, and retain a one-way replay marker for every committed exchange until the family expires. Insert the marker in `pending` state with a unique rotation operation id and 30-second lease before the atomic compare-and-swap from the current hash to the next hash; record the operation id on the family and commit the marker before returning credentials. An expired pending marker may be taken over only while the family still references the presented token. If the family already records the pending operation id, or pending marker/family state is otherwise inconsistent, revoke the family and return the generic denial. Each application instance reconciles no more than 100 expired markers every 60 seconds. A request presenting any committed marker hash also revokes the family. During migration, revoke all active legacy families and clear their legacy token hashes because complete historical replay markers cannot be reconstructed safely.

**Rationale**: [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2) requires public-client refresh tokens to be sender-constrained or rotated and describes revoking the active grant when an invalidated token is replayed. Retaining only the immediately previous hash would stop detecting older exchanged credentials after another rotation. One-way markers preserve full-family replay detection without retaining raw credentials; explicit pending/committed state, operation ownership, and family reconciliation close the marker-before-CAS interruption gap. Revoking legacy families is the only way to claim complete replay coverage when older generations were never retained.

**Alternatives considered**:

- No refresh tokens and force full reauthentication: secure but poor usability for staff workflows.
- Static refresh tokens: rejected because theft can remain useful until expiry and replay is harder to detect.
- Keep only `previousTokenHash` on the family: rejected because replay of a token older than one rotation would become indistinguishable from an arbitrary invalid credential and would not revoke the active family.
- Extend family expiry after each rotation: rejected because a stolen continuously used refresh credential could create an unbounded session.

## Decision: Keep Tokens Out of Browser localStorage

Issue access tokens with a maximum 15-minute lifetime and store them in frontend memory only. Use an HTTP-only, Secure in production, host-only, `SameSite=Strict` cookie limited to `/auth` for refresh continuity; set its lifetime to the family expiry remaining at issuance or rotation rather than restarting the 30-day clock. Omit the `Domain` attribute. Current-session sign-out revokes the matching family when present and succeeds generically when absent; all-session sign-out revokes every family and invalidates current access credentials through the account authorization version. Both clear the refresh cookie with matching attributes, and the frontend clears memory and server-state caches.

**Rationale**: The [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#storage-apis) advises against storing session identifiers in local storage because scripts can read them. The [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#cookies) recommends `Secure`, `HttpOnly`, and `SameSite` cookie protections. Memory-only access tokens limit persistence after browser compromise, while an absolute refresh-family expiry bounds continuity even under regular rotation.

**Alternatives considered**:

- Store access and refresh tokens in localStorage: rejected due to XSS and persistence risk.
- Store access token in sessionStorage: better than localStorage but still exposed to XSS and not sufficient for refresh-token protection.
- Use `SameSite=Lax`: rejected for this same-site authentication flow because the contract requires the stricter cross-site exclusion and no state-changing authentication endpoint depends on cross-site navigation.
- Use a parent-domain cookie: rejected because sibling subdomains do not need the refresh credential and a host-only cookie reduces overwrite and disclosure scope.

## Decision: Enforce a Trusted Browser Origin Before Session Access

Use one `AUTH_TRUSTED_BROWSER_ORIGINS` JSON array as the source of truth for both credentialed CORS responses and server-side browser-session origin enforcement. When omitted outside production, default to `http://localhost:5173` and `http://127.0.0.1:5173`; production has no default and requires at least one entry. Each entry must be an exact `http` or `https` origin containing only scheme, host, and effective port; reject credentials, non-root paths, queries, fragments, `null`, wildcards, regexes, duplicate canonical origins, and non-HTTPS production entries. Before parsing a refresh cookie or issuing, rotating, revoking, or clearing refresh state, a dedicated guard requires one exact configured `Origin`; missing, opaque, multiple, malformed, or untrusted values receive a generic forbidden response with no session lookup, cookie emission, throttle change, authentication-state mutation, or persistent security-event write. Operational visibility uses only fixed route/reason dimensions and emits at most one redacted warning per dimension per minute per application instance while carrying suppressed counts forward; it never includes the supplied origin/header, cookie, token, or account reference. Apply the guard to shared and compatibility sign-in, refresh, current-session sign-out, and all-session sign-out. CORS preflight handling uses the same allowlist but is not treated as the authorization check.

**Rationale**: The [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#using-standard-headers-to-verify-origin) recommends strong source-origin verification and blocking when neither trusted source header is available. It also warns that credentialed CORS must use a small exact allowlist rather than wildcard or broad subdomain matching. `SameSite=Strict` remains defense in depth; explicit origin enforcement covers login CSRF and ensures rejection occurs before session state is touched.

**Alternatives considered**:

- Rely on CORS alone: rejected because CORS controls whether browsers expose responses; it is not the server-side authorization decision and does not by itself guarantee no session mutation.
- Rely on `SameSite` alone: rejected because same-site sibling origins and future deployment changes can still create request-forgery risk.
- Fall back to `Referer` or accept missing/`null` origins: rejected by the explicit fail-closed browser contract; supported clients send `Origin` on these state-changing requests.
- Allow wildcard or suffix-based origins: rejected because compromised or attacker-controlled subdomains could become trusted.

## Decision: Use RBAC Role Assignment with Permission Guards and Ownership Checks

Use role assignments for member, staff, and administrator categories, map roles to named permissions, and enforce permissions through a server-side guard. Use explicit ownership checks for member self-service resources so a member can only access their own membership and borrowing records.

**Rationale**: OWASP recommends least privilege, deny by default, permission validation on every request, and authorization tests. Pure RBAC is too coarse for member object ownership, so member ownership must be checked separately.

**Alternatives considered**:

- Role-only guards: rejected because they are too coarse for catalog/member/borrowing/security workflows and do not express ownership.
- Full custom policy engine: deferred because the current single-library scope can be handled with explicit permission and ownership checks.

## Decision: Follow NIST/OWASP Password and Sign-In Guidance

Require strong password handling, allow long passwords, block known weak/compromised choices where practical, avoid arbitrary periodic rotation, rate-limit failed attempts, return generic failure messages, and hash passwords with an accepted slow password hashing algorithm. Shared and compatibility sign-in entry points use common counters: five generic failures per versioned identifier correlation and twenty attempts per trusted network source in fifteen minutes. Unknown, ambiguous, invalid-password, inactive, suspended, locked, and missing-credential outcomes count whenever the request has a normalizable identifier; malformed requests without one count only by source. Refresh uses thirty attempts per session family and trusted source in five minutes. Limits are configurable, but acceptance tests use these defaults and all windows recover automatically.

**Rationale**: NIST SP 800-63B requires minimum password length, blocklist comparison, rate limiting, and secure password processing. OWASP recommends proper password strength controls, secure storage, and generic authentication failure behavior.

**Alternatives considered**:

- Composition-only password rules: rejected because NIST discourages arbitrary composition requirements.
- Detailed login failure messages: rejected because they can leak account existence or status.

## Decision: Use Shared Privacy-Preserving Throttle Buckets

Store short-lived throttle buckets in MongoDB so all sign-in entry points and application instances enforce the same boundaries. Use purpose-separated HMAC keys for normalized identifier correlation, trusted network source, and refresh-family dimensions; store the audit-correlation `keyVersion` but no raw identifier, address, cookie, or token. For each request, derive candidate bucket keys under the current and configured previous versions, continue an existing unexpired bucket, and create a current-version bucket only when none exists. Count every sign-in request against the trusted-source bucket, count every generic sign-in failure with a normalizable identifier against the identifier bucket, and count refresh attempts against both trusted-source and family buckets. Enforce all dimensions directly through `AuthThrottleService`; do not add a second framework throttling guard. Resolve source identity with `proxy-addr`: trust only direct peers in the validated `AUTH_TRUSTED_PROXY_CIDRS` JSON allowlist, scan right-to-left to the first untrusted address, and ignore forwarding headers when the list is empty or the direct peer is untrusted.

**Rationale**: Process-local counters can be bypassed by switching compatibility routes, application instances, or restarts. Identifier-only limits permit distributed guessing and can enable targeted account denial; source-only limits can be bypassed by distributed clients. Short-lived indexed buckets provide consistent enforcement and automatic recovery while limiting retained personal data.

**Alternatives considered**:

- Default in-memory throttler storage: rejected for production because counters diverge across application instances and reset on restart.
- Generic `@nestjs/throttler` guards plus controller checks: rejected because failure-only identifier counting requires post-authentication outcomes and two enforcement paths could double count.
- Identifier-only lockout: rejected because an attacker could deny service to a known account and unknown identifiers would avoid meaningful source control.
- Trust all forwarding headers: rejected because client-supplied source values can evade or create throttle identities.
- Hop-count-only proxy trust: rejected because topology changes can silently trust a client-controlled address; explicit proxy CIDRs are reviewable and fail closed.

## Decision: Persist Security Activity Events Separately

Record sign-in success/failure, denied authorization, role assignment changes, account deactivation, refresh-token replay, token revocation, and sign-out/revocation activity in a separate append-only audit-style collection.

**Rationale**: The constitution requires auditability for important state changes and sensitive operations. OWASP authorization guidance calls out logging and authorization tests so access-control failures are detectable and attributable.

**Alternatives considered**:

- Only application logs: rejected because logs may rotate, are harder to query in the admin UI, and risk leaking sensitive request data.
- Embed events on account documents: rejected because events grow without a predictable bound.

Failed sign-in events may include an opaque internal account reference only when identifier resolution safely produced exactly one account context. Unknown, missing, released, conflict-marked, or ambiguous identifiers record only versioned HMAC correlation and a generic reason category; raw and normalized submitted identifiers are never stored or displayed.

## Decision: Keep Rotation Preflight Metadata-Only

Accept only candidate current and previous key-version numbers. Compute required versions from both non-terminal/cleanup-pending repairs and unexpired throttle buckets so active rate-limit windows survive rotation. Return required version numbers and count plus the fixed non-sensitive fields `status`, `reason`, and `maxPreviousKeys`; reject unknown or secret-bearing input, emit no infrastructure, repair-record, or throttle-bucket details, and perform no writes.

**Rationale**: Operators need deterministic allowed/blocked diagnostics before changing configuration, but key material and repair details are unnecessary and would enlarge the secret-exposure surface.

**Alternatives considered**:

- Return only an exit code: rejected because operators need actionable version-capacity diagnostics.
- Return repair document ids or key values: rejected because neither is required to decide rotation and both expose sensitive operational context.
