# Feature Specification: Book Borrowing System

**Feature Branch**: `001-book-borrowing-system`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "This project intended to build as a book borrowing system like we have in a library. I want to have data on collection of books where it can be borrowed by member. It needs due date, quantity of the book. Membership system so it can track borrowing book, limited number of books a person can borrow. Tracking system to manage borrowing books."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Borrowable Book Collection (Priority: P1)

A library staff member can maintain a collection of books, including how many copies are owned and how many copies are available for borrowing.

**Why this priority**: Borrowing cannot be managed reliably unless the library knows what books exist and whether copies are available.

**Independent Test**: Can be fully tested by adding a book with a copy quantity, viewing its availability, and confirming that unavailable books cannot be borrowed.

**Acceptance Scenarios**:

1. **Given** a library staff member has a new book to add, **When** they record the book details and quantity, **Then** the book appears in the collection with the correct available copy count.
2. **Given** all copies of a book are already borrowed, **When** a member attempts to borrow that book, **Then** the borrowing request is rejected because no copies are available.

---

### User Story 2 - Track Member Borrowing Limits (Priority: P2)

A library staff member can maintain member records and enforce the maximum number of books each active member may borrow at one time.

**Why this priority**: The system must prevent one member from borrowing beyond the allowed limit and must show each member's current borrowing status.

**Independent Test**: Can be fully tested by creating an active member with a borrowing limit, lending books up to that limit, and confirming that another loan is blocked.

**Acceptance Scenarios**:

1. **Given** an active member is below their borrowing limit, **When** they borrow an available book, **Then** the loan is recorded and the member's active borrowed count increases.
2. **Given** an active member has reached their borrowing limit, **When** they attempt to borrow another book, **Then** the system prevents the loan and explains that the borrowing limit has been reached.
3. **Given** a member is inactive or suspended, **When** they attempt to borrow a book, **Then** the system prevents the loan.

---

### User Story 3 - Manage Borrowing Lifecycle (Priority: P3)

A library staff member can record when a member borrows a book, assign a due date, track the loan until return, and identify overdue items.

**Why this priority**: The core operational value is knowing who has each borrowed book, when it is due, and when it has been returned.

**Independent Test**: Can be fully tested by lending an available book to an eligible member, verifying the due date and active loan record, returning the book, and confirming the book is available again.

**Acceptance Scenarios**:

1. **Given** an active member is eligible to borrow and a book copy is available, **When** staff records the borrowing transaction with a due date, **Then** the system creates an active loan for that member and reduces the book's available quantity by one.
2. **Given** a member returns a borrowed book, **When** staff records the return, **Then** the loan is marked returned and the book's available quantity increases by one.
3. **Given** an active loan is past its due date, **When** staff reviews borrowing records, **Then** the loan is clearly identifiable as overdue.

---

### Edge Cases

- A book quantity cannot be reduced below the number of copies currently on loan.
- A book cannot be borrowed when its available quantity is zero.
- A borrowing record cannot be created without an eligible member, borrowable book, and due date.
- A due date cannot be earlier than the borrowing date.
- Returning the same borrowing record more than once must not increase availability more than once.
- Suspended or inactive members cannot create new borrowing records but their existing borrowing history remains visible.
- If a member has overdue books, the system prevents additional borrowing until the overdue loans are resolved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow staff to create, view, update, and deactivate book records in the library collection.
- **FR-002**: System MUST store each book's title, author, identifying catalog information, total quantity, available quantity, and borrowing status.
- **FR-003**: System MUST prevent a book's total quantity from being set lower than the number of active loans for that book.
- **FR-004**: System MUST allow staff to create, view, update, and deactivate member records.
- **FR-005**: System MUST store each member's identity details, membership status, borrowing limit, active borrowed count, and borrowing history.
- **FR-006**: System MUST prevent inactive or suspended members from creating new borrowing records.
- **FR-007**: System MUST allow staff to create a borrowing record only when the selected member is eligible, the selected book has at least one available copy, and a valid due date is provided.
- **FR-008**: System MUST reduce a book's available quantity by one when a borrowing record is created.
- **FR-009**: System MUST prevent a member from borrowing more books than their configured borrowing limit allows.
- **FR-010**: System MUST track each borrowing record with the member, book, borrowed date, due date, return date when returned, and current status.
- **FR-011**: System MUST mark active borrowing records as overdue when the due date has passed and the book has not been returned.
- **FR-012**: System MUST allow staff to record book returns and increase the book's available quantity by one exactly once per returned loan.
- **FR-013**: System MUST allow staff to view active, returned, and overdue borrowing records by member and by book.
- **FR-014**: System MUST preserve borrowing history even after books or members are deactivated.
- **FR-015**: System MUST provide clear validation messages when borrowing is blocked by availability, membership status, borrowing limit, overdue loans, or invalid dates.

### Key Entities *(include if feature involves data)*

- **Book**: A library collection item that can be borrowed. Key attributes include title, author, catalog identifier, total quantity, available quantity, and active/deactivated status.
- **Member**: A person registered with the library. Key attributes include identity details, membership status, borrowing limit, active borrowed count, and borrowing history.
- **Borrowing Record**: A transaction connecting one member to one borrowed book. Key attributes include borrowed date, due date, return date, status, and overdue state.
- **Borrowing Policy**: Library rules that determine eligibility, including member status requirements, maximum active loans per member, and whether overdue loans block new borrowing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can record a new book and its quantity in under 2 minutes.
- **SC-002**: Staff can complete a valid borrowing transaction in under 1 minute when the member and book already exist.
- **SC-003**: The system prevents 100% of borrowing attempts that would exceed member limits or available book quantity.
- **SC-004**: Staff can identify all currently borrowed and overdue books for a member in under 30 seconds.
- **SC-005**: Book availability counts remain accurate after borrowing and return workflows across at least 100 consecutive transactions.
- **SC-006**: At least 90% of staff test users can complete the primary book lending and return workflows without external assistance.

## Assumptions

- Library staff are the primary users for managing books, members, borrowing, and returns.
- Members are tracked by the system, but self-service member borrowing is outside the first version unless added later.
- Each borrowing record represents one borrowed copy of one book.
- Borrowing limits are configurable per member or by a library policy assigned to the member.
- Active overdue loans block new borrowing until returned or otherwise resolved.
- Deactivating a book or member prevents new borrowing activity but does not delete historical records.
