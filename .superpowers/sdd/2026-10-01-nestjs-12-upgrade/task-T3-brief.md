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

