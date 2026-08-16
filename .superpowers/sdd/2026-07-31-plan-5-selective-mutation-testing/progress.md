# Plan 5 Progress

Base SHA: b678209e23ef7020c21ff565327de1b229c835f6

## Dependency evidence

This append-only ledger corrects the initial flat Task 00 evidence into the binding Plan 5 sectioned contract while preserving its facts and chronology.

- Task 00 dependency verdict: PASS. The locked execution base is the reviewed Plan 3 integration merge.
- `git merge-base --is-ancestor 75d81b17ca826df4f8236fd153f89b155c1d9748 b678209e23ef7020c21ff565327de1b229c835f6` — exit `0`.
- `git merge-base --is-ancestor 912131507fb8bbf58ad9a674e9b00906d23022d8 b678209e23ef7020c21ff565327de1b229c835f6` — exit `0`.
- `git merge-base --is-ancestor 75d81b17ca826df4f8236fd153f89b155c1d9748 bb80f9b8e82a1f658acaaa479d01a021dfe7e79a` — exit `0`.
- `git merge-base --is-ancestor 912131507fb8bbf58ad9a674e9b00906d23022d8 bb80f9b8e82a1f658acaaa479d01a021dfe7e79a` — exit `0`.
- The preceding current-HEAD checks establish that reviewed Task 10 handoff and administrative acceptance remain ancestors of current HEAD at Fix Round 1 validation.
- Selected production mutation boundary: `src/auth/token-session.service.ts`, `src/auth/auth-identifier-repair.service.ts`, `src/auth/auth-identifier-reconciliation.service.ts`, `src/members/members.service.ts`, and `src/borrowings/borrowings.service.ts`.
- Copied generated evidence verified: `coverage/backend-unit/coverage-summary.json` SHA-256 `E664AB848B846F95C3165F0958BBD50CED6F3231EAD366C338E16A906EF3947F`.

## Model dispatch ledger

