# NestJS 12 Upgrade Implementation and Handoff Plan

> **For agentic workers:** Use the subagent-driven-development workflow when available: one fresh implementer per task, one independent task reviewer, and a final whole-branch review. Follow the execution protocol in this document if the named skill is unavailable. Steps use checkboxes for tracking.

**Goal:** Upgrade book-library-nestjs from NestJS 11 to 12.1.1 while preserving authentication, library workflows, API contracts, and quality gates.

**Architecture:** Retain CommonJS application output, Express, Jest, Mongoose, and class-based DTO validation. Standardize Node 24, resolve tooling compatibility, characterize production behavior on Nest 11, then upgrade the framework. Test the compiled application and container in addition to module-level tests.

**Tech stack:** NestJS, TypeScript, Express 5, Mongoose/MongoDB, Passport/JWT, Jest/ts-jest, Stryker, React/Vite, Playwright, Docker, GitHub Actions.

**Repository:** https://github.com/tisana/book-library-nestjs  
**Base branch:** master  
**Assessed commit:** 29fd6cfee2f3d51182cdd2626ade72b7e3856996  
**Plan date:** 2026-10-01  
**Execution method:** Subagent-driven development  
**Status:** Ready for implementation preflight; implementation has not started.

**Spec and requirements:** This document contains the upgrade scope, constraints, risk analysis, and acceptance criteria. Preserve the existing authentication requirements in [specs/003-auth-roles-permissions/plan.md](../../../specs/003-auth-roles-permissions/plan.md) and follow [AGENTS.md](../../../AGENTS.md). Read the current repository instructions before implementation.

## Evidence and limitations

The assessment used GitHub source and lockfile inspection at the assessed commit, plus official NestJS migration guidance and release-tag package metadata. The execution environment failed to provision, so no installation, compilation, application execution, test suite, or benchmark was run during planning.

Treat compatibility conclusions as source/metadata findings until verified in T0–T5. Existing test files and recorded coverage thresholds are not proof of a currently passing baseline.

Recheck master and compare it with the assessed commit before implementation. If application code, dependencies, workflows, or security requirements have changed, update this plan's affected assumptions and record the changes.

## Global constraints

- Work in an isolated implementation branch/worktree; do not implement directly on master.
- Preserve refresh-token replay detection, role permissions, member ownership, exact-origin checks, trusted-proxy handling, and audit redaction.
- Preserve CommonJS application output and the production entry point dist/main.js.
- Preserve Mongoose 9.8.1 and existing database schemas initially.
- Do not introduce schema/data migrations unless a demonstrated compatibility requirement is separately documented and reviewed.
- Resolve dependency conflicts without --force or --legacy-peer-deps.
- Preserve coverage floors, mutation policy, required test execution, and quality-gate enforcement.
- Use disposable databases, accounts, keys, and sessions for verification. Never run destructive seed/reset or migration experiments against production.
- Keep credentials, tokens, cookie values, and personal data out of saved evidence.
- Record unrelated existing defects separately. Do not silently change their public contracts during the upgrade.
- Retain Jest, existing DTO validation, and the current frontend architecture. ESM application conversion, Vitest migration, oxlint adoption, and new observability services are outside this upgrade.
- Completion produces reviewed commits, verification evidence, and a release runbook. Production deployment is a separate action.

## Current state and target versions

Targets were checked against release metadata on 2026-10-01. T0 must confirm registry availability, peer requirements, engines, and material advisories before installing them. Record a reason for any replacement target; do not silently substitute latest.

| Component | Current locked version | Planned target |
| --- | --- | --- |
| @nestjs/common | 11.1.17 | 12.1.1 |
| @nestjs/core | 11.1.18 | 12.1.1 |
| @nestjs/platform-express | 11.2.6 | 12.1.1 |
| @nestjs/testing | 11.1.13 | 12.1.1 |
| @nestjs/config | 4.0.4 | 12.0.1 |
| @nestjs/jwt | 11.0.2 | 12.0.2 |
| @nestjs/mongoose | 11.0.4 | 12.0.0 |
| @nestjs/passport | 11.0.5 | 12.0.0 |
| @nestjs/schedule | 6.1.3 | 12.0.2 |
| @nestjs/swagger | 11.4.7 | 12.0.2 |
| @nestjs/cli | 11.0.19 | 12.0.8 |
| @nestjs/schematics | 11.0.10 | 12.0.6 |
| TypeScript | 5.9.3 | 6.0.2 |
| ts-jest | 29.4.6 | 29.4.14 |
| Jest | 30.2.0 | Retain initially |
| Mongoose | 9.8.1 | Retain initially |
| Node | CI/Docker 22; devcontainer 24 | One maintained, pinned 24.x patch >=24.15 |

