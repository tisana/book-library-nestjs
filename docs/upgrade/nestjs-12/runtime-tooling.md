# T1 runtime and transformer alignment

Verified 2026-10-02 from `df74b59c1354699b4050e947a3e1551c450ee59e` plus the T1 working-tree changes on `upgrade/nestjs-12`. Status: **DONE_WITH_CONCERNS**. Nest remains 11; TypeScript remains 5.9.3, Jest 30.2.0, Mongoose 9.8.1, and application output remains CommonJS.

Node **24.19.0** is pinned in `.node-version`, all seven CI/mutation jobs (including CodeQL autobuild), and each production Docker base stage. Each CI job verifies the selected version and installs/verifies npm **11.9.0**. The root package declares `>=24.15.0 <25` and `npm@11.9.0`. Local runtime assertions pass: [local version](evidence/t1/local-runtime-version.txt), [parsed workflow validation](evidence/t1/workflow-runtime-validation.txt).

The pulled `node:24.19.0-alpine` image actually reports `v24.19.0`; digest `sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43`. Its bundled npm is **11.17.0**, distinct from the selected lockfile/CI npm 11.9.0: [image version](evidence/t1/node-image-version.txt). This verifies the shared Node base for all production stages, not a built/started application container; T5 owns that verification.

The devcontainer retains its existing `javascript-node:24-trixie` base and MongoDB tool-install block. It installs Node 24.19.0 using the image's existing nvm, sets its default and PATH explicitly, and asserts the actual version during build. **Its build and actual runtime remain unverified:** pulling the existing MCR base failed after retries with `Forbidden` while downloading image configuration: [failure](evidence/t1/devcontainer-pull-failure.txt). The cloud status reported current/enforced restricted package-manager HTTP policy; no VPN is configured. No policy/TLS/proxy bypass was attempted. A permitted base-image pull is an outstanding environment prerequisite.

npm 11.9.0 regenerated the root lockfile without force or legacy peer handling. Only `ts-jest` 29.4.6 → **29.4.14**, `@types/node` 25.2.3 → **24.19.1**, required `undici-types` 7.16.0 → 7.24.6, and new nested `ts-jest/semver` 7.8.5 changed. All other installed versions remain identical: [changes and resolved direct versions](evidence/t1/dependency-changes.json). ts-jest 29.4.14 supports Jest 30 and TypeScript below 7; no Nest 12 or TypeScript 6 migration is included.

## Verification

Commands use `npm_config_cache=/tmp/nestjs-t0-npm-cache`. Integration/mutation/performance commands additionally use `MONGOMS_SYSTEM_BINARY=/tmp/nestjs-t0-mongo/mongod`, `MONGOMS_VERSION=8.2.12`, and `MONGOMS_DOWNLOAD_DIR=/tmp/nestjs-t0-mongo`. Mongo memory-server owns disposable fixtures; no existing database or production identity is used. [Actual command exits/timings](evidence/t1/command-outcomes.txt).

| Check | Exit | Outcome versus T0 |
| --- | ---: | --- |
| npm ci | 0 | 885 packages; expected extra nested semver |
| npm ls --json | 0 | No tree errors; retained versions verified |
| npm run build | 0 | Existing full-checkout `dist/src/main.js` defect persists; T3 owns repair |
| npm run test:cov | 0 | 35 suites / 560 tests / 0 skips; identical coverage and file counts |
| npm run test:e2e:report, initial | 1 | 28 passed / 1 failed suite; 242 passed / 1 failed test |
| npm run test:quality-reporting | 0 | 4 suites / 68 tests / 0 skips |
| Backend quality gate, initial | 1 | Correctly rejected the actual e2e failure |
| npm run mutation:check | 0 | Existing 89-rule manifest matches |
| npm run mutation:smoke | 0 | All five shards and aggregate policy pass |
| npm run verify:auth-performance, isolated | 0 | Both unchanged gates pass |
| npm run test:e2e:report, isolated | 0 | 29 suites / 243 tests / 0 skips, same post-repair T0 counts |
| Backend quality gate, isolated | 0 | Actual successful unit/e2e producers; 87 expected covered files |
| npm audit --json | 1 | Same 7 affected packages: 2 high / 5 moderate / 0 critical |