- Task 00 requested and actual implementer: `gpt-5.6-terra`, medium reasoning, identity `/root/plan5_task0_implementer`; substitution none.
- Task 00 requested and actual reviewer: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task0_reviewer`; substitution none.
- Initial reviewer verdict: Needs fixes. Fix Round 1 is recorded in `task-00.md`; the historical initial verdict is retained.
- Final scoped reviewer: requested and actual `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task0_reviewer`; substitution none. Fix Round 2 verdict: APPROVED.
- Task 01 requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task1_implementer`; substitution none.
- Task 01 requested reviewer: fresh `gpt-5.6-sol`, high reasoning, identity pending controller dispatch; substitution none.
- Task 01 requested and actual reviewer: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task1_reviewer`; substitution none. Initial verdict: Needs fixes with three Important evidence findings.
- Task 01 final scoped reviewer: requested and actual fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task1_reviewer`; substitution none. Fix Round 1 verdict: APPROVED, all three findings addressed with no new Critical/Important breakage.
- Task 02 requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task2_implementer`; substitution none.
- Task 02 requested reviewer: fresh `gpt-5.6-sol`, high reasoning, identity pending controller dispatch; substitution none.
- Task 02 requested and actual reviewer: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task2_reviewer`; substitution none. Initial verdict: Needs fixes; six findings/conflict records are preserved in `task-02.md`.
- Task 02 Fix Round 2 final scoped reviewer: requested and actual fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task2_reviewer`; substitution none. Verdict: APPROVED with the formatting finding addressed and no new Critical/Important breakage.
- Task 03 requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task3_implementer`; substitution none.
- Task 03 requested reviewer: fresh `gpt-5.6-sol`, high reasoning, identity pending controller dispatch; substitution none. Independent verdict remains pending and is not pre-approved by the implementer.
- Task 03 requested and actual reviewer: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task3_reviewer`; substitution none. Initial verdict: CHANGES_REQUIRED with Critical `0`, Important `1`, Minor `0`.
- Task 03 final scoped reviewer: requested and actual fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task3_reviewer`; substitution none. Fix Round 3 verdict: APPROVED with Critical `0`, Important `0`, Minor `0`; Important I1 addressed.
- Task 04 requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_implementer`; substitution none.
- Task 04 requested reviewer: fresh `gpt-5.6-sol`, high reasoning, identity pending controller dispatch; substitution none. Independent review remains pending and is not pre-approved by the implementer.
- Task 04 amendment requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_amendment_implementer`; substitution none.
- Task 04 approved fallback requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_amendment_implementer`; substitution none.
- Task 04 human-approved revised fallback requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_amendment_implementer`; substitution none.
- Task 04 human-approved second-level range-sharding amendment requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_amendment_implementer`; substitution none. Recorded before redispatch; reviewer remains a separate fresh `gpt-5.6-sol`, high-reasoning agent only after implementation acceptance.
- Task 04 distributed-runner/local-sequential amendment requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_amendment_implementer`; substitution none. Recorded before redispatch. Approved design/plan commits are `342f83ccdfe2a14d9de681fa631a73f72396d904` and whitespace-only correction `a8d5fd7717698b7a1ccb197a3f6be91ed360cb24`. No push or Actions dispatch is authorized.
- Task 04 distributed members-concurrency correction requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_amendment_implementer`; substitution none. Recorded before redispatch. Exact smoke map is token/repair/reconciliation/members/borrowings `2/2/2/4/2`; no push or Actions dispatch is authorized.
- Task 04 final independent reviewer requested and actual: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_final_reviewer`; substitution none. Requested role was recorded before dispatch; approval is not presumed.
- Task 04 final independent review verdict: CHANGES_REQUIRED, Critical `0`, Important `1`, Minor `0`. I1: named/sequential execution can accept stale pre-existing JSON/HTML as current-run evidence when a new nonzero Stryker launch writes nothing.
- Task 04 Fix Round 1 implementer requested and actual: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_amendment_implementer`; substitution none. Recorded before dispatch; fix scope is only I1 and its evidence.
- Task 04 Fix Round 1 scoped reviewer requested and actual: fresh Task 4 reviewer `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_final_reviewer`; substitution none. Recorded before re-dispatch; approval is not presumed.

## Task status

- Task 00 initial implementation evidence complete in `b231461ef15ca7336e29cfed7c74883507066234` (`docs: lock selective mutation testing baseline`); its evidence-only backfill commit is `bb80f9b8e82a1f658acaaa479d01a021dfe7e79a` (`docs: record Plan 5 task evidence`).
- Task 00 Fix Round 1 result: immutable ancestry evidence addressed; reviewer identified the Base-SHA/section ordering as still open.
- Task 00 Fix Round 2: exact prefix/order correction and strengthened schema-order validation pending fresh reviewer re-review; no Task 1+ work has begun.
- Task 0: fix round 1/5 (1 addressed, 1 open — ancestry evidence addressed; exact schema order open; commit e9f962f)
- Task 0: fix round 2/5 (1 addressed, 0 open — exact schema order; commit b89e29d)
- Task 0: complete (commits b678209..b89e29d, review clean)
- Task 01: in progress (implementer `/root/plan5_task1_implementer`; reviewer pending controller dispatch)
- Task 01 implementation complete in `cbd19a9f7567fe654d1dd1b6178dda5fd6d7ba3a` (`build: pin selective mutation tooling`); independent reviewer decision pending controller dispatch.
- Task 01: fix round 1/5 (three Important evidence findings addressed; fresh re-review pending).
- Task 1: fix round 1/5 (3 addressed, 0 open — exact schema command, complete lock graph audit, reviewer backfill; commit e7605c5)
- Task 1: complete (commits a61d4e8..e7605c5, review clean)
- Task 02: in progress (implementer `/root/plan5_task2_implementer`; reviewer pending controller dispatch).
- Task 02 implementation complete in `6bd0cef92d04963aeb44d93ef09b082f44958db4` (`test: enforce selective mutation policy`); independent reviewer decision pending controller dispatch.
- Task 02: fix round 1/5 (six findings/conflict records addressed under human-approved coordinate and baseline rulings; fresh re-review pending).
- Task 2: fix round 1/5 (6 addressed, 0 open — one-based coordinates, source bounds, baseline semantics, zero denominator, boundary coverage, and reviewer evidence; commit 8f53887)
- Task 2: complete (commits 6bd0cef..8f53887, review clean)
- Task 2: fix round 2/5 (1 addressed, 0 open — Task 02 evidence formatting; administrative closeout)
- Task 2: complete (commits 6bd0cef..0cd77ef, review clean)
- Task 03 implementation is complete in `4c1e61318792c2f09d359fd609f871e708a2a33a` (`test: define critical mutation rules`). Its immutable full SHA is backfilled without amend in the required evidence-only commit; independent review remains pending.
- Task 03 Fix Round 1/5 implementation is complete in `2511d7d43931b245fecda39a3e6a384ffd779bc0` (`fix: complete critical mutation rule inventory`), with `60` rules covering `93/93` reviewed occurrence points. The immutable full SHA is backfilled without amend in the required evidence-only commit; fresh scoped re-review remains pending and Task 4 remains blocked.
- Task 3: fix round 1/5 (0 addressed, 1 open — reviewed executable occurrence completeness; commit 2511d7d)
- Task 3: fix round 2/5 (0 addressed, 1 open — per-line category completeness; commit db8d7d0)
- Task 3: fix round 3/5 (1 addressed, 0 open — per-line category completeness; commit 65d3d3e)
- Task 3: complete (commits 4c1e613..65d3d3e, review clean)
- Task 04: in progress from clean starting SHA `1d3a4d1831e2b85ac4c325e4982604b649ba13f4`; preflight passed, Task 3 is approved, and no Task 5 work has started.
- Task 04: blocked before commits by explicit real-smoke timeout stop condition — `300021.1058/300000 ms`, `timedOut: true`, signal `SIGTERM`, missing JSON/HTML, no score or survivor disposition. Generated timeout evidence remains preserved; Task 5 has not started.
- Task 04 amendment: `BLOCKED_TO_FALLBACK` before commits. Concurrency `4` and exact process-tree cleanup passed deterministic tests. The controller ruled the first missing-Git event a setup failure; after provenance correction, genuine primary cold trial 1 reached Stryker/dry-run but timed out at `300259.49086200004 ms`, so the automatic fallback boundary stopped trials 2–3. No fallback, Task 5, push, or Actions work started.
- Task 04 approved per-file fallback: **BLOCKED** before commits. Deterministic fallback implementation passed `71/71`; genuine cold Trial 1 reached all five shards but members timed out at `104/204`, overall `300358.90116099996/300000 ms`, so Trials 2-3 stopped. No Task 5, push, or Actions work started.
- Task 04 human-approved revised fallback: **BLOCKED** before commits. Deterministic revision passed `73/73` on authoritative WSL Node 22; genuine cold Trial 1 used members concurrency `4` but members reached only `160/204`, overall `300391.094205/300000 ms`, so Trials 2-3 stopped. No Task 5, push, or Actions work started.
- Task 04 human-approved second-level range-sharding amendment: in progress before commits. Smoke alone changes from five source shards to seven isolated shards by splitting token-session at line `401/402` and members at line `341/342`; total worker allocation remains `12`, the shared `300000 ms` deadline and all gates remain unchanged, and exact canonical union `1366` is mandatory. Task 5, push, and Actions remain unstarted.
- Task 04 second-level range sharding is superseded after its genuine cold failure. The approved distributed amendment returns smoke to five whole-source shards, permits sequential local evidence generation, and defers only five-minute reference wall-clock proof to Task 8. Tasks 4–7 may proceed locally; Task 8 stops before push/dispatch and Task 9 remains blocked on fresh reference evidence.
- Task 04 distributed sequential evidence isolated members as the only standalone budget failure: four sources produced JSON/HTML below 300000 ms, while members concurrency `2` reached `159/204` and timed out at `300019.033115 ms`. The targeted correction reuses the previously human-approved members concurrency `4` setting on an idle/local or independent CI runner; all other shard settings and gates remain unchanged.
- Task 4: fix round 1/5 (0 addressed, 1 open — stale current-run artifact acceptance; implementation pending).
- Task 4: fix round 1/5 (1 addressed, 0 open — stale current-run artifact acceptance; commits `125e5b5..23291f3`).
- Task 4: complete (implementation `b496431`, fix `125e5b5`, final review closeout `dad7c52`; review clean; distributed reference wall-clock deferred to Task 8, not waived).
- Task 05 implementer requested and actual: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task5_implementer`; substitution none. Requested role was recorded before dispatch.
- Task 05 token equivalent-candidate reviewer requested and actual: separate fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task5_equivalent_reviewer`; substitution none. Candidate fingerprint `0108d0...0cc5`; approval is not presumed and implementer has not edited the allowlist.
- Task 05 exact equivalent review: APPROVED only fingerprint `0108d029ef22842e4c8a00d900136b2dbc483f0013d796483b852f024a550cc5`, rule `token-interrupted-cas-finalization`, source hash `72da52c9835a71d59bca5cd6b367be54b0257541a5bf273d4396700809fcd051`, reviewed `2026-08-12`, expires `2026-11-10`; Critical/Important/Minor `0/0/0`. No other survivor or Task 5 is approved.
- Task 05 second token equivalent audit requested: separate reviewer `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task5_equivalent_reviewer`; substitution none. Candidates `4fb5f8...` and `f0bf4e...` overlap two rules each; approval is not presumed and no entries have been added.
- Task 05 second token equivalent audit verdict: REJECT both `4fb5f831...a15ce` and `f0bf4e31...c496` as non-equivalent, Critical/Important/Minor `0/1/0`. Both consume `randomUUID()` outside the following catch before denial; deterministic UUID sequencing or a throwing UUID source distinguishes them. No allowlist entries authorized.
- Task 05 repair HMAC equivalent audit requested: separate reviewer `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task5_equivalent_reviewer`; substitution none. Candidate exact fingerprint `c010a2ec5f4bb9177df61f0bc8326b2d04d2463a59bf5dd2337b840dedc2f36e`; approval is not presumed and no entry has been added.
- Task 05 repair HMAC equivalent audit verdict: APPROVED only fingerprint `c010a2ec5f4bb9177df61f0bc8326b2d04d2463a59bf5dd2337b840dedc2f36e`, rule `repair-batch-identity-and-checkpoint`, source hash `a8f4bf8847acfed54dc0c9a7258a01979bed058ba3f47bcdd37f84cae83b4e1f`, reviewed `2026-08-12`, expires `2026-11-10`; Critical/Important/Minor `0/0/0`. No other repair survivor or Task 5 is approved.
- Task 05 interruption recovery: prior implementer session ended during repair pass 8 after pass-7 archival. No active mutation descendants remain; pass 7 is intact with only approved HMAC fingerprint `c010a2ec...c2f36e` and killable activation-filter mutant `152`. Fresh replacement implementer requested and actual: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task5_recovery_implementer`; substitution none.
- Task 05 narrow owned-test amendment: `test/quality/mutation-policy.test.mjs` may update only the historical strict-empty tracked-allowlist assertion/comment/name to validate the exact independently approved entry and fingerprint. Policy/schema/evaluation behavior remains out of scope and unchanged. This prevents knowingly carrying a red Task 2 integrity fixture after the Task 5-authorized allowlist population.

## Mutation score history

- No mutation run has begun; raw combined selected-module mutation score remains unrecorded and the tracked raw baseline is not lowered.
- Verified Plan 3 critical branch pairs: token session `89/103`; identifier repair `103/110`; identifier reconciliation `181/191`; members `164/188`; borrowings `105/116`; permission full-source monitor `71/74`.

## Critical-rule decisions

