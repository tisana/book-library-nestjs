# NestJS 11 execution baseline

Execution date: 2026-10-02. Branch: `upgrade/nestjs-12`. Execution base: `9812ea907ed18ffc513ffdef0effc0e1ddaaa0df`. Assessed commit: `29fd6cfee2f3d51182cdd2626ade72b7e3856996`. T0 records the baseline plus an explicitly authorized benchmark-only HTTP ownership fix; application/dependency/schema contracts are unchanged.

The base adds `7270ebf` (security activity account names) and `9812ea9` (local API port documentation/configuration). Security activity now includes optional current `actorName`, resolved at read time through bounded staff/member ID queries; historical audit records retain the previous redacted storage model. Name display and its additional read costs are part of this baseline. Missing/unknown actors retain the ID fallback. Local example API port is 4000; the actual default and Docker API port remain 3000 unless PORT is supplied. Frontend architecture and security contracts are unchanged.

Read AGENTS.md, the current auth plan, the upgrade plan, package/lockfile, all tsconfigs, Dockerfile, CI and mutation workflows. Preserve current refresh replay, origin-before-session, permissions/ownership, trusted-proxy and audit-redaction requirements. No schema migration, dependency update, application-code/security change, threshold change or production action occurred. After baseline exposed the benchmark connection race, the coordinator explicitly authorized a minimal benchmark runner fix and focused regression so valid comparison evidence could be captured.

## Environment and reproducibility

Node 24.19.0; npm 11.9.0; Debian GNU/Linux 13.6 x86_64; three logical Intel Xeon Platinum 8573C CPUs. CI and Docker still use Node 22; these runs characterize the unchanged Nest 11 code under the planned Node 24 runtime, not a reproduced Node 22 CI/container run.

Initial npm queries failed because the default `/home/agent/.npm/_cacache` cannot be created. Rerun package-manager network commands with `npm_config_cache=/tmp/nestjs-t0-npm-cache`. Target registry availability was verified before npm ci or any baseline checks. All 14 exact targets are available; see [dependency-matrix.md](dependency-matrix.md).

Initial Mongo integration tests failed because `/home/agent/.cache/mongodb-binaries` cannot be created. Recovery used a binary from the allowed official Docker registry, without disabling tests or changing repository configuration:

```sh
docker --host=unix:///var/run/docker.sock pull mongo:8.2
docker --host=unix:///var/run/docker.sock create --name nestjs-t0-mongo-extract mongo:8.2
docker --host=unix:///var/run/docker.sock cp nestjs-t0-mongo-extract:/usr/bin/mongod /tmp/nestjs-t0-mongo/mongod
docker --host=unix:///var/run/docker.sock rm nestjs-t0-mongo-extract
```

Pulled image digest: `sha256:e0ce8c35124d4a9f9785532d1f268f39e9728ffa1cb38f46fa482436424c4bd3`. MongoDB is 8.2.12 (Ubuntu 24.04 binary), [version evidence](evidence/mongo-version.txt). Subsequent commands use `MONGOMS_SYSTEM_BINARY=/tmp/nestjs-t0-mongo/mongod MONGOMS_VERSION=8.2.12 MONGOMS_DOWNLOAD_DIR=/tmp/nestjs-t0-mongo`. Mongo memory-server owns disposable standalone or single-node replica-set fixtures, including the benchmark's separate temporary replica set. No existing/production database is configured or seeded.

Read the cloud runtime/network/Docker references. `/etc/codex/network-policy.json` allows npm, GitHub and Docker registry/CDN destinations; no VPN or external TCP grants. Runtime status reports connected/current observations, restricted package-manager preset and HTTP policy state `unknown`; policy readiness is not claimed. Actual permitted requests succeeded through configured proxy/CA. No network policy bypass, credential inspection or TLS verification change.

## Required command outcomes

