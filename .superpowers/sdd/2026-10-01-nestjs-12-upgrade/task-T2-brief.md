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