- Required read-only fixture exports: Plan 2 `deferred`, `queryResult`, `createStaffDocument`, `createStaffModelHarness`, `createIdentifierModelHarness`; Plan 3 `createRefreshFamily`, `createReplayMarker`, `createIdentifierOperation`, `createMemberDocument`, `createBorrowingDocument`, `CriticalQueryDouble`, `criticalQueryResult`, `createCriticalModelHarnesses`.
- Permission evaluation remains a monitored, non-mutated control; focused-only coverage is `69/74`, while inherited authoritative full-source coverage is `71/74`.
- Plan 3's parked non-load-bearing Minor remains visible: aggregate assertions accept any string rather than exact replacement/original identifiers. Task 00 does not address it.
- Task 02 human ruling: installed Stryker 9.6.1 one-based report line/column coordinates govern; policy overlap and fingerprints use emitted one-based coordinates directly, with source-text endpoint bounds.
- Task 02 human ruling: `baseline: null` is valid before Task 6; supplied baseline objects validate for smoke and complete, but only complete compares raw score against the baseline.
- Task 03 initial inventory encoded `29` narrow source-hashed rules across all `5/5` selected sources and all six required invariant categories; every range had exact unique anchors. The tracked schema-v1 allowlist remains exactly empty, so no equivalent is presumed.
- Task 03 updater supports only read-only `--check` and review-only `--candidate`; candidates are written only under `reports/mutation/` and never promote or overwrite tracked JSON.
- Task 03 resolved one proposed duplicated borrowing-detail end anchor by using the next unique method boundary at line `205`; no tracked anchor/range ambiguity remains.
- Task 03 initial reviewer Important I1: the valid 29-rule manifest omitted Plan 3-reviewed critical occurrences in every selected module, leaving those lines to aggregate score only.
- Task 03 Fix Round 1 re-inventory records `93` reviewed critical occurrence points and expands the manifest to `60` narrow rules: token `12`, repair `18`, reconciliation `15`, members `8`, borrowings `7`. All `93/93` points, five sources, six categories, exact hashes, and unique anchors are covered; the focused overlap regression prevents recurrence.
- Task 03 final accepted inventory contains `89` source-hashed rules and `90` exact executable occurrences. The reviewer independently recomputed `3151` unique line/category pairs — token `451`, repair `996`, reconciliation `909`, members `456`, borrowings `339` — and confirmed all are covered. The exact schema and strict empty allowlist remain unchanged.

## Runtime history

