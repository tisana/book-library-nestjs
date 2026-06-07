# Feature Specification: Library User Interface

**Feature Branch**: `002-library-ui`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "Create a UI for the existing book library application. Staff or librarians need a browser-based back office for books, catalog, and membership management. Members need a simple mobile-first membership application showing membership tier, current borrowed books, due date status, reminders, and borrowing quota/limit status."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Library Back Office (Priority: P1)

A staff member or librarian can sign in to a browser-based back office, review operational status, search and manage books, maintain catalog classifications, manage membership types and members, and handle borrowing and return workflows from clear task-focused screens.

**Why this priority**: Staff need a reliable operational interface before library records, member eligibility, and borrowing activity can be managed day to day.

**Independent Test**: Can be fully tested by signing in as staff, adding or updating a book, finding a member, reviewing the member's borrowing eligibility, recording a valid borrowing or return, and confirming that the displayed inventory and member status update correctly.

**Acceptance Scenarios**:

1. **Given** a staff member is signed in, **When** they open the back office, **Then** they see role-appropriate navigation and operational summaries for books, members, active loans, overdue loans, and items needing attention.
2. **Given** a staff member has a new book to add, **When** they enter the required catalog and quantity details, **Then** the book appears in searchable collection views with correct availability status.
3. **Given** a member wants to borrow a book, **When** staff selects the member and book for a valid borrowing transaction, **Then** the UI shows the calculated due date, records the active borrowing, reduces available quantity, and shows the member's remaining quota.
4. **Given** a borrowed book is returned, **When** staff records the return, **Then** the UI marks the borrowing as returned, restores book availability, and preserves the borrowing history.
5. **Given** a borrowing action is blocked by availability, member status, borrowing limit, or overdue loans, **When** staff attempts the action, **Then** the UI explains the specific reason and shows the next available correction.

---

### User Story 2 - View Member Borrowing Status on Mobile (Priority: P2)

A member can open a simple mobile-first membership area, confirm their membership tier and status, see current borrowed books, understand due date status, and know how many more books they may borrow.

**Why this priority**: Members need fast self-service visibility into what they have borrowed and what action they need to take next, reducing staff questions and overdue surprises.

**Independent Test**: Can be fully tested on a phone-sized viewport by signing in as a member with active loans, opening the member home screen, and confirming that membership tier, quota, borrowed books, due dates, and status labels are visible without staff-only information.

**Acceptance Scenarios**:

1. **Given** a member is signed in, **When** they open the membership area on a phone, **Then** they see their membership tier, account status, active borrowing count, maximum borrowing limit, and remaining quota.
2. **Given** a member has active borrowed books, **When** they view the borrowing list, **Then** each book shows title, borrowed date, due date, and an on-time, due-soon, due-today, or overdue status.
3. **Given** a member has no active borrowed books, **When** they open the membership area, **Then** they see an empty state that confirms no current borrowings and shows their available quota.
4. **Given** a member has reached their borrowing limit, **When** they view their quota, **Then** the UI clearly shows that no further borrowing quota remains until a book is returned.

---

### User Story 3 - Receive Borrowing Reminders and Limit Warnings (Priority: P3)

A member can quickly notice due-soon, due-today, overdue, suspended, or quota-reached conditions from prominent in-app reminders and status messages.

**Why this priority**: Reminders and quota warnings help members act before books become overdue and help them understand why additional borrowing may be unavailable.

**Independent Test**: Can be fully tested by viewing member accounts that have a due-soon loan, a due-today loan, an overdue loan, and a quota-reached state, then confirming that each state shows a distinct reminder and practical next step.

**Acceptance Scenarios**:

1. **Given** a borrowed book is due within the configured due-soon window, **When** the member opens the membership area, **Then** the UI shows an in-app reminder with the due date and return guidance.
2. **Given** a borrowed book is overdue, **When** the member opens the membership area, **Then** the UI highlights the overdue status before lower-priority content and explains that new borrowing may be blocked until return.
3. **Given** the member has reached the borrowing limit, **When** the member views their membership status, **Then** the UI shows the limit, active borrowed count, and the requirement to return a book before more quota is available.

---

### Edge Cases

