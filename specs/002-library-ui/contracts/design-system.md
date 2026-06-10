# Design System Contract: Library User Interface

This contract defines the look-and-feel direction for implementation. It is intentionally concrete because the project does not have dedicated UI/UX support.

## Stack

- **Styling**: Tailwind CSS with project design tokens.
- **Component source**: shadcn/ui generated components.
- **Accessible behavior primitives**: Radix UI primitives selected through shadcn/ui where available.
- **Icons**: lucide-react.
- **Tables**: TanStack Table logic rendered through shadcn/ui table components.
- **Charts/summaries**: Use simple shadcn/ui chart or hand-built semantic summaries only where they clarify operational state.

## Visual Direction

Staff back office:

- Quiet, utilitarian, dense, and scan-friendly.
- Avoid marketing-style hero sections and decorative layouts.
- Prefer clear tables, filters, side navigation, status badges, and compact forms.
- Use cards only for repeated summary items, detail panels, and modal/sheet content.

Member mobile area:

- Simple phone-first dashboard.
- Show membership tier, account status, quota, and urgent reminders before secondary history.
- Use generous touch targets and short labels.
- Keep one primary action or next-step message per status block.

## Layout Rules

| Area | Desktop/Laptop | Tablet | Phone |
| --- | --- | --- | --- |
| Staff shell | Fixed side navigation, top utility bar, content max width by workflow | Collapsible side navigation, tables keep priority columns | Supported but not primary; navigation collapses, tables may scroll horizontally |
| Member shell | Centered content column with optional secondary details | Centered content column | Single-column layout, no horizontal scroll |
| Forms | Sheet or page section for common create/edit flows | Sheet or full-page form based on width | Full-page or bottom-sheet style where appropriate |
| Tables | Dense table with filters above | Column priority and horizontal overflow | Use list cards where table would be unreadable |

## Component Rules

- Buttons use icons where a familiar icon exists and text where command clarity matters.
- Status is shown with badges and short text, never color alone.
- Destructive or irreversible actions require clear confirmation; low-risk actions should not overuse modals.
- Use skeletons for first-load content and inline pending states for mutations.
- Use toast notifications for save success only when the page content also updates visibly.
- Use form field messages tied to the relevant input.
- Use empty states that state what is missing and what action is available.

## Status Semantics

| Status | Meaning | Visual Treatment |
| --- | --- | --- |
| Available/active/on time | Normal healthy state | neutral or success badge |
| Due soon | Due within 3 calendar days | warning badge and reminder |
| Due today | Due on current local date | warning badge with higher priority than due soon |
| Overdue | Due date has passed and not returned | danger badge and top reminder |
| Quota reached | No remaining active borrowing allowance | warning badge and quota explanation |
| Suspended/inactive | Member cannot borrow | danger or disabled treatment with explanation |
| Returned | Historical completed borrowing | neutral badge |

## Accessibility Requirements

- All primary workflows must be keyboard operable.
- Dialogs, dropdowns, popovers, tabs, and menus must preserve focus management.
- Inputs must have accessible labels and error descriptions.
- Icon-only buttons must have accessible names and tooltips when meaning is not obvious.
- Color contrast must support normal text and status labels on light and dark themes if dark mode is included.
- Motion must respect reduced-motion preferences.

## Responsive Acceptance Checks

Before completion, verify:

- Staff dashboard and list screens at 1440x900, 1024x768, and 768x1024.
- Member home and borrowing list at 390x844 and 430x932.
- Text does not overlap or overflow for long book titles, long member names, and long catalog identifiers.
- Touch targets on member screens are at least 44px in both dimensions where practical.
- Primary status and next action remain visible above the fold on member home.

## Theme Direction

- Use a neutral base with restrained accent colors.
- Do not let the UI become a one-hue theme.
- Use status colors only for status meaning.
- Use 8px or smaller radius for operational staff cards unless the shadcn default component requires otherwise.
- Member cards may use slightly more spacing but should still remain compact.
