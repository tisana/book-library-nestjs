# Authentication lifecycle and HTTP shutdown

The compiled HTTP bootstrap enables Nest shutdown hooks. Identifier reconciliation stops its readiness/scheduled timers and drains its active pass in `onModuleDestroy`; refresh reconciliation owns one timer, shares overlapping passes and drains the active pass there too. This happens before Nest disposes HTTP connections and before Mongoose closes its connection in `onApplicationShutdown`. Rejected background queries produce generic diagnostics and allow teardown to continue; their durable markers/leases retain the existing recovery semantics.

Identifier startup still requires migration `003`. Concurrent/repeated bootstrap probes, temporary readiness failures and a readiness result arriving after shutdown cannot create duplicate or surviving timers. Refresh initialization is idempotent and uses the already-connected injected models. Application integration checks verify both timers are destroyed and Mongo reaches disconnected state.

## Shutdown budget

The process test harness allows **8,000 ms from SIGTERM to exit**, leaving two seconds inside Docker Compose's default **10-second** stop grace period (this checkout does not override `stop_grace_period`). A deployment must retain at least that grace period; T6 must confirm the actual deployment settings. Ordinary idle, accepted HTTP login and active reconciliation tests require a real `dist/main.js` child to exit on SIGTERM, within the budget, without SIGKILL.

A deadline overrun is an error, even if SIGKILL successfully cleans up the test child. There is no production forced-exit timer: an indefinitely blocked database operation can exceed the orchestrator's grace period. The negative test pauses a real terminal-audit database command for ten seconds after its lease is claimed, requires the eight-second shutdown to **fail**, observes SIGKILL cleanup, then restarts the compiled application and verifies recovery with exactly one terminal audit. Only that disposable lease's timestamp is advanced past expiry to avoid waiting the default 300-second lease plus five-second skew allowance. Production recovery uses actual lease expiry; operators must allow that interval before declaring work stranded.

A separate real process case injects a non-retryable database error during an active claim, verifies ordinary signal shutdown still completes, and verifies the next process completes the untouched operation. The real Mongo failpoints are enabled only on the disposable test server; production code, routes, schemas and startup artifacts have no test hooks.

## Reproduce

Use the approved Node 24 runtime and installed dependencies. Point MongoMemoryServer at an authorized disposable Mongo binary if downloads are unavailable:

```sh
export MONGOMS_SYSTEM_BINARY=/tmp/nestjs-t0-mongo/mongod
export MONGOMS_VERSION=8.2.12
export MONGOMS_DOWNLOAD_DIR=/tmp/nestjs-t0-mongo
npm run test:production
npm test -- --runInBand token-session.service.spec auth-identifier-reconciliation.service.spec
npm run test:e2e -- auth-persistence auth-identifier-recovery auth-browser-session-security auth-identifier-migration auth-identifier-offline-repair
```

`test:production` builds and runs both the existing production contracts and the signal suite. The ordinary e2e selector excludes both compiled-production suites, preserving the build prerequisite. Tests use synthetic accounts, randomly generated keys/passwords, disposable databases and redacted child diagnostics. Authentication restart tests cover continuity, stale auth versions, old-token replay, unexpired/expired pre-CAS leases, orphaned post-CAS markers and concurrent recovery. The two simultaneous in-process TestingModules share Passport's global strategy registry, so their HTTP fixture is recreated after its peer closes; actual deployed processes do not share that registry.

Final commands, RED/GREEN evidence and scoped limitations are recorded in [the T4 report](../../../.superpowers/sdd/2026-10-01-nestjs-12-upgrade/task-T4-report.md) and [verification evidence](evidence/t4/verification.json). T1's devcontainer verification remains blocked; T5 owns broader quality/mutation/frontend/container gates. This evidence authorizes no production deployment.
