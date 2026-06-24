# Implementation Plan: Library User Interface

**Branch**: `002-library-ui` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-library-ui/spec.md`

## Summary

Build a responsive web UI for the existing book library system. Add a desktop/tablet-oriented staff back office for catalog, membership, member, borrowing, and return workflows, plus a mobile-first member self-service area for membership tier, active borrowings, due status, reminders, and quota state. Use a React/Vite/TypeScript frontend with a modern, maintainable component system based on Tailwind CSS, shadcn/ui, and accessible primitives. Consume the existing NestJS REST API for staff workflows and add the minimal member-scoped authentication/read support required for the member UI privacy requirements.

This plan amendment adds clean sign-out controls to both staff and member shells, and replaces internal MongoDB identifiers in staff-facing borrowing summaries with human-readable borrowing context. Dashboard attention rows, borrowing lists, overdue lists, and borrowing detail screens should show member names/member numbers and book titles/catalog identifiers before any internal IDs.

## Technical Context

**Language/Version**: TypeScript 5.9.x for frontend and backend consistency; React current stable; Vite current stable with Node.js 20.19+ or 22.12+ as required by current Vite documentation.

**Primary Dependencies**: React, React DOM, Vite, `@vitejs/plugin-react`, Tailwind CSS, `@tailwindcss/vite`, shadcn/ui generated components, Radix UI primitives, lucide-react, TanStack Query, TanStack Router, TanStack Table, React Hook Form, Zod, date-fns or equivalent lightweight date utility, Vitest, Testing Library, Playwright, and MSW for frontend REST mocking. The sign-out and staff display improvements require no new dependency.

**Storage**: Existing MongoDB remains the source of truth through the backend. Frontend stores no domain data permanently. Access tokens must not be stored in localStorage; use memory-only token handling for v1 unless backend tasks add an HTTP-only cookie session flow. Sign-out clears the memory session and relevant TanStack Query cache; no persistent sign-out store is introduced.

**Document Model Design**: Member self-service adds authentication data to the existing Member document instead of creating a relational-style member credentials collection. Store member credential fields on the member aggregate because login identity, membership status, and self-service authorization are read together. Add unique indexes for member login identifiers such as email or member number where used for authentication. Keep borrowings as separate documents referenced by member id because borrowing history grows without a predictable bound and needs independent status/query access. Member self-service `me` endpoints derive identity from the authenticated member token and query member, policy status, and borrowings by indexed member id.

Staff borrowing screens should use an enriched borrowing read model produced by backend population or explicit lookup of referenced Book and Member documents. The stored borrowing document remains reference-based; the response DTO may include `memberDisplayName`, `memberNumber`, `bookTitle`, and `bookCatalogIdentifier` as read-model fields. No new collection is required. No migration is required unless the implementation intentionally denormalizes snapshots into stored borrowing documents later; if that happens, the owning source and backfill/rollback strategy must be documented.

**Testing**: Keep existing backend Jest/e2e coverage. Add frontend unit/component tests with Vitest and Testing Library, REST contract mocks with MSW, and Playwright end-to-end tests for staff happy paths, blocked borrowing states, member mobile status, access control, sign-out behavior, and staff borrowing display labels that avoid raw internal IDs.

**Target Platform**: Browser-based web app. Staff back office targets laptop, desktop, and tablet layouts. Member self-service targets mobile-first phone layouts while remaining usable on tablet/desktop.

**Project Type**: Frontend web application added beside the existing NestJS REST API in the same repository.

**Performance Goals**: Member home renders useful status within 2 seconds under normal expected library usage; staff list/detail screens show useful results, empty states, or errors within 2 seconds; staff can complete borrowing/return workflows within the spec success criteria. Enriched staff borrowing rows must avoid N+1 frontend fetching; backend list/detail responses should provide display labels in the same request.

**Constraints**: UI must not duplicate core borrowing rules. Staff actions remain auditable through backend actor context. Member users may only view their own membership and borrowing data. Back office lists must use pagination/filtering rather than loading all records. Sign-out must clear role-specific session state and redirect without leaking the previous user's data through cached screens. External push, email, and SMS notifications are out of scope.

**Scale/Scope**: One frontend application with two protected role areas, approximately 15 primary screens, integrated with the existing single-library backend. No native mobile app, public catalog, reservations, payment, barcode, RFID, token revocation service, or multi-branch support.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **User-Centered Library Workflow**: PASS. Plan separates staff/librarian and member journeys, adds explicit sign-out, and removes raw ID-heavy borrowing displays from staff workflows.
- **Correctness Over Cleverness**: PASS. Borrowing availability, due dates, eligibility, and quota remain backend-owned; UI presents backend decisions and backend-provided display context.
- **Security and Privacy by Default**: PASS with required backend support. Member self-service requires member authentication and member-scoped read endpoints. Sign-out clears memory-only tokens and cached role data.
- **Spec-First, Traceable Changes**: PASS. Artifacts map to `specs/002-library-ui/spec.md`; tasks must be regenerated or amended from this plan.
- **Test the Rules That Matter**: PASS. Playwright, component tests, backend authorization tests, and contract mocks cover staff workflows, member privacy, sign-out, display labels, and blocked states.
- **Maintainable Architecture**: PASS. Adds targeted shell/display improvements without changing the top-level app structure or introducing microservices.
- **Data Integrity and Auditability**: PASS. Staff state changes continue through authenticated backend workflows with actor tracking; sign-out is not an auditable domain mutation in v1.
- **Document-Oriented MongoDB Data Modeling**: PASS. Borrowings remain referenced documents because history is unbounded; enriched display fields are response read-model fields derived from referenced Member and Book documents, not relational-style client joins.
- **Usability and Accessibility**: PASS. Component stack and contracts require keyboard, screen-reader labels, responsive layouts, explicit sign-out controls, and human-readable borrowing rows.
- **Performance With Practical Limits**: PASS. Uses server pagination, route-level code splitting, server-state caching, and backend-enriched list responses to avoid frontend N+1 queries.
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

**Structure Decision**: Add a top-level `frontend/` Vite app and keep the existing backend structure stable. This avoids a disruptive monorepo migration while still allowing frontend-specific dependencies, tests, and build scripts. Sign-out controls belong in `frontend/src/components/layout/staff-shell.tsx` and `frontend/src/components/layout/member-shell.tsx`. Staff display formatting belongs in staff borrowing/dashboard routes and shared API/view-model helpers.

## Complexity Tracking

No constitution violations require exceptions.

## Phase 0: Research

Completed in [research.md](research.md). Key decisions: use React + Vite + TypeScript, Tailwind CSS + shadcn/ui + Radix primitives, TanStack Query/Router/Table, React Hook Form + Zod, Vitest/Testing Library/Playwright/MSW; use memory-only sign-out for v1; use backend-enriched borrowing read models for staff-facing borrowing displays. MUI, Ant Design, Angular, Next.js, frontend-only borrowing joins, and a logout endpoint/token denylist were evaluated and rejected for this project shape.

## Phase 1: Design & Contracts

Completed design artifacts:

- [data-model.md](data-model.md)
- [contracts/design-system.md](contracts/design-system.md)
- [contracts/rest-integration.md](contracts/rest-integration.md)
- [contracts/ui-routes.md](contracts/ui-routes.md)
- [quickstart.md](quickstart.md)

## Post-Design Constitution Check

- **User-Centered Library Workflow**: PASS. Routes and UI contracts cover staff back office, member mobile home, reminders, quota states, sign-out, and human-readable borrowing rows.
- **Correctness Over Cleverness**: PASS. UI contracts require backend-owned decisions for availability, due dates, blocked borrowing, quota, and display context.
- **Security and Privacy by Default**: PASS. Contracts require member-scoped endpoints, forbid member access to staff endpoints, and require sign-out to clear memory session state and cached role data.
- **Spec-First, Traceable Changes**: PASS. Generated artifacts are traceable to the UI spec and ready for `/speckit-tasks`.
- **Test the Rules That Matter**: PASS. Quickstart defines staff, member, blocked-state, privacy, sign-out, human-readable display, and responsive validation scenarios.
- **Maintainable Architecture**: PASS. Frontend is isolated under `frontend/`; shared concepts are represented through typed API adapters and feature folders.
- **Data Integrity and Auditability**: PASS. State-changing staff actions are routed through existing backend workflows; enriched borrowing labels are read-model data.
- **Document-Oriented MongoDB Data Modeling**: PASS. Member authentication extends the existing member document aggregate; borrowings remain referenced because history is unbounded; enriched display labels are derived from referenced documents without creating relational join tables.
- **Usability and Accessibility**: PASS. Design-system contract includes responsive, keyboard, contrast, empty, loading, error, sign-out, and ID-avoidance requirements.
- **Performance With Practical Limits**: PASS. Contracts require pagination, cache invalidation, code splitting, and enriched borrowing responses that avoid frontend N+1 queries.
- **Operability and Observability**: PASS. Quickstart provides local run/build/test validation; error handling avoids sensitive data.
