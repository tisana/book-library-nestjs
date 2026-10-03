# T0 baseline report

Status: DONE_WITH_CONCERNS. Every required command has an outcome; the performance comparison blocker was diagnosed and resolved through an explicitly authorized benchmark-only correction. Existing local compilation-path and dependency-advisory concerns remain.

Execution base: `9812ea907ed18ffc513ffdef0effc0e1ddaaa0df`; branch `upgrade/nestjs-12`. Assessed SHA: `29fd6cfee2f3d51182cdd2626ade72b7e3856996`. Read task-T0-brief.md, AGENTS.md, named auth plan and copied upgrade plan. Initial scope was baseline documentation/evidence. The coordinator explicitly authorized a minimal benchmark-only listener correction and focused regression after the existing runner race blocked valid baseline comparison. No dependency/application/schema/security/configuration changes. No agents/reviewers spawned.

## Files and evidence

- `docs/upgrade/nestjs-12/baseline.md`: runtime, changes since assessment, reproducible commands, coverage and output-path evidence.
- `docs/upgrade/nestjs-12/dependency-matrix.md`: all planned versions, engine/peer/module flags, official releases and advisories.
- `docs/upgrade/nestjs-12/evidence/`: compact metadata, counts, coverage summary, audit and version evidence. Excludes credentials, raw full test results, HTML coverage, Stryker sandboxes and bulk generated artifacts.
- `docs/superpowers/plans/2026-10-01-nestjs-12-upgrade.md`: existing untracked copied user plan, preserved verbatim and included for traceability.
- `scripts/verify-auth-performance.ts` and `test/performance/verify-auth-performance.spec.ts`: authorized runner HTTP ownership correction and regression exercising the actual compiled runner.
- This report. Existing untracked plan-specific progress ledger and T0 brief are preserved for parent ownership; other ledgers unchanged.

## Command ledger

All commands run from `/workspace/book-library-nestjs` unless a directory is stated. Commands ran separately and each producer has its own log/exit file under `/tmp/nestjs-t0-evidence`. Table below records semantic commands; shell log redirects and read-only inspection wrappers are omitted from spelling. No secret-bearing files/environment dumps were read or saved.