Unit coverage remains statements **81.51%**, branches **76.47%**, functions **81.50%**, lines **81.89%**, with identical numerators/denominators and 87 files: [coverage](evidence/t1/coverage-summary.json), [unit counts](evidence/t1/unit-counts.json), [final e2e counts](evidence/t1/e2e-isolated-counts.json). No floors, budgets, required counts, mutation policy, waivers, instrumentation configuration, or source hashes changed.

The initial failed test was the real compiled performance-runner regression. Its child exited 1 without ECONNRESET; the existing test discards the child's metrics/stdout/stderr before checking that exit. The failure coincided with the independent MCR image pull. Once image work and mutation smoke ended, the unchanged standalone runner and complete e2e suite both passed. **The exact initial cause cannot be proven retrospectively; load is a hypothesis, not a confirmed diagnosis.** No gate was weakened and no retry result replaces the preserved [initial counts](evidence/t1/e2e-initial-counts.json) and [failure](evidence/t1/e2e-initial-failure.txt). No persistent runtime/tooling regression was demonstrated; retaining child diagnostics would improve future investigation.

## Instrumentation and performance comparison

Mutation smoke still generates **1366** mutants and scores **99.78%**, with the same three approved equivalents and zero violations. All Stryker/policy exits are 0; all shard process timeouts are false. Individual detected mutant timeouts are distinct from process-budget failures. The sequential total is 1022897 ms versus T0 1010362 ms; the displayed 350000 ms budget applies to each shard.

| Shard | T0 duration ms | T1 duration ms | Raw score T0 / T1 |
| --- | ---: | ---: | --- |
| token-session | 272043 | 269914 | 99.53 / 99.53 |
| identifier-repair | 178729 | 185018 | 99.75 / 99.75 |
| identifier-reconciliation | 221135 | 221385 | 99.76 / 99.76 |
| members | 269862 | 277031 | 100 / 100 |
| borrowings | 68426 | 69390 | 100 / 100 |

Detected mutant timeouts changed from T0 **8/3/0/18/0** to **1/3/0/15/0**; survivor counts and policy classification did not change. [Summary](evidence/t1/mutation-smoke-summary.md), [duration](evidence/t1/mutation-smoke-duration.json), [individual shard metadata](evidence/t1/mutation-smoke-shards.json). Metadata records base HEAD `df74b59` because these checks executed the T1 working tree before its commit.

The isolated benchmark uses the unchanged production compilation, temporary replica set, 100 warm-ups, 500 samples, concurrency 10 and 10000 security events. Boundary p95 is **13.70 ms** versus T0 **13.00 ms**; the first-50-events read is **15.79 ms** versus **12.07 ms**. Both remain well within unchanged 50 ms / 2000 ms gates: [metrics](evidence/t1/auth-performance-isolated.md), [command log](evidence/t1/auth-performance-isolated.txt). Both T0 and T1 execute Node 24.19.0 here; these values are not a controlled Node 22-to-24 comparison. Historical specification performance evidence was restored byte-for-byte.

## Effects and remaining concerns

No application endpoint, DTO, authorization/session logic, audit format, schema, database migration, frontend architecture, CommonJS setting, or production command changed. Security invariants are preserved by unchanged source and passing unit/e2e/mutation suites. The existing full-checkout production entry-path defect remains T3's responsibility; T5 still owns actual final-container startup and PR changed-line gates. The unchanged current-lock advisories remain documented for owning upgrade tasks: [audit](evidence/t1/audit.json). Production deployment is outside this task.