- Task 05 user-approved runtime amendment: deterministic focused RED expected five exact `350000 ms` smoke timers while the unchanged runner still scheduled `300000 ms`; exit `1`, `0/1`, exact assertion `0 !== 5`. The binding correction raises smoke only to exactly `350000 ms`, retains complete at `900000 ms`, and leaves selected production scope, mutators, reporters, score/critical gates, and concurrency map unchanged. The required reconciliation retry uses a unique clean WSL-native Node 22 `lts/jod` snapshot with a fresh `npm ci`; all prior timeout evidence remains preserved.
- Task 05 reconciliation pass 7: unique clean WSL snapshot `/home/tisana/book-library-plan5-task5-reconciliation-350k-20260816-1620/repo`, provenance `dad7c524330c1c60ea016b357c3feedae68e47c9`, Node `v22.22.2`/npm `10.9.8`, fresh `npm ci` exit `0` in `22.81 s`, manifest `89`, deterministic runner/policy `83/83`. Reconciliation completed with JSON/HTML at `123501.000308/350000 ms`, no timeout, exits Stryker/artifact/policy `0/0/0`, and exact `414` Killed/`1` Survived/zero NoCoverage from `415`. Durable evidence is `reports/mutation/diagnostics/task5-identifier-reconciliation-pass7-wsl-350k/`; JSON SHA `463a524f94625ffaea7b783f78a5f59f2247c28cdd92802d5345595b5a7557c5`.
- Task 05 reconciliation equivalent pre-dispatch: the sole survivor is mutant `403`, `StringLiteral` to `""`, location `879:28-879:34`, rule `reconciliation-secret-decoding`, exact fingerprint `b4a9385a539d4b16ca74d4f3f5c70adb2775a73e50a66a80aa1acf17e30bd51a`. Node 22 routes empty and explicit `utf8` encodings to the same implementation, and the existing observable fallback test already proves resulting bytes. Reviewer requested fresh `gpt-5.6-sol`, high reasoning; actual fresh `gpt-5.6-sol`, high reasoning; substitution none. Allowlist remains unchanged pending verdict.
- Task 05 reconciliation equivalent verdict: fresh independent reviewer returned `APPROVED_EQUIVALENT` for only `b4a9385a539d4b16ca74d4f3f5c70adb2775a73e50a66a80aa1acf17e30bd51a`. Narrow ordered-allowlist RED exited `1`, `0/1`, exact `2 !== 3`; after adding only the verbatim reviewer-provided schema-v1 entry, the full policy suite passed `46/46`, exit `0`, `547.9982 ms`. Requested/actual reviewer fresh `gpt-5.6-sol`, high reasoning; substitution none. The tracked allowlist now contains exactly the three independently approved ordered fingerprints.
- Task 05 current-report validation: token final is exact `210` Killed/`1` approved-equivalent Survived of `211` (JSON SHA `2c0d4de38140eeabec6c6a20986930a8efd6ebb6632ae3b23554412f55a4fc8f`); repair pass 8 is exact `397` Killed/`3` Timeout/`1` approved-equivalent Survived of `401` (JSON SHA `6a8dfd644978e69112bb9b1941f05aabd09180c49929b531444ea83ba8ad3c76`). Both are valid preserved Task 5 evidence, but their Node 24/`300000 ms` provenance prevents reuse in the required same-provenance Node 22/`350000 ms` final merge. Old member/borrowing artifacts also have historical commit/budget provenance, so final production must regenerate those four named shards around the accepted current reconciliation report.
- Task 05 final same-snapshot smoke producer: exact shard durations token `149865.12891`, repair `114286.59524099999`, reconciliation `123501.000308`, members `224989.141534`, and borrowings `37732.896585999995 ms`, all under `350000`, no timeout, all JSON/HTML. Standalone merge accepted exact five sources/`1366` identities at commit `dad7c52`, Node major `22`, and config SHA `e65a708152cdbc95ab850ba8546bbec3af4690895e91f86b4970d884f761562a`. Raw score `94.14348462664715`; statuses `1283` Killed/`66` Survived/`3` Timeout/`14` NoCoverage. Auth has exact three approved equivalents and zero unapproved critical findings; the expected policy RED is only `26` members plus `51` borrowings violations. Aggregate JSON SHA `f1f5154f39199da5bd64b297e646449372055f2712a45b73824e982ced024ecb`.
- Task 05 complete-profile stop: same snapshot and unchanged full five-source scope instrumented `1727` mutants with concurrency `4`; 329-test dry run passed. The runner timed out at `900335.251824/900000 ms`, `timedOut: true`, signal `SIGTERM`, last emitted progress `1702/1727`, no remaining mutation processes, and no complete JSON/HTML/log. Summary has raw score null and missing-report policy error, so baseline and critical disposition are not acceptable. Preserved at `reports/mutation/diagnostics/task5-complete-profile-timeout-wsl-900k/`; duration SHA `2b78e9f583c2dbef4b7f7848593ecacdfff755c32d245dacf9ef50a295e741d7`, sandbox tar SHA `2a57aa40e83143f692e590fb51b852e69e0ed1aafebdab6562b527f2bfeaaa51`. Binding status: STOPPED/INCOMPLETE; no retry, Task 6, commit, push, or Actions.
- Focused Task 00 commands total `35147 ms`; each is below the `300000 ms` PR-smoke limit. Verified inherited Plan 3 producer runtime was approximately `72 s`.
- Scheduled/manual Stryker mutation execution has not begun; the `900000 ms` Ubuntu 24.04/Node 22 limit remains mandatory.
- Task 03 RED: exact Node suite exit `1`, `37/43` pass and six intended missing-updater failures, `415.2626 ms`. Initial GREEN: exact Node suite exit `0`, `43/43` pass, `501.5477 ms`; standalone updater `--check` exit `0` with `29` rules. Final post-format evidence is retained in `task-03.md`.
- Task 03 Fix Round 1 RED: exact Node suite exit `1`, `43/44` pass, one intended reviewed-occurrence failure exposing `59` uncovered points, `469.0597 ms`. Final GREEN: exit `0`, `44/44` pass, `471.6878 ms`; updater check exit `0` with `60` rules; ESLint/Prettier exit `0`. All five focused Plan 3 suites passed `193/193` in `6.454 s`.
- Task 03 Fix Round 3 final reviewer verification: policy `45/45`, updater `89` rules, selected Plan 3 suites `193/193`, ESLint and Prettier clean, and all hashes, anchors, allowlist, source-identity, and scope checks clean.
- Task 04 test-first RED: runner suite exit `1`, intended missing `stryker.config.mjs`, Node duration `70.6459 ms`. Deterministic GREEN after the tested Windows launcher correction: combined policy/runner suite `57/57`, exit `0`, Node duration `1036.9569 ms`; updater check `89` rules, exit `0`.
- Task 04 first live attempt exposed native Node `v24.18.0` Windows `npx.cmd` `spawn EINVAL` in `127 ms`; the exact local shim regression went RED then GREEN using locked `cross-spawn@7.0.6` while retaining `shell:false`.
- Task 04 second live smoke hit the hard stop at `300021.1058 ms` against the `300000 ms` budget on Node `v24.18.0`, `win32 10.0.26200 x64`; Stryker was terminated with `SIGTERM`, and only duration/summary/temp evidence exists. No mutation JSON/HTML, score, or critical-finding inventory was produced.
- Task 04 controller-requested isolated reference probe used Ubuntu `24.04.4 LTS`, official portable Node `v22.23.2`, npm `10.9.8`, fresh `npm ci` exit `0`, and exact unchanged smoke configuration/budget. It also timed out (`300112.812547/300000 ms`, `timedOut: true`, Stryker exit `null`, policy exit `1`) without JSON/HTML, score, survivors, NoCoverage, or fingerprints. The exact npm-ci shell timer was lost when the orphan-held supervising capture timed out; the surviving npm log establishes a `25239.839624 ms` log window. No commit was made.
- Task 04 user-directed persistent native-nvm retry used Ubuntu `24.04.4 LTS`, exact nvm output `Now using node v22.22.2 (npm v10.9.8)`, fresh `npm ci` exit `0` in `23738 ms`, and snapshot `105afb77f9f936d29b893ba090e679778961d29b`. Deterministic tests and manifest check passed. Stryker accepted five sources/1366 mutants/two workers and its 268-test dry run passed, but the exact runner again timed out (`300114.361609/300000 ms`, harness wall `300172 ms`, Stryker exit `null`, policy exit `1`) without JSON/HTML. Last emitted progress was `889/1366` tested, `234` survived, `3` timed out. Persistent snapshot `/home/tisana/book-library-plan5-task4-nvm-retry-20260811` remains intact at `455741450` bytes; copied small diagnostics are under `reports/mutation/diagnostics/node22-nvm-ubuntu24-timeout/`. No commit was made.
- Task 04 user-authorized Docker fallback used Ubuntu image digest `sha256:561618e2c15bf2397621dd04f96926663a3b5616c189cf7e38db7e82f5c538ea`, preserved container `9e27f4ecd69343d2a8527040edd53df465f175231210e6f64e1227841f6920e7`, 8 CPUs/16334456 KB RAM with no explicit Docker resource cap, and verified official Node `v22.22.2` archive SHA `88fd1ce767091fd8d4a99fdb2356e98c819f93f3b1f8663853a2dee9b438068a` with npm `10.9.7`. The exact 535-file source archive was copied into overlayfs, but preserved WSL uid/gid plus root-created `.git` triggered Git 2.43 dubious-ownership protection before snapshot SHA, `npm ci`, or smoke. Per the structural-failure stop condition no workaround/retry or commit was made; container, image, overlay, archive, and logs remain preserved.
- Task 04 Docker context-fix retry: controller ruled the mixed-owner Git rejection a setup blocker and authorized consistent root ownership without `safe.directory`. The Git boundary passed at snapshot `018ba8d658c78b5dddaa8a7d256ce526beb0ff28`; fresh `npm ci` exited `0` in `31882 ms`; deterministic tests and manifest check passed. Exact config remained 89 unique ranges, concurrency 2, all required reporters/thresholds, and the unchanged runner budget. Docker smoke still timed out (`300120.214394/300000 ms`, harness wall `300139 ms`, Stryker exit `null`, policy exit `1`) without JSON/HTML. Last emitted progress was `837/1366` tested, `222` survived, `3` timed out. Complete report archive SHA is `d82735fd3a8da8180609a0c86fb628473e686d0e33b14b5134a92b5bf5259fb3`; container and prior evidence remain preserved. No commit was made.
- Task 04 amendment RED: concurrency focused test exit `1`, actual `2` versus literal `4`, `114.8608 ms`; Ubuntu/nvm Node 22 real descendant test exit `1`, exact descendant alive after direct-child return, `1086.9539 ms`.
- Task 04 amendment GREEN: Ubuntu `24.04.4`, nvm Node `v22.22.2`, combined quality suite `59/59`, no skips, `12383.9075 ms`; real graceful group cleanup `794.1055 ms`; real SIGTERM-resistant forced cleanup `10796.8184 ms` after the exact ten-second grace; both exact fixture PIDs absent before return. Windows real exact-tree verification also passed.
- Task 04 amendment primary trial 1: persistent root `/home/tisana/book-library-plan5-task4-primary-1a-20260812`; source ledger SHA `0741a8130e1ac524be6a122b21b3c3b9691deeac25dc71e0e772d7d0d0d02cef`; fresh npm ci exit `0` in `23693 ms`. Wrapper exited `1` in `50 ms` before Stryker because `.git` was absent, so mutation JSON/HTML/duration/summary artifacts were absent. Exact post-process observation was empty. Durable hashes/evidence are under `reports/mutation/diagnostics/node22-nvm-ubuntu24-primary-trial-1-failure/`.
- Task 04 amendment primary trial 1 correction: controller classified the `50 ms` event as setup/context, not a runtime trial. Consistent `tisana` ownership, empty global `safe.directory`, local identity, clean status, and exact 40-hex snapshot `f4fee10c9cd25a758ecb03438684a3a66a0fc701` passed provenance. Genuine run accepted five sources/1366 mutants/concurrency `4`, passed 268-test dry run in 14s, and reached `1201/1366`, `348` survived, `3` timed out. Wrapper exit `1`; wall `309543 ms`; runner `300259.49086200004/300000 ms`; timed out true; JSON/HTML absent; exact descendant observation empty. Full archive SHA `7f11b105dd789176d168b33b35fab8bb49b6b42d28e829954050884324cf64e6`; log SHA `abe4cf4eaf8a6dccd3c1701b6e13140b6eb364f5ca3ea6df4e299c9bf7e6ee3a`.
- Task 04 amendment final verification: Ubuntu/nvm Node 22 `59/59`, no skips, `12449.126774 ms`; manifest `89`; ESLint/Prettier/diff/source identity exit `0`; smoke config SHA `25081d98e3e3341b30026ebc6c90f95c500cddfe1bc8c09388fc2a058b5b17d3` with 89 ranges, five-source union, concurrency `4`, unchanged reporters/thresholds/budget.
- Task 04 fallback RED: runner exit `1`, `9/27` passed, `17` intended failures, `1` skipped, `27836.2932 ms`. Final deterministic GREEN: Ubuntu/nvm Node 22 combined suite exit `0`, `71/71`, no skips, `13595.5128 ms`; manifest `89`; focused ESLint/Prettier/protected identity/scope/diff checks exit `0`.
- Task 04 fallback genuine Trial 1: persistent root `/home/tisana/book-library-plan5-task4-fallback-1c-20260812`, snapshot `f254f366ff3122c1966f11ea98752f6896d9684b`, source-ledger SHA `12c2a49967a6eafe6171bd5a1509d41f487bfce924476438f15e89433934b381`, exact Node `v22.22.2`/npm `10.9.8`, fresh npm ci `20013 ms`. All five shards reached Stryker and exact instrumented union `1366`; four completed with JSON/HTML, but members reached only `104/204` and timed out. Wrapper exit `1`, wall `310187 ms`, runner `300358.90116099996/300000 ms`, canonical merge failed closed, exact descendant observation empty. Full archive SHA `e28b1c7bd159d73a26a59294d25a0dff8a7ba0106de768ecf4a3175a09437248`; Trials 2-3 and commits stopped.
- Task 04 revised fallback RED: focused Windows exit `1`, `0/2` passed, exact members `2` versus expected `4` and first shard post-all finish `.250Z` versus own `.020Z`, `181.0335 ms`. Focused GREEN `2/2`, `182.9944 ms`; Windows full `72` pass/`1` POSIX skip; authoritative WSL `73/73`, `13619.734 ms`; manifest/lint/format/protected identity/scope/diff all clean.
- Task 04 revised fallback genuine Trial 1: persistent root `/home/tisana/book-library-plan5-task4-revised-fallback-1-20260812`, snapshot `8e15f8a3b10de1cddce9f384b98304d470f30546`, source-ledger SHA `01279156d70ee2d580203b3d8e38b8bb48658f860c315e43261b71648c4602fd`, exact Node `v22.22.2`/npm `10.9.8`, fresh npm ci `20443 ms`. Exact instrumented union remained `1366`; four shards completed with true settlement durations `294293.292525`, `259712.12791299997`, `272730.433264`, and `95620.006745 ms`, but members concurrency `4` reached only `160/204` and timed out at `300281.33399199997 ms`. Overall runner `300391.094205/300000 ms`, wall `307662 ms`, canonical merge failed closed, exact descendant observation empty. Full archive SHA `e0b461be6c59ac98b1c008056ba6268350da6b3b06ce2767277eac883dd1b695`; Trials 2-3 and commits stopped.
- Task 04 range-sharding balance evidence: the preserved complete token-session JSON contains `211` mutants and divides `107/104` at line `401`; a read-only probe using installed pinned `@stryker-mutator/instrumenter@9.6.1` over the unchanged reviewed member ranges contains `204` mutants and divides `102/102` at line `341`. The approved topology therefore uses token `1+1` workers and members `2+2` workers while retaining the prior exact total allocation of `12`.
- Task 04 range-sharding TDD: focused RED `0/5` with five exact topology/merge/count/tree failures; focused GREEN `5/5`. Final Windows combined suite `75` pass/`0` fail/`1` POSIX skip; final authoritative Ubuntu/nvm Node 22 suite `76/76`, `14642.3955 ms`; manifest89, lint, format, protected identity, scope, and diff checks all clean.
- Task 04 range-sharding genuine Trial 1: persistent root `/home/tisana/book-library-plan5-task4-range-sharding-1-20260812`, snapshot `562190f57b0a2d3f1107d8fc7307a2bdb3c052df`, source-ledger SHA `5821761eba2299b26a5990adb05c6e72cafab956a5363e2a0dd984adac840fa5`, exact Node `v22.22.2`/npm `10.9.8`, fresh npm ci `23016 ms`. Seven Stryker shards/twelve workers started, but actual window counts were `106/104/401/415/100/104/135 = 1365`, contradicting the approved evidence counts and required `1366`. Only borrowings emitted JSON/HTML; all others timed out. Runner `300812.39060600003/300000 ms`, wall `307494 ms`, wrapper `1`, canonical merge failed closed, exact descendants empty. Archive SHA `a0cafca2506097b54b3c0435d274cea4d9b4dedf54fb52d4f6c9e9aea3c98b8a`. Final status BLOCKED; Trials 2-3 and commits stopped.

