# Book Borrowing System Constitution

## Purpose

This project is a web application for managing book borrowing in a library-like environment.  
The system should help users discover books, borrow and return them, and help librarians or administrators manage inventory, members, loans, and overdue items.

The goal of this constitution is to keep implementation quality high while avoiding unnecessary process or over-engineering.

---

## Core Principles

### I. User-Centered Library Workflow

The application must prioritize clear, predictable workflows for the main user groups:

- Borrowers/members
- Librarians/staff
- Administrators

Every feature must clearly state which user role it serves and what user outcome it supports.

Required behavior:
- Users should understand whether a book is available, borrowed, reserved, overdue, or unavailable.
- Borrowing and returning flows must avoid ambiguity.
- Staff-facing actions must be efficient and auditable.
- Error messages must explain what happened and what the user can do next.

Avoid:
- Features that are technically interesting but do not improve library operations.
- Hidden state changes that users or staff cannot explain.

---

### II. Correctness Over Cleverness

Book availability, loan status, due dates, reservations, and penalties are core business rules. These must be implemented simply, explicitly, and testably.

Required behavior:
- A book copy cannot be borrowed by more than one active loan at the same time.
- Loan lifecycle states must be explicit, for example: `active`, `returned`, `overdue`, `lost`, `cancelled`.
- The system must distinguish between a book title and a physical/digital copy where applicable.
- Time-sensitive rules, such as due dates and overdue status, must be deterministic and testable.
- Business rules must live in domain/service logic, not only in UI code.

Avoid:
- Implicit state derived from scattered fields without clear ownership.
- Complex abstractions before the workflow requires them.
- Silent fixes to inconsistent data.

---

### III. Security and Privacy by Default

The system handles member identities and borrowing history. Access must be limited by role and purpose.

Required behavior:
- Authentication is required for all non-public actions.
- Authorization must be enforced server-side, not only in the UI.
- Borrowers may view their own loans and reservations.
- Staff/admin users may manage loans and inventory according to assigned permissions.
- Sensitive data, such as passwords or tokens, must never be logged.
- Passwords must be hashed using an accepted password hashing algorithm.
- Input must be validated server-side before persistence.

Avoid:
- Trusting client-side role checks.
- Exposing full member borrowing history to unauthorized users.
- Storing secrets in source code or frontend bundles.

---

### IV. Spec-First, Traceable Changes

Specifications are the source of truth for what should be built. Implementation should follow the approved spec, plan, and task breakdown.

Required behavior:
- Every feature starts with a spec describing user goals, acceptance criteria, and key edge cases.
- Plans must explain major design choices and trade-offs.
- Tasks must be small enough to review and test independently.
- Implementation must not introduce major behavior not described in the spec.
- Any discovered requirement change should update the spec before code is changed.

Avoid:
- “Just implement it” changes with no acceptance criteria.
- Large tasks that mix UI, backend, database, and test changes without separation.
- Treating specs as disposable documentation.

---

### V. Test the Rules That Matter

Testing should focus on business-critical behavior, not arbitrary coverage targets.

Required behavior:
- Domain rules for borrowing, returning, renewing, reserving, and overdue handling must have automated tests.
- Authorization rules must have automated tests.
- Key API endpoints or user flows must have integration tests.
- Bug fixes must include a regression test when practical.
- Tests must be readable and describe the business scenario.

Recommended minimum:
- Unit tests for domain rules.
- Integration tests for API/database behavior.
- At least one end-to-end happy path for: search book → borrow → return.

Avoid:
- Requiring 100% coverage.
- Snapshot-heavy tests that break on harmless UI changes.
- Mocking so much that tests no longer verify real behavior.

---

### VI. Maintainable Architecture

The codebase should be easy to understand, modify, and review.

Required behavior:
- Separate concerns between UI, application logic, domain rules, persistence, and infrastructure.
- Keep domain concepts explicit: Book, Copy, Member, Loan, Reservation, Fine, Staff/User.
- Prefer straightforward naming over clever patterns.
- Shared logic must be extracted when duplication becomes harmful, not before.
- Database migrations must be versioned and reviewable.

Avoid:
- Premature microservices.
- Framework-specific logic leaking into domain rules.
- Deep inheritance or overly generic abstractions.
- Business rules implemented only inside database triggers unless explicitly justified.

---

### VII. Data Integrity and Auditability

Library operations must be reliable and explainable.

