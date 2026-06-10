# Research: Library User Interface

**Date**: 2026-06-07

## Decision: React + Vite + TypeScript as the frontend application stack

**Rationale**: The backend is already TypeScript/NestJS and exposes a REST contract, so a TypeScript frontend keeps validation, DTO naming, and developer tooling aligned. React has the strongest ecosystem for the requested component-library direction. Vite fits this project because the UI is an authenticated application consuming an existing REST backend; it can ship as static assets without adding an unnecessary server-rendering runtime. Current Vite docs include React TypeScript templates, modern browser targeting, fast development behavior, and a clear TypeScript build/check split.

**Alternatives considered**:

- **Next.js**: Strong React framework, but the feature does not need public SEO, server components, or a second server runtime. It would add deployment and authentication complexity for little benefit in this internal/member app.
- **Angular + Angular Material**: Strong TypeScript alignment with NestJS, but heavier for this repo and less aligned with the user's request for current trend UI libraries and easy visual polish without a dedicated UI/UX resource.
- **Vue/Nuxt**: Viable, but introduces a different ecosystem from the TypeScript/NestJS backend and has fewer direct benefits for the chosen component stack.

**Sources**:

- React docs: https://react.dev/learn/creating-a-react-app
- Vite guide: https://vite.dev/guide/
- Vite features: https://vite.dev/guide/features/

## Decision: Tailwind CSS + shadcn/ui + Radix primitives for the component/design system

**Rationale**: The project needs modern UI quality without a dedicated designer. shadcn/ui provides strong defaults, a broad component catalog, and an "own the code" model that keeps components editable inside the app instead of locked behind a dependency API. Radix primitives provide accessible low-level behavior for dialogs, dropdowns, selects, tooltips, tabs, and similar interactive controls. Tailwind CSS keeps responsive styling and design tokens close to the component code, integrates directly with Vite, and has zero runtime CSS generation in the browser.

**Alternatives considered**:

- **Material UI**: Very mature and production-ready, with strong theming and many components. Rejected as the primary choice because it strongly carries Material Design visual language and is less flexible for a custom current-trend library/product feel. It remains the best fallback if the team later prioritizes complete out-of-the-box enterprise widgets over owning component code.
- **Ant Design**: Strong enterprise admin ecosystem and TypeScript support. Rejected because its opinionated enterprise aesthetic is heavier for the mobile member experience and less flexible for a unified custom library brand.
- **Mantine**: Good React component library and developer experience. Rejected because shadcn/ui + Radix has stronger current momentum for modern Tailwind-based product UIs and copy-owned component customization.

**Sources**:

- Tailwind CSS with Vite: https://tailwindcss.com/docs/installation/using-vite
- Tailwind utility styling: https://tailwindcss.com/docs/styling-with-utility-classes
- shadcn/ui introduction: https://ui.shadcn.com/docs
- shadcn/ui components: https://ui.shadcn.com/docs/components
- Radix Primitives introduction: https://www.radix-ui.com/primitives/docs/overview/introduction
- Material UI: https://mui.com/material-ui/
- Ant Design: https://ant.design/docs/react/introduce/

## Decision: TanStack Query for REST server state

**Rationale**: Staff and member screens are mostly server-backed lists, details, mutations, and post-mutation refreshes. TanStack Query directly models server state with caching, request dedupe, retries, invalidation, mutation lifecycle, and devtools. This avoids hand-built loading/error/cache state and keeps REST integration maintainable.

**Alternatives considered**:

- **Redux Toolkit Query**: Strong option, but adds Redux conventions that are not otherwise needed.
- **Manual fetch + component state**: Too much repeated loading, error, stale-data, and invalidation code.
- **SWR**: Good lightweight choice, but TanStack Query has broader mutation workflow and cache tooling for admin workflows.

**Sources**:

- TanStack Query: https://tanstack.com/query/latest

## Decision: TanStack Router for protected route structure and typed URL state

**Rationale**: Back office lists require route-level search parameters for filters, sort, pagination, and selected tabs. TanStack Router provides type-safe routes, typed path/search params, loaders, error boundaries, and good integration with TanStack Query. The route tree can separate staff and member layouts cleanly.

**Alternatives considered**:

- **React Router**: Stable and widely adopted. Rejected for this plan because TanStack Router's typed search params are a better fit for data-heavy staff screens.
- **Next.js routing**: Rejected with Next.js for the same server-runtime reasons.

**Sources**:

- TanStack Router: https://tanstack.com/router/latest/docs/overview

## Decision: TanStack Table for staff data grids

**Rationale**: The staff back office needs searchable, sortable, paginated views for books, members, borrowings, overdue lists, and membership types. TanStack Table is headless, TypeScript-oriented, and pairs well with shadcn/ui table markup, so the UI keeps a consistent design while the table logic stays robust.

**Alternatives considered**:

- **MUI Data Grid**: Strong integrated grid, but would pull the app toward MUI as the primary component system.
- **Ant Design Table**: Strong enterprise table, but would pull the app toward Ant Design's heavier visual system.
- **Custom tables**: Too much duplicated sorting, filtering, pagination, and selection state.

**Sources**:

- TanStack Table: https://tanstack.com/table/latest/docs/overview

## Decision: React Hook Form + Zod for forms and validation

**Rationale**: Staff workflows depend on many forms: books, catalog classifications, membership tiers, members, borrowing creation, returns, and auth. React Hook Form is well suited to performant React forms. Zod provides TypeScript-first schemas, runtime validation, JSON Schema conversion, and form ecosystem support. Use Zod schemas in the frontend to validate user input before submit while treating backend validation as authoritative.

**Alternatives considered**:

- **Formik**: Mature but less aligned with current React form performance patterns.
- **TanStack Form**: Promising and type-safe, but newer and less necessary for this feature.
- **Only native form validation**: Insufficient for consistent error messaging and typed form data.

**Sources**:

- React Hook Form: https://react-hook-form.com/
- Zod: https://zod.dev/

## Decision: Vitest + Testing Library + Playwright + MSW for verification

**Rationale**: Vitest reuses the Vite pipeline and supports TypeScript/JSX well. Testing Library encourages behavior-oriented component tests. Playwright covers end-to-end staff and member flows across responsive viewports with reliable locators, auto-waiting, and browser isolation. MSW lets frontend tests mock the same REST requests the app makes in production.

**Alternatives considered**:

- **Jest for frontend**: Existing backend uses Jest, but Vitest is simpler for Vite and modern ESM frontend testing.
- **Cypress**: Good e2e tool, but Playwright has strong cross-browser support, isolation, and accessibility-oriented locators.
- **Only unit tests**: Insufficient for role access, responsive UI, and borrowing workflow confidence.

**Sources**:

- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/
- Testing Library user-event: https://testing-library.com/docs/user-event/intro/
- MSW: https://mswjs.io/

## Decision: Add minimal member-scoped backend support for US2

**Rationale**: The existing REST contract includes staff/admin login and staff-facing endpoints, but no member login or member-scoped "my membership/my borrowings" endpoints. The mobile member area cannot safely use staff endpoints or arbitrary member IDs. Add minimal backend support for member authentication and `me` endpoints so members only receive their own membership, policy status, quota, and borrowings.

**Alternatives considered**:

- **Reuse staff login for members**: Violates role separation and member privacy.
- **Expose existing `/members/{id}` endpoints to members**: Unsafe because client-provided IDs can expose other members if authorization is missed.
- **Static demo member selection**: Acceptable only for prototypes, not for this feature specification.

**Sources**:

- Existing local `openapi.json` paths show staff auth and staff/member management endpoints but no member-scoped auth/read routes.