## Integration status

- Dependency evidence, selected-path byte identity, fixture export inventory, coverage-summary checksum, initial RED/GREEN results, and initial focused metrics are recorded in `task-00.md`.
- Fix Round 1 corrects the required ledger contract and adds immutable ancestry command evidence. Fresh reviewer follow-up is pending after this implementation fix.
- Final scoped reviewer approval recorded: Task 0 APPROVED after Fix Round 2; all findings addressed with no new Critical/Important breakage.
- Final scoped reviewer approval recorded: Task 1 APPROVED after Fix Round 1; exact Stryker pins, installed-schema compatibility, complete lock-graph provenance, and reviewer backfill are accepted with no new Critical/Important breakage.
- Task 2 Fix Round 1 implements the human-approved one-based coordinate and pre-baseline-null rulings, adds source bounds and zero-denominator coverage, and backfills reviewer evidence; fresh reviewer re-review is pending.
- Final scoped reviewer approval recorded: Task 2 APPROVED after Fix Round 2; evidence formatting and semantic preservation are accepted with focused Prettier and scoped-diff verification and no new Critical/Important breakage.
- Task 03 initial implementation evidence and its 29-rule review matrix are recorded in `task-03.md`; immutable initial implementation SHA backfill is complete. Initial review later required Fix Round 1, and Task 4 did not start.
- Task 03 Fix Round 1 implementation `2511d7d43931b245fecda39a3e6a384ffd779bc0` addresses Important I1 with a complete 60-rule/93-occurrence matrix and regression evidence; immutable SHA backfill is complete and fresh scoped independent re-review remains pending. Task 4 remains blocked and unstarted.
- Final scoped reviewer approval recorded: Task 3 APPROVED after Fix Round 3; Important I1 is addressed, `3151/3151` unique executable line/category pairs are covered, and no Critical/Important/Minor finding remains. Task 3 is complete; Task 4 has not started in this closeout.
- Task 04 preflight and deterministic implementation checks passed, but its mandatory real smoke probe timed out and did not create JSON/HTML. The task remains uncommitted and blocked; no Task 5, push, workflow dispatch, equivalent decision, baseline, or production/spec/dependency/manifest/allowlist change occurred.
- The Node 22/Ubuntu 24.04 reference-like rerun reproduced the same structural timeout/missing-report blocker. Windows timeout diagnostics remain at `reports/mutation/diagnostics/node24-timeout/`; surviving reference npm logs and the `/tmp` staging-loss record remain at `reports/mutation/diagnostics/node22-ubuntu24-reference/`. Task 04 remains uncommitted by explicit controller instruction.
- The user-directed native-nvm persistent retry independently reproduced the timeout/missing-report blocker with exact nvm Node `v22.22.2`; all logs and partial temp evidence remain preserved, all observed worker processes have exited, and Task 04 remains uncommitted for the controller's authorized Docker fallback decision.
- The Docker fallback setup failure is isolated to diagnostic archive ownership metadata, not Task 4 code or configuration. Evidence remains under `reports/mutation/diagnostics/docker-ubuntu24-node22-reference/`; Task 04 remains uncommitted and blocked pending controller direction.
- The controller-authorized Docker ownership correction confirmed the setup diagnosis, but the subsequent real mutation run independently reproduced the 300-second timeout/missing-report blocker on container-local overlayfs. Task 04 remains uncommitted and blocked; Task 5, push, and Actions remain unstarted.
- Task 04 systematic conclusion: native WSL and container-local overlayfs eliminate the prior environment hypothesis and exhibit consistent throughput against the same immutable 1366-mutant/concurrency-2 workload; neither can satisfy 300000 ms. The timeout implementation also terminates only the direct child, leaving Stryker/workers or respawns that require exact external process-group cleanup. Both are preserved blocker findings, not post-timeout code changes.
- Task 04 amendment deterministically corrects concurrency to `4` and exact process-tree cleanup without changing scope/ranges/mutators/reporters/thresholds/budgets. Primary acceptance is not established: the first cold trial failed required provenance/artifact acceptance before mutation launch, so the controller must dispatch the already-authorized fallback separately.
- Task 04 approved fallback deterministically implements five concurrent concurrency-2 source shards and fail-closed canonical merge without changing protected scope/ranges/reporters/thresholds/budgets. Genuine fallback Trial 1 failed the shared runtime/artifact gate because members timed out and lacked JSON/HTML; full evidence is preserved, status is BLOCKED, and the exact two-commit protocol was not started.
- Task 04 revised fallback raised only members to concurrency `4` and corrected actual settlement metadata. Genuine Trial 1 still failed the immutable runtime/artifact gate because members timed out without JSON/HTML; full evidence is preserved, final status remains BLOCKED, and no commit was created.
- Task 04 second-level range sharding deterministically implements the exact seven approved windows, twelve-worker ceiling, canonical sibling merge, and fail-closed `1366` count. Genuine Trial 1 failed both runtime/artifact acceptance and exposed that the exact approved windows instrument only `1365` mutants. Evidence is preserved; no post-failure implementation change or commit was made.
- Task 04 distributed-runner amendment supersedes range sharding with five whole-source concurrency-2 shards, named execution, sequential local evidence, fail-closed provenance/canonical merge, independent `300000 ms` shard budgets, and unchanged complete concurrency `4`/`900000 ms`. Strict distributed RED was `0/6`; final Windows deterministic verification was `78` pass/one intentional POSIX skip, and Ubuntu 24.04/nvm Node 22 was `79/79`, no skips, with manifest/lint/format/protected/scope/diff gates clean.
- Task 04 distributed cold sequential set: persistent WSL root `/home/tisana/book-library-plan5-task4-distributed-sequential-1-20260812/repo`, clean snapshot `da9063578b37a123dc56da4afd4e488d7e327fd5`, source-ledger SHA `350534a9710337d1cda148855b7177c300773cbbd5f264820b79a85b9b924db3`, exact Node `v22.22.2`/npm `10.9.8`, fresh npm ci `22.69 s`. Token `211`/`138392.496521 ms`, repair `401`/`103928.02499899999 ms`, reconciliation `415`/`102255.79665 ms`, and borrowings `135`/`36701.73382299999 ms` produced JSON/HTML. Members instrumented `204` but reached only `159/204` and timed out at `300019.033115 ms` without JSON/HTML. Wrapper wall `688.71 s`, fail-closed policy error `Missing members mutation.json.`, no canonical union, exact descendant observation empty. Archive SHA `221ebdbc6aca649d4f1affde560796138c1d6bb27ba3dc46ba3bb68c328d7d71`. Final status BLOCKED; no post-failure config change, commits, review, Task 5, push, or Actions.

