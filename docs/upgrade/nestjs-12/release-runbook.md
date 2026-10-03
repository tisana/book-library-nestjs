# NestJS 12 release and rollback runbook

**Release blocked. No production deployment was performed.** T6 rehearses an independent compatibility gate; it does not turn reviewed T5 `DONE_WITH_CONCERNS` into a pass.

## Required approvals and evidence

Before scheduling a deployment, the named deployment owner and on-call operator must adopt production error/latency thresholds, establish the measured production baseline and minimum traffic, confirm the actual scheduler shutdown grace, and approve a maintenance window. These people and adopted objectives are currently undefined. The following implementation gates remain open:

- T1: build/start the actual devcontainer after supported network configuration permits `westus.data.mcr.microsoft.com`, `www.mongodb.org`, and `repo.mongodb.org`. Current enforced package-manager policy has no custom hosts; no bypass was attempted.
- T5: accepted current five-shard complete baseline (1744 mutants, raw score >=95.2518818760857, genuine provenance) and smoke (1366 mutants) under unchanged 900000/350000 ms per-shard budgets. Actual token smoke failed at350132ms; historical baseline remains historical. Passing89 manifest rules does not close this gate.
- Production: immutable registry digests for both approved images, secret/configuration version references, database backup/recovery confirmation, named owner, approved SLOs, traffic sampling and deployed grace. Local rehearsal image IDs are evidence, not production registry references.

Normal runtime, production image, live browser, coverage and security gates have measured T5 passes; see [T5 evidence](../../../.superpowers/sdd/2026-10-01-nestjs-12-upgrade/task-T5-report.md). Earlier failures and blockers remain preserved.

## Strategy and prerequisites

Require `init: true` on every old/new application container. The exact old image ignores ordinary SIGTERM as PID1; Docker init forwards the signal to its child. Its exit143 is ordinary process termination, **not a Nest worker/HTTP drain**. Interrupted durable work must recover; the new image provides the T4 graceful lifecycle.

Use a **non-overlapping maintenance transition**: remove application traffic, stop every old instance and verify exit, then start the new image. The reverse follows the same order. Mixed-version deployment is not approved or tested. Do not use a rolling update, overlapping canary or a second process sharing this database. Stages refer to traffic admitted to the single selected version after all predecessor instances exit.

Preserve database URI, issuer/audience, JWT signing secret, cookie secret, trusted browser origins, trusted proxy CIDRs, audit key version/current/previous key set and identifier repair key references across either transition. Preserve MongoDB 8 replica-set configuration, Mongoose 9.8.1, existing collection/index definitions, CommonJS output and `node dist/main.js`. Do not rotate keys, run migrations, reset data, seed accounts, restore old session hashes or re-enable revoked sessions as part of this release. Migration003 legacy-session revocation is irreversible.

Capture protected configuration and secret-store **version references**, never values, cookies, tokens or account data in evidence. Validate both artifacts with the same production configuration before approval. Confirm no uncommitted build inputs. Retain the actual approved old production immutable image; the reconstructed execution-base rehearsal image does not substitute for an unknown deployed digest. Keep old image and configuration accessible for the entire observation window. The local Compose development defaults are not suitable production configuration.

## Proposed objectives for adoption

These are starting recommendations, not existing/adopted SLOs. Any authorization bypass, wrong member ownership, refresh/session continuity failure, replay acceptance, secret exposure or data-integrity failure triggers immediate traffic closure and rollback. A readiness probe that persistently fails after the approved startup allowance also triggers rollback; suggested allowance30s, then two failed probes5s apart. Dependency-loss readiness must become503 within5s; existing auth benchmark p95<=50 ms remains a test gate, not a production latency objective.

For operational errors, propose rollback when application5xx exceeds1% over two consecutive5-minute windows with at least1000 requests per window. For latency, propose rollback when p95 exceeds120% of a verified comparable pre-release production baseline for two consecutive5-minute windows with at least1000 requests each. Compare the same route mix, payload size, dependencies and load; exclude the approved maintenance period. Investigate immediately on the first breach. Operators must adopt or replace these thresholds and define baseline period, instrumentation, retry accounting and low-traffic handling before release. At low traffic, extend each window until minimum samples exist; use synthetic session/permission checks and dependency/worker signals without inventing a statistically established p95. Do not promote solely because a timer elapsed.