| Command / operation | Exit / status | Result / evidence |
| --- | --- | --- |
| pwd; rg --files for instructions/brief/plans | 0 | Workspace `/workspace`; AGENTS.md found; hidden brief then read directly |
| cat AGENTS.md and T0 brief | 0 | Current auth plan identified; exact T0/global constraints consumed |
| skills.read using-superpowers | success | Subagent-stop instruction: dispatched task does not use this workflow |
| skills.read cloud-environment-runtime and references/networking.md; /etc/codex/network-policy.json inspection | success / 0 | Restricted allowed npm/GitHub/Docker routes; no VPN/TCP destinations; no policy changes |
| cloud_environment.environment_status | success | Connected/current observations; policy state unknown; no credentials/capabilities; not claimed ready |
| git status --short; git rev-parse HEAD; git branch --show-current; git log/diff assessed..HEAD | 0 | Correct dedicated branch/base; two new commits and 10 affected files; only initial untracked user plan/ledger |
| cat auth plan, upgrade plan, package.json, tsconfig*.json, Dockerfile, .github/workflows/*.yml; rg fixture/benchmark/test setup | 0 | Existing instructions/scripts/quality gates and fixture procedure read |
| node -v; npm -v; cat /etc/os-release; lscpu | 0 | Node 24.19.0/npm 11.9.0; Debian 13.6; 3 logical Xeon Platinum 8573C CPUs |
| npm view TARGET version engines peerDependencies repository dist-tags --json (14 queries, initial cache) | 1 each | Default `/home/agent/.npm/_cacache` cannot be created; environmental ENOENT, no target availability inference |
| npm_config_cache=/tmp/nestjs-t0-npm-cache npm view TARGET version engines peerDependencies repository dist-tags --json (14 reruns) | 0 each | Every exact target verified before install; evidence/targets.json contains each command/output/exit |
| npm_config_cache=/tmp/nestjs-t0-npm-cache npm view TARGET peerDependenciesMeta type exports --json (14 queries) | 0 each | Optional flags and module maps; evidence/target-module-metadata.json |
| Official GitHub release/tag URL fetches (5 urllib GETs) | HTTP 200 each; wrapper 0 | Nest 12.0.0/12.1.1, Passport 12.0.0, tagged schematics/ts-jest metadata; evidence/releases.json |
| npm registry advisory bulk POST for 14 exact targets | HTTP 200; wrapper 0 | Empty direct-target advisories; evidence/target-advisories.json; no future transitive audit claim |
| npm_config_cache=/tmp/nestjs-t0-npm-cache npm ci | 0 | 884 packages; npm-ci.log and npm-ci.exit; no lockfile change |
| npm run build | 0 | build.log/.exit; full checkout emits dist/src/main.js, not dist/main.js |
| npm_config_cache=/tmp/nestjs-t0-npm-cache npm audit --json | 1 | 7 affected packages (2 high, 5 moderate); evidence/audit.json; advisories pre-existing |
| npm_config_cache=/tmp/nestjs-t0-npm-cache npm ls --json | 0 | No tree errors; npm-ls.json/.exit and evidence/resolved-direct.json |
| npm run test:cov | 0 | 35 suites/560 tests passed, no skips, 87 files; test-cov.log/.exit and durable counts/coverage |
| npm run test:e2e:report (initial) | 1 | 19 passed/10 failed suites; 201 passed/41 failed tests; environmental Mongo cache ENOENT; test-e2e-initial.log/.exit |
| npm run test:quality-reporting | 0 | 4 suites/68 tests passed, no skips; test-quality.log/.exit |
| skills.read references/docker.md | success | Managed daemon/proxy/CA procedure consumed before Docker operations |
| env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock info | 0 | Managed daemon accessible; docker-info.log/.exit |
| docker --host=unix:///var/run/docker.sock pull mongo:8.2 | 0 | Allowed registry; digest recorded in baseline; mongo-pull.log/.exit |
| mkdir /tmp/nestjs-t0-mongo; docker create/cp/rm extraction; /tmp/nestjs-t0-mongo/mongod --version | 0 | Mongo 8.2.12; extractor removed; evidence/mongo-version.txt |
| MONGOMS_SYSTEM_BINARY=/tmp/nestjs-t0-mongo/mongod MONGOMS_VERSION=8.2.12 MONGOMS_DOWNLOAD_DIR=/tmp/nestjs-t0-mongo npm run test:e2e:report | 0 | 29 suites/242 tests passed, no skips, real disposable Mongo fixtures; test-e2e-before-benchmark-fix.log and original exit 0 |
| npm run mutation:check | 0 | 89 critical rules; mutation-check.log/.exit |
| npm --prefix /tmp/nestjs-t0-docker-inputs run build (src/config/package inputs copied, node_modules symlink) | 0 | Docker-input simulation emits dist/main.js; docker-input-build.log/.exit; not actual Docker image verification |
| npm run quality:report:backend -- --check-only --producer-outcome backend-unit=success --producer-outcome backend-e2e=success | 0 | Actual successful recovered producers; 87 expected files and floors preserved; quality-gate.log/.exit |
| npm run verify:auth-performance (both unchanged attempts, Mongo env as above) | 1 each | Successful build/compile/fixture migrations, then ECONNRESET; both failures retained |
| Focused npx --no-install jest --config test/jest-e2e.json --runInBand test/performance/verify-auth-performance.spec.ts (red) | 1 | Expected reset assertion fails: 1 new failed/3 existing passed |
| Same focused Jest command (green, same Mongo env) | 0 | All 4 pass after minimal listener fix |
| npm run test:e2e:report after fix (same Mongo env) | 0 | All 29 suites/243 tests pass, no skips; 45.633 seconds |
| npm run verify:auth-performance after fix (same Mongo env) | 0 | Boundary p95 13.00 ms; first 50/10000 events 12.07 ms; both gates pass |
| Backend quality check-only command after fix | 0 | Same floors/file count and actual successful producers |
| Read-only rg/tail/ps, JSON reductions, release HTML text extraction and git inspections | 0 except missing-path rg below | Progress/outcome inspection and compact evidence generation; no application mutation |
| rg missing reports/mutation/smoke/duration.json and summary.json (while runner active) | 2 | Aggregate not produced until sequential shards complete; diagnostic only |
| rg --files -uu reports .stryker-tmp | 0 with missing .stryker-tmp diagnostic | Actual Stryker sandboxes reside inside shard directories; later resolved via shard logs |
| rg --files /tmp /usr/bin /usr/local/bin for mongod | 0 with unreadable unrelated /tmp directory diagnostic | No system binary found there; no permission escalation attempted |
| mkdir/cp compact evidence and write baseline/matrix/report | 0 | Documentation-only outputs; generated bulk artifacts excluded |

## Baseline and environmental distinctions

Current baseline passes installation, compile, dependency validation, unit coverage, recovered e2e, quality-reporting and existing backend quality gate. Mongo/npm cache failures were environmental and resolved with /tmp-backed documented setup. Secondary undefined close teardown errors follow Mongo setup failures; they are existing test robustness concerns, not Nest 12 regression evidence.

Local production output mismatch is an existing code/configuration-input issue: the full checkout includes scripts/migrations and emits dist/src/main.js plus benchmark artifacts; Docker copies a narrower source graph and emits dist/main.js. No correction made in T0. Ordinary AppModule does not reference benchmark handlers. T3 must make compilation boundaries explicit and preserve dist/main.js.

Unit coverage is statements 81.51%, branches 76.47%, functions 81.50%, lines 81.89%, above unchanged floors. Expected covered files remains 87. Existing locked dependency audit contains 7 findings; exact direct targets are currently advisory-free, but future resolved lockfile still needs audit. Node 24 baseline differs from still-Node-22 Docker/CI; Docker-input simulation is explicitly not a shipped-container run.

## Security and API effects

No application/dependency/security/schema/API behavior changed; benchmark alone now owns its listener instead of delegating ownership to individual Supertest requests. Since assessed SHA, optional actorName in security activity resolves current account names at read time (bounded ID queries); existing audit redaction/storage remains part of preserved baseline. The additional queries affect performance comparison and are accounted for by using execution base 9812ea9. Example local API port is 4000; default/Docker remain 3000 unless configured. No real credentials, tokens, cookie values, account data or external databases are in saved evidence.

## Concerns, final evidence and self-review

Full mutation smoke exits 0: 1366 mutants, raw score 99.78%, three existing approved-equivalent survivors, no violations; all five processes under per-shard budgets. Before the authorized fix, both unchanged isolated benchmark attempts exited 1 with ECONNRESET and produced no metrics. Systematic debugging and a no-database one-variable HTTP diagnostic isolate concurrent Supertest auto-listen/close behavior (7 reset errors/37 automatic closes vs 0/0 with explicit listener). Coordinator authorized the minimal runner correction and a regression executing the actual compiled benchmark. Red failed ECONNRESET, green all 4 pass. The corrected standalone benchmark passes p95 13.00 ms and activity 12.07 ms without changing warm-ups/samples/concurrency/thresholds. Full e2e after fix 29 suites/243 tests passes; quality gate passes. Historical metrics are not reused, and historical spec artifact is restored. Evidence and exact mechanism are in baseline.md. T0 does not certify Nest 12, shipped image, production HTTP contracts, lifecycle changes, rollback or deployment. Those remain owning tasks T1–T6.


Additional commands: `skills.read c6/systematic-debugging` succeeded before any proposed fix; 11 unique exact-target release-tag GETs and tagged ts-jest CHANGELOG GET returned HTTP 200 (wrappers exit 0). Technical summaries are in evidence/release-notes.json; public contributor names omitted. `npm_config_cache=/tmp/nestjs-t0-npm-cache npm run mutation:smoke` exit 0, logs and duration/summary evidence retained. `MONGOMS_SYSTEM_BINARY=/tmp/nestjs-t0-mongo/mongod MONGOMS_VERSION=8.2.12 MONGOMS_DOWNLOAD_DIR=/tmp/nestjs-t0-mongo npm run verify:auth-performance` was run separately after smoke twice: exit 1 each, successful compilation/migrations then ECONNRESET. The inline Node HTTP/Supertest lifecycle diagnostic exits 0 and reports both probe outcomes, not an application performance pass. `cmp` verifies historical benchmark evidence preserved; `git diff --exit-code` verifies application/dependency/schema/configuration artifacts and historical benchmark evidence unchanged; the authorized performance runner/spec are the only code/test changes.

Commit range for this task: execution base `9812ea907ed18ffc513ffdef0effc0e1ddaaa0df..HEAD`, two commits: `64a2100d8f8263bf631f791d426a580d4c0f5709` (`fix: own authentication benchmark HTTP listener`), followed by the documentation/evidence commit titled `docs: establish NestJS upgrade baseline evidence` on `upgrade/nestjs-12`. Numeric resulting commit is delivered in task handoff; HEAD in this report denotes that baseline commit, not future upgrade commits.

Self-review checks: report/brief acceptance cross-check, exact versions/peer flags, actual producer exits and counts, coverage floors/file count, per-shard timing/policy outcomes, current-versus-historical benchmark evidence, baseline/security/API assumptions, generated-artifact/privacy scope, staged diff and whitespace checks. Every required check has its actual outcome. Code fix was committed separately after red/green, full e2e and standalone performance verification. Only task docs/evidence and the verbatim copied user plan are staged for the documentation commit. Existing progress ledger/T0 brief and unrelated ledgers/artifacts remain untouched. Current corrected Nest11 benchmark performance passes both existing gates; no claim that Nest12 or production container/release verification passed.


Authorized deviation: coordinator ruling in plan-specific progress.md requires fixing benchmark HTTP ownership now because valid baseline comparison must exist before dependent tasks. Fix is confined to ephemeral loopback startup and the real-runner process regression; existing cleanup/sample method retained. Full smoke was verified at original Nest11 base before this benchmark-only fix; its selected application/unit sources and policy inputs are unchanged, so no additional smoke run was justified. Unit coverage likewise describes unchanged application sources. Additional verification commands: formatting the touched performance spec (exit 0), git diff/checks (exit 0), historical evidence cmp (exit 0), narrow code-fix stage/check/commit (exit 0). The main TDD/verification skills were read; the referenced writing-good-tests skill resource was unavailable at both attempted relative locators, with no task impact because the main workflow and exact regression requirements were available and followed.

Final artifact/link/JSON validation exits 0. Full staged whitespace check exits 2 only for pre-existing Markdown hard-break spaces and blank EOF in the copied user plan, which is preserved verbatim; the narrower check for authored baseline/matrix/evidence/report exits 0. This is documentation formatting, not a producer or application failure. Final stage/commit/status verification is recorded in handoff, with only the coordinator-owned brief/progress files remaining untracked.