## Task 03 Fix Round 2 correction

- Fix Round 1 re-review by `/root/plan5_task3_reviewer` (fresh `gpt-5.6-sol`, high; substitution none) remained CHANGES_REQUIRED: Critical `0`, Important `1`, Minor `0`. The `93`-point/`60`-rule completeness statements above are retained as historical claims but corrected as inaccurate because the point list admitted signature/caller proxies and did not require same-category overlap.
- Fix Round 2 RED: `node --test test/quality/mutation-policy.test.mjs` exited `1`; `44/45` passed, the single intended category-aware inventory regression failed, duration `497.358 ms`, with `41` uncovered executable ranges and `126` missing category links.
- Fix Round 2 implementation is complete in `db8d7d078d632b83d00736426c089481ef9cf626` (`fix: protect reviewed critical helper bodies`). Only the manifest and its policy regression changed; no production, Task 4, workflow, runner, baseline, or allowlist file changed.
- Final authoritative inventory: `90` exact executable occurrences across token `18`, repair `26`, reconciliation `21`, members `12`, borrowings `13`; category links authorization `23`, ownership `45`, replay `20`, revoked/expired rejection `5`, illegal borrowing `10`, terminal/cleanup/TTL `25`.
- Final manifest: `89` rules across token `16`, repair `26`, reconciliation `22`, members `13`, borrowings `12`. Category classification uses a controlled prefix inside the existing required `invariant` string; the exact schema is unchanged.
- Fix Round 2 GREEN: policy `45/45`, `579.2292 ms`; updater check `89` rules; Plan 3 selected suites `193/193`, `7.598 s`; ESLint and Prettier exit `0`; updater candidate byte identity, source byte identity, `git diff --check`, and scoped ownership checks exit `0`.
- Fix Round 2 implementation was submitted with implementer-known open findings `0`, but independent re-review kept Important I1 open because category coverage was not enforced on every executable line. Task 4 remained blocked and unstarted.

## Task 03 Fix Round 3 correction

- Fix Round 2 re-review by `/root/plan5_task3_reviewer` (fresh `gpt-5.6-sol`, high; substitution none) was CHANGES_REQUIRED: Critical `0`, Important `1`, Minor `0`. Completeness beyond I1 was accepted. The prior `128/128` statement described occurrence/category overlap, not per-line/category completeness, and is superseded by the exact denominator below.
- Fix Round 3 RED: policy exit `1`, `44/45` passed, duration `486.8926 ms`; zero uncovered ranges and exactly `63` missing line/category pairs: repair transactional terminal `305-324` (`20`), repair completed-event terminal `461-463` (`3`), reconciliation cleanup ownership `764-803` (`40`).
- Fix Round 3 implementation is complete in `65d3d3e2512f9552d6e3e071901a2f56bcac7295` (`fix: enforce per-line critical categories`). Only the manifest and regression changed. No rule was added or removed; the final manifest remains `89` rules and the matrix remains `90` occurrences.
- Final authoritative denominator: `3151` executable line/category pairs, all `3151/3151` covered by a same-source manifest rule carrying the same category. The exact schema, six controlled categories, source hashes, allowlist, and production bytes are unchanged.
- Fix Round 3 GREEN: policy `45/45`, `490.0548 ms`; updater `89` rules; selected Plan 3 suites `193/193`, `6.61 s`; ESLint, Prettier, updater candidate byte identity, source identity, hashes, scope, and diff checks exit `0`.
- Final Fix Round 3 reviewer verdict: APPROVED with Critical `0`, Important `0`, Minor `0`; Important I1 addressed and open findings `0`. Task 3 is complete. Task 4 remains unstarted in this closeout.

## Task 04 final distributed correction

- The human-approved members correction supersedes the blocked whole-source concurrency-2 result with exact smoke concurrency map `2/2/2/4/2`, keeping five whole-source shards, independent `300000 ms` deadlines, fail-closed provenance/canonical merge, and complete concurrency `4`/`900000 ms` unchanged.
- Strict focused RED: exit `1`, `0/1`, `114.5595 ms`, exact members actual `2` versus expected `4`. Minimal focused GREEN: `2/2`, `116.4271 ms`.
- Final Windows deterministic suite: exit `0`, `78` pass, `0` fail, one intentional POSIX skip, `26806.3345 ms`; final Ubuntu 24.04/nvm Node `v22.22.2` suite: exit `0`, `79/79`, no skips, `14818.558805 ms`. Manifest `89`, ESLint, Prettier, exact ignore entry, protected bytes, scope, and diff checks passed.
- Mandatory members-alone cold gate: persistent root `/home/tisana/book-library-plan5-task4-members-c4-alone-20260812/repo`, clean snapshot `6c739e882ea9daa57df6b160172fd4751a10153a`, exact Node `v22.22.2`/npm `10.9.8`, fresh npm ci `22.67 s`. Exact `204` mutants completed with JSON/HTML in `242808.848852/300000 ms`, Stryker/artifact exits `0/0`, no timeout, no surviving descendants. Archive SHA `17ffd105aebadc844a9503063eeff03690eb31811b89dffe036924e1640417b2`.
- Fresh same-commit sequential compatibility set: root `/home/tisana/book-library-plan5-task4-sequential-c4-20260812/repo`, same clean snapshot and runtime, fresh npm ci `22.49 s`. Token `211/148211.688546 ms`, repair `401/109038.59291400001 ms`, reconciliation `415/117191.18293000001 ms`, members `204/245561.36113700003 ms`, borrowings `135/39750.64014600008 ms`; every shard had JSON/HTML, artifact exit `0`, no timeout, and no surviving descendants.
- Canonical merge accepted exact five files and `1366` unique identities. Aggregate policy error is null, raw score `70.79062957540263`, and wrapper exit `1` is the valid Task 5 RED solely from `410` real critical findings/violations. Aggregate archive SHA `cd44aee362c0e07e09f2aac091e3c1a1ec8445ef28c64b04fb70b724019b0d8f`; report ledger `e90289153eb9491c60c339a74fa8d98055b4435620cd708b737873eba9d81669`.
- Task 04 implementation is complete in immutable commit `b496431e43c365e2190ab77c5cc6c85be0959869` (`test: add budgeted selective mutation runner`). Evidence backfill is separate. Final status: READY FOR FRESH INDEPENDENT REVIEW. Task 5, push, workflow dispatch, and Actions remain unstarted.

