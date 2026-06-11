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

Selected direction: **Ledger Blue**.

Reference mockup: [ledger-blue-reference.png](../assets/ledger-blue-reference.png)

Ledger Blue is a structured circulation-console design language for high-volume
library operations. It uses a blue and white base, compact data density,
split-pane task flows, and clear status semantics. The member self-service area
uses the same visual system with simpler rows, larger touch targets, and a
single-column hierarchy.

Staff back office:

- Quiet, utilitarian, dense, and scan-friendly.
- Avoid marketing-style hero sections and decorative layouts.
- Prefer clear tables, command search, filters, side navigation, status badges, split detail panels, and compact forms.
- Use cards only for repeated summary items, detail panels, and modal/sheet content.
- Make borrowing and return workflows feel like a circulation console: selected row on the left, detail and action panel on the right.

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

### Ledger Blue Screen Patterns

| Pattern | Use For | Composition |
| --- | --- | --- |
| Circulation console | Borrowing records, returns, selected borrowing detail | Sidebar, command bar, table pane, selected detail pane, right member preview or contextual summary |
| Management list | Books, catalog, membership types, members | Sidebar, top utility bar, page title, search/filter row, dense table, add/edit sheet |
| Detail workspace | Book, member, borrowing detail | Summary header, status badges, tabs, policy/availability block, history table or timeline |
| Member home | `/member` mobile-first dashboard | Tier/status block, quota progress, urgent reminders, active borrowings, return guidance |

## Component Rules

- Buttons use icons where a familiar icon exists and text where command clarity matters.
- Status is shown with badges and short text, never color alone.
- Destructive or irreversible actions require clear confirmation; low-risk actions should not overuse modals.
- Use skeletons for first-load content and inline pending states for mutations.
- Use toast notifications for save success only when the page content also updates visibly.
- Use form field messages tied to the relevant input.
- Use empty states that state what is missing and what action is available.
- Use split panes for workflows where a selected table row drives a detail/action area.
- Use command search for staff workflows that benefit from fast keyboard access, especially circulation, books, and members.
- Keep staff row height compact, but leave enough space for two-line due date/status text where needed.
- Selected rows use a pale blue background and a stronger blue leading edge or checkbox state.
- Member list items should be row-like grouped surfaces, not heavy individual cards unless each item needs rich detail.

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

- Use Ledger Blue as the implementation theme.
- Use a white base with restrained blue accents and cool neutral surfaces.
- Do not let the UI become a one-hue theme: reserve strong blue for primary navigation, selected states, and primary actions.
- Use status colors only for status meaning.
- Use 8px or smaller radius for operational staff cards unless the shadcn default component requires otherwise.
- Member cards may use slightly more spacing but should still remain compact.

### Color Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `background` | `#FFFFFF` | Main app canvas and card surfaces |
| `foreground` | `#102A56` | Headings and primary text |
| `muted-foreground` | `#64748B` | Secondary text, metadata, helper copy |
| `primary` | `#155EEF` | Primary actions, active navigation, selected controls |
| `primary-foreground` | `#FFFFFF` | Text/icons on primary blue |
| `primary-soft` | `#EFF6FF` | Selected rows, soft highlights, member quota surfaces |
| `primary-line` | `#D6E9FF` | Blue-tinted borders and separators |
| `sidebar` | `#063B73` | Staff navigation shell |
| `sidebar-accent` | `#0B64D8` | Active navigation item |
| `border` | `#D8E1EC` | Default dividers and input borders |
| `muted` | `#F6F9FC` | Subtle table/header backgrounds |
| `success` | `#16A34A` | Active, available, returned successfully |
| `success-soft` | `#EAF8F0` | Success badge background |
| `warning` | `#F59E0B` | Due soon, due today, quota warning |
| `warning-soft` | `#FFF7E6` | Warning badge background |
| `danger` | `#DC2626` | Overdue, suspended, destructive confirmation |
| `danger-soft` | `#FDECEC` | Danger badge background and overdue alert |

### Typography

- Use `Inter` as the default UI font. `IBM Plex Sans` is acceptable if the implementation wants a more ledger-like operational feel.
- Body text defaults to `14px` in staff tables and `16px` in member mobile surfaces.
- Use tabular numbers for due dates, quotas, borrowing IDs, and dashboard metrics where practical.
- Keep page titles concise and task-oriented, such as `Borrowing Management`, `Members`, and `Book Collection`.

### Density And Shape

- Staff surfaces use `4px` to `8px` radius and compact vertical rhythm.
- Member surfaces may use `8px` radius and more padding, but should still feel connected to the staff theme.
- Prefer borders and separators over shadows. Use shadow only for overlays, popovers, and sheets.
- Tables should support selected row, hover row, disabled row, loading skeleton row, and empty state variants.
