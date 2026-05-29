# Feature Specification: Book Borrowing System

**Feature Branch**: `001-book-borrowing-system`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "This project intended to build as a book borrowing system like we have in a library. I want to have data on collection of books where it can be borrowed by member. It needs due date, quantity of the book. Membership system so it can track borrowing book, limited number of books a person can borrow. Tracking system to manage borrowing books."

## Clarifications

### Session 2026-05-29

- Q: How should borrowing limits be determined for members? -> A: Borrowing limit is defined by membership type.
- Q: How should books be tracked for borrowing availability? -> A: Track books by title/catalog record with total and available quantity only.
- Q: How should due dates be determined for borrowing records? -> A: Due date is calculated from the book category or collection type.
- Q: How should overdue loans affect borrowing eligibility? -> A: Block new borrowing until overdue loans are returned.

### Session 2026-05-30

- Q: How should staff/admin authentication and authorization be handled? -> A: Add first-party staff/admin JWT authentication and role authorization.
- Q: How should MongoDB data model changes be managed? -> A: Add versioned MongoDB migration scripts with rollback notes.
- Q: How should MongoDB transaction support be handled? -> A: Configure MongoDB replica set support for transactions in local/test/container environments.
- Q: How should User Story 1 stay independently testable before borrowing exists? -> A: Validate collection availability display only; borrowing rejection is covered by User Story 3.
- Q: How should User Story 2 stay independently testable before borrowing exists? -> A: Validate member policy status and remaining allowance only; loan creation is covered by User Story 3.
- Q: Should Borrowing Policy be a persisted data entity? -> A: No; Borrowing Policy is non-persisted domain logic enforced by services.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Borrowable Book Collection (Priority: P1)

A library staff member can maintain a collection of books, including how many copies are owned and how many copies are available for borrowing.

**Why this priority**: Borrowing cannot be managed reliably unless the library knows what books exist and whether copies are available.

**Independent Test**: Can be fully tested by adding a book with a copy quantity, viewing its availability, and confirming that books with zero available quantity are shown as unavailable in collection views.

**Acceptance Scenarios**:

1. **Given** a library staff member has a new book to add, **When** they record the book details and quantity, **Then** the book appears in the collection with the correct available copy count.
2. **Given** a book has zero available quantity, **When** staff views or searches the collection, **Then** the book is clearly shown as unavailable and is not listed as available for borrowing.

---

### User Story 2 - Track Member Borrowing Limits (Priority: P2)

A library staff member can maintain member records and enforce the maximum number of books each active member may borrow at one time based on the member's membership type.

**Why this priority**: The system must prevent one member from borrowing beyond the allowed limit and must show each member's current borrowing status.

**Independent Test**: Can be fully tested by creating an active member with a membership type that has a borrowing limit, setting or viewing the member's active borrowed count, and confirming the system shows whether the member is within or at the configured limit.

**Acceptance Scenarios**:

1. **Given** an active member is below their borrowing limit, **When** staff views the member's borrowing status, **Then** the system shows the member as eligible by limit and displays remaining borrowing allowance.
2. **Given** an active member has reached their borrowing limit, **When** staff views the member's borrowing status, **Then** the system shows that the borrowing limit has been reached.
3. **Given** a member is inactive or suspended, **When** staff views the member's borrowing status, **Then** the system shows the member as ineligible for new borrowing.

---

### User Story 3 - Manage Borrowing Lifecycle (Priority: P3)

A library staff member can record when a member borrows a book, have the due date calculated from the book category or collection type, track the loan until return, and identify overdue items.

**Why this priority**: The core operational value is knowing who has each borrowed book, when it is due, and when it has been returned.

**Independent Test**: Can be fully tested by lending an available book to an eligible member, verifying the category-based due date and active loan record, returning the book, and confirming the book is available again.

**Acceptance Scenarios**:

1. **Given** an active member is eligible to borrow and a book copy is available, **When** staff records the borrowing transaction, **Then** the system creates an active loan with a due date calculated from the book category or collection type and reduces the book's available quantity by one.
2. **Given** a member returns a borrowed book, **When** staff records the return, **Then** the loan is marked returned and the book's available quantity increases by one.
3. **Given** an active loan is past its due date, **When** staff reviews borrowing records, **Then** the loan is clearly identifiable as overdue.

---

### Edge Cases