Also inspect transitive Nest integrations, including @nestjs/mapped-types, after lockfile regeneration. The final resolved tree must not retain incompatible Nest 11 peer requirements.

The existing application already uses Express 5. No GraphQL, NATS, Joi, or Terminus dependencies were found. Their migration steps are not part of this plan unless the implementation checkout has added them.

## Risk register

Likelihood describes the assessed checkout. Impact assumes the condition is not mitigated.

| ID | Risk | Likelihood / impact | Evidence and analysis | Mitigation / owner |
| --- | --- | --- | --- | --- |
| R1 | Node/Jest cannot load Nest 12 correctly | Confirmed configuration conflict / High | Both CI workflows use Node 22. The Nest migration guide requires Node >=24.9 for Jest to load v12 ESM packages. Schematics impose a higher Node 24 floor of 24.15. Node 22 is not categorically unsupported for production; the immediate conflict is the test/tooling stack. | Align all runtimes in T1; verify clean builds and tests in T3/T5. |
| R2 | Dependency peers reject the upgrade | Confirmed / High | Existing Nest integrations mostly accept Nest 10/11. Locked ts-jest 29.4.6 requires TypeScript <6; v12 schematics require >=6. ts-jest 29.4.14 declares support for TypeScript <7. | Upgrade integrations together; validate npm ci and npm ls in T3. |
| R3 | TypeScript/module settings break builds or operational scripts | Likely / High | Root tsconfig uses CommonJS, implicit legacy resolution, baseUrl, and no explicit rootDir. Operational commands use ts-node and require.main. Docker expects dist/main.js. | Explicit compilation boundaries; preserve CommonJS; test every operational entry point in T3. |
| R4 | Lifecycle changes disrupt authentication recovery | Medium / High | Identifier reconciliation starts on application bootstrap, checks migrations, and registers intervals. Token-session recovery starts on module initialization. v12 changes hook ordering. | Test migration gating, one interval per worker, leases, restart recovery, concurrent instances, and cleanup in T4. |
| R5 | Tests pass while production HTTP behavior changes | Confirmed test gap / High | Several tests construct smaller applications without main.ts setup. Inspected Playwright sign-in tests mock API responses. Real CORS, trusted proxy, filters, validation, and SPA behavior can escape those tests. | Characterize compiled application in T2; live-browser/container verification in T5. |
| R6 | Authentication or persistence regresses | Medium / High | JWT/Passport and Mongoose participate in refresh replay protection, permissions, identifier reservations, and borrowing transactions. | Preserve schema and Mongoose versions; real MongoDB security/transaction tests in T4/T5. |
| R7 | Instrumentation changes weaken or invalidate quality evidence | Medium / Medium–High | Stryker 9.6.1 consumes the Jest configuration. Custom reporting consumes coverage and test-result files; source-range mutation manifests depend on source positions. | Run reporting tests and mutation shards; review legitimate range changes; preserve thresholds in T5. |
| R8 | Shutdown cleanup is not invoked by container signals | Existing gap / High | main.ts does not call enableShutdownHooks(). app.close() tests alone do not establish SIGTERM behavior. | Enable signal hooks and test actual processes, active work, and bounded shutdown in T4. |
| R9 | Readiness contract differs between tests and production | Existing discrepancy / Medium | Health tests expect raw status/reason responses. The production exception filter normalizes errors and does not preserve reason. | Capture actual baseline in T2; preserve it for this upgrade. Treat any contract correction as a separately reviewed change. |

Lower-risk findings: inspected application providers declare @Optional() in their own constructors; no deep Nest-package imports or custom getAuthenticateOptions() overrides were found. Rescan the execution checkout rather than assuming these remain absent.

## Review focus

Each item must have evidence in the owning task:

1. Malformed/untrusted Origin and forwarding headers must not cause session mutation, unauthorized cookies, or incorrect source identity — T2/T5.
2. Interrupted refresh rotation and identifier repair must remain safely recoverable without duplicate effects — T4.
3. Missing migrations, dependency loss, and missing correlation keys must keep readiness and workers fail-closed — T2/T4/T5.
4. Compiled entry points, operational CLIs, static assets, and SPA deep links must work from the shipped artifact — T2/T3/T5.
5. Old/new application transitions must preserve sessions and database compatibility, with demonstrated rollback — T6.

## Subagent assignments and model recommendations

These recommendations reflect task complexity; they are not measured cost or latency estimates. Explicitly set model and reasoning for every dispatch.

| Role | Model | Reasoning | Rationale |
| --- | --- | --- | --- |
| Coordinator | gpt-6.1-sol | high | Cross-task dependencies, briefs, evidence, and integration decisions |
| T0 implementer | gpt-6.1-sol | medium | Baseline inspection and reproducible checks |
| T1 implementer | gpt-6.1-sol | medium | Bounded runtime and configuration changes |
| T2 implementer | gpt-6.1-sol | high | Distinguishing actual contracts from test mocks |
| T3 implementer | gpt-6.1-sol | high | Multi-file compiler and dependency integration |
| T4 implementer | gpt-6-astra | high | Security-sensitive lifecycle and concurrency |
| T5 implementer | gpt-6.1-sol | high | Container, browser, CI, and quality-tool integration |
| T6 implementer | gpt-6.1-sol | medium | Evidence-driven rollback and operational documentation |
| T0 and T1 independent reviewers | gpt-6.1-sol | medium | Bounded review surfaces |
| T2, T3, T5, T6 independent reviewers | gpt-6.1-sol | high | Integration and behavioral correctness |
| T4 independent reviewer | gpt-6-astra | high | Failure recovery, concurrency, and security |
| Final whole-branch reviewer | gpt-6-astra | xhigh | Cross-task interactions and release risks |

Use a fresh agent per implementation task and a separate fresh reviewer per task. Set fork_turns to "none" and supply a focused brief. Reusing a model does not mean reusing the implementer's context as its review.

If these model IDs are unavailable in the execution environment, record the substitution: use the current coding workhorse for GPT-6.1 roles and the strongest available reasoning model for Astra roles. Do not silently inherit an expensive default.

## Execution protocol

1. Create or verify an isolated worktree/branch based on master; preserve user changes.
2. Save this plan at docs/superpowers/plans/2026-10-01-nestjs-12-upgrade.md if handing it into another checkout.
3. Create a plan-specific ledger under .superpowers/sdd/2026-10-01-nestjs-12-upgrade/progress.md. Follow repository/skill conventions if they define the workspace location.
4. Record the plan identity, assessed SHA, execution base SHA, task status, commit ranges, test evidence, findings, and decisions.
5. Before each task, the coordinator records the base commit and supplies only that task's requirements, global constraints, predecessor interfaces, owned files, and report location.
6. The implementer writes focused tests where behavior changes, makes the minimum change, verifies it, commits, and self-reviews.
7. An independent reviewer checks both specification compliance and task quality against the entire task commit range.
8. Resume the same implementer for fixes. Review the fix diff and relevant regressions.
9. Mark a task complete only after evidence and review are satisfactory.
10. Run one implementation agent at a time. Do not test a checkout another agent is mutating. Workers must not spawn additional workers or reviewers.
11. After interruption/compaction, read the ledger and git history; do not redispatch completed tasks.
12. Escalate persistent integration/debugging problems from gpt-6.1-sol to gpt-6-astra after revising the brief. For an Astra task, reassess and raise reasoning to xhigh. Do not repeat unchanged attempts indefinitely.
13. Preserve review and verification outcomes in durable evidence. Do not delete unrelated workspaces or user artifacts.

### Worker report contract

Each report must contain:
- Status: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED.
- Changed files and commit range.
- Commands, exit statuses, and meaningful result summaries.
- Baseline failures versus newly introduced failures.
- Security/API behavior affected.
- Remaining concerns and evidence locations.

Review reports must independently state spec compliance and code-quality verdicts, actionable findings, and whether acceptance criteria are met.

## Task dependencies

T0 -> T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> final review.

The sequence deliberately establishes actual production behavior before upgrading Nest. Shared manifests, compiler settings, and workflows make concurrent implementers inappropriate.

## Task T0: Establish the baseline

**Implementer:** gpt-6.1-sol / medium.  
**Reviewer:** gpt-6.1-sol / medium.

**Files**
- Read: AGENTS.md; package.json; package-lock.json; tsconfig*.json; Dockerfile; .github/workflows/*.yml; existing auth plan.
- Create: docs/upgrade/nestjs-12/baseline.md.
- Create: docs/upgrade/nestjs-12/dependency-matrix.md.

**Interfaces**
- Consumes: assessed commit, target table, current repository instructions.
- Produces: execution base SHA, verified target matrix, reproducible baseline results, actual compiled entry paths, existing failures.

- [ ] Record checkout SHA and the relevant changes from 29fd6cfee2f3d51182cdd2626ade72b7e3856996.
- [ ] Verify target package versions, engines, peers, release notes, and material advisories.
- [ ] Record Node/npm, operating system, MongoDB version/topology, and resolved dependencies.
- [ ] Run existing build, unit coverage, backend e2e, quality-reporting tests, and mutation smoke checks.
- [ ] Record actual production and performance compilation output paths. Compare local build and Docker build inputs.
- [ ] Record test counts/skips and coverage metrics; distinguish existing failures from environmental failures.
- [ ] Capture the existing auth-performance benchmark using a disposable database and the repository's documented fixture procedure.
- [ ] Commit baseline and dependency evidence, excluding credentials and generated bulk artifacts.

**Commands**
    npm ci
    npm run build
    npm run test:cov
    npm run test:e2e:report
    npm run test:quality-reporting
    npm run mutation:check
    npm run mutation:smoke
    npm run verify:auth-performance

Run commands separately and retain each result. Tests and benchmarks may need MongoDB binary downloads or disposable MongoDB service access; diagnose missing prerequisites without disabling tests.

**Acceptance:** Every check has an outcome and evidence. Existing failure is not reported as success. Blockers affecting comparison are resolved or explicitly documented before dependent work.

## Task T1: Align runtime and transformer while retaining Nest 11

**Implementer:** gpt-6.1-sol / medium.  
**Reviewer:** gpt-6.1-sol / medium.

**Files**
- Modify: Dockerfile; .github/workflows/ci.yml; .github/workflows/mutation.yml; .devcontainer/Dockerfile; package.json; package-lock.json; README.md.
- Create: .node-version.

**Interfaces**
- Consumes: T0 verified matrix and baseline.
- Produces: Nest 11 running on the pinned Node 24 runtime with ts-jest 29.4.14.

- [ ] Select one maintained Node 24 patch >=24.15 and record its exact version.
- [ ] Align CI, mutation jobs, Docker stages, and devcontainer runtime. Verify the actual version; a moving image tag alone is insufficient evidence of alignment.
- [ ] Declare a supported Node 24 range in package.json and align @types/node with Node 24.
- [ ] Update ts-jest to 29.4.14 while retaining TypeScript 5.9.3 and Nest 11.
- [ ] Regenerate the root lockfile with the selected npm version.
- [ ] Run a clean install, application build, unit/e2e suites, reporting tests, and mutation smoke.
- [ ] Review changes in instrumentation/results against T0; commit the runtime/tooling change.

**Acceptance:** No unexplained runtime/tooling regression. CI and mutation jobs use the same pinned runtime. No Nest 12 migration is included in this task.

## Task T2: Characterize the production application on Nest 11

**Implementer:** gpt-6.1-sol / high.  
**Reviewer:** gpt-6.1-sol / high.

**Files**
- Create: test/support/production-process.ts.
- Create: test/production-bootstrap.e2e-spec.ts.
- Create: test/jest-production.json.
- Modify: package.json to add test:production.
- Update: docs/upgrade/nestjs-12/baseline.md.

**Interfaces**
- Consumes: T1 runtime and T0's verified compiled entry point.
- Produces: a reusable compiled-application harness and baseline production contract tests.

The harness must accept an explicit compiled entry path, disposable MongoDB URI, test-only environment, and optional static asset directory. It must return the application base URL plus controlled shutdown/exit observation, reserve an available port with bounded startup retries, capture redacted diagnostics, and clean up child processes on all outcomes. Use the verified baseline entry path; do not silently assume the local Nest 11 build already emits dist/main.js.

- [ ] Launch the compiled application rather than reconstructing main.ts in a TestingModule.
- [ ] Initialize disposable database fixtures and required migrations using existing helpers.
- [ ] Verify allowed credentialed CORS; reject untrusted origins at the browser-session boundary before session writes or Set-Cookie.
- [ ] Verify trusted/untrusted proxy chains and spoofed forwarding-header handling.
- [ ] Capture validation, malformed JSON, authorization, and domain-error contracts. Normalize only nondeterministic fields.
- [ ] Verify /docs, /docs-json, /health, /health/ready, static assets, and login/staff/member deep links.
- [ ] Verify frontend fallback does not turn API errors into HTML success responses.
- [ ] Record the actual readiness error body with the global filter enabled.
- [ ] Keep the production suite separate from the existing test:e2e matcher to avoid double-running it.
- [ ] Run the characterization suite on Nest 11 and commit passing contracts.

Suggested script contract:
    npm run test:production

The script builds the application, then runs the dedicated Jest production configuration serially. T3 updates the verified entry path to dist/main.js.

**Acceptance:** Tests exercise actual bootstrap configuration and pass on the baseline. They become regression tests for T3. Existing readiness discrepancies are documented, not silently repaired or mislabeled as v12 regressions.

## Task T3: Upgrade Nest packages and TypeScript

**Implementer:** gpt-6.1-sol / high.  
**Reviewer:** gpt-6.1-sol / high.

**Files**
- Modify: package.json; package-lock.json; tsconfig.json; tsconfig.build.json; tsconfig.performance.json.
- Modify only as needed: nest-cli.json; Jest configurations; affected imports and operational scripts.

**Interfaces**
- Consumes: T0 target matrix, T1 runtime, T2 production contracts.
- Produces: Nest 12.1.1, reproducible install, dist/main.js, working operational commands.

- [ ] Run the verified/pinned v12 CLI's nest upgrade --dry-run --no-observe and save its report.
- [ ] Review and apply the target matrix. Retain unrelated dependency versions where possible.
- [ ] Regenerate package-lock.json and inspect transitive Nest peers.
- [ ] Use TypeScript 6-compatible NodeNext module/resolution settings while preserving CommonJS package semantics; do not add type: module.
- [ ] Audit baseUrl usage across source, scripts, migrations, and tests before removing obsolete configuration.
- [ ] Keep root-level compilation usable for scripts/tests; make tsconfig.build.json explicitly compile src with rootDir src and output dist.
- [ ] Preserve decorator metadata and the existing runtime semantics. Keep performance compilation rooted at the repository with its own output directory.
- [ ] Address compiler-proven interop issues, such as callable namespace Supertest imports. Batch the same import correction consistently.
- [ ] Confirm dist/main.js exists; point T2's harness to that exact artifact.
- [ ] Verify migrate:status, migrate:up, bootstrap:admin, key-rotation preflight, and identifier-repair operations against disposable fixtures.
- [ ] Verify operational CLI exit codes, stdin handling, and redaction, including process-level execution.
- [ ] Run clean install, dependency validation, build, production contracts, and reporting tests; commit the migration.

**Commands**
    npm ci
    npm ls
    npm run build
    npm run test:production
    npm run test:quality-reporting

**Acceptance:** Commands succeed without invalid peers. Production and performance entry points resolve. Operational commands retain expected exit contracts. The T2 HTTP contracts remain compatible.

## Task T4: Verify authentication lifecycle and graceful shutdown

**Implementer:** gpt-6-astra / high.  
**Reviewer:** gpt-6-astra / high.

**Files**
- Modify: src/main.ts.
- Test and modify only where necessary: src/auth/auth-identifier-reconciliation.service.ts; src/auth/token-session.service.ts; their existing unit tests.
- Extend: test/auth-persistence.e2e-spec.ts; test/auth-identifier-recovery.e2e-spec.ts.
- Create: test/production-shutdown.e2e-spec.ts.
- Extend: T2's process helper/configuration as needed.

**Interfaces**
- Consumes: T3 application and T2 process harness.
- Produces: verified startup/recovery invariants and real-signal shutdown behavior.

- [ ] Write focused tests for migration-gated startup, one interval per worker, repeated readiness probes, and bootstrap retry paths.
- [ ] Test refresh-marker interruption/recovery, leases, concurrent instances, and duplicate-effect prevention.
- [ ] Verify existing sessions survive application restarts; stale and replayed credentials remain rejected.
- [ ] Enable Nest shutdown hooks for the HTTP application.
- [ ] Send actual SIGTERM to the process and verify bounded exit without forced kill.
- [ ] Verify interval cleanup and database closure with application-level integration checks.
- [ ] Exercise shutdown during active reconciliation and an in-flight request; require safe completion or recoverable interruption.
- [ ] Set and document a test shutdown budget compatible with the deployment grace period; treat timeout as failure, not a passing forced kill.
- [ ] Fix lifecycle code only where tests demonstrate a failure; preserve fail-closed behavior.
- [ ] Run relevant unit, MongoDB integration, production, and signal tests; commit the lifecycle change.

**Acceptance:** Startup workers do not run before prerequisites. Timers do not duplicate. Interrupted work is recoverable. Signal shutdown invokes cleanup and meets the documented budget. Timing-sensitive failures are diagnosed rather than skipped.

## Task T5: Validate quality gates and the shipped artifact

**Implementer:** gpt-6.1-sol / high.  
**Reviewer:** gpt-6.1-sol / high.

**Files**
- Modify as necessary: .github/workflows/ci.yml; .github/workflows/mutation.yml; package.json; Jest/Stryker configuration; quality reporting integration.
- Create: frontend/playwright.live.config.ts.
- Create: frontend/tests/live/nestjs-upgrade.spec.ts.
- Add disposable fixture/setup helpers only as required; keep them out of production routes.

**Interfaces**
- Consumes: T3 build, T4 lifecycle behavior, existing quality baselines.
- Produces: final application/container/live-browser and quality-gate evidence.

The separate live-browser suite must target a started built application with seeded disposable MongoDB accounts. It must not use page.route or other mocks for application API responses. Keep the existing mocked suite intact.

- [ ] Run backend unit coverage, backend e2e reporting, and production-process tests.
- [ ] Run reporting tests and enforce real producer outcomes, coverage floors, and changed-line requirements.
- [ ] Keep the expected backend coverage-file count at 87 unless the actual covered source set changes; explain and review any adjustment.
- [ ] Run mutation:check and mutation smoke shards. Run additional affected shards if fixes expose concerns.
- [ ] Regenerate mutation source ranges only for real source-position changes; preserve critical-rule intent and review manifest diffs.
- [ ] Run frontend coverage and existing Playwright suites.
- [ ] Run live-browser sign-in, refresh, logout, staff/member permissions, borrowing, and deep-link checks.
- [ ] Build and start the production Docker image against disposable MongoDB.
- [ ] Verify production environment validation rejects unsafe/missing required settings.
- [ ] Run the existing auth-performance benchmark and dependency-loss readiness check.
- [ ] Wire required production/live-browser checks into CI with actual failing outcomes enforced.
- [ ] Commit verification infrastructure and concise evidence.

**Core commands**
    npm run test:cov
    npm run test:e2e:report
    npm run test:production
    npm run test:quality-reporting
    npm run mutation:check
    npm run mutation:smoke
    npm run frontend:test:coverage
    npm run frontend:test:e2e:report
    npm run build
    npm run frontend:build
    npm run verify:auth-performance

Use the quality-report commands and producer-outcome arguments from the actual CI configuration. Do not claim a gate passed merely because a report file exists.

**Acceptance**
- Backend coverage floors: statements 80.89%, branches 74.7%, functions 81.32%, lines 81.26%.
- Frontend coverage floors: statements 85.29%, branches 82.44%, functions 81.48%, lines 85.82%.
- Preserve existing mutation policy and changed-line requirements.
- No unexplained reduction in executed tests or new skipped tests.
- Authentication/authorization overhead <=50 ms p95 using the documented warm-up/sample/concurrency method.
- Readiness failure within five seconds of dependency loss.
- Production container and live-browser checks pass.
- Tool incompatibility is fixed or remains a release blocker; thresholds are not weakened.

## Task T6: Rehearse rollback and prepare release evidence

**Implementer:** gpt-6.1-sol / medium.  
**Reviewer:** gpt-6.1-sol / high.

**Files**
- Create: docs/upgrade/nestjs-12/release-runbook.md.
- Update: docs/upgrade/nestjs-12/baseline.md; dependency-matrix.md; README.md.

**Interfaces**
- Consumes: passing T5 evidence and old/new application artifacts.
- Produces: rollback demonstration, deployment prerequisites, and operator runbook.

- [ ] Record exact versions, commit/image identifiers, environment prerequisites, and verification outcomes.
- [ ] Rehearse old-image -> new-image -> old-image transitions using a disposable database.
- [ ] Verify session continuity, refresh rotation, readiness, and worker recovery across transitions.
- [ ] Test mixed versions if rollout permits concurrent old/new instances. Otherwise document and verify a non-overlapping transition.
- [ ] Define staged rollout and observation windows based on expected traffic and recovery-worker cadence.
- [ ] Define immediate rollback for authorization/session failures, persistent readiness failure, or data-integrity failures.
- [ ] Record service objectives for error rate and latency as rollout thresholds. If absent, mark production rollout blocked pending their definition; implementation documentation can still be completed.
- [ ] Document rollback commands, image/configuration restoration, required follow-up checks, and who performs the deployment.
- [ ] Commit the runbook and evidence. Do not deploy production as part of this task.

**Acceptance:** Rollback is demonstrated, not assumed. Session/database incompatibility is resolved or clearly blocks release. No production mutation was needed for the rehearsal.

## Final whole-branch review

**Reviewer:** gpt-6-astra / xhigh, fresh context.

Review the complete execution-base-to-final-HEAD diff and task evidence. Check:
- Reproducible install and Node/Nest/TypeScript compatibility.
- Authentication, replay protection, permissions, and member isolation.
- Worker startup, concurrent recovery, and signal shutdown.
- Actual production HTTP/static behavior and operational CLIs.
- Quality-gate integrity, coverage accounting, and mutation evidence.
- Database/session compatibility and rollback.
- Scope control: no unrelated feature or framework rewrites.

Provide a findings list with file references and severity, plus explicit spec-compliance and code-quality verdicts. Route fixes to the relevant implementer and re-review affected behavior.

## Completion and release gates

Implementation is complete when:
- [ ] All tasks have reviewed commits and durable reports.
- [ ] Required checks pass on the final commit, or unrelated pre-existing failures are explicitly reported without claiming those checks pass.
- [ ] No unresolved migration/security/data-integrity blockers remain.
- [ ] The repository contains the updated documentation and release evidence.
- [ ] The final independent whole-branch review is satisfactory.

Production release additionally requires:
- [ ] Required CI and artifact checks pass.
- [ ] Performance/readiness criteria are met.
- [ ] Rollback is demonstrated and deployment thresholds are defined.
- [ ] The deployment action is authorized.

## Handoff prompt

Use the following request in an implementation chat:

> Implement docs/superpowers/plans/2026-10-01-nestjs-12-upgrade.md for tisana/book-library-nestjs, starting from master in an isolated worktree. Read AGENTS.md and the plan first. Execute T0–T6 using the specified subagent models and reasoning levels, one implementer at a time, with independent task reviews and a final whole-branch review. Maintain a plan-specific ledger and resume from recorded progress. Revalidate version metadata and the assessed commit before changing dependencies. Preserve auth/security contracts and quality thresholds. Produce reviewed commits and verification/release documentation. Do not deploy production.

## Sources

- [Assessed repository snapshot](https://github.com/tisana/book-library-nestjs/tree/29fd6cfee2f3d51182cdd2626ade72b7e3856996)
- [NestJS migration guide](https://docs.nestjs.com/migration-guide)
- [Nest upgrade command](https://docs.nestjs.com/cli/usages#nest-upgrade)
- [NestJS 12.1.1 release](https://github.com/nestjs/nest/releases/tag/v12.1.1)
- [NestJS 12.0.0 release and breaking changes](https://github.com/nestjs/nest/releases/tag/v12.0.0)
- [Nest CLI 12.0.8](https://github.com/nestjs/nest-cli/releases/tag/12.0.8)
- [Schematics 12.0.6 package requirements](https://github.com/nestjs/schematics/blob/12.0.6/package.json)
- [ts-jest 29.4.14 peer requirements](https://github.com/kulshekhar/ts-jest/blob/v29.4.14/package.json)
- [Passport 12.0.0 migration details](https://github.com/nestjs/passport/releases/tag/12.0.0)
- [Mongoose integration 12.0.0](https://github.com/nestjs/mongoose/releases/tag/12.0.0)

