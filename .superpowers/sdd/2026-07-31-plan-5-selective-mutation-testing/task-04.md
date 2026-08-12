# Task 04 Evidence

## Task

Add the Stryker configuration and budget-aware runner test-first. This task does not start Task 5.

## Implementer model and reasoning

Requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_implementer`; substitution none. This assignment was recorded before substantive implementation.

Human-approved amendment implementer: requested and actual `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_amendment_implementer`; substitution none. The amendment resumed at the same uncommitted starting HEAD and preserved the original implementation and every prior diagnostic.

## Reviewer model and reasoning

Requested reviewer: fresh `gpt-5.6-sol`, high reasoning, identity pending controller dispatch; substitution none. Independent review remains pending and is not pre-approved by the implementer.

## Base SHA

Task 4 starting SHA: `1d3a4d1831e2b85ac4c325e4982604b649ba13f4`. Locked Plan 5 base: `b678209e23ef7020c21ff565327de1b229c835f6`, verified as an ancestor before work.

## Files changed

- `.gitignore`
- `stryker.config.mjs`
- `scripts/quality/run-mutation.mjs`
- `test/quality/mutation-runner.test.mjs`
- `test/quality/mutation-policy.test.mjs`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-04.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`

The implementation remains uncommitted because the mandatory real smoke probe hit an explicit timeout stop condition. No selected production source, service spec, dependency, manifest, allowlist, baseline, workflow, threshold, budget, reporter list, concurrency value, Jest version, or Stryker version changed.

The approved amendment changed only the authorized concurrency value from `2` to `4` and the timeout lifecycle implementation/tests. It did not alter the five selected sources, `89` ranges, observed `1366`-mutant workload, mutator set, reporters, thresholds, budgets, source files, service specs, dependencies, lockfile, manifest, allowlist, baseline, workflow, or Task 5+ files.

## RED command and exit

```powershell
node --test test/quality/mutation-runner.test.mjs
# exit 1; Node duration 70.6459 ms; wall 167 ms
```

After the first live probe exposed Windows `npx.cmd` launch behavior, the focused regression RED was:

```powershell
node --test --test-name-pattern="launches the local npx shim" test/quality/mutation-runner.test.mjs
# exit 1; Node duration 95.9681 ms
```

The amendment's exact concurrency RED was:

```powershell
node --test --test-name-pattern="both profiles use Jest" test/quality/mutation-runner.test.mjs
# exit 1; 0/1 passed; Node duration 114.8608 ms
```

Actual config concurrency was `2`; the hand-derived expected literal was `4`.

The real descendant-process RED ran under Ubuntu `24.04.4 LTS` after exact `nvm use lts/jod`, Node `v22.22.2`:

```bash
node --test --test-name-pattern="real descendant process tree" test/quality/mutation-runner.test.mjs
# exit 1; 0/1 passed; Node duration 1086.9539 ms
```

The direct parent had exited but the exact recorded descendant PID was still alive (`true !== false`). The fixture's `finally` cleanup targeted only its exact process group/PIDs; no name-based cleanup was used.

## RED evidence

The exact Task 4 RED was the intended `ERR_MODULE_NOT_FOUND` for root `stryker.config.mjs`: `1` test, `0` passed, `1` failed. The later launcher regression failed because `launchLocalNpx` was absent, after native Node `v24.18.0` had reproducibly thrown synchronous `spawn EINVAL` for Windows `npx.cmd` with `shell:false`. The existing locked `cross-spawn@7.0.6` successfully launched that exact shim and preserved `shell:false`.

Amendment RED proved both requested breaks independently: both profiles still exposed concurrency `2`, and POSIX timeout completion observed only the direct child's close while its real descendant survived.

## GREEN command and exit

```powershell
node --test --test-name-pattern="launches the local npx shim" test/quality/mutation-runner.test.mjs
# exit 0; 1/1 passed; Node duration 416.9741 ms

node --test test/quality/mutation-runner.test.mjs test/quality/mutation-policy.test.mjs
# exit 0; 57/57 passed; Node duration 1036.9569 ms

node scripts/quality/update-critical-rule-manifest.mjs --check
# exit 0; Critical mutation manifest check passed (89 rules).
```

Amendment GREEN under exact Ubuntu/nvm Node `v22.22.2`:

```bash
node --test test/quality/mutation-runner.test.mjs test/quality/mutation-policy.test.mjs
# exit 0; 59/59 passed; 0 skipped; Node duration 12383.9075 ms
```

The real graceful process-group test completed in `794.1055 ms`. The real SIGTERM-resistant process-group test completed in `10796.8184 ms`, proved the existing ten-second grace elapsed, and proved both recorded parent/descendant PIDs absent before return. The Windows real exact-descendant-tree test also passed in `11907.9574 ms`; the Windows combined suite passed `58`, failed `0`, and skipped only the POSIX-only forced-signal test.

## GREEN evidence

Deterministic unit/config GREEN is distinct from the real mutation result. Tests prove exact complete five-file scope; all `89` distinct supported smoke ranges; Jest `perTest`; all four reporters; thresholds `80/70/break 70`; concurrency `2`; the exact custom Jest block; exact module-load profile validation; `300000`/`900000` budgets; `SIGTERM` then ten-second `SIGKILL`; timeout duration preservation; provenance, source hashes, score, and policy summaries; policy enforcement after Stryker exit zero; and the exact ignore entry.

The preceding concurrency-`2` sentence is historical pre-amendment evidence. Amendment GREEN supersedes it with fixed concurrency `4` for both profiles. POSIX launches the local `npx --no-install` child with `shell:false` in an isolated process group, signals the exact group with SIGTERM, waits ten seconds, signals that group with SIGKILL if necessary, and verifies the group is gone. Windows snapshots the exact root PID's descendant relation, attempts exact-tree graceful termination, then uses exact `/PID ... /T /F` forced cleanup and verifies every tracked PID is gone. No broad process-name cleanup is present.

The first live probe exited `1` in `127 ms` before Stryker because native Node on Windows threw `spawn EINVAL`. The test-first `cross-spawn` launcher correction preserved `npx.cmd`, `npx --no-install stryker run`, and `shell:false`.

The second real smoke probe exited nonzero after the hard budget. Preserved evidence reports `durationMs: 300021.1058`, `budgetMs: 300000`, `timedOut: true`, `strykerExitCode: null`, `policyExitCode: 1`, and signal `SIGTERM`. No `mutation.json` or `mutation.html` was produced, so configuration/report compatibility and survivor/score results are not established. This is an explicit Task 4 stop condition, not an acceptable mutation-policy RED.

At controller direction, a second compatibility probe used an isolated WSL `/tmp` copy, Ubuntu `24.04.4 LTS`, the official portable Node `v22.23.2` archive, npm `10.9.8`, and fresh `npm ci` exit `0`. Its exact unchanged smoke budget also timed out: `durationMs: 300112.812547`, `budgetMs: 300000`, `timedOut: true`, `strykerExitCode: null`, `policyExitCode: 1`, snapshot `053555b23cfeb3907a08715c94daadb0742897f8`, Linux `6.18.33.2-microsoft-standard-WSL2 x64`. It produced neither `mutation.json` nor `mutation.html`, so score, survivor, NoCoverage, and fingerprint evidence remain unavailable. The runner's direct-child termination left Stryker PID `1272` and workers `1296`/`1297` briefly orphaned; all had exited before cleanup. The orphan-held capture pipe caused the supervising command to time out before staging, and WSL later removed the isolated `/tmp` workspace. Surviving npm logs and a precise loss record are preserved at `reports/mutation/diagnostics/node22-ubuntu24-reference/`; the exact shell-recorder `npm ci` runtime is unavailable, while the npm log's start-to-mtime window is `25239.839624 ms`.

