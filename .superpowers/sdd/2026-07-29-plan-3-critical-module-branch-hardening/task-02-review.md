# Task 02 review

## Task
Task 2 — Offline repair validation and fail-closed preconditions.

## Reviewer identity
`/root/plan3_task2_review`

## Reviewer model and reasoning
`gpt-5.6-sol`, high; separate context; substitution none.

## Reviewed commit
`fbfc378dd1c002aa4bff3456c4e99fc32b6ee308` against base `b05b9e90a8669adf69970014927335d01cff2a63`.

## Commands and exits
- Read `specs/003-auth-roles-permissions/plan.md`, the Task 2 brief, implementer report, review template, and the immutable `review-b05b9e9..fbfc378.diff` package: exit 0 for each. The diff package was read once and was the primary review view.
- Focused `rg -n` searches for the public repair paths, required exceptions, fixture exports, mutation mocks, and Task 2 assertions: exit 0.
- Numbered read-only excerpts of `auth-identifier-repair.service.ts`, `auth-identifier-repair.service.spec.ts`, `critical-auth-fixtures.ts`, and `backend-coverage-fixtures.ts`: exit 0.
- No Jest, lint, coverage, broad-suite, or Git command was rerun by the reviewer because code reading left no concrete doubt unanswered and the review brief restricts reviewer reruns to that condition.
- Relied-on implementer evidence, not independently rerun: focused RED exit 1 with the three documented public-query-shape failures; focused GREEN exit 0 with `34/34` tests and `80/110` repair branches; focused ESLint exit 0; `git diff --check` exit 0; backend coverage suite exit 0 with `35/35` suites and `400/400` tests (`task-02-report.md:26-49`).

## Spec Compliance

- **Compliant.** The complete table-driven precondition set is present: unstable resume IDs (`src/auth/auth-identifier-repair.service.spec.ts:147-169`), missing current key version (`:171-188`), wrong existing operation type/key version/hash (`:190-239`), indistinguishable missing/non-conflict reservation errors (`:241-258`), omitted/foreign/duplicate claimant accounting (`:260-307`), and missing persisted operations for both `apply` and `cancel` (`:309-329`).
- Order-before-write is observable at public/model boundaries. Resume validation asserts 422 and precedes `authorizeMutation` (`auth-identifier-repair.service.spec.ts:151-167`; production order corroborated at `auth-identifier-repair.service.ts:134-138`). Missing key, missing/non-conflict reservation, and invalid claimant cases assert no operation lookup and no mutation (`auth-identifier-repair.service.spec.ts:171-188,241-258,288-307`); the service performs those preconditions before lookup/create (`auth-identifier-repair.service.ts:93-116,706-735,853-858`).
- Stable public errors are identical across the paired paths: `Identifier conflict not found` (`auth-identifier-repair.service.spec.ts:241-258`) and `Repair operation not found` for awaited `apply`/`cancel` lookups (`:309-329`). Expectations contain fixed public text only and no claimant, password hash, token value, or database detail.
- Claimant accounting exercises omitted, foreign, and duplicate subjects against the same owned conflict fixture (`auth-identifier-repair.service.spec.ts:139-145,260-307`) and matches the set/cardinality contract (`auth-identifier-repair.service.ts:714-735`).
- Query shapes are correct: `dryRun` uses the shared `criticalQueryResult` adapter for `findOne().lean().exec()` (`auth-identifier-repair.service.spec.ts:225,506-519`; service `:101-104`), while missing `apply`/`cancel` operations use `mockResolvedValue` for the directly awaited lookup (`auth-identifier-repair.service.spec.ts:309-329`; service `:140,205,771-776`).
- Plan 2 fixtures are consumed by import without copying or editing: `createIdentifierOperation` and `criticalQueryResult` (`auth-identifier-repair.service.spec.ts:6-9,190-225`) plus `createStaffDocument({ id: 'admin-2' })` as the active actor (`:10,48-86`). Their shared exports remain at `test/support/critical-auth-fixtures.ts:76-93,156-170` and `test/support/backend-coverage-fixtures.ts:70-89`.
- The centralized failure helper checks every modeled operation, batch, identifier, staff, and member mutation method (`auth-identifier-repair.service.spec.ts:127-137`) and is applied to each new failure family. The immutable package changes only the owned service spec and Task 2 ledger files; no production, fixture implementation, configuration, coverage denominator/exclusion/threshold/script/Jest/CI/e2e/frontend/baseline file is changed.
- The implementer report records the required focused floor exactly at `80/110` branches and states generated coverage/test-results remain ignored and unstaged (`task-02-report.md:32-49`).

## Strengths

- The new cases are compact, meaningfully table-driven, and nonduplicate: each row isolates a distinct validation dimension while sharing only setup and invariant assertions (`auth-identifier-repair.service.spec.ts:147-329`).
- The failure helper makes zero-write guarantees difficult to weaken accidentally and includes the less-obvious `updateMany` and `findOneAndUpdate` mutation boundaries (`auth-identifier-repair.service.spec.ts:127-137`).
- The actor fixture uses only stable public identity/auth-version fields; its stored password hash is never asserted or copied into a ledger (`auth-identifier-repair.service.spec.ts:48-86`).
- The wrong-operation cases use the shared persisted-operation builder and real manifest hashing, avoiding unstable snapshots or hand-built partial documents (`auth-identifier-repair.service.spec.ts:190-225`).

## Issues

### Critical

None.

### Important

None.

### Minor

None.

⚠️ Verification boundary: the reviewer did not independently rerun the focused suite or inspect generated ignored directories, as required by the brief's rerun restriction. The `34/34`, `80/110`, full-suite, lint, diff-check, and unstaged-artifact statements above are implementer-report claims, not fresh reviewer command results. Existing private-method spies elsewhere in the unchanged baseline spec were not used as evidence for the new Task 2 assertions; the Task 2 delta itself exercises public methods and observable model requests only.

## Assessment

Approved. The Task 2 delta satisfies the brief and binding constraints with no open finding.

## Findings
No open findings.

## Resolutions verified
Not applicable; the initial separate-context review found no issue requiring resolution.

## Verdict
approved
