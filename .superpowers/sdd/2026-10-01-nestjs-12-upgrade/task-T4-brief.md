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