## Task 04 Fix Round 1

- Initial independent review verdict: CHANGES_REQUIRED, Critical `0`, Important `1`, Minor `0`. Important I1 reproduced stale named/sequential shard JSON+HTML acceptance and stale aggregate retention after a failed merge.
- Strict focused RED: exit `1`, `0/4` passed, `346.0442 ms`. A child writing nothing and exiting `1` was incorrectly reported as artifact/wrapper exit `0`; failed standalone merge left prior aggregate JSON/HTML active.
- Fix Round 1 archives prior shard directories and aggregate outputs under ignored run-numbered history before each current launch/merge. Current active JSON/HTML must therefore be created by the current child/merge, while prior evidence remains preserved.
- Final focused GREEN: `4/4`, `289.7141 ms`. Windows combined suite: `82` pass, `0` fail, one intentional POSIX skip, `26997.3148 ms`. Ubuntu 24.04/nvm Node `v22.22.2`: `83/83`, no skips, `14841.724933 ms`. Manifest `89`, ESLint, Prettier, diff, protected bytes, and scope are clean.
- Accepted cold evidence was not rerun because its unique clean snapshots had no pre-existing active outputs, and the fix changes only output lifecycle handling—not config, provenance, scope, identity merge, concurrency, reporters, thresholds, mutators, or budgets.
- Fix implementation commit `125e5b519eac9513a7f82c72325035979a33c598` (`fix: reject stale mutation artifacts`). Important I1 addressed; implementer-known open findings `0`. Status: READY FOR SCOPED FRESH RE-REVIEW. Task 5, push, workflow dispatch, and Actions remain unstarted.

## Task 04 final review closeout

- Fix Round 1 scoped reviewer requested and actual: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task4_final_reviewer`; substitution none.
- Final verdict: APPROVED. I1 ADDRESSED. Critical `0`, Important `0`, Minor `0`; spec and code-quality verdicts both APPROVED.
- Reviewer verification: focused `4/4`; Windows full `82` passed plus one intentional POSIX skip; Ubuntu/Node 22 full `83/83`; manifest, ESLint, Prettier, whitespace, protected-byte, scope, and ignore checks passed.
- Reviewer accepted the prior cold mutation evidence as valid because its unique clean output paths make the new pre-launch preservation step a no-op. Configuration, sources, provenance, `2/2/2/4/2` smoke concurrency, complete concurrency `4`, reporters, thresholds, mutators, and budgets remain unchanged.
- Task 4 is complete. Task 8 reference wall-clock proof remains deferred and is not waived. Task 5 and CI are not preapproved; no Task 5 work, push, workflow dispatch, or Actions run occurred in this closeout.

## Task 05 complete-profile distributed amendment dispatch

- Human approval received on `2026-08-16` to replace the structurally incomplete monolithic complete-profile producer with five full-source complete-profile shards and a fail-closed canonical merge. The complete hard/runtime gate remains exactly `900000 ms`; selected production files, mutation operators, reporters, score thresholds, critical-survivor policy, and dependency order remain unchanged. No push or Actions dispatch is authorized.
- Amendment implementer dispatch requested and actual: `/root/plan5_task5_recovery_implementer`, `gpt-5.6-sol`, high reasoning; substitution none.
- Task 05 final independent reviewer dispatch requested and actual: fresh `/root/plan5_task5_final_reviewer`, `gpt-5.6-sol`, high reasoning; substitution none. Review target is immutable implementation `f539eda1c1f99622df59ca13181b9a71f96219a5` plus evidence `1819b85433b798fb4e25e2e751bb381b5ab02400`; Task 6 remains blocked pending verdict.
- Task 05 Fix Round 1 implementer dispatch requested and actual: `/root/plan5_task5_recovery_implementer`, `gpt-5.6-sol`, high reasoning; substitution none. The immutable final review verdict was CHANGES_REQUIRED with Critical `0`, Important `3`, Minor `0`; Task 6 remains blocked.
- Task 05 Fix Round 1 scoped re-review dispatch requested and actual: `/root/plan5_task5_final_reviewer`, fresh `gpt-5.6-sol`, high reasoning; substitution none. Review target is implementation `b90460231c8cbdb5ceeee3de6bde93c424f8ecc0` plus evidence `57d878a3b698d789f4d4576d365a1a935efa4b0a`; Task 6 remains blocked pending verdict.
- Task 05 review-closeout implementer dispatch requested and actual: `/root/plan5_task5_recovery_implementer`, `gpt-5.6-sol`, high reasoning; substitution none. The scoped re-review verdict is APPROVED with Critical `0`, Important `0`, Minor `0`; closeout is documentation-only and Task 6 remains blocked until its commit is clean.
- Complete-distributed amendment TDD: focused RED `0/13` on the monolithic
  config/missing shard APIs; focused GREEN `13/13`. Final Windows runner/policy
  verification is `91` pass, `0` fail, one intentional POSIX skip. The
  accepted byte-exact WSL Node `v22.22.2` snapshot passed `92/92`, no skips,
  plus manifest `89`, ESLint, Prettier, and diff checks. Smoke remains exactly
  `350000 ms` with `2/2/2/4/2`; complete remains exactly `900000 ms` with
  concurrency `4` per full-source shard.
- Accepted WSL snapshot:
  `/home/tisana/book-library-plan5-task5-complete-shards-exact-20260816-2000/repo`,
  HEAD `dad7c524330c1c60ea016b357c3feedae68e47c9`, Node `v22.22.2`, npm
  `10.9.8`, fresh `npm ci` `23.70 s`, runner SHA
  `f6352077e62e4ef37a050655ce58f33d5b6aa5b8e3a1c19e8a736518480796f9`,
  config SHA
  `3e960072b82654cf7ecf2e43ca43f7227719117bb332206101baf984b25c26e2`.
  Exact byte comparisons passed for runner/config/policy/allowlist/manifest,
  package inputs, and all five protected production sources. Two earlier
  no-shard preflight snapshots are preserved: one failed WSL Prettier from
  inherited CRLF changed JavaScript; one failed manifest hashes after
  over-normalizing protected production to LF.
- Complete full-source shards all wrote isolated JSON/HTML/log/duration/summary
  with artifact exit `0`, no timeout, identical provenance, c4, and independent
  `900000 ms` gates: token `261/114714.184835 ms`; repair
  `417/76678.565423 ms`; reconciliation `532/106823.370522 ms`; members
  `286/316857.54179700004 ms`; borrowings `231/42058.691993 ms`.
- Canonical complete merge accepted exact five disjoint sources and `1727`
  identities. Raw score `90.79328314997105`; statuses `1565` Killed, `132`
  Survived, `27` NoCoverage, `3` Timeout. The single Task 2 policy run exited
  `1` only for Task 6/7: exact `26` member + `51` borrowing violations. All
  three auth critical findings are the approved exact equivalents; auth
  unapproved `0`. Missing artifacts, timeout, scope/provenance drift, and raw
  score regression are absent.
- Durable complete tree:
  `reports/mutation/diagnostics/task5-complete-distributed-wsl-900k/`;
  aggregate JSON SHA
  `ce3730b1ce3d06967a23a77f4203ded43af7b62d481e7901fec65528ab067f01`;
  summary SHA
  `8ef53c529e1ab01dfa3a0ce8f9b834071c92ac9b4faae5251852664488afc5c8`.
  Pre-Fix-Round-1 focused auth was `188/188`; implementer self-review open findings
  Critical/Important/Minor `0/0/0`. Task 5 is ready for its exact two-commit
  protocol and then fresh independent final review. Task 6, push, and Actions
  remain unstarted.
- Independent existing gates are explicitly consumed, not averaged into
  mutation: Task 0 verified inherited backend unit `469/469`, backend E2E
  `242/242`, quality `68/68`, backend report `87` files, and changed-line
  `not-applicable` `0/0` passed. The accepted integrated G3/G4 handoff retains
  frontend coverage baseline statements/branches/functions/lines
  `85.29/82.44/81.48/85.82%` and Playwright `87/87`, zero
  failed/flaky/skipped. Task 5 touches none of those gates; Task 8 owns their
  fresh authoritative integration rerun.
- Task 05 immutable implementation commit is
  `f539eda1c1f99622df59ca13181b9a71f96219a5` (`test: harden critical auth
