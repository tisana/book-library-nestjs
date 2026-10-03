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

