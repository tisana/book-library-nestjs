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

## Execution handoff

- User states production error/latency thresholds and deployment owner are not defined, and requests industry-practice guidance. Provide risk-based proposed starting triggers, clearly distinguished from adopted SLOs: immediate rollback for auth/session/data-integrity failures; sustained5xx above1% or p95 latency more than20% above verified production baseline with traffic-based windows/minimum samples. Existing auth benchmark<=50ms and dependency-loss readiness<=5s remain test gates. Production rollout stays blocked pending adopted thresholds and named owner; do not deploy.
- T4 verifies ordinary shutdown within8s against Compose default10s grace. Confirm actual deployed grace; document slow-query timeout as failure/recoverable interruption. Default worker lease300s plus5s skew means observation/recovery windows must span relevant cadence and lease expiry.
- Preserve existing frontend reload behavior: reload begins signed-out until sign-in; it is not automatic refresh restoration. T5 live browser tests characterize this and explicitly verify real cookie refresh/rotation.
- Fix deferred reviewed documentation nits: baseline Mongo extraction commands need mkdir -p before docker cp; escape Node-engine || inside Markdown table cells.
- T1 actual devcontainer verification remains blocked unless required hosts become allowed. Preserve this acceptance gap in runbook/final evidence, independently of production rollout prerequisites.

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