mutations`). Its exact full SHA was measured after commit and is backfilled
  without amend in the required distinct evidence-only commit. Final status:
  READY FOR FRESH INDEPENDENT TASK 5 REVIEW; Task 6, push, and Actions remain
  unstarted.

## Task 05 Fix Round 1

- Initial independent verdict: `CHANGES_REQUIRED`, Critical `0`, Important `3`,
  Minor `0`. I1 required an auditable RED reconstruction, I2 required exact
  implementation/amendment path accounting, and I3 required replacing the cited
  direct private-method/getter tests with public observable workflows.
- Fix Round 1 implementer requested and actual:
  `/root/plan5_task5_recovery_implementer`, `gpt-5.6-sol`, high reasoning;
  substitution none. No Task 6, production, member/borrowing spec, dependency,
  manifest, push, or Actions work is authorized.
- Strict focused public-path guard command:
  `node --test --test-name-pattern "keeps Task 5 mutation assertions on public service paths" test/quality/mutation-policy.test.mjs`;
  RED exit `1`, `0/1`, identifying the cited private access in all three auth
  specs; GREEN exit `0`, `1/1`. Token assertions now traverse public `rotate`,
  reconciliation assertions traverse `reconcileOnce` outcomes, and repair
  validation assertions traverse public `dryRun`/`apply`/`cancel` workflows.
- Final Windows verification passed focused auth `190/190`, all auth
  `334/334`, deterministic runner/policy `92` passed with one intentional POSIX
  skip, manifest `89`, ESLint, Prettier, protected-path identity, and whitespace
  checks. Final current-snapshot WSL Node 22 verification passed deterministic
  runner/policy `93/93` with no skips, manifest `89`, and Prettier.
- First clean WSL smoke was retained as a report-based RED because exact
  fingerprint
  `646a86b2242963771f866c8e1eac7a192151eb099421e4a7e2912b51b3b14967`
  survived the public repair manifest path. Preserved JSON SHA is
  `ef6a5b69c22c1487e216be210c7d757c0b2552bb02dab50f3e6932cf1d47cbf9`;
  summary SHA is
  `7f715addc9ffd22565a6922d937c043c0c5b794861eb766ea132e9ab16f8520a`.
  The minimal public claimant-state assertion killed it.
- Final clean WSL-native snapshot root is
  `/home/tisana/book-library-plan5-task5-fix-round1-20260816-1930/repo`,
  temporary provenance commit
  `4c4623512fc0895685aff396e7d77d0333f12150`, Node `v22.22.2`, npm `10.9.8`,
  fresh `npm ci`, runner SHA
  `f6352077e62e4ef37a050655ce58f33d5b6aa5b8e3a1c19e8a736518480796f9`,
  config SHA
  `3e960072b82654cf7ecf2e43ca43f7227719117bb332206101baf984b25c26e2`.
- Final smoke exact `1366`: raw `94.14348462664715`; statuses `1283` Killed,
  `66` Survived, `3` Timeout, `14` NoCoverage; auth unapproved `0`; exact three
  approved equivalents; `77` expected Task 6/7 violations. Durations in exact
  `350000 ms` gates: token `135733.733258`, repair `104056.1518`,
  reconciliation `114038.735271`, members `196870.980403`, borrowings
  `37127.026146 ms`. Durable JSON SHA is
  `cb3e454dc510268da17021f9044b6c26616e8dea748cf8c7ebc46aa531446266`;
  summary SHA is
  `afbcf3bd2b3aa00d7c25b85f77fcdd51014b36bca12c9135cc071d57a1fd38e1`.
- Final distributed complete exact `1727`: raw `90.79328314997105`; statuses
  `1565` Killed, `132` Survived, `27` NoCoverage, `3` Timeout; auth unapproved
  `0`; exact three approved equivalents; `77` expected Task 6/7 violations.
  Full-source shard durations under independent `900000 ms` gates: token
  `261/102477.067983`, repair `417/66520.382847`, reconciliation
  `532/95562.910743`, members `286/274087.79486100003`, borrowings
  `231/39642.82099199999 ms`. All required JSON/HTML/log/duration/summary
  artifacts and provenance checks passed. Durable JSON SHA is
  `51eb907615b659a2cacb2278e1e066c70e33edbdfb9f04600f8b7e0bbdf34a3a`;
  summary SHA is
  `c5a2c2d887c9dd52dd11fd8efcf3db5d03c70a97c4452679c7ee5339b5224533`.
- Fix Round 1 evidence directories are
  `reports/mutation/diagnostics/task5-fix-round1-public-path-smoke-red-wsl/`,
  `reports/mutation/diagnostics/task5-fix-round1-final-smoke-wsl-350k/`, and
  `reports/mutation/diagnostics/task5-fix-round1-final-complete-wsl-900k/`.
  Prior timeout and accepted evidence is preserved. Real implementation and
  evidence are kept in separate commits. Fix implementation is immutable
  `b90460231c8cbdb5ceeee3de6bde93c424f8ecc0` (`test: use public auth mutation
paths`), containing only the three auth specs and policy quality regression.
  Implementer self-review open Critical/Important/Minor is `0/0/0`; re-review
  is pending and no approval is presumed.

## Task 05 final review closeout

- Final scoped reviewer requested and actual: fresh
  `/root/plan5_task5_final_reviewer`, `gpt-5.6-sol`, high reasoning;
  substitution none. Reviewed immutable implementation
  `b90460231c8cbdb5ceeee3de6bde93c424f8ecc0` and evidence
  `57d878a3b698d789f4d4576d365a1a935efa4b0a`.
- Final verdict: `APPROVED`, Critical `0`, Important `0`, Minor `0`. I1
  auditable RED reconstruction, I2 exact scope/amendment accounting, and I3
  public-observable test quality are all `RESOLVED`.
- Reviewer verification: focused auth `190/190`; all-auth `334/334`; elevated
  Windows deterministic runner/policy `92` passed with one intentional POSIX
  skip; manifest `89`; smoke exact `1366`, raw `94.14348462664715`, maximum
  shard duration below `350000 ms`; complete exact `1727`, raw
  `90.79328314997105`, maximum shard duration below `900000 ms`; auth
  unapproved `0` with exactly three approved equivalents; clean WSL snapshot
  `4c4623512fc0895685aff396e7d77d0333f12150` byte-matched the reviewed inputs.
- Task 5 is complete at the reviewed immutable boundary. This closeout changes
  evidence only; no implementation amend, Task 6, push, or Actions work was
  started.