| Command | Exit | Result |
| --- | ---: | --- |
| npm ci (with /tmp cache) | 0 | 884 packages installed; lockfile preserved |
| npm run build | 0 | Full-checkout build succeeds; actual entry path is dist/src/main.js |
| npm run test:cov | 0 | 35 suites; 560 tests passed; 0 skipped; 87 covered files |
| npm run test:e2e:report (initial) | 1 | 19 passed/10 failed suites; 201 passed/41 failed tests; Mongo cache ENOENT, with secondary teardown errors |
| npm run test:e2e:report (Mongo recovery) | 0 | 29 suites; 242 tests passed; 0 skipped; 94.857 seconds |
| npm run test:quality-reporting | 0 | 4 suites; 68 tests passed; 0 skipped |
| npm run mutation:check | 0 | 89 critical rules match |
| npm run mutation:smoke | 0 | All 5 shards pass; 1366 mutants; raw score 99.78%; 3 existing approved equivalents; no policy violations |
| npm run verify:auth-performance (before fix: first + isolated retry) | 1 each | Build/compile/Mongo migrations succeed; both terminate with read ECONNRESET before metrics |
| Focused real-runner regression (red / green) | 1 / 0 | Expected ECONNRESET failure, then all 4 tests pass after listener ownership fix |
| npm run test:e2e:report (after fix) | 0 | 29 suites; 243 tests passed; 0 skips; extra test is the runner regression |
| npm run verify:auth-performance (after fix) | 0 | Auth boundary p95 13.00 ms; first 50/10000 events 12.07 ms; both gates pass |

Additional baseline checks: `npm ls --json` exits 0 with no dependency-tree errors. `npm run quality:report:backend -- --check-only --producer-outcome backend-unit=success --producer-outcome backend-e2e=success` exits 0 using the actual successful recovered producer runs and expected 87 files. No pull-request changed-line gate was measured in T0; that final integration check remains T5.

Coverage: statements **81.51%** (2999/3679), branches **76.47%** (2165/2831), functions **81.50%** (498/611), lines **81.89%** (2877/3513). All exceed existing floors (80.89/74.70/81.32/81.26%). Durable [coverage](evidence/coverage-summary.json), [unit counts](evidence/backend-unit-counts.json), [e2e counts](evidence/backend-e2e-counts.json), [resolved direct dependencies](evidence/resolved-direct.json).

## Compilation paths and existing defects

Root tsconfig has CommonJS output, decorator metadata, implicit legacy resolution, baseUrl, no explicit rootDir. Its production exclude list excludes test/spec paths but the default source graph includes migrations/scripts; `scripts/verify-auth-performance.ts` imports the test benchmark module, causing benchmark artifacts to be emitted in the ordinary full-checkout build. Observed artifacts include `dist/src/main.js`, `dist/scripts/verify-auth-performance.js`, `dist/test/performance/auth-benchmark.controller.js` and `.module.js`. `dist/main.js` is absent. Existing `start:prod` and Docker CMD assume dist/main.js; the local artifact fails that entry-point requirement even though npm run build exits 0. Benchmark handlers are not imported by production AppModule; emitted files alone do not establish exposed routes.

A separate `/tmp/nestjs-t0-docker-inputs` directory copied exactly the backend build-stage source/config inputs (src, package.json, tsconfig*.json, nest-cli.json), reused baseline node_modules through a symlink, and ran `npm --prefix /tmp/nestjs-t0-docker-inputs run build`. It exits 0 and emits **dist/main.js**. Thus compilation root/output differs with source inputs. This is an input simulation under Node 24, not a built/started production Docker image under Node 22, and does not satisfy T5 container acceptance.

Performance tsconfig explicitly roots at the repository (`rootDir: .`), targets `dist-performance`, and includes source, migrations, runner and test-only benchmark module. Its expected runner path is `dist-performance/scripts/verify-auth-performance.js`; actual results are recorded below after verification.

The initial Mongo setup failures are environmental, not demonstrated application regressions. Secondary `undefined.close` teardown failures follow setup failures and are recorded separately as existing test robustness issues. Current dependency advisory findings and local production-entry mismatch predate upgrade implementation and need follow-up in owning upgrade tasks. No check is weakened to hide them.

## Mutation evidence