- A staff user has a valid account but lacks permission for a requested management action.
- A staff user attempts to create borrowing for an unavailable book, inactive member, suspended member, member with overdue loans, or member at the borrowing limit.
- A member has zero current borrowings.
- A member has multiple books with mixed due states, including due soon, due today, and overdue.
- A due date changes status across a date boundary while the member view is open.
- A member account is suspended or deactivated after the member has signed in.
- A member record has a missing or inactive membership tier.
- Long book titles, author names, member names, and catalog identifiers must not break mobile or desktop layouts.
- Staff list views return no results after search or filtering.
- The system cannot load data, the user's session expires, or a save action fails.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide separate role-appropriate entry points for staff/librarian users and member users.
- **FR-002**: System MUST require staff/librarian users to sign in before accessing back office screens.
- **FR-003**: System MUST require member users to sign in before viewing personal membership or borrowing information.
- **FR-004**: System MUST prevent members from viewing other members' personal identity, membership, or borrowing information.
- **FR-005**: Back office screens MUST show operational summaries for books, members, active borrowings, overdue borrowings, unavailable books, and members needing attention.
- **FR-006**: Staff users MUST be able to search, filter, sort, paginate, view, create, update, and deactivate book records.
- **FR-007**: Staff users MUST be able to manage catalog classifications used by books, including whether a classification is active and the loan period it represents.
- **FR-008**: Staff users MUST be able to search, filter, sort, paginate, view, create, update, and deactivate member records.
- **FR-009**: Staff users MUST be able to manage membership tiers and their borrowing limits.
- **FR-010**: Staff users MUST be able to view a member's current borrowing eligibility, active borrowed count, remaining quota, current borrowings, overdue items, and borrowing history.
- **FR-011**: Staff users MUST be able to record valid borrowing and return actions from the back office.
- **FR-012**: Back office borrowing screens MUST show clear blocking reasons when borrowing is denied by book availability, member status, borrowing limit, overdue loans, missing loan-period rules, or invalid dates.
- **FR-013**: Back office screens MUST preserve and display borrowing history even when related books, catalog classifications, or members are deactivated.
- **FR-014**: Member screens MUST be mobile-first and remain usable on common phone widths without horizontal scrolling.
- **FR-015**: Member screens MUST show the member's membership tier, membership status, active borrowed count, maximum borrowing limit, and remaining borrowing quota.
- **FR-016**: Member screens MUST list current borrowed books with title, borrowed date, due date, and current due status.
- **FR-017**: System MUST classify member due date status as on time, due soon, due today, overdue, or returned where relevant.
- **FR-018**: Member screens MUST show in-app reminders for due-soon, due-today, overdue, suspended, inactive, and quota-reached states.
- **FR-019**: When a member has reached the borrowing limit, the member screen MUST show the limit, active borrowed count, and what must change before more quota is available.
- **FR-020**: The UI MUST show intentional loading, empty, validation, permission-denied, session-expired, and general error states.
- **FR-021**: The UI MUST use consistent book, member, membership, borrowing, return, due date, overdue, and quota terminology across staff and member experiences.
- **FR-022**: The UI MUST make primary staff workflows usable with keyboard navigation and screen-reader-accessible labels.
- **FR-023**: The UI MUST make primary member workflows readable and operable on mobile devices with sufficient contrast, clear touch targets, and non-overlapping text.
- **FR-024**: The UI MUST refresh visible inventory, borrowing, quota, and due status after successful state-changing staff actions without requiring users to manually find the changed record again.
- **FR-025**: External push notifications, email notifications, SMS notifications, public discovery search, online reservations, and self-service member borrowing creation are outside this feature unless added by a later specification.

### Key Entities *(include if feature involves data)*

- **Staff/Librarian User**: A back office user who manages library operations according to assigned permissions.
- **Member User**: A library member who views their own membership tier, borrowing status, due dates, reminders, and quota.
- **Book**: A cataloged library item with visible identity, classification, total quantity, available quantity, and active/deactivated status.
- **Catalog Classification**: A grouping used to organize books and determine their expected loan period.
- **Membership Tier**: A member category that defines the maximum number of active borrowings a member may have.
- **Member**: A person registered with the library, including membership status, membership tier, borrowing limit, active borrowings, and borrowing history.
- **Borrowing Record**: A record connecting a member to a borrowed book, including borrowed date, due date, return date when returned, and current status.
- **Reminder**: A visible in-app notice that highlights due-soon, due-today, overdue, suspended, inactive, or quota-reached conditions.
- **Quota Status**: The member's current borrowing allowance, including maximum limit, active borrowed count, remaining quota, and whether the limit has been reached.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can find and update an existing book or member record in under 2 minutes during usability testing.
- **SC-002**: Staff can complete a valid borrowing or return action in under 1 minute when the member and book already exist.
- **SC-003**: 100% of staff borrowing attempts blocked by availability, member status, overdue loans, or borrowing limit display the correct reason to the user.
- **SC-004**: Members can confirm their tier, current borrowed count, remaining quota, and next due date in under 30 seconds on a phone-sized screen.
- **SC-005**: 90% of staff test users can complete catalog, member lookup, borrowing, and return workflows without external assistance.
- **SC-006**: 90% of member test users can identify whether each current borrowing is on time, due soon, due today, or overdue without external assistance.
- **SC-007**: 100% of member privacy checks confirm that members only see their own membership and borrowing information.
- **SC-008**: Common list, search, and detail views show useful results, empty states, or error states within 2 seconds under normal expected library usage.

## Assumptions

- The existing library system already owns book, catalog classification, membership tier, member, borrowing, due date, return, overdue, and eligibility rules.
- The UI will display and submit information through the existing library system rather than duplicating borrowing rules in presentation screens.
- Staff/librarian users are the primary actors for creating and updating library records and recording borrowing or return actions.
- Member self-service in this feature is limited to viewing membership, borrowing, due date, reminder, and quota status.
- Member-initiated borrowing, online reservations, payments, fines, public catalog browsing, barcode scanning, and branch selection are outside this feature.
- Due soon means a current borrowing is due within 3 calendar days, unless a later specification changes the reminder window.
- Dates are shown using the library's local calendar conventions and must avoid ambiguity around due today and overdue states.
- External notifications are outside scope for this version; reminders are visible inside the member experience.
