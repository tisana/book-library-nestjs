# Next Five Test Quality Priorities Design

## Purpose

Define five separate, agent-ready implementation plans that continue the
repository's test-quality program without combining backend coverage, frontend
unit coverage, or frontend Playwright pass-rate metrics.

The plans must be independently understandable, explicit about dependencies,
safe to hand off to fresh agents or subagents, and strict about evidence-based
baseline ratcheting.

## Current State

The merged quality-reporting system enforces three independent streams:

1. Backend Jest unit coverage plus backend Jest e2e results.
2. Frontend Vitest unit coverage.
3. Frontend Playwright pass, skip, flaky, and failure results.

Current checked-in baselines:

| Scope | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| Backend | 68.24% | 65.64% | 70.57% | 68.82% |
| Frontend | 47.00% | 44.03% | 41.08% | 48.27% |

Current changed-line evidence:

| Scope | Covered / total | Coverage | Gate |
| --- | ---: | ---: | --- |
| Backend | 68 / 82 | 82.92% | Pass |
| Frontend | 47 / 50 | 94.00% | Pass |

Current e2e evidence:

- Backend: 242 passed, zero failed.
- Frontend: 86 passed, one explicit mobile performance skip, zero failed,
  zero flaky.

The long-term direction remains at least 75% overall coverage, at least 80%
changed-line coverage, and 85–90% branch coverage for designated critical
modules.

## Selected Approach

Use a dependency-aware milestone ladder.

```text
Plan 1: Frontend coverage ───────────────┐
                                         ├─ final integrated verification
Plan 2: Backend coverage ──> Plan 3 ──> Plan 5
Plan 4: Mobile Playwright ───────────────┘
```

Plans 1, 2, and 4 may begin from the same clean base in isolated worktrees.
Plan 3 depends on Plan 2. Plan 5 depends on Plan 3.

## Plan Boundaries

### Plan 1: Frontend Coverage Uplift

Raise frontend statements and branches to at least 60% in this plan. The plan
must also leave a file-ranked, behavior-ranked backlog that accounts for the
remaining work to 75%; reaching 75% is a later wave rather than a hidden exit
condition for this plan.

Owns:

- Frontend unit, component, and MSW integration tests.
- Frontend coverage configuration only when eligibility is demonstrably wrong.
- The frontend section of `quality/coverage-baselines.json`.

Must prioritize user-visible behavior, routing, mutations, authorization,
loading, error, retry, empty, and cache-invalidation paths. It must not add
Playwright performance work assigned to Plan 4.

### Plan 2: Backend Overall Coverage Uplift

Raise backend branch coverage to at least 70% in this plan without decreasing
statements, functions, or lines. The plan must leave a quantified backlog for
the later move from 70% to 75% overall.

Owns:

- Broad backend services, controllers, guards, DTO behavior, and error paths.
- Backend tests outside the critical hardening matrix reserved for Plan 3.
- The backend section of `quality/coverage-baselines.json`.

It may add foundational fixtures for critical modules only when Plan 3 can
reuse them without duplicating behavior tests. Its handoff must list those
fixtures explicitly.

### Plan 3: Critical Module Branch Hardening

Depends on Plan 2's completed and reviewed commit.

Raise every designated security and business-critical module to at least 85%
branch coverage, using adversarial, boundary, authorization, idempotency,
concurrency, and failure-recovery tests. Modules that reach 90% without
low-value tests should ratchet to that higher evidence-backed value.

Initial critical set:

- Token session and refresh-family handling.
- Auth identifier repair.
- Auth identifier reconciliation.
- Member credential and lifecycle rules.
- Borrowing ownership and state transitions.
- Permission evaluation remains monitored but should not receive low-value
  tests once its target is already met.

Plan 3 must consume Plan 2's fixture inventory, avoid repeating its tests, and
recalculate backend baselines from fresh full-source coverage.

### Plan 4: Mobile Playwright Skip Elimination

May run independently from the clean base.

Remove the explicit mobile performance skip by making the scenario
deterministic and measurable, or replace it with an equivalent non-skipped
browser assertion that preserves the performance risk being tested.

Owns:

- The mobile performance Playwright scenario and its fixtures.
- Browser timing/readiness controls required for deterministic execution.
- Frontend e2e pass-rate evidence.

It must not weaken time budgets merely to hide flakiness and must not mix
Playwright pass-rate data with unit coverage.

### Plan 5: Selective Mutation Testing

Depends on Plan 3's completed and reviewed commit.

Introduce mutation testing only for stabilized critical modules. Establish a
repeatable local command, bounded CI or scheduled execution, explicit mutation
score evidence, surviving-mutant triage, and runtime controls.

The initial selected-module mutation score must be at least 70%. No
authorization bypass, ownership bypass, refresh-family revocation, or illegal
state-transition mutant may survive unless it is proven equivalent and
documented. A pull-request smoke command must finish within five minutes on the
reference CI runner; the complete scheduled command must finish within fifteen
minutes.

Owns:

