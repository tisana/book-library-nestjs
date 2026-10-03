# T4 — Authentication lifecycle and graceful shutdown

Implemented on `upgrade/nestjs-12`, base `e01d4e2fc81197ef6483596fc429f02f7ca59068`. T4 implementation is ready for independent review; this is not final release approval. Applicable repository AGENTS.md/authentication plan, T4/global constraints, T3 report/review and installed Nest/Mongoose shutdown ordering were inspected. No subagents, Docker runs, production databases, seed imports or external messages were used.

## Changes and acceptance evidence

- `main.ts` enables Nest HTTP shutdown hooks. The actual compiled `dist/main.js` receives SIGTERM in the process suite; reconstructed TestingModules are not used as proof of signal behavior.
- Identifier reconciliation stops readiness/interval producers and awaits the active pass in `onModuleDestroy`, before Mongoose's `onApplicationShutdown` closes Mongo. A stopped worker cannot recreate its readiness timer when an earlier probe resolves. Existing public shutdown behavior remains idempotent.
- Refresh reconciliation registers only one interval per service, shares an overlapping active pass and awaits it during module destruction. Both workers contain drain-query rejection with generic, secret-free diagnostics so remaining teardown can complete. No refresh replay, lease, auth version, origin, permission or schema contracts changed.
- Unit and Mongo tests cover migration-003 gating, concurrent/repeated readiness, retry after readiness failures, timer ownership, shutdown/readiness races, active-pass drain, query rejection and cleanup. Application-level checks assert real timer handles destroyed, scheduler intervals removed and Mongo disconnected.
- Restart tests prove staff/member session continuity, reject replayed old/successor refresh credentials after another restart, and reject stale member access/refresh credentials after auth-version changes. Pending pre-CAS markers reject takeover during a live lease and rotate after expiry; post-CAS orphan recovery across two live application instances commits one marker, revokes the family and rejects both credentials. Identifier recovery respects an unexpired interrupted lease and produces exactly one durable terminal event/active reservation after expired-lease competition.
- Production tests pause real child Mongo commands using disposable-server `failCommand`, with no custom application entry, route, module, loader or seed probe. An accepted login completes safely after SIGTERM. A real finalizing identifier operation with an applied reservation persists its terminal event, completes and releases its lease before signal exit. A failing active query permits teardown and recovers on process restart.
- The strict harness rejects an 8,000ms overrun; SIGKILL is cleanup, never successful shutdown. A negative real-process test blocks a claimed worker's terminal audit for ten seconds, requires shutdown rejection and SIGKILL, then restarts against the durable checkpoint and verifies one audit/completed operation. It advances only the disposable lease past expiry, retaining real Mongo time predicates. A separate wedged-child harness test confirms timeout cannot become a passing forced-kill result.
- Eight seconds leaves two seconds within Compose's default ten-second stop grace. Production has no forced-exit timer; an indefinitely blocked query can exceed that grace and must recover after lease expiry. [Lifecycle documentation](../../../docs/upgrade/nestjs-12/lifecycle.md) explains deployment compatibility, the default 300s lease plus 5s skew delay, failure behavior and commands. Actual deployment grace remains a T6 confirmation.

## RED/GREEN and investigation

Saved logs are under `docs/upgrade/nestjs-12/evidence/t4/`.

1. `unit-red.txt`: focused units exit 1, **127 passed / 2 failed**. Repeated refresh initialization produced two timers; a readiness response after shutdown recreated one timer. The existing readiness-race test previously hid the latter with a second shutdown call. Minimal guards fixed both.
2. `process-red-2.txt`: real compiled process exit 1, **1 passed / 2 failed**. SIGTERM reset the accepted login (observed status 0, expected 200) and interrupted reconciliation. Hooks alone yielded **2 passed / 1 failed** (`process-hooks.txt`), proving enabling hooks was insufficient.
3. `process-active-red.txt`: strengthened finalizing/applied-reservation fixture still failed after hooks: expected completed, observed finalizing. Early active-pass drain fixed it. `process-green-1.txt` records **3/3** successful real signal cases.
4. `persistence-red.txt`: application closed while a real refresh recovery query was gated; expected draining, observed closed, followed by a reconciliation error. Tracking/draining the active pass fixed it. The additional unrelated 500 within this new combined fixture was traced to Passport's process-global strategy pointing at the second TestingModule after it closed. Isolated continuity passed; recreating the surviving HTTP fixture after peer shutdown restored combined success without a production change. The diagnostic test-name run deselected three cases; it is not acceptance evidence.
5. `drain-rejection-red.txt`: focused units exit 1, **132 passed / 2 failed** because both destroy hooks propagated a rejected active query. Generic logging plus continued teardown fixed this; final units and the real nonretryable-query process recovery case pass.
6. Test-authoring failures are retained separately: first process fixture omitted required production JWT issuer; the lease fixture first omitted required creator/updater metadata, then used object values where the unchanged schema requires strings. These were test setup/type errors, not compatibility defects. No skip, threshold weakening or schema change resolved them.

## Final verification

Environment: Node 24.19.0/npm 11.9.0; Nest 12.1.1; TypeScript 6.0.2; Jest 30.4.1 with required VM-module flag; disposable Mongo 8.2.12 at `/tmp/nestjs-t0-mongo/mongod`. Mongo commands set `MONGOMS_SYSTEM_BINARY`, `MONGOMS_VERSION=8.2.12`, `MONGOMS_DOWNLOAD_DIR=/tmp/nestjs-t0-mongo`.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run test:cov` | 0 | 35 suites, **566/566**, zero pending; all 87 source coverage files retained |
| `npm run test:e2e -- auth-persistence auth-identifier-recovery auth-browser-session-security auth-identifier-migration auth-identifier-offline-repair` | 0 | 6 suites, **33/33**, zero skipped/open-handle reports |
| `node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/jest-production.json --runInBand --detectOpenHandles production-shutdown` | 0 | **6/6**, including two explicit negative timeout assertions, zero skipped |
| `npm run test:production` | 0 | Clean build + 2 suites, **54/54**, zero skipped/open-handle reports |
| `node node_modules/typescript/bin/tsc -p tsconfig.jest.json --noEmit --incremental false` | 0 | Full Jest/test typecheck |
| `node node_modules/eslint/bin/eslint.js` with all nine changed TS files | 0 | Scoped lint, no fixes or suppression |

Coverage: statements **81.57% (3011/3691)**, branches **76.58% (2178/2844)**, functions **81.65% (503/616)**, lines **81.95% (2888/3524)**. Increased totals reflect tested lifecycle implementation; all four percentages improve on the T3 baseline. No exclusions, floors, rule manifests or dependency changes. Unit logs contain expected generic warnings from deliberately injected failures, plus the existing Node VM-module warning.

The full e2e suite, reporting/mutation/frontend/container gates are not rerun for this scoped task; T5 owns those broader gates. T1's actual devcontainer verification and T5's existing audit/VM-worker follow-ups remain open. Coordinator progress.md, T3 review and the T4 brief are included unchanged; unrelated T5/T6 briefs and raw review packages are excluded. Commit/range is supplied in the handoff after final verification.

`git diff --check` is clean for implementation/evidence; the unchanged coordinator T4 brief retains its supplied Markdown hard-break trailing spaces and final blank line. They were preserved as requested.