After the user supplied and authorized the native-nvm retry, a third compatibility probe used persistent WSL-native storage at `/home/tisana/book-library-plan5-task4-nvm-retry-20260811` rather than `/tmp`. Exact nvm output was `Now using node v22.22.2 (npm v10.9.8)` on Ubuntu `24.04.4 LTS`; the isolated 535-file snapshot SHA is `105afb77f9f936d29b893ba090e679778961d29b`. Fresh `npm ci` exited `0` in `23738 ms`, the deterministic `57/57` suite exited `0` in `436 ms`, and the manifest check exited `0`. Stryker accepted five mutated sources, instrumented `1366` mutants, created two workers, and passed its 268-test dry run in 12 seconds. The final emitted mutation-progress line before timeout was `889/1366` tested, `234` survived, and `3` timed out. The exact unchanged runner again timed out: runner `durationMs: 300114.361609`, harness wall `300172 ms`, `budgetMs: 300000`, `timedOut: true`, `strykerExitCode: null`, `policyExitCode: 1`, signal `SIGTERM`. No JSON/HTML was produced. Two workers were captured immediately after the direct child returned and both subsequently exited; the final process check was empty. The complete persistent snapshot remains in place at 455741450 bytes.

The user-authorized Docker fallback then used official Ubuntu `24.04` image digest `ubuntu@sha256:561618e2c15bf2397621dd04f96926663a3b5616c189cf7e38db7e82f5c538ea`, container `9e27f4ecd69343d2a8527040edd53df465f175231210e6f64e1227841f6920e7`, and a 535-file/7352320-byte source archive with SHA-256 `968e53262c9272c381118619f8d81fd2623994ba9ca32172e4ad0862e91f0246`. The container had no explicit Docker CPU, memory, or PID limit and observed 8 CPUs plus 16334456 KB RAM. Ubuntu reported `24.04.4 LTS`; the official Node `v22.22.2` archive verified at SHA-256 `88fd1ce767091fd8d4a99fdb2356e98c819f93f3b1f8663853a2dee9b438068a` and supplied npm `10.9.7`. The probe stopped structurally before snapshot commit, `npm ci`, or smoke: GNU tar retained WSL uid/gid ownership for `/workspace/repo`, while root created `.git`, so Git `2.43.0` rejected the mixed-owner repository as dubious during local identity configuration. Per the explicit structural-failure stop condition, no ownership workaround or retry was attempted. The running container, overlayfs workspace, image, source archive, and all setup evidence remain preserved.

The controller ruled that Git ownership rejection a context/setup blocker rather than a Task 4 structural failure and authorized one minimal retry in the same preserved container. `/workspace/repo` resolved exactly; recursive ownership was normalized from mixed `ubuntu:ubuntu`/`root:root` to consistently `root:root`, while global `safe.directory` remained empty. The previously failing Git status/config/add/commit boundary then passed and produced snapshot `018ba8d658c78b5dddaa8a7d256ce526beb0ff28`. Fresh `npm ci` exited `0` in `31882 ms`; deterministic `57/57` tests exited `0` in `436 ms`; the manifest check exited `0`; and serialized config SHA-256 `f5879c763d1f476a1afc1cf925cdc6919084166332297214b9672c181bac0535` retained the exact Task 4 contract. Stryker again accepted five sources, instrumented `1366` mutants, created two workers, and passed the 268-test dry run in 14 seconds. The final emitted mutation-progress line was `837/1366` tested, `222` survived, `3` timed out. The unchanged Docker smoke timed out: runner `durationMs: 300120.214394`, harness wall `300139 ms`, budget `300000`, `timedOut: true`, Stryker exit `null`, policy exit `1`, signal `SIGTERM`; JSON and HTML remained absent. Post-return worker termination caused orphan Stryker PID `3098` to respawn workers `3274`/`3275`; the exact session `2824` was terminated and only zero-CPU PID-1-unreaped zombies remained. The container and its full report tree remain preserved.

## Focused metrics

- Deterministic tests: `57/57` passed.
- Manifest check: `89` rules across exact source counts `16/26/22/13/12`.
- Complete config source count: exactly `5` full selected files.
- Smoke config range count: exactly `89`, with no duplicate range and no rule omission.
- Real smoke score and critical findings: unavailable because the hard timeout preceded `mutation.json`.
- No equivalent classification was proposed or added.
- Amendment deterministic tests: Ubuntu Node 22 `59/59` passed with no skips; exact real graceful and forced process-tree cases passed and verified no recorded descendant survived.
- Amendment primary acceptance: the initial `50 ms` provenance failure was ruled a snapshot setup/context failure because Stryker never spawned. After local Git initialization and provenance GREEN, genuine cold trial 1 reached Stryker/config/dry-run but timed out above the required `270000 ms`; per the automatic fallback boundary, trials 2–3 were not started and no fallback was designed.

## Full-suite commands and exits

The exact combined Node suite exited `0` with `57/57` passed. The standalone updater check exited `0` with `89` rules. No repository-wide suite, Task 5 service-spec mutation hardening, complete-profile run, workflow dispatch, push, or Action was started.

The amendment's fresh authoritative Ubuntu/nvm combined suite exited `0` with `59/59` passed and no skips. The manifest check remained `89` rules. Focused ESLint/Prettier/source/scope verification was performed before handoff; the primary runtime stop prevented the exact two-commit protocol.

Final post-runtime verification: Ubuntu/nvm Node `v22.22.2` combined suite exit `0`, `59/59`, no skips, `12449.126774 ms`; updater check exit `0`, `89` rules; focused ESLint exit `0`; focused Prettier exit `0`; `git diff --check` exit `0`; selected production identity against locked base exit `0`. Serialized smoke config SHA-256 `25081d98e3e3341b30026ebc6c90f95c500cddfe1bc8c09388fc2a058b5b17d3` proves `89` ranges, exact five-source union, concurrency `4`, unchanged reporters and thresholds, and unchanged `300000 ms` budget.

## Runtime evidence

Preflight completed on the assigned clean starting SHA with Stryker `9.6.1`, Jest `30.2.0`, ts-jest `29.4.6`, `89` reviewed manifest rules, and an exact empty allowlist. The initial RED wall time was `167 ms`; the initial 56-test combined GREEN wall time was `648 ms`; the final 57-test combined GREEN Node duration was `1036.9569 ms`; the failed real smoke duration was `300021.1058 ms` on Node `v24.18.0`, Windows `win32 10.0.26200 x64`.

Preserved generated evidence:

- `reports/mutation/smoke/duration.json` — SHA-256 `37d4fb030cc54dda0723d2f48553681a973b97b80837ab5fd255fc51df5abd3c`.
- `reports/mutation/smoke/summary.json` — SHA-256 `533b0823df2f929bde9d5b8c6a79a0fcc723048863ea59854c5ff61e8779266c`.
- `reports/mutation/smoke/summary.md` — SHA-256 `7503a5601830d8a8b34a1a499eec984052c7ffdf20f817779277d5c4f0e5304b`.
- `reports/mutation/smoke/.stryker-tmp/` remains preserved.
- `reports/mutation/smoke/mutation.json` and `mutation.html` are absent.
- The complete Windows timeout folder is additionally preserved without deletion at `reports/mutation/diagnostics/node24-timeout/`; its top-level duration/summary hashes match those listed above.
- Reference-probe preservation record: `reports/mutation/diagnostics/node22-ubuntu24-reference/reference-observation.txt`.
- Reference npm-ci log: SHA-256 `44cf4cfefb9d59cef9311e2778acd60633c58e9b6cb9f8df2d8e82c9ed50a304`.
- Reference npm postinstall-child log: SHA-256 `fe69d4e33c9d35f778bd6cf8d3125bc62e99e19be3309785ab92744032fb2698`.
- Reference npx/Stryker-launch log: SHA-256 `0306ba03cbadeb895435e360f7bd827238f97c8507aa2979269d2fb48bf9195c`.
- The reference probe's original duration/summary/temp files and smoke log were lost with the isolated WSL `/tmp` workspace before staging; no artifact hash is claimed for files that were not preserved.
- User-directed persistent nvm retry diagnostics: `reports/mutation/diagnostics/node22-nvm-ubuntu24-timeout/`.
- Nvm retry `duration.json`: SHA-256 `28b2afaef936325b99a9a2908534761df5865fb37eac2307dde0c2994c952050`.
- Nvm retry `summary.json`: SHA-256 `c5b18791ab05293e6364472ec4e63f42517d065689d7a7d3fd024678d657c91b`.
- Nvm retry `summary.md`: SHA-256 `d2cbf2a63ccfc948ab56d83d88229cebb1392e5e863188caca160297903d1f26`.
- Nvm retry `smoke.log`: SHA-256 `b3500b0185633e195fbdca377b55841edfb6e90940255663a6998b58ef6dde7c`.
- Nvm retry `probe-state.txt`: SHA-256 `992aca37deb44d78b6a453e4e8f4779aed6b3db30fdbe7770dfac1575c14a1a5`.
- Nvm retry `post-smoke-processes.txt`: SHA-256 `588b4316750d0c968c38a2ea83631a7fa5a5ffaa46de8b62542f116d7245e63c`.
- The persistent nvm retry keeps its full 6,956,262-byte/535-file `.stryker-tmp` at `/home/tisana/book-library-plan5-task4-nvm-retry-20260811/repo/reports/mutation/smoke/.stryker-tmp`; it was not deleted or copied over prior diagnostics.
- Docker fallback diagnostics: `reports/mutation/diagnostics/docker-ubuntu24-node22-reference/`.
- Docker source archive: SHA-256 `968e53262c9272c381118619f8d81fd2623994ba9ca32172e4ad0862e91f0246`.
- Docker `probe.log`: SHA-256 `33f4d90d0b83d43f80d311cc63aa3f3186128ee7e5985aae176bf8a5a3cbf7d2`.
- Docker `probe-state.txt`: SHA-256 `f1548fc9412dacfada903c2052f159201ee2fedc8fb676e44e437afb2d901535`.
- Docker `git-ownership-failure.txt`: SHA-256 `00894f0c5f691ce84695a6cc910b42d5bee81a575739005f37a15afddf76e21a`.
- Docker `container-inspect.json`: SHA-256 `2ce6002900feb77ebf6d7bfeed29b7bf4488bd70f4fba90dcbd118d8512bef7c`.
- Docker setup produced no mutation report or duration/summary artifact because it stopped before `npm ci` and smoke.
- The preceding Docker setup statement is historical pre-fix evidence. After the controller-authorized ownership correction, Docker `duration.json` is SHA-256 `2d3b0d8c0742741ce3502b47a1e35b6b9764650861820a4165eeb82029fbfc94`.
- Docker post-fix `summary.json`: SHA-256 `895638f8a6ba2f2f480b957847312712e37e164e0e124a604e57ee042c95cf1f`.
- Docker post-fix `summary.md`: SHA-256 `67e3abdbfaea0efe2e9066e53f992722b212aa007cb2c6983ee8c9e7f591622f`.
- Lossless complete Docker report archive, including Linux symlinks: `reports/mutation/diagnostics/docker-ubuntu24-node22-reference/smoke-report.tar`, 7526400 bytes, SHA-256 `d82735fd3a8da8180609a0c86fb628473e686d0e33b14b5134a92b5bf5259fb3`.
- The corresponding report tree remains at `/workspace/repo/reports/mutation/smoke` in the preserved container and occupies 6961462 bytes; its `.stryker-tmp` contains 535 files.
- Amendment primary trial 1 persistent root: `/home/tisana/book-library-plan5-task4-primary-1a-20260812` on Ubuntu `24.04.4 LTS`; exact `nvm use lts/jod` selected Node `v22.22.2`, npm `10.9.8`.
- Trial 1 source ledger SHA-256: `0741a8130e1ac524be6a122b21b3c3b9691deeac25dc71e0e772d7d0d0d02cef`; fresh `npm ci` exit `0` in `23693 ms`.
- Trial 1 smoke wrapper exit `1` in `50 ms` before Stryker because the copied cold snapshot omitted `.git`; `git rev-parse HEAD` failed, so there was no duration/summary/mutation JSON or HTML. This is a configuration/provenance acceptance failure, not a mutation-policy failure.
- Trial 1 exact post-return process observation was empty for the trial path, Stryker, and Jest workers.
- Trial 1 durable local diagnostics: `reports/mutation/diagnostics/node22-nvm-ubuntu24-primary-trial-1-failure/`. `smoke.log` SHA-256 `8963301523503d93603ebd2850db06692b5b7d0c9c963f3f44129278c3930a76`; `smoke-result.txt` `b56d98f43014e1eb6e4f77357d353eff36501bde61423f6d9609ea3d0a0afc24`; `npm-ci.log` `989fbbf377f7558180804dda631801f5a30f97d65ba8e4691a6444943bf7aac8`; empty post-process proof `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- The controller classified that `50 ms` event as setup/context evidence, not a primary runtime trial. In the same byte-identical persistent snapshot, all files were consistently owned by `tisana`; global `safe.directory` was empty; local-only identity created clean snapshot commit `f4fee10c9cd25a758ecb03438684a3a66a0fc701`. The provenance harness proved exact 40-hex HEAD, clean status, one owner, and no bypass before genuine trial 1.
- Genuine trial 1: Stryker accepted exactly five sources, instrumented `1366` mutants, created concurrency `4`, and passed the 268-test `perTest` dry run in 14 seconds. Final progress was `1201/1366` tested, `348` survived, `3` timed out, with an emitted `~37m` remaining estimate.
- Genuine trial 1 wrapper exit `1`; wall `309543 ms`; `durationMs: 300259.49086200004`; `budgetMs: 300000`; `timedOut: true`; Stryker exit `null`; policy exit `1`; signal `SIGTERM`. This fails both the hard budget and the stricter `<=270000 ms` primary acceptance. Mutation JSON/HTML were absent; duration JSON and both summaries exist.
- Genuine trial 1 process-group cleanup proof is the exact empty post-smoke observation; an independent post-return process query was also empty for the trial root, Stryker, and Jest workers. The full report tree contains `539` files and remains persistent.
- Genuine trial 1 hashes: duration JSON `3d522c7ebf7d9cc29f8e76c18fa69724d19d8895e0ec90dd435516130e966991`; summary JSON `2ec08152339282adcfb347d174f884d3713b031aaa24dacbdfe317b61b9c5d7e`; summary Markdown `e6e8abfe3b8b95cac23471c259f8b41fba5599654df1a0053d78bc19ca353081`; full report archive `7f11b105dd789176d168b33b35fab8bb49b6b42d28e829954050884324cf64e6`; full smoke log `abe4cf4eaf8a6dccd3c1701b6e13140b6eb364f5ca3ea6df4e299c9bf7e6ee3a`; report hash ledger `21dcc29dffc0dc880c0f2d555b1f88940f8c6684cf8b1a9fd4d1d06bb9e07b15`.

## Commit hash

No implementation commit exists. The exact two-commit protocol was not started because the mandatory real smoke probe timed out and failed to create JSON/HTML evidence.

No amendment commit exists. The primary trial missed acceptance, so the amendment stopped before the exact two-commit protocol as required.

## Deferred findings

- Blocking condition: real smoke exceeded the exact `300000 ms` budget and produced neither JSON nor HTML on local Node `v24.18.0`/Windows, portable Node `v22.23.2`/Ubuntu `24.04.4 LTS`, native-nvm Node `v22.22.2`/Ubuntu `24.04.4 LTS`, and the controller-corrected Ubuntu 24.04 container-local overlayfs/Node `v22.22.2` fallback. Task 4 remains blocked with no commits.
- Systematic conclusion: the filesystem/runtime environment variable is eliminated. Persistent native WSL and container-local overlayfs used the same Node `v22.22.2` and showed consistent incomplete throughput (`889/1366` and `837/1366` at the hard stop). With the mandated `1366`-mutant workload and concurrency `2`, both displayed tens of minutes remaining and cannot complete within the immutable `300000 ms` smoke budget. No scope, range, concurrency, reporter, threshold, or budget change was made to compensate.
- Real-process termination defect: the runner signals only its direct child. At timeout, underlying Stryker and worker processes survive or respawn; WSL left Stryker/workers briefly orphaned, while Docker's orphan Stryker PID `3098` respawned workers `3274`/`3275` after initial worker termination. Safe cleanup required external resolution and termination of the exact Docker process session `2824`; only zero-CPU PID-1-unreaped zombies remained. This is recorded for controller action and was not changed after the explicit timeout stop.
- Task 5 mutant hardening, equivalent review, Task 6 baseline creation, workflow work, push, and Actions remain out of scope and unstarted.
- The generated timeout artifacts must remain preserved until the controller/reviewer has consumed them.
- Amendment fallback boundary: the controller ruled the initial missing-Git event a setup failure and authorized the provenance correction. Genuine primary cold trial 1 then reached Stryker and its dry run but timed out at `300259.49086200004 ms`, above both `270000` acceptance and the unchanged `300000` hard budget, without mutation JSON/HTML. Per the human-approved automatic rule, status is **BLOCKED_TO_FALLBACK**; trials 2–3 stopped, and this implementer did not design or implement sharding.
- The amendment code itself has deterministic cross-platform process-tree/concurrency GREEN, but runtime acceptance is not established. The controller must dispatch the separately authorized fallback workflow.

## Reviewer decision

Independent review remains pending controller dispatch. Implementer status: **BLOCKED BY EXPLICIT TASK 4 TIMEOUT STOP CONDITION**; no approval is claimed.

Amendment implementer status supersedes the historical status with **BLOCKED_TO_FALLBACK**. Independent review remains pending; no approval is claimed.

## Distributed runner / local sequential amendment result (2026-08-12)

The user-approved distributed-runner amendment was implemented by `/root/plan5_task4_amendment_implementer` using requested and actual `gpt-5.6-sol`, high reasoning; substitution none. The binding design and Task A amendment were read completely before implementation. This result supersedes the seven-range-shard candidate while preserving the earlier diagnostic history.

Strict TDD first captured focused RED against the seven-shard candidate: the six distributed smoke tests exited `1`, `0/6` passed, with exact failures for the five whole-source IDs/concurrency, missing named-shard execution, missing sequential local evidence, and merge still requiring seven range shards. Focused GREEN then passed `6/6` in `12587.7942 ms`, including a real named-shard descendant cleanup fixture. Self-review added a separate truthful distributed-summary RED: expected `maxShardDurationMs: 60000`, actual `undefined`; the focused GREEN passed `1/1` in `260.5579 ms` after the merge summary recorded Node major, maximum shard duration, independent budget, shard results, and non-reference status.

Final deterministic Windows verification passed `78/78` runnable tests with one intentional POSIX-only skip and no failures in `26492.2879 ms`. Ubuntu `24.04`, nvm Node `v22.22.2`/npm `10.9.8` passed `79/79`, no skips, in `14616.21423 ms`; the real graceful, forced-after-ten-seconds, and named-shard process-tree cases passed in `798.392072`, `10798.99159`, and `802.208931 ms`. The `89`-rule manifest check, focused ESLint, focused Prettier, `git diff --check`, protected production/package/workflow/manifest/allowlist/policy-module identity, and scoped-file checks all exited `0`.

The final candidate has exactly five whole-source smoke shards (`token-session`, `identifier-repair`, `identifier-reconciliation`, `members`, `borrowings`), concurrency `2` each, every owned manifest range, no line windows, isolated JSON/HTML/duration/summary/log/temp paths, named shard execution, sequential local evidence, and fail-closed canonical merge. Every shard owns an independent `300000 ms` hard deadline. Complete remains the exact five production sources, concurrency `4`, and `900000 ms`. Common merge provenance includes exact 40-hex commit, Node major, selected-source hashes, configuration SHA-256, and report schema; duplicate/omitted identity and any union other than `1366` fail closed, and Task 2 policy is evaluated once.

The one required cold compatibility set used persistent WSL-native root `/home/tisana/book-library-plan5-task4-distributed-sequential-1-20260812/repo`, consistent `tisana:tisana` ownership, no global `safe.directory` bypass, clean local snapshot `da9063578b37a123dc56da4afd4e488d7e327fd5`, and source-ledger SHA-256 `350534a9710337d1cda148855b7177c300773cbbd5f264820b79a85b9b924db3`. Same-shell runtime was exact nvm Node `v22.22.2`, npm `10.9.8`, with both binaries below `/home/tisana/.nvm/versions/node/v22.22.2/bin`. Fresh `npm ci` exited `0` in `22.69 s`; its log SHA-256 is `88d6b83b5a6a331adf49c3bf922f0b9d248c3f08bd2816feabb4f24fccccd927`. Installed versions were Stryker core/Jest runner `9.6.1`, Jest `30.2.0`, and ts-jest `29.4.6`.

Cold sequential results:

- `token-session`: exact `211` mutants, JSON/HTML present, `138392.496521 ms`, no runner timeout, Stryker exit `1` from score `57.82`.
- `identifier-repair`: exact `401` mutants, JSON/HTML present, `103928.02499899999 ms`, no runner timeout, Stryker exit `0`, score `75.81`.
- `identifier-reconciliation`: exact `415` mutants, JSON/HTML present, `102255.79665 ms`, no runner timeout, Stryker exit `1` from score `67.23`.
- `members`: instrumented exact `204`, progressed to `159/204` with `25` survived and zero Stryker mutant timeouts, but hit the independent hard stop at `300019.033115 ms`; runner `timedOut: true`, signal `SIGTERM`, artifact exit `1`, JSON/HTML absent.
- `borrowings`: exact `135` mutants, JSON/HTML present, `36701.73382299999 ms`, no runner timeout, Stryker exit `1`.

The wrapper settled non-zero after `688.71 s` wall time (diagnostic only) and recorded `681415.4080640001 ms`. It failed closed with `policyError: "Missing members mutation.json."`, `canonicalMutantCount: null`, and no merged mutation JSON/HTML. The four complete shard reports contain `1162` mutants; they are not represented as the required canonical `1366` union. All five shard summaries share snapshot `da9063578b37a123dc56da4afd4e488d7e327fd5`, Node major `22`, the exact selected-source hashes, and configuration SHA-256 `a776fcd0a07d052b9d954147f7befa31e4a6ed930adc28ec6e7587fad0f4e2bd`; members correctly has null report schema because no report exists. The exact post-wrapper query was empty for the persistent root, Stryker, and Jest workers, proving no surviving descendant.

The persistent source and report tree remain untouched. Durable ignored diagnostics are copied under `reports/mutation/diagnostics/node22-nvm-ubuntu24-distributed-sequential-blocked/`. Report-ledger SHA-256 is `faf55ac0dcce4366340bf426ba00fc49df22273fd5b33242d8ecc7fd3eac1ac6`; lossless `smoke-report.tar` is `15841280` bytes with SHA-256 `221ebdbc6aca649d4f1affde560796138c1d6bb27ba3dc46ba3bb68c328d7d71`; root duration/summary/Markdown hashes are `dfbf653dafd47cfe7ffda1c87921f53b5f7e037fe78c0694d3463644b8772ae4`, `4ef5e2d52d95fc6136313c73081467184506833b85b26a41b445570f54705368`, and `2e80f6a573d14419783ca8fd7c42e461744af8ee38fbee2be13080faa71ca93d`.

Final status is **BLOCKED**: the cold set has a genuine members timeout and missing required JSON/HTML, not a valid policy-only mutation RED. Per the binding stop condition the implementation/configuration was not changed after the failure; the two-commit protocol, reviewer dispatch, Task 5, push, and Actions were not started.

## Approved per-file fallback result (2026-08-12)

The controller dispatched the separately authorized fallback to the same requested and actual `gpt-5.6-sol`, high-reasoning implementer, `/root/plan5_task4_amendment_implementer`; substitution none. The binding fallback brief was read before work. Strict TDD captured the exact intended RED: runner suite exit `1`, `9/27` passed, `17` failed and `1` skipped in `27836.2932 ms`. The failures covered the absent five-way concurrent orchestration, concurrency-2 shard configuration, source/rule ownership, isolated artifacts, canonical identity/merge, merged policy, HTML index, shared cleanup, and five-tree proof.

Minimal fallback implementation reached authoritative Ubuntu/nvm Node 22 GREEN: combined policy/runner suite exit `0`, `71/71` passed, no skips, `13595.5128 ms`. This includes five concurrent launches under one absolute deadline, exact five-source/89-rule ownership, concurrency `2` per shard, isolated report/log/temp/duration paths, fail-closed report/source/identity checks, five-map canonical JSON with unchanged fixture statuses, one merged policy evaluation, truthful index HTML, complete concurrency `4`/`900000 ms`, graceful/forced process-tree cleanup, and a real five-tree timeout proof with no descendants. Manifest check passed with `89` rules; focused ESLint and Prettier, protected production/dependency/spec/manifest/allowlist identity, scope, and diff checks all exited `0`.

Two setup-only snapshots were preserved but did not count as trials: `1a` and `1b` exposed an nvm shell-subshell harness defect after fresh npm installs reported actual Node 24/npm 11. Neither started Stryker. The corrected genuine cold fallback Trial 1 used persistent root `/home/tisana/book-library-plan5-task4-fallback-1c-20260812`, consistent `tisana:tisana` ownership, empty global `safe.directory`, clean snapshot `f254f366ff3122c1966f11ea98752f6896d9684b`, and source-ledger SHA-256 `12c2a49967a6eafe6171bd5a1509d41f487bfce924476438f15e89433934b381`. The provenance boundary independently returned the same 40-hex SHA. Same-shell runtime was `/home/tisana/.nvm/versions/node/v22.22.2/bin/node` and npm in the same prefix, Node `v22.22.2`, npm `10.9.8`; fresh `npm ci` exited `0` in `20013 ms` and left a clean snapshot.

Trial 1 started at epoch `1786501100406` ms. All five shards reached Stryker/perTest dry run and instrumented exactly one source each: token-session `211`, identifier-repair `401`, identifier-reconciliation `415`, members `204`, borrowings `135`, totaling the unchanged `1366`. Exact root npx PIDs were `1498,1499,1500,1501,1503`; Stryker PIDs were `1563-1567`, with ten child-proxy workers observed. Final results:

- token-session completed `211/211` in Stryker's `4m34s`, JSON/HTML present, raw statuses Killed `122`, NoCoverage `3`, Survived `86`, Stryker exit `1`; runner shard duration metadata `300308.572361 ms`.
- identifier-repair completed `401/401` in `3m55s`, JSON/HTML present, Killed `301`, NoCoverage `8`, Survived `89`, Timeout `3`, Stryker exit `0`; runner shard duration metadata `300316.393661 ms`.
- identifier-reconciliation completed `415/415` in `4m06s`, JSON/HTML present, Killed `279`, NoCoverage `3`, Survived `133`, Stryker exit `1`; runner shard duration metadata `300316.511061 ms`.
- borrowings completed `135/135` in `1m22s`, JSON/HTML present, Killed `84`, NoCoverage `13`, Survived `38`, Stryker exit `1`; runner shard duration metadata `300316.885561 ms`.
- members was the critical path and reached only `104/204` at the shared deadline, with last emitted `11` survivors and `0` mutation timeouts. It received `SIGTERM`, Stryker exit remained `null`, `timedOut: true`, artifact exit `1`, JSON/HTML absent; runner shard duration metadata `300316.564061 ms`.

The overall wrapper exited `1`; harness wall was `310187 ms`; runner duration was `300358.90116099996/300000 ms`, `timedOut: true`, policy exit `1`. Canonical JSON/HTML were correctly absent because merge failed closed on `Missing members mutation.json.`; summary JSON/Markdown and overall/per-shard durations were preserved. Exact initial root/Stryker/worker PIDs were absent after return, `descendants_after` was empty, and an independent exact PID query was empty. Trials 2-3 were not started under the binding first-failed-cold-trial stop rule.

The complete `13M` report tree remains in the persistent snapshot. Its `3.1M` lossless archive is copied under `reports/mutation/diagnostics/node22-nvm-ubuntu24-fallback-trial-1-failure/`; archive SHA-256 `e28b1c7bd159d73a26a59294d25a0dff8a7ba0106de768ecf4a3175a09437248`, artifact-ledger SHA-256 `009f44ed8a21f7019f40a463eae29eb682e136f529168d0202221afd314ad3a8`, overall duration SHA-256 `216bfa3f3499a02ef7a3e2cbb76859d9a7296e4a8ce8586b49f78d8aabd4360b`, summary JSON `e024a1d771d15f0df6859220620e4bbb5c94ac0e629dc2e1b87ac81736946036`, summary Markdown `b4a6842b3d66fc43c05710f6f4555e73051674efa7047b19bffc85ac97b9ab77`.

Final fallback status is **BLOCKED**. The failed cold trial also exposed that completed-shard `durationMs` values are sampled after all shards settle rather than at each shard's own close, causing completed shard duration metadata to exceed the budget despite their Stryker completion times. Per the binding stop rule, this was preserved as a concern and not changed after the failed trial. No implementation or documentation commit was created; no Task 5, protected edit, push, or Actions dispatch occurred.

## Human-approved revised fallback result (2026-08-12)

The human explicitly approved one exact Task 4 revision. Requested and actual implementer remained `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_amendment_implementer`; substitution none. The revised brief and all predecessor briefs/evidence were read before changes. It authorized only members concurrency `4` while the other four smoke shards remain `2`, plus per-shard timestamps/durations at each shard's actual settlement. Every canonical merge, shared deadline, process-tree, source/rule, artifact, reporter, threshold, policy, complete-profile, and budget invariant remained fixed.

Strict focused RED on Windows:

```powershell
node --test --test-name-pattern="smoke uses the hand-derived|smoke records each shard duration" test/quality/mutation-runner.test.mjs
# exit 1; 0/2 passed; 2 failed; 181.0335 ms
```

The concurrency assertion reported exact actual members `2` versus expected `4`, with every other shard `2`. The settlement assertion reported the first shard's actual post-all `2026-08-12T10:00:00.250Z` versus its expected own settlement `2026-08-12T10:00:00.020Z`. Minimal implementation selected `4` only for members and stored each handle's finish timestamp/performance duration inside its single settlement callback. Focused GREEN passed `2/2` in `182.9944 ms`. The injected fixture proved token `20 ms`, repair `50 ms`, reconciliation `90 ms`, members `130 ms`, borrowings `180 ms`, and overall `250 ms`, with matching exact UTC finish timestamps.

Full deterministic verification:

- Windows: exit `0`, `73` tests, `72` passed, `0` failed, `1` POSIX-only skip, `31212.1672 ms`.
- Authoritative Ubuntu/nvm Node 22: exit `0`, `73/73` passed, no skips, `13619.734 ms`; graceful, ten-second forced, and real five-tree cleanup all passed.
- Manifest check `89` rules; focused ESLint/Prettier, protected production/frontend/dependency/spec/manifest/allowlist/workflow identity, scope, and diff checks exited `0`.
- Serialized shard concurrency/rule counts: token `2/16`, repair `2/26`, reconciliation `2/22`, members `4/13`, borrowings `2/12`; complete remained concurrency `4` over the exact five full files.

Genuine revised cold Trial 1 used unique persistent root `/home/tisana/book-library-plan5-task4-revised-fallback-1-20260812`, consistent `tisana:tisana` ownership, empty global `safe.directory`, clean snapshot `8e15f8a3b10de1cddce9f384b98304d470f30546`, source-ledger SHA-256 `01279156d70ee2d580203b3d8e38b8bb48658f860c315e43261b71648c4602fd`, same-shell Node `v22.22.2`/npm `10.9.8` at the nvm prefix, and fresh `npm ci` exit `0` in `20443 ms`. Provenance independently returned the same 40-hex SHA. Trial start epoch was `1786505708978` ms; npx roots were `1463-1467`; Stryker PIDs were `1524,1531,1534,1535,1537`; twelve child-proxy workers were observed, matching `2/2/2/4/2`. All five shards reached one-source Stryker/perTest and instrumented exact counts `211/401/415/204/135`, union `1366`.

Trial result:

- token-session completed `211/211`, Stryker exit `1`, JSON/HTML present, actual settlement `294293.292525 ms`; Killed `120`, NoCoverage `3`, Survived `86`, Timeout `2`.
- identifier-repair completed `401/401`, exit `0`, JSON/HTML present, `259712.12791299997 ms`; Killed `301`, NoCoverage `8`, Survived `89`, Timeout `3`.
- identifier-reconciliation completed `415/415`, exit `1`, JSON/HTML present, `272730.433264 ms`; Killed `279`, NoCoverage `3`, Survived `133`.
- borrowings completed `135/135`, exit `1`, JSON/HTML present, `95620.006745 ms`; Killed `83`, NoCoverage `13`, Survived `38`, Timeout `1`.
- members reached only `160/204`, last emitted `25` survivors and `1` mutation timeout, then received `SIGTERM`; exit `null`, `timedOut: true`, actual settlement `300281.33399199997 ms`, JSON/HTML absent.

Overall wrapper exit was `1`; runner `300391.094205/300000 ms`; harness wall `307662 ms`; timed out true; policy exit `1`. Canonical merge failed closed on `Missing members mutation.json.`; canonical JSON/HTML index were therefore absent, while overall/per-shard durations and summaries were preserved. Exact npx groups `1463-1467` were absent, the exact initial Stryker/worker PID query was empty, and recorded `descendants_after` was empty.

The complete `13M` report tree remains persistent and its `3.1M` archive is copied to `reports/mutation/diagnostics/node22-nvm-ubuntu24-revised-fallback-trial-1-failure/`. Archive SHA-256 `e0b461be6c59ac98b1c008056ba6268350da6b3b06ce2767277eac883dd1b695`; artifact ledger `78ce381f6b8cdfb814fbd53b78d1aa2a9ae73715b22a0e7ae6d4541025ca5bbb`; duration JSON `d373df365f377f726dee063da5687167d666a49a6ec630fdbf058fce66bb93b2`; summary JSON `c6e288d1839b24f76562d975c533969bd4e0c10e394f8fa083955152406c24f7`; summary Markdown `b1cc21e97930f190141365b42d249bb5af2b30a33cce96258812dd6fa7b7ae2d`.

Final revised-fallback status is **BLOCKED**. Per the binding first-failed-genuine-trial rule, Trials 2-3 stopped and the exact two-commit protocol was not started. No further concurrency/scope/rule/budget weakening, Task 5, protected edit, push, or Actions dispatch occurred.

## Human-approved second-level range-sharding result (2026-08-12)

The human approved the exact second-level topology in `task-04-range-sharding-brief.md`. Requested and actual implementer remained `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_amendment_implementer`; substitution none. The implementation keeps the unchanged five sources, `89` reviewed rules, reporters, thresholds, mutators, `300000` ms smoke deadline, and complete concurrency `4`/`900000` ms. Smoke launches seven isolated shards with a maximum of twelve workers: token lines `<=401` and `>=402` at concurrency `1` each; repair, reconciliation, members lines `<=341`, members lines `>=342`, and borrowings at concurrency `2` each. Manifest rules are intersected with inclusive shard windows, and validation proves every reviewed rule's emitted line union is exact and non-overlapping. Sibling JSON is merged at source level with canonical identity and exact-count validation.

Strict focused RED used the five exact new regressions for seven-range configuration, orchestration, sibling merge, `1365` rejection, and seven real process trees. It exited `1`: `0/5` passed, `5` failed, `20668.369 ms`. The failures showed the old five IDs, old five-child launch, old five-source-only merge assumption, pre-count topology rejection, and absent range-shard PID evidence. Minimal implementation then passed the same `5/5` in `21236.3775 ms`; the seven-tree cleanup regression took `20809.8531 ms`.

Final deterministic verification after formatting:

- Windows combined policy/runner suite: exit `0`, `76` tests, `75` passed, `0` failed, one POSIX-only skip, `35677.7363 ms`.
- Ubuntu `24.04.4 LTS`, nvm Node `v22.22.2`, npm `10.9.8`: exit `0`, `76/76` passed, no skips, `14642.3955 ms`. Graceful cleanup took `801.4815 ms`, forced cleanup `10800.5336 ms`, and seven-tree cleanup `805.3252 ms`.
- The actual-settlement fixture records exact shard values `20/50/90/130/180/210/230 ms` and overall `250 ms`.
- Manifest check passed `89` rules. Focused ESLint, Prettier, protected production/frontend/dependency/spec/manifest/allowlist/workflow byte identity, exact scope, and `git diff --check` passed. Starting HEAD remained `1d3a4d1831e2b85ac4c325e4982604b649ba13f4`.

Genuine cold Trial 1 used unique persistent root `/home/tisana/book-library-plan5-task4-range-sharding-1-20260812`, consistent `tisana:tisana` ownership, empty global `safe.directory`, clean snapshot `562190f57b0a2d3f1107d8fc7307a2bdb3c052df`, and source-ledger SHA-256 `5821761eba2299b26a5990adb05c6e72cafab956a5363e2a0dd984adac840fa5`. Same-shell runtime paths were `/home/tisana/.nvm/versions/node/v22.22.2/bin/node` and npm in the same prefix; fresh `npm ci` exited `0` in `23016 ms` and left clean status. A pre-install provenance probe failed setup-only because dependencies were intentionally absent, and a detached WSL launch exited before runner entry with no `run-meta`, no Stryker, and an empty supervisor log; neither event counts as a trial. The post-install provenance boundary returned the exact snapshot as a 40-hex SHA. The genuine attached run began at epoch `1786521710027` ms.

Seven npx roots/process groups (`1501,1502,1503,1504,1505,1511,1518`), seven Stryker processes (`1598,1613,1590,1592,1591,1587,1594`), and exactly twelve child-proxy workers were observed. All shards reached one-source Stryker with Jest `perTest`. Live instrumentation exposed a binding-evidence discrepancy before completion: the approved windows actually produced token `106/104`, repair `401`, reconciliation `415`, members `100/104`, and borrowings `135`, totaling `1365`, rather than the brief's `107/104`, `401`, `415`, `102/102`, `135` and required canonical `1366`. No source, range, boundary, or acceptance change was made after observing it.

The genuine trial also missed the unchanged wall-time gate. Final progress was token-a `33/106` (`4` survived, `1` timed out), token-b `34/104` (`16`, `1`), repair `182/401` (`54`, `4`), reconciliation `174/415` (`82`, `2`), members-a `28/100` (`1`, `2`), members-b `17/104` (`6`, `2`), and borrowings' last emitted progress `130/135` (`36`, `2`). Borrowings alone produced JSON/HTML and settled in `252913.378917 ms` with Stryker exit `1`; all other shards timed out and lacked JSON/HTML. Their actual settlement durations were token-a `300728.11932600004`, token-b `300728.369538`, repair `300753.524916`, reconciliation `300694.695321`, members-a `300755.35435700003`, and members-b `300744.584492` ms.

Overall runner duration was `300812.39060600003/300000 ms`, harness wall `307494 ms`, wrapper exit `1`, `timedOut: true`, signal `SIGTERM`, policy exit `1`. Canonical merge failed closed on `Missing token-session-a mutation.json.`; canonical JSON/HTML and a policy result over the full union were therefore absent. Recorded `descendants_after` was empty, the exact root/Stryker/worker query was independently empty, and the Windows WSL host had completed. Process-tree cleanup passed.

The persistent report tree contains `3295` files and is `52M`. Its `16M` lossless archive and ledgers are copied under `reports/mutation/diagnostics/node22-nvm-ubuntu24-range-sharding-trial-1-failure/`. Archive SHA-256 is `a0cafca2506097b54b3c0435d274cea4d9b4dedf54fb52d4f6c9e9aea3c98b8a`; artifact ledger `70a85d18a9404fd97b3feff62fd7e83c2b3b0739eb60550c06e77756f8559775`; duration JSON `56daa58d70cbb1b41a5b5a736918c1641cd28b63fc2205267f30ef7bee0b856a`; summary JSON `ce5e4fc5a807043e507dacbfbd737c7119fb822d29cbb771e2cfbd0115981d44`; summary Markdown `25ca7f075273de09780e0421a9a3da68aa3eb8f2dd0995f502d2305ea18a36a9`; run metadata `09efad05b6d8ed402cc6f777ad53ec0d49e344b7b796dfa02e9a24202fc6e605`; npm-ci log `88d6b83b5a6a331adf49c3bf922f0b9d248c3f08bd2816feabb4f24fccccd927`.

Final range-sharding status is **BLOCKED**. The first genuine cold trial failed artifact, exact-`1366` identity, policy-result, per-shard duration, and overall duration acceptance. Trials 2-3 stopped immediately. Per the binding brief, there was no post-failure implementation change, exact-count/budget weakening, implementation or documentation commit, fresh reviewer dispatch, Task 5, push, or Actions run.

## Human-approved distributed runner and members concurrency correction (2026-08-12)

The distributed-runner design supersedes the seven-window topology with exactly five whole-source smoke shards, one shard for each selected source, named single-shard execution, sequential local compatibility execution, isolated JSON/HTML/duration/summary/log/temp artifacts, fail-closed provenance and canonical identity merge, and an unchanged complete profile. The subsequent binding members-concurrency correction retains concurrency `2` for token-session, identifier-repair, identifier-reconciliation, and borrowings while assigning concurrency `4` only to members. Every smoke shard retains its independent `300000 ms` hard deadline; complete remains exact five full sources at concurrency `4` and `900000 ms`.

Strict correction RED was captured before the two-line configuration change. The focused worker-map regression exited `1`, `0/1` passed, in `114.5595 ms`, with exact actual members concurrency `2` versus expected `4`; all other shard values already matched `2`. Minimal GREEN changed only the members entry in `stryker.config.mjs` and `scripts/quality/run-mutation.mjs`. The two focused map regressions then passed `2/2` in `116.4271 ms`.

Final deterministic verification:

- Windows combined mutation policy/runner suite: exit `0`, `79` tests, `78` passed, `0` failed, one intentional POSIX-only skip, `26806.3345 ms`. The real graceful and named exact-tree cleanup cases passed; no implementation defect emerged.
- Ubuntu `24.04.4 LTS`, nvm Node `v22.22.2`, npm `10.9.8`: exit `0`, `79/79` passed with no skips in `14818.558805 ms`. Real graceful cleanup was `805.0104 ms`, forced cleanup was `10804.113632 ms`, and named cleanup was `812.408178 ms`.
- The manifest check passed all `89` rules. Focused ESLint and Prettier passed. `.gitignore` contains exactly one `/reports/mutation/` entry. Protected production, dependency, workflow, manifest, allowlist, baseline, Task 2 policy, and committed design bytes were unchanged; `git diff --check` and the scoped ownership check passed.

The mandatory members-alone gate used unique persistent root `/home/tisana/book-library-plan5-task4-members-c4-alone-20260812/repo`, consistent `tisana:tisana` ownership, empty global `safe.directory`, and clean local snapshot `6c739e882ea9daa57df6b160172fd4751a10153a`. Exact nvm runtime was Node `v22.22.2` and npm `10.9.8`; fresh `npm ci` exited `0` in `22.67 s`. Stryker `9.6.1` accepted the one members source, instrumented exact `204` mutants, created four workers, and passed its 119-test dry run. The shard completed in wall `242.88 s`; runner duration `242808.848852/300000 ms`; `timedOut: false`; Stryker exit `0`; artifact exit `0`. JSON, HTML, duration, summary, and log all exist. Members results were Killed `178`, Survived `25`, NoCoverage `1`, Timeout `0`, score `87.25`. The exact post-return process observation was empty.

Members-alone evidence is preserved under `reports/mutation/diagnostics/node22-nvm-ubuntu24-members-c4-alone-pass/`. Its source-ledger file SHA-256 is `089d3d78505501ecdfeeab719e41ad4d1f80c32847cddb83b5386ceac61a6531`; serialized config SHA-256 `4835137d0aa666f5486b770a8b9df006a230f29fd90af324c570dc575831805d`; report ledger `a794c85cf8f7cab347c7b74f9a6c63760d0fa72c19d036aa3480fdfc73442428`; lossless archive `17ffd105aebadc844a9503063eeff03690eb31811b89dffe036924e1640417b2`; duration JSON `8093ecb546c965a5db334ebc74a6bb3016d7c844e35d2be19392f2262e9897c8`; summary JSON `f7ab2ed4c4f5384819a9ac2d9e79eb43924acf87ab298ff623f60a6641031536`; mutation JSON `e9ec797d260505ddbd0d8b5dd652aa3a26e0d9cb5443d89eaebacd42c736a095`; HTML `1c073173e65a216425b028d02f07c85ca8c7d2d398ce55a13fd74fbe7007dd3f`.

The required fresh same-commit cold sequential set used `/home/tisana/book-library-plan5-task4-sequential-c4-20260812/repo`, cloned without hardlinks from the accepted members snapshot. It remained clean at the same snapshot `6c739e882ea9daa57df6b160172fd4751a10153a`, with one owner, no `safe.directory` bypass, exact Node `v22.22.2`/npm `10.9.8`, and fresh `npm ci` exit `0` in `22.49 s`. All five selected-source hashes exactly matched the manifest. The checkout's full source-ledger file SHA-256 was `de806b7d7e12baa4350b9f25b1de8347bacc2535b9d8247128839741a45d3f2d`; the difference from the members snapshot ledger is attributable to checkout line-ending normalization outside protected selected sources and does not affect the exact source/config provenance enforced by the merge.

All five whole-source shards completed under their own hard budget, with JSON and HTML present, `timedOut: false`, artifact exit `0`, and exact settlement durations:

- token-session: `211` mutants, `148211.688546 ms`, Stryker exit `1`.
- identifier-repair: `401` mutants, `109038.59291400001 ms`, Stryker exit `0`.
- identifier-reconciliation: `415` mutants, `117191.18293000001 ms`, Stryker exit `1`.
- members: `204` mutants, `245561.36113700003 ms`, Stryker exit `0`.
- borrowings: `135` mutants, `39750.64014600008 ms`, Stryker exit `1`.

Sequential diagnostic wall time was `668.56 s`; the aggregate runner diagnostic duration was `659917.5307499999 ms` and is explicitly not reference budget evidence. Canonical merge accepted exact five files and exactly `1366` unique canonical mutant identities with no duplicate or omission. Aggregate `policyError` is null, `timedOut` false, `referenceBudgetEvidence` false, and raw combined score `70.79062957540263`. The wrapper exit `1` is the valid Task 5 mutation RED solely from `410` real critical Survived/NoCoverage findings and corresponding policy violations; no equivalent entry, threshold, range, source, reporter, or budget was changed. The exact post-wrapper process observation was empty for the runner, Stryker, Jest, and the snapshot root.

Sequential evidence is preserved under `reports/mutation/diagnostics/node22-nvm-ubuntu24-sequential-c4-valid-policy-red/`: report-ledger SHA-256 `e90289153eb9491c60c339a74fa8d98055b4435620cd708b737873eba9d81669`; lossless archive `cd44aee362c0e07e09f2aac091e3c1a1ec8445ef28c64b04fb70b724019b0d8f`; root duration JSON `30988d3a62e1eeb1912c1a27f232d93d826504f4c40a221ea2d44a4690f3ff33`; summary JSON `6d157f57c6c9451f8425cb9e8f9a04c27e7fc9d1761881cd1e60077ad6673751`; summary Markdown `3c824643434a82b1b2df8ab73614fdd9c376c08afe98e1e49f70cfa10f5d4833`; aggregate mutation JSON `b07c6c6db1312e0e210e4b301e51e150a91fff26c2e4fce1a85988ed11ee10c6`; HTML index `0f19136f159a39552b4fc8dd89cc6a7d5d7baef6fed1981d2400aa2d0e4026a1`.

Implementation commit is `b496431e43c365e2190ab77c5cc6c85be0959869` (`test: add budgeted selective mutation runner`). It contains only the verified runner, configuration, tests, and mutation-report ignore rule. This evidence backfill is intentionally separate and does not amend that immutable implementation SHA.

Final implementer status is **READY FOR FRESH INDEPENDENT REVIEW**. Task 5, production/service-spec changes, package/dependency changes, manifest/allowlist/baseline changes, workflow dispatch, push, and Actions remain unstarted.

## Fix Round 1 — current-launch artifact isolation (2026-08-12)

The initial independent reviewer returned CHANGES_REQUIRED with Critical `0`, Important `1`, Minor `0`. Important I1 demonstrated that named and sequential execution treated pre-existing shard `mutation.json`/`mutation.html` as current output whenever a new Stryker child wrote nothing and exited nonzero. Standalone merge could also fail while leaving an older aggregate JSON/HTML pair active. The reviewer probe returned Stryker exit `1`, artifact exit `0`, wrapper exit `0`, and stale schema `2.0`, violating the fail-closed current-launch evidence contract.

Root-cause tracing confirmed that both named and sequential artifact classification used only post-child `existsSync` checks. No lifecycle boundary isolated the prior shard directory before launch, and neither sequential nor standalone merge invalidated active aggregate outputs before attempting a new merge.

Strict TDD added deterministic named, sequential, and standalone-merge regressions before implementation. The focused RED command selected four tests and exited `1`: `0` passed, `4` failed, `346.0442 ms`. Named and sequential reproduced stale acceptance with actual artifact/wrapper exit `0` instead of expected `1`; standalone merge correctly threw for a missing shard but left the stale root aggregate active.

The minimal correction atomically renames an existing shard output directory into ignored `reports/mutation/smoke/history/shards/<shard>/run-NNNN/` before every shard launch, then creates a new active directory. Sequential and standalone merge similarly move existing aggregate mutation JSON/HTML/duration/summary artifacts into `history/aggregate/run-NNNN/` before attempting current aggregation. Therefore active JSON/HTML can exist only if the current child or current merge created them, while all prior evidence remains preserved.

Focused GREEN after final formatting: `4/4` passed, `289.7141 ms`. Final Windows combined suite: exit `0`, `83` tests, `82` passed, `0` failed, one intentional POSIX-only skip, `26997.3148 ms`. Final Ubuntu `24.04.4 LTS` with nvm Node `v22.22.2`/npm `10.9.8`: exit `0`, `83/83`, no skips, `14841.724933 ms`; forced cleanup remained `10808.323749 ms`, and named real-tree cleanup `800.021273 ms`. Manifest check remained `89`; ESLint, Prettier, `git diff --check`, protected-byte, and scope checks passed.

The previously accepted cold members and sequential mutation evidence remains valid and was not rerun. Both accepted runs began from unique clean snapshots with no pre-existing active mutation outputs; the fix changes only pre-launch preservation and active-output invalidation. It does not change Stryker configuration, selected sources/ranges, canonical identities, provenance fields, concurrency `2/2/2/4/2`, reporters, thresholds, mutators, `300000`/`900000 ms` budgets, or the emitted current-run artifacts when the active paths begin absent.

Fix Round 1 implementation is immutable commit `125e5b519eac9513a7f82c72325035979a33c598` (`fix: reject stale mutation artifacts`). It changes only the mutation runner and its deterministic regression tests. Important I1 is addressed; implementer-known findings are Critical `0`, Important `0`, Minor `0`. Status is **READY FOR SCOPED FRESH RE-REVIEW**. Task 5, push, workflow dispatch, and Actions remain unstarted.

## Fix Round 1 final independent review

Requested and actual scoped reviewer was fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_final_reviewer`; substitution none. The final verdict is **APPROVED** with I1 **ADDRESSED** and Critical `0`, Important `0`, Minor `0`. Both the spec verdict and code-quality verdict are APPROVED.

The reviewer verified that prior shard directories move into unique ignored history before launch; prior aggregate JSON/HTML/duration/summary artifacts are preserved before sequential or standalone merge; named and sequential runs cannot accept stale JSON/HTML; and a failed standalone merge leaves no stale canonical output active. The regressions exercise exported entry points with children that write nothing and are non-tautological.

Exact reviewer verification: focused stale-artifact regressions `4/4`; Windows full suite `82` passed with one intentional POSIX skip; Ubuntu/Node 22 full suite `83/83`. Manifest, ESLint, Prettier, whitespace, protected-byte, scope, and ignore checks passed. Only runner lifecycle, regression tests, and evidence ledgers changed. Configuration, source scope, provenance, smoke concurrency `2/2/2/4/2`, complete concurrency `4`, reporters, thresholds, mutators, and budgets remain unchanged.

The reviewer independently accepted the prior cold mutation evidence as valid because it was produced from unique clean output paths; the new preservation step is a no-op for those runs and does not affect their execution or results. Task 4 is complete. Reference wall-clock proof remains deferred to Task 8 and is not waived. This approval does not preapprove Task 5 or CI; Task 5, push, workflow dispatch, and Actions remain unstarted.
