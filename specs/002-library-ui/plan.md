# Implementation Plan: Library User Interface

**Branch**: `002-library-ui` | **Date**: 2026-06-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-library-ui/spec.md`

## Summary

Build a responsive web UI for the existing book library system. Add a desktop/tablet-oriented staff back office for catalog, membership, member, borrowing, and return workflows, plus a mobile-first member self-service area for membership tier, active borrowings, due status, reminders, and quota state. Use a React/Vite/TypeScript frontend with a modern, maintainable component system based on Tailwind CSS, shadcn/ui, and accessible primitives. Consume the existing NestJS REST API for staff workflows and add the minimal member-scoped authentication/read support required for the member UI privacy requirements.

## Technical Context

**Language/Version**: TypeScript 5.9.x for frontend and backend consistency; React current stable; Vite current stable with Node.js 20.19+ or 22.12+ as required by current Vite documentation.

**Primary Dependencies**: React, React DOM, Vite, `@vitejs/plugin-react`, Tailwind CSS, `@tailwindcss/vite`, shadcn/ui generated components, Radix UI primitives, lucide-react, TanStack Query, TanStack Router, TanStack Table, React Hook Form, Zod, date-fns or equivalent lightweight date utility, Vitest, Testing Library, Playwright, and MSW for frontend REST mocking.

**Storage**: Existing MongoDB remains the source of truth through the backend. Frontend stores no domain data permanently. Access tokens must not be stored in localStorage; use memory-only token handling for v1 unless backend tasks add an HTTP-only cookie session flow.

**Testing**: Keep existing backend Jest/e2e coverage. Add frontend unit/component tests with Vitest and Testing Library, REST contract mocks with MSW, and Playwright end-to-end tests for staff happy paths, blocked borrowing states, member mobile status, and access control.

**Target Platform**: Browser-based web app. Staff back office targets laptop, desktop, and tablet layouts. Member self-service targets mobile-first phone layouts while remaining usable on tablet/desktop.

**Project Type**: Frontend web application added beside the existing NestJS REST API in the same repository.

**Performance Goals**: Member home renders useful status within 2 seconds under normal expected library usage; staff list/detail screens show useful results, empty states, or errors within 2 seconds; staff can complete borrowing/return workflows within the spec success criteria.

**Constraints**: UI must not duplicate core borrowing rules. Staff actions remain auditable through backend actor context. Member users may only view their own membership and borrowing data. Back office lists must use pagination/filtering rather than loading all records. External push, email, and SMS notifications are out of scope.

**Scale/Scope**: One frontend application with two protected role areas, approximately 15 primary screens, integrated with the existing single-library backend. No native mobile app, public catalog, reservations, payment, barcode, RFID, or multi-branch support.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **User-Centered Library Workflow**: PASS. Plan separates staff/librarian and member journeys and keeps each status/action visible.
- **Correctness Over Cleverness**: PASS. Borrowing availability, due dates, eligibility, and quota remain backend-owned; UI presents backend decisions.
- **Security and Privacy by Default**: PASS with required backend support. Member self-service requires member authentication and member-scoped read endpoints because existing staff endpoints are not safe for member access.
- **Spec-First, Traceable Changes**: PASS. Artifacts map to `specs/002-library-ui/spec.md`; tasks must be generated from this plan.
- **Test the Rules That Matter**: PASS. Playwright, component tests, backend authorization tests, and contract mocks cover staff workflows, member privacy, and blocked states.
- **Maintainable Architecture**: PASS. Adds a separate `frontend/` app without moving the existing backend or introducing microservices.
- **Data Integrity and Auditability**: PASS. Staff state changes continue through authenticated backend workflows with actor tracking.
- **Usability and Accessibility**: PASS. Component stack and contracts require keyboard, screen-reader labels, responsive layouts, and explicit loading/empty/error states.
- **Performance With Practical Limits**: PASS. Uses server pagination, route-level code splitting, and server-state caching.
- **Operability and Observability**: PASS. Quickstart includes local run, build, and verification commands; UI errors avoid sensitive data.

## Project Structure

### Documentation (this feature)

```text
specs/002-library-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── design-system.md
│   ├── rest-integration.md
│   └── ui-routes.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/                         # existing NestJS API, kept in place
test/                        # existing backend e2e tests
migrations/                  # existing MongoDB migrations
scripts/                     # existing backend seed scripts

frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── public/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── query-client.ts
│   ├── routes/
│   │   ├── staff/
│   │   └── member/
│   ├── features/
│   │   ├── auth/
│   │   ├── books/
│   │   ├── catalog/
│   │   ├── membership-types/
│   │   ├── members/
│   │   ├── borrowings/
│   │   └── member-home/
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   ├── lib/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── dates/
│   │   └── validation/
│   └── test/
│       ├── mocks/
│       └── setup.ts
└── tests/
    └── e2e/
```

**Structure Decision**: Add a top-level `frontend/` Vite app and keep the existing backend structure stable. This avoids a disruptive monorepo migration while still allowing frontend-specific dependencies, tests, and build scripts.

## Complexity Tracking

No constitution violations require exceptions.

## Phase 0: Research

Completed in [research.md](research.md). Key decision: use React + Vite + TypeScript, Tailwind CSS + shadcn/ui + Radix primitives, TanStack Query/Router/Table, React Hook Form + Zod, Vitest/Testing Library/Playwright/MSW. MUI, Ant Design, Angular, and Next.js were evaluated and rejected for this project shape.

## Phase 1: Design & Contracts

Completed design artifacts:

- [data-model.md](data-model.md)
- [contracts/design-system.md](contracts/design-system.md)
- [contracts/rest-integration.md](contracts/rest-integration.md)
- [contracts/ui-routes.md](contracts/ui-routes.md)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- **User-Centered Library Workflow**: PASS. Routes and UI contracts cover staff back office, member mobile home, reminders, and quota states.
- **Correctness Over Cleverness**: PASS. UI contracts require backend-owned decisions for availability, due dates, blocked borrowing, and quota.
- **Security and Privacy by Default**: PASS. Contracts require member-scoped endpoints and forbid member access to staff endpoints.
- **Spec-First, Traceable Changes**: PASS. Generated artifacts are traceable to the UI spec and ready for `/speckit-tasks`.
- **Test the Rules That Matter**: PASS. Quickstart defines staff, member, blocked-state, privacy, and responsive validation scenarios.
- **Maintainable Architecture**: PASS. Frontend is isolated under `frontend/`; shared concepts are represented through typed API adapters and feature folders.
- **Data Integrity and Auditability**: PASS. State-changing staff actions are routed through existing backend workflows.
- **Usability and Accessibility**: PASS. Design-system contract includes responsive, keyboard, contrast, empty, loading, and error state requirements.
- **Performance With Practical Limits**: PASS. Contracts require pagination, cache invalidation, and code splitting for role areas.
- **Operability and Observability**: PASS. Quickstart provides local run/build/test validation; error handling avoids sensitive data.