- Mutation-test configuration and scripts.
- Critical-module mutation scopes.
- Mutation-result artifacts and documentation.

It must not replace coverage, changed-line, unit, integration, or e2e gates.
It must not mutate the whole repository in the first rollout.

## Dependency and Conflict Contract

Every implementation plan must begin with an explicit dependency block
containing:

- Required base commit or predecessor plan.
- Plans that may run concurrently.
- Plans that must not run concurrently.
- Shared files likely to conflict.
- Artifacts and interfaces consumed from predecessor plans.

Concurrency rules:

- Plans 1 and 2 may run in parallel because they own separate baseline
  sections.
- Plan 4 may run concurrently with Plans 1 or 2 in an isolated worktree.
- Plans 1 and 4 must be merged sequentially because both can affect frontend
  quality outputs; rerun frontend unit and e2e reports after each merge.
- Plan 3 cannot begin until Plan 2 is completed and reviewed.
- Plan 5 cannot begin until Plan 3 is completed and reviewed.
- Plans 2 and 3 must never update the backend baseline from stale coverage.

## Required Plan Structure

Each of the five plans must include:

1. Goal, architecture, tech stack, current metrics, milestone, final target,
   and non-goals.
2. Dependency contract and parallel-execution rules.
3. Owned files, prohibited files, shared conflict files, and expected new
   files.
4. Exact interfaces produced and consumed by every task.
5. Bite-sized checkbox steps with test-first RED/GREEN commands and expected
   results.
6. Independent task review gates and a whole-plan final review.
7. Baseline ratchet steps using fresh full-source coverage.
8. Exact unit, integration, e2e, quality-report, lint, build, changed-line, and
   whitespace verification commands required by that plan's owned files.
9. Commit boundaries and exact commit messages.
10. A progress-ledger path and handoff template for replacement agents.
11. Stop conditions and escalation rules.
12. Rollback and recovery considerations for configuration or CI changes.

No plan may contain placeholders, unspecified test instructions, or references
such as "similar to another task." A fresh agent must be able to execute one
task without reading the conversation.

## Shared Quality Rules

- Keep backend, frontend unit, and frontend e2e metrics separate.
- Preserve the independent 80% changed-line gates.
- Do not lower baselines, thresholds, expected-file counts, or eligibility
  rules to make CI green.
- Coverage gains must come from behavior assertions, not execution-only tests.
- Missing, malformed, zero-test, failed-suite, global-error, and producer
  failures remain blocking.
- No plan may introduce a failed or flaky e2e test.
- Every baseline update requires fresh full-source coverage and a
  non-decreasing comparison.
- Generated files, test files, and type-only exclusions must remain aligned
  with the existing coverage configurations.
- Work must use isolated worktrees at execution time and preserve unrelated
  working-tree changes.

## Handoff Artifacts

Each plan will use a dedicated ledger:

```text
.superpowers/sdd/2026-07-29-<plan-slug>/progress.md
```

Every task implementer must write a complete report in the same directory,
including:

- RED evidence.
- GREEN evidence.
- Focused and full metrics.
- Commands and exit results.
- Files changed.
- Commit hash.
- Deferred findings and concerns.

Each task must be reviewed by a fresh task-scoped reviewer. Reviewer findings
must be resolved before the next dependent task begins.

## Stop and Escalation Conditions

An implementation plan must stop and request direction when:

- Meeting a target requires changing the approved denominator or exclusions.
- A required target conflicts with an authoritative product or security
  contract.
- A predecessor plan's advertised artifact or fixture is absent.
- A coverage increase exposes a production defect whose fix materially
  expands the plan's scope.
- The mutation pull-request smoke command exceeds five minutes or the complete
  scheduled command exceeds fifteen minutes on the reference CI runner.
- Eliminating the Playwright skip requires weakening the performance
  requirement.

Ordinary test failures, uncovered branches, fixture extensions, and
non-destructive configuration updates are not blockers; agents should diagnose
and continue within scope.

## Final Integrated Verification

After all five plans are merged in dependency order:

```powershell
npm run test:quality-reporting
npm run test:cov
npm run test:e2e:report
npm run quality:report:backend
npm run frontend:test:coverage
npm run quality:report:frontend-unit
npm run frontend:test:e2e:report
npm run quality:report:frontend-e2e
npm run lint
npm run frontend:lint
npm run build
npm run frontend:build
git diff --check
```

The final mutation command defined by Plan 5 must also reach at least a 70%
selected-module mutation score, satisfy the critical-mutant rule, and remain
within the five-minute pull-request and fifteen-minute scheduled runtime
budgets. All three reporting streams must remain independently readable, and
all checked-in baselines must match or exceed the predecessor values.

## Out of Scope

- Combining backend and frontend coverage into one percentage.
- Treating e2e pass rate as code coverage.
- Raising coverage through generated code or test-file inclusion.
- Repository-wide mutation testing in the first rollout.
- Unrelated product refactoring.
- Weakening performance, authorization, privacy, or error-copy contracts.