After maintenance, admit operator-only synthetic checks, then10%,50%,100% of normal traffic using ingress controls. Observe each stage for at least15minutes **and** required sample windows. Default identifier worker lease300s plus5s skew and60s reconciliation cadence requires at least365s for interrupted-lease recovery; refresh pending marker lease30s plus60s cadence requires at least90s. Fifteen minutes spans these bounds, but real backlogs may take multiple100-operation passes; require no unexplained growing backlog, exactly one terminal audit event per recovered operation, no active lease owned by a terminated instance past its eligibility window, and readiness200. Keep final100% under owner supervision for at least30minutes and repeat checks the next business traffic peak. Approval must account for maintenance downtime and measured expected traffic.

## Operator commands

Commands are a template to be completed with the actual protected production Compose files, named owner, immutable registry references and ingress control. They are not deployment authorization. `DEPLOY_ENV_FILE` references a mode0600 file managed by the secret/configuration system; it must not be logged. Preserve its approved version for rollback. Set `COMPOSE_FILE` to the reviewed base plus image override; do not print expanded `docker compose config`, which can disclose secrets.

Image override:

```yaml
services:
  app:
    image: ${RELEASE_IMAGE:?immutable image required}
    init: true
    stop_grace_period: 10s
```

The measured new-image ordinary SIGTERM shutdown fits8s, leaving2s margin under this10s example. Confirm the actual deployed value with the owner; use a larger reviewed grace if expected slow work needs it. A timeout/SIGKILL is a failed drain, requiring inspection and durable worker recovery, not a successful shutdown check.

```sh
# Set approved OLD_IMAGE and NEW_IMAGE registry@sha256 references beforehand.
export RELEASE_IMAGE="$OLD_IMAGE"
docker compose --env-file "$DEPLOY_ENV_FILE" pull app
# Owner closes ingress and drains outstanding HTTP work with their ingress tool.
docker compose --env-file "$DEPLOY_ENV_FILE" stop app
# Verify ALL app replicas have exited; nonzero means STOP, do not start replacement.
test -z "$(docker compose --env-file "$DEPLOY_ENV_FILE" ps --status running -q app)"
export RELEASE_IMAGE="$NEW_IMAGE"
docker compose --env-file "$DEPLOY_ENV_FILE" pull app
docker compose --env-file "$DEPLOY_ENV_FILE" up -d --no-deps --no-build app
curl --fail --silent --show-error "$API_BASE_URL/health/ready"
```

If rollback is triggered, close ingress, stop the new application, verify every replica exited, restore the prior protected configuration references while retaining required `init: true`, then:

```sh
export RELEASE_IMAGE="$NEW_IMAGE"
docker compose --env-file "$DEPLOY_ENV_FILE" stop app
test -z "$(docker compose --env-file "$DEPLOY_ENV_FILE" ps --status running -q app)"
export RELEASE_IMAGE="$OLD_IMAGE"
docker compose --env-file "$DEPLOY_ENV_FILE" up -d --no-deps --no-build app
curl --fail --silent --show-error "$API_BASE_URL/health/ready"
```

Do not downgrade MongoDB or restore the database merely to roll back the application. If data-integrity failure is suspected, keep traffic closed and involve the database recovery owner; blindly admitting traffic on the old binary can worsen corruption.

Before reopening traffic in either direction, confirm liveness200/readiness200; existing pre-transition access token permits only its original role/ownership; retained HttpOnly cookie refreshes and rotates; older cookie replay returns401 and revokes the family; wrong origin fails without writes; revoked session remains revoked; identifier interrupted work completes once; orphan pending refresh markers commit/revoke fail-closed; inventory/loan counts remain consistent. Use approved synthetic accounts with token/cookie capture confined to protected process memory. Frontend reload still starts signed-out until sign-in: automatic refresh restoration is not a release expectation. Record only statuses/counts/timings and immutable IDs.

## Rehearsal provenance

The disposable old/new/old run, exact versions, image IDs, commands, recovery limitations and actual timings are in [T6 report](../../../.superpowers/sdd/2026-10-01-nestjs-12-upgrade/task-T6-report.md) and [machine evidence](evidence/t6/rollback-result.json). The old artifact was built from execution base `9812ea907ed18ffc513ffdef0effc0e1ddaaa0df`; the new runtime artifact is the T5 verification image. Existing migrations were applied only to a new disposable fixture. Future short leases in synthetic interrupted checkpoints test real Mongo expiry/skew and default worker cadence without waiting300s; production must still observe the full default lease window. No application source/schema or production database was modified by T6.
