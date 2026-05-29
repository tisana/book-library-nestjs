# Research: Book Borrowing System

## Decision: Extend the existing single NestJS API with feature modules

**Rationale**: The repository already contains a NestJS app and `books` module. The constitution prefers maintainable architecture and rejects premature microservices. Feature modules keep domain concepts explicit while preserving the current application baseline.

**Alternatives considered**:

- Replace the app with a new structure: rejected because existing controllers, services, tests, and MongoDB wiring can be evolved.
- Split into services: rejected as unnecessary for a single library-like deployment.

## Decision: Use MongoDB with Mongoose schemas and transactional service methods

**Rationale**: The project already uses `@nestjs/mongoose` and `mongoose`. Borrowing and returning require coordinated updates to borrowing records, book availability, and member active counts. MongoDB transactions provide consistency when the app is deployed with a replica set or compatible managed MongoDB.

**Alternatives considered**:

- Rely only on independent document updates: rejected because partial writes could corrupt availability or member counts.
- Switch to SQL: rejected because the user asked to use MongoDB as the baseline.

## Decision: Track books by aggregate title/catalog record for v1

**Rationale**: Clarification selected title/catalog records with total and available quantity only. This supports the requested quantity and borrowing workflows without barcode/copy lifecycle complexity.

**Alternatives considered**:

- Per-copy records: rejected for v1 because the spec explicitly excludes copy identifiers and copy-level condition tracking.
- Hybrid optional copy identifiers: rejected because it adds implementation paths not needed for current acceptance criteria.

## Decision: Model membership limits through membership types

**Rationale**: Clarification selected membership-type borrowing limits. This provides policy consistency and avoids one-off member-level exceptions.

**Alternatives considered**:

- Global limit: rejected because it cannot represent realistic member categories.
- Per-member limit: rejected because it increases operational inconsistency for v1.

## Decision: Calculate due dates from book category or collection type

**Rationale**: Clarification selected book-category-driven due dates. This keeps lending policy attached to the item being borrowed and supports different loan periods for normal books, reference items, or short-loan collections.

**Alternatives considered**:

- Staff-selected due dates: rejected because it creates inconsistent lending periods.
- Membership-type due dates: rejected because the user selected book category or collection type.

## Decision: Block borrowing while any active loan is overdue

**Rationale**: Clarification selected blocking new borrowing until overdue loans are returned. This is simple to test and avoids adding fines or override workflows outside the current spec.

**Alternatives considered**:

- Track fines: rejected as a constitution non-goal unless explicitly specified.
- Staff override: rejected for v1 because it adds authorization and audit complexity not requested.

## Decision: Add explicit authentication and role authorization boundary

**Rationale**: The constitution requires authentication for non-public actions and server-side authorization. Existing code has no auth module, so implementation must either add a minimal staff/admin auth boundary or integrate with an existing one if introduced before implementation.

**Alternatives considered**:

- Leave endpoints unauthenticated: rejected by constitution.
- Full borrower self-service auth: rejected because member self-service is out of scope for v1.

## Decision: Use DTO validation and predictable error responses

**Rationale**: The project already uses `class-validator`. Required failures include unavailable books, inactive members, limits, overdue loans, missing loan-period rules, and invalid quantities. Explicit DTO validation plus domain exceptions keeps errors testable.

**Alternatives considered**:

- Mongoose-only validation: rejected because server-boundary validation and user-friendly errors are constitution requirements.

## Decision: Add OpenAPI contract documentation

**Rationale**: The feature exposes REST APIs. `@nestjs/swagger` is a small, common NestJS addition that keeps API contracts documented and reviewable.

**Alternatives considered**:

- Markdown-only contracts: accepted for planning output, but generated OpenAPI is recommended during implementation.

## Decision: Containerize app and MongoDB together for local and deployment baseline

**Rationale**: The repository already has `docker-compose.yml` for MongoDB only. Deployment should be container based, so add a production app Dockerfile, env-based MongoDB URI, health check, and compose service for local parity.

**Alternatives considered**:

- Host-run app with containerized DB: useful during development but incomplete for deployment.
