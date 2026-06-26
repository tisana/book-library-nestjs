# Usability Validation

Date: 2026-06-26

Validation used automated Playwright smoke flows and manual timing checkpoints against the phase 7 mocked demo-scale data. Timings are measured from route action to first useful content becoming visible on the local Vite development server.

| Scenario | Target | Result | Evidence |
| --- | --- | --- | --- |
| SC-001 Staff can access the dashboard after login | Useful dashboard content within 2 seconds | Pass | Staff dashboard heading, summary cards, and attention list render in `responsive-staff.spec.ts`. |
| SC-002 Staff can review books and details | Staff list/detail useful content within 2 seconds | Pass | `performance-smoke.spec.ts` renders a 100-book list and opens a book detail under the target. |
| SC-004 Staff can review active and overdue borrowings | Human-readable member/book labels are visible | Pass | `responsive-staff.spec.ts` verifies borrowing and overdue screens at desktop/tablet sizes. |
| SC-005 Staff can record borrowing/return workflows | Forms and confirmation remain reachable by keyboard-accessible controls | Pass | `accessibility.spec.ts` verifies labels, enabled record action, and modal confirmation controls. |
| SC-006 Member can open mobile home | Useful member status within 2 seconds | Pass | `performance-smoke.spec.ts` renders member home against demo-scale borrowing data under the target. |
| SC-009 Member sees reminders and limits | Due today, overdue, quota, and current-borrowing states remain visible on phone widths | Pass | `responsive-member.spec.ts` and existing reminder tests cover 390x844 and 430x932 layouts. |
| SC-010 Sign-out clears protected data | Staff/member sign-out returns to login and protected routes require a new session | Pass | Existing sign-out tests plus `token-handling-audit.md` verify memory session and query cache clearing. |

## Notes

- Staff visual checks cover 1440x900, 1024x768, and 768x1024.
- Member visual checks cover 390x844 and 430x932.
- Accessibility validation is dependency-free and focuses on semantic route guards, labels, navigation, modal dialog controls, status text, and sign-out controls.
