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

## Execution handoff from T3/T4

- T3 pins Jest30.4.1 with native ESM support under Node24.19.0. Propagate the required experimental-vm-modules flag to Stryker's programmatic Jest worker; npm Jest script flags alone do not reach it.
- T4 adds six production signal/harness cases and lifecycle recovery tests. Latest scoped counts:566 unit,54 production/signal,33 focused Mongo/security. Backend expected covered files remains87; final e2e count must be measured, not assumed from T3's249.
- T3 saved the dated audit and exposure/patch candidates in docs/upgrade/nestjs-12/evidence/t3/audit-triage.json. Triage security-material blockers before expensive final checks; propose the smallest compatible security-only change and record any needed matrix exception with the coordinator. Never perform an unrelated broad autofix. Preserve both dev-tool and shipped-image exposure evidence.
- T1 actual devcontainer build/runtime is still blocked by westus.data.mcr.microsoft.com, www.mongodb.org, repo.mongodb.org. No custom hosts are allowed at environment revision6. Do not bypass policy or claim this check passed. Continue unaffected gates.
- T4 uses an8s ordinary shutdown budget against Compose's default10s grace. SIGKILL is never normal passing shutdown; separate negative timeout tests must fail shutdown and then prove durable lease recovery. Default reconciliation lease300s plus5s skew requires rollback observation windows to account for recovery.

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