- A book quantity cannot be reduced below the number of copies currently on loan.
- A book cannot be borrowed when its available quantity is zero.
- A borrowing record cannot be created without an eligible member, borrowable book, and book category or collection type with an active loan period.
- A calculated due date cannot be earlier than the borrowing date.
- Returning the same borrowing record more than once must not increase availability more than once.
- Suspended or inactive members cannot create new borrowing records but their existing borrowing history remains visible.
- If a member has overdue books, the system prevents additional borrowing until the overdue loans are returned.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow staff to create, view, update, and deactivate book records in the library collection.
- **FR-002**: System MUST store each book's title, author, identifying catalog information, book category or collection type, total quantity, available quantity, and borrowing status at the title/catalog record level.
- **FR-003**: System MUST prevent a book's total quantity from being set lower than the number of active loans for that book.
- **FR-004**: System MUST allow staff to create, view, update, and deactivate member records.
- **FR-005**: System MUST store each member's identity details, membership status, membership type, active borrowed count, and borrowing history.
- **FR-006**: System MUST prevent inactive or suspended members from creating new borrowing records.
- **FR-007**: System MUST allow staff to create a borrowing record only when the selected member is eligible, the selected book has at least one available copy, and the book category or collection type has an active loan period.
- **FR-008**: System MUST reduce a book's available quantity by one when a borrowing record is created.
- **FR-009**: System MUST prevent a member from borrowing more books than the borrowing limit assigned to their membership type.
- **FR-010**: System MUST track each borrowing record with the member, book catalog record, borrowed date, due date, return date when returned, and current status.
- **FR-011**: System MUST mark active borrowing records as overdue when the due date has passed and the book has not been returned.
- **FR-012**: System MUST allow staff to record book returns and increase the book's available quantity by one exactly once per returned loan.
- **FR-013**: System MUST allow staff to view active, returned, and overdue borrowing records by member and by book.
- **FR-014**: System MUST preserve borrowing history even after books or members are deactivated.
- **FR-015**: System MUST provide clear validation messages when borrowing is blocked by availability, membership status, borrowing limit, overdue loans, missing loan-period rules, or invalid dates.
- **FR-016**: System MUST calculate each borrowing due date from the loan period assigned to the borrowed book's category or collection type.
- **FR-017**: System MUST block new borrowing for members with overdue loans until those overdue loans are returned.
- **FR-018**: System MUST require first-party staff/admin JWT authentication for all book, category, membership type, member, and borrowing management actions.
- **FR-019**: System MUST enforce staff/admin role authorization server-side for all protected management actions.
- **FR-020**: System MUST store staff/admin credentials securely using accepted password hashing and MUST NOT expose or log passwords, hashes, or tokens.
- **FR-021**: System MUST record the authenticated staff/admin actor for auditable state-changing actions.
- **FR-022**: System MUST manage MongoDB collection, index, and seed/reference data changes through versioned migration scripts with rollback notes.
- **FR-023**: System MUST run borrowing and return consistency updates in transaction-capable MongoDB environments for local development, automated tests, and container deployments.
- **FR-024**: System MUST enforce Borrowing Policy as non-persisted domain/service logic rather than as a separate persisted policy record in the first version.

### Key Entities *(include if feature involves data)*

- **Book**: A library collection item tracked at the title/catalog record level rather than as individually identified physical copies. Key attributes include title, author, catalog identifier, total quantity, available quantity, and active/deactivated status.
- **Book Category or Collection Type**: A classification assigned to books that determines the loan period used to calculate borrowing due dates.
- **Member**: A person registered with the library. Key attributes include identity details, membership status, membership type, active borrowed count, and borrowing history.
- **Membership Type**: A category of membership that defines borrowing rules for members in that category, including the maximum number of active loans allowed.
- **Borrowing Record**: A transaction connecting one member to one borrowed book. Key attributes include borrowed date, due date, return date, status, and overdue state.
- **Borrowing Policy**: Non-persisted domain/service logic that determines eligibility, including member status requirements, maximum active loans per member, and overdue-loan borrowing blocks.
- **Staff/Admin User**: An authenticated system user allowed to perform protected library management actions according to assigned roles.
- **Migration Record**: A versioned record of an applied MongoDB data model change, including the change identifier, applied timestamp, and rollback guidance.
- **MongoDB Deployment Configuration**: Runtime database configuration that supports transactions consistently across local development, automated tests, and container deployments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can record a new book and its quantity in under 2 minutes.
- **SC-002**: Staff can complete a valid borrowing transaction in under 1 minute when the member and book already exist.
- **SC-003**: The system prevents 100% of borrowing attempts that would exceed member limits or available book quantity.
- **SC-004**: Staff can identify all currently borrowed and overdue books for a member in under 30 seconds.
- **SC-005**: Book availability counts remain accurate after borrowing and return workflows across at least 100 consecutive transactions.
- **SC-006**: At least 90% of staff test users can complete the primary book lending and return workflows without external assistance.
- **SC-007**: 100% of protected management actions reject unauthenticated requests and requests from authenticated users without the required role.

## Assumptions

- Library staff are the primary users for managing books, members, borrowing, and returns.
- Members are tracked by the system, but self-service member borrowing is outside the first version unless added later.
- Each borrowing record represents one borrowed copy of one book.
- Individual physical copy identifiers, barcodes, and copy-level condition tracking are outside the first version.
- Due dates are calculated automatically from the borrowed book's category or collection type.
- Borrowing limits are configured by membership type.
- Active overdue loans block new borrowing until returned.
- Deactivating a book or member prevents new borrowing activity but does not delete historical records.
- Staff and administrator accounts are managed inside this service for the first version.
- MongoDB schema, index, and reference-data changes are deployed through versioned migration scripts instead of relying only on automatic schema synchronization.
- Local development, automated tests, and container deployments use MongoDB configuration that supports transactions.
- Borrowing Policy rules are implemented as service-domain logic for the first version, not stored as a separate policy collection.