Full smoke passes existing policy: [summary](evidence/mutation-smoke-summary.md), [aggregate duration](evidence/mutation-smoke-duration.json), [individual shard outcomes](evidence/mutation-smoke-shards.json). Durations in milliseconds: token-session 272043, identifier-repair 178729, identifier-reconciliation 221135, members 269862, borrowings 68426. Every shard has timedOut=false, Stryker exit 0 and policy exit 0, below the unchanged 350000 ms per-shard budget. Sequential wall time is 1010362 ms; the existing aggregate summary displays this summed time beside the per-shard budget, which is not an aggregate deadline failure. Raw scores are 99.53/99.75/99.76/100/100%. Three survivors match existing approved equivalents; no new equivalent/waiver was introduced. Mutant-level timeouts (8/3/0/18/0) are detected mutants under current policy, distinct from process-budget timeouts.

## Performance harness failure and authorized correction

Before the authorized correction, the documented runner was invoked twice unchanged, each using its own automatically seeded temporary replica set, synthetic administrator, 100 warm-ups, 500 samples, concurrency 10, 10000 events, disabled Nest logging and production-mode compiled benchmark. Both attempts exit **1** with `auth-performance-verification-failed: read ECONNRESET` after successful build, performance compilation and migrations. Those attempts produced no latency metrics; historical auth-performance evidence was preserved and was not presented as a current pass. Confirmed compiled runner `dist-performance/scripts/verify-auth-performance.js`, application `dist-performance/src/main.js`, benchmark controller/module under `dist-performance/test/performance/`.

Root-cause investigation used systematic debugging: the runner calls `app.init()` then shares a non-listening HTTP server across concurrent Supertest requests (`scripts/verify-auth-performance.ts:141-164`, `:217-226`). Locked Supertest 4 automatically calls `app.listen(0)` for a server without an address, marks that request as server owner, then closes it when the request completes (`node_modules/supertest/lib/test.js:54-59`, `:120-126`). Other concurrent workers can reuse the server while its owner closes it. A minimal in-memory HTTP probe with the same 10 workers/100 requests, no Mongo/auth/data, reproduces 7 ECONNRESET errors and 37 automatic closes. The one-variable comparison with an explicitly listening server has 0 errors/0 automatic closes: [diagnostic](evidence/supertest-lifecycle-diagnostic.txt). This isolates an existing harness server-lifecycle race under the current Node 24/Supertest 4 combination. At this diagnosis stage no repository code/test changed; explicit-listen behavior was tested only in the disposable diagnostic, not substituted into benchmark results.

Evidence: [first attempt](evidence/auth-performance-initial.txt), [isolated retry before fix](evidence/auth-performance-retry-before-fix.txt). The coordinator authorized a minimal runner correction and focused regression to unblock baseline comparison. This changes the initial documentation-only scope transparently; it does not fix unrelated application contracts.


`64a2100d8f8263bf631f791d426a580d4c0f5709` replaces app.init with `app.listen(0, '127.0.0.1')` so the benchmark owns one ephemeral loopback listener until existing finally/app.close cleanup. The new regression compiles and executes the actual benchmark runner in a disposable directory against a dedicated seeded temporary Mongo replica set, including real auth and concurrent requests. It checks the existing fixed sample/warm-up/concurrency parameters and both existing performance gates. Red: one new test fails specifically with ECONNRESET (three existing pass); green: all four pass. [Red evidence](evidence/performance-regression-red.txt), [green evidence](evidence/performance-regression-green.txt). No application route, schema, auth settings, thresholds, sample method or fixtures changed.

After the fix, all 29 e2e suites/243 tests pass (0 skips, 45.633 seconds): [new counts](evidence/backend-e2e-after-fix-counts.json). Backend quality gate passes again with real successful producers. Standalone `npm run verify:auth-performance` now exits **0**: boundary p50 **7.67 ms**, p95 **13.00 ms**, max **20.66 ms**; security activity first 50/10000 events **12.07 ms**. Both existing limits pass. Full unprotected/protected/runtime/sample metadata: [current baseline](evidence/auth-performance-baseline.md), [successful command log](evidence/auth-performance.txt). Historical spec evidence was restored byte-for-byte after copying the current result into upgrade evidence. This resolves the comparison blocker; the unchanged local entry-path defect and current-lock advisories remain concerns for owning tasks.