Required behavior:
- Important state-changing actions must record who performed the action and when.
- Loan, return, renewal, reservation, and inventory changes must be auditable.
- Destructive actions should be soft-delete or status-based where historical accuracy matters.
- Database constraints should protect critical invariants where practical.
- Data model changes must include migration and rollback considerations.

Avoid:
- Hard-deleting loan history.
- Manual data repair as a normal workflow.
- Relying only on frontend validation for critical rules.

---

### VIII. Usability and Accessibility

The system should be usable by real staff and borrowers, including non-technical users.

Required behavior:
- Core workflows must be usable with keyboard and screen readers where practical.
- Forms must show clear validation errors.
- Search, filter, and sort should be available for large lists such as books, members, and loans.
- UI must clearly show current status and next available action.
- Loading, empty, and error states must be handled intentionally.

Avoid:
- Admin screens that require memorizing IDs.
- Ambiguous actions such as “Update” when the action is actually “Return book”.
- Blocking users with unnecessary modal confirmations for low-risk actions.

---

### IX. Performance With Practical Limits

Performance should be good enough for expected library usage without premature optimization.

Required behavior:
- Common queries such as book search, availability lookup, member loan history, and overdue list must be efficient.
- Pagination or lazy loading must be used for potentially large lists.
- Expensive operations should not block normal user interactions.
- Indexes should be added for frequently queried fields.

Initial performance target:
- Common pages should respond within a reasonable interactive time under normal expected load.
- Exact scalability requirements should be defined in feature specs when needed.

Avoid:
- Optimizing for massive scale before the product needs it.
- Loading entire tables into memory for normal workflows.
- Adding caching before correctness is proven.

---

### X. Operability and Observability

The application should be easy to run, debug, and support.

Required behavior:
- The project must include clear local setup instructions.
- Configuration must be environment-based.
- Logs must be useful for debugging but must not expose sensitive data.
- Errors should be captured with enough context to diagnose failures.
- Health checks or equivalent readiness signals should exist for deployed environments.

Avoid:
- Hidden manual setup steps.
- Environment-specific behavior that is not documented.
- Logging personal data, secrets, or full request payloads by default.

---

## Quality Gates

A change is ready for implementation only when:

1. The spec identifies the user role, user goal, and acceptance criteria.
2. Important edge cases are listed.
3. Security and authorization impact is considered.
4. Data model changes are described if applicable.
5. Test expectations are clear.

A change is ready for review only when:

1. The implementation matches the spec.
2. Critical domain rules have tests.
3. Authorization-sensitive behavior has tests.
4. Database migrations are included and reviewed if needed.
5. Error, loading, and empty states are handled for user-facing changes.
6. No secrets, sensitive data, or debug-only code are committed.

A change may skip some gates only when the reason is explicitly documented in the spec or pull request.

---

## Product Domain Rules

The following rules apply unless a feature spec explicitly changes them:

- A book title may have one or more borrowable copies.
- A copy may have at most one active loan.
- A member may have multiple loans, subject to configured borrowing limits.
- A loan has a due date.
- Returning a copy closes the active loan and makes the copy available unless it is reserved, damaged, lost, or otherwise restricted.
- Overdue status must be calculated consistently from due date and return status.
- Staff/admin actions that affect loans or inventory must be auditable.
- Borrowing history should be preserved.

---

## Preferred Implementation Style

- Start simple and evolve when requirements justify it.
- Prefer explicit domain services/use cases for business operations.
- Keep APIs boring, predictable, and documented.
- Use validation at both UI and server boundaries.
- Prefer readable tests over overly abstract test helpers.
- Prefer database constraints for critical invariants when practical.
- Keep dependencies minimal and justified.

---

## Non-Goals Unless Explicitly Specified

The system does not require these by default:

- Multi-branch library support
- Payment processing
- Barcode scanner integration
- RFID integration
- Public discovery portal
- Recommendation engine
- Mobile app
- Complex fine calculation
- Multi-tenant SaaS architecture
- Microservices

These may be added later through normal spec-driven changes.

---

## Governance

This constitution is intentionally stable. It should change only when the team learns something that affects many future decisions.

Amendments require:
1. A clear reason for the change.
2. A summary of affected principles or quality gates.
3. Migration guidance for existing specs or implementation where relevant.

When there is conflict:
1. Security and data integrity take priority.
2. Domain correctness takes priority over UI convenience.
3. Simplicity takes priority over architectural novelty.
4. The approved spec takes priority over assumptions made during implementation.

**Version**: 1.0.0 | **Ratified**: 2026-05-29 | **Last Amended**: 2026-05-29