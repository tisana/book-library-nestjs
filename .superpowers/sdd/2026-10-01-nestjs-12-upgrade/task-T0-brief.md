# Task T0: Establish the baseline

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

