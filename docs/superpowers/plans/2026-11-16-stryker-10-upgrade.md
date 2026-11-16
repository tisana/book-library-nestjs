# Stryker 10.1.1 Upgrade Implementation Plan

> Execute the checkbox tasks in order after implementation is authorized. Use `superpowers:executing-plans` for native execution. Read this plan and the repository instructions before making changes.

**Goal**

Upgrade `@stryker-mutator/core` and `@stryker-mutator/jest-runner` from 9.6.1 to exactly 10.1.1, adopt the additional v10 mutations, and produce passing mutation gates with reviewed evidence.

**Architecture**

Retain the existing five-shard Jest/ts-jest pipeline, custom Jest runner, canonical merge, critical-rule manifest, equivalent-mutant policy, and complete-score baseline. Diagnose survivor behavior before changing tests, bind shard evidence to the dependency lockfile, and migrate the exact mutant counts together with their validators and fixtures.

**Tech stack**

Node 24.19.0, npm 11.9.0, Stryker 10.1.1, Jest 30.4.1, ts-jest 29.4.14, TypeScript 6.0.2, PowerShell, and GitHub Actions on Ubuntu 24.04.

**Project context**

Read `AGENTS.md` and `specs/003-auth-roles-permissions/plan.md`. This document contains the upgrade decisions and execution requirements. Earlier upgrade plans provide historical context. Current source, configuration, and this plan govern this upgrade.

## Agreed approach and planning decisions

- On 2026-11-16, the user selected adoption of v10 mutations and resolution of the surviving critical cases.
- The user selected a dependency diff focused on Stryker, including removal of the new Scarf telemetry approval.
- Pin both direct Stryker packages to `10.1.1`. Exact pins are the plan author's recommendation because mutant inventories and equivalence proofs depend on the toolchain.
- Keep the existing Node and npm pins. A runtime upgrade would expand this change's validation scope.
- An initial compatibility upgrade with v9 mutation behavior was considered. The user selected the additional coverage available with v10.
- The expected path changes dependencies, tests, mutation infrastructure, and policy metadata. If diagnosis proves an authentication implementation change is required, document the exact defect and amend the affected source hashes, inventory, and baseline migration steps before executing that change. Existing baseline validation binds source hashes and makes that amendment a technical dependency.

## Evidence and limits

The workspace was inspected on 2026-11-16 on branch `stryker-upgrade-v10`, at HEAD `973da8b448346c5beb8912c93ece13c4efd92419`. The working tree contains user changes to `package.json` and `package-lock.json`.

The 2026-11-14 review recorded passing backend build, lint, 566 unit tests, 254 integration tests, 68 reporting tests, and 132 mutation infrastructure tests with two skips. Its clean-install check used npm 11.9.0 with lifecycle scripts disabled. Application tests used Node 24.22.1. These results establish prior evidence. Task 7 supplies fresh verification with the pinned toolchain and normal CI installation.

The real token-session smoke shard produced 225 mutants, 221 killed and four survived, for 98.22%. Three new survivors removed `denyRefresh()` calls. The identifier-repair shard exceeded its 350000 ms local budget, and the remaining smoke run was stopped. The complete profile was inventoried without executing its full mutation tests.

The reviewed inventory used identical application source for both versions.

| Shard                     | v9 smoke | v10 smoke | v9 complete | v10 complete |
| ------------------------- | -------: | --------: | ----------: | -----------: |
| token-session             |      211 |       225 |         272 |          287 |
| identifier-repair         |      401 |       405 |         417 |          421 |
| identifier-reconciliation |      415 |       415 |         538 |          547 |
| members                   |      204 |       204 |         286 |          286 |
| borrowings                |      135 |       135 |         231 |          231 |
| Total                     |     1366 |      1384 |        1744 |         1772 |

All 18 added smoke mutants and 28 added complete mutants were `CallExpression` mutations. Every v9 mutant identity remained present. Treat these counts as expected values for the inspected source. Recompute them if the selected source or rule ranges change.

Prior evidence is under `reports/mutation/v10-upgrade-review/`. These ignored files may be local to this checkout. Preserve or export them before switching workspaces. Task 3 recreates the comparison if they are unavailable.

## Global constraints

- Preserve the five selected services, all 89 critical rules, per-test coverage analysis, and reporter outputs.
- Retain Stryker thresholds `high=80`, `low=70`, and `break=70`, the policy's raw combined score floor of 70%, and zero unapproved critical findings.
- Retain the current complete-score floor of `95.35550458715596%`. The final baseline must come from an actual policy-green complete report and meet this floor.
- Retain the smoke budget of 350000 ms per shard and complete budget of 900000 ms per shard. Use fresh Ubuntu 24.04 CI evidence to establish reference-runner timing.
- Preserve generic refresh denials, replay detection, rotation ordering, family revocation, permission checks, and origin/cookie protections.
- Keep the exact-fingerprint equivalent policy, including proof, reviewer metadata, source hash, review date, and expiry. Raw score accounting continues to include equivalent survivors as undetected.
- Preserve `typed-rest-client`'s `qs=6.16.0` override and the dependency security objective already encoded in the repository.
- Use strict installation and ordinary peer resolution. Dependency conflicts require diagnosis.
- Save evidence from incomplete or timed-out runs with its actual outcome. Reusing a prior passing result cannot satisfy a fresh run.

## Files and responsibilities

| File                                         | Expected responsibility in this upgrade                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `package.json`                               | Exact Stryker pins and focused install-script approvals                              |
| `package-lock.json`                          | Coherent, minimal dependency resolution                                              |
| `scripts/quality/run-mutation.mjs`           | Lockfile-bound configuration hash and exact profile counts                           |
| `scripts/quality/mutation-policy.mjs`        | Complete-report count and baseline validation                                        |
| `test/quality/mutation-runner.test.mjs`      | Provenance, merge, count, timeout, and fixture regressions                           |
| `test/quality/mutation-policy.test.mjs`      | Complete-count, critical-survivor, expiry, scoring, and baseline regressions         |
| `scripts/quality/mutation-jest-runner.cjs`   | Change only if targeted controls demonstrate a runner defect                         |
| `test/quality/mutation-jest-runner.test.mjs` | Regression test for any demonstrated runner defect                                   |
| `src/auth/token-session.service.spec.ts`     | Supported-behavior tests for the reported critical survivors                         |
| Other selected service spec files            | Coverage for additional observed v10 survivors                                       |
| `test/quality/mutation-equivalents.json`     | Exact, reviewed equivalence entries when proved                                      |
| `test/quality/mutation-baseline.json`        | Baseline generated by the existing validated CLI                                     |
| `stryker.config.mjs`                         | Preserve configuration, adjust only for demonstrated compatibility or timing defects |
| `.github/workflows/mutation.yml`             | Existing matrix and merge entry points for final verification                        |

## Review focus

1. A custom-runner optimization or test-name filter can misreport a mutant whose behavior an existing test already covers. Task 4 compares actual selected tests and a standard-runner control.
2. Equal source/configuration with a different Stryker lockfile can reuse incompatible evidence. Task 2 binds dependency bytes and rejects both stale and mixed shards.
3. A correct total can conceal a duplicate, omission, wrong-source mutant, or invalid status. Task 5 preserves identity and ownership checks and their negative tests.
4. A new equivalence entry or baseline can conceal a score or security regression. Tasks 4 and 6 retain raw scoring and exercise rejection paths.
5. A passing local run can conceal a CI shard timeout or surviving worker. Tasks 2 and 7 verify cleanup and require finished reference-runner evidence.

## Task 1 — Establish a reproducible, focused dependency candidate

**Files** — `package.json`, `package-lock.json`, existing runtime pins and workflow configuration.

**Deliverable** — A strict-installable 10.1.1 candidate with an explained dependency diff and a recoverable v9 comparison.

- [ ] Save HEAD, status, and the user's existing dependency patch. Use the existing feature branch or an isolated implementation worktree as appropriate. Preserve the original patch before narrowing it.
- [ ] Record the v9 manifest, lockfile, baseline, equivalent entries, selected-source hashes, and rule manifest in a comparison directory outside active shard output paths.
- [ ] Activate Node 24.19.0 and npm 11.9.0. Verify `node --version` and `npm.cmd --version` before installation. On Linux, use `npm` in the commands below.
- [ ] In the implementation checkout, start lockfile resolution from the saved HEAD lockfile and set the two direct Stryker dependencies to exact `10.1.1`.
- [ ] Resolve with `npm.cmd install --save-dev --save-exact --package-lock-only --lockfile-version=2 --ignore-scripts @stryker-mutator/core@10.1.1 @stryker-mutator/jest-runner@10.1.1`.
- [ ] Compare old and new package graphs by package path and version. Account for required Babel 8, Stryker, report-package, regex, and deduplication changes. Remove unrelated ESLint/TypeScript-ESLint updates from this candidate. Investigate any runtime dependency movement, including shared `semver`, and document why it is required if retained.
- [ ] Remove the newly added Scarf script approval. Review the added `unrs-resolver` approval against normal installation with the pinned npm version. Keep an additional approval only when a demonstrated install/runtime requirement justifies it.
- [ ] Run a clean `npm.cmd ci`, followed by `npm.cmd ls --depth=0`, `npm.cmd ls @stryker-mutator/core @stryker-mutator/jest-runner @stryker-mutator/instrumenter`, and `git diff --check`.
- [ ] Confirm matching Stryker 10.1.1 versions and a normal install with the existing security override. Save the actual outputs and inspect lifecycle-script behavior. The prior `--ignore-scripts` installation is insufficient for this step.

## Task 2 — Bind shard evidence to the dependency toolchain

**Files** — `scripts/quality/run-mutation.mjs`, `test/quality/mutation-runner.test.mjs`.

**Interface** — Extend `configurationSha256(root)` while retaining its string return value and the existing `configurationSha256` fields in shard/aggregate artifacts.

- [ ] Add a regression test named `configuration provenance binds the dependency lockfile`. Capture a hash, change only the lockfile bytes, and assert the hash changes. Verify that the test fails against the existing implementation.
- [ ] Add `package-lock.json` to `configurationSha256(root)`'s existing file inputs. Include the lockfile in `temporaryRepository()` fixtures. Keep the current binding to runner, compiler, Stryker configuration, and inline Jest configuration.
- [ ] Add negative tests that capture shard evidence, change only the lockfile, and require both smoke and complete merges to reject the old evidence. Add a mixed-shard case with different dependency hashes.
- [ ] Preserve the existing regression that an unrelated `package.json` script change alone leaves the configuration hash stable.
- [ ] Run `node --test test/quality/mutation-runner.test.mjs test/quality/mutation-jest-runner.test.mjs`. Require passing provenance and cleanup tests, with any platform skips explained.

## Task 3 — Reproduce and review the v10 mutant inventory

**Inputs** — Saved v9 dependency state, the pinned v10 candidate, identical selected sources, and identical rule ranges.

**Deliverable** — A comparison of canonical mutant identities and exact per-shard counts for both profiles.

- [ ] Generate v9 and v10 inventories in separate dependency environments. Use the same installed Node version and source bytes. Reuse the reviewed comparison only when its hashes match the candidate.
- [ ] Compare normalized source path, location, mutator name, and replacement. Normalize API/report coordinate conventions before comparing. Numeric mutant IDs are local identifiers and may shift.
- [ ] Verify the table above and list every added, removed, or changed identity. For the inspected source, expect 18 added smoke mutants and 28 added complete mutants, with zero removals.
- [ ] Inspect representative generated code for each newly added mutation shape, especially replacement of a standalone call by an empty statement. Confirm the intended call is actually removed when the mutant is activated.
- [ ] Record report schema and field compatibility. The current validator already permits `duration`. Use a real v10 report to test validation and preserve rejection of malformed fields and statuses.
- [ ] Review any unexplained inventory difference before changing the gate constants. Keep the entire v10 mutation set enabled.

## Task 4 — Resolve every surviving critical mutation

**Files** — Selected service specs, custom runner and its tests when justified, and the equivalent allowlist when equivalence is proved.

**Deliverable** — Each critical mutant is killed by supported behavior or has a reviewed exact-fingerprint proof.

The three reported token-session cases require separate diagnosis.

| Current source line | Rule                                    | Existing test to examine                                                    |
| ------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| 185                 | `token-rotation-failure-revokes-family` | `fails closed when the family compare-and-swap returns no successor`        |
| 435                 | `token-committed-marker-replay-revokes` | `finalizes an operation-correlated pending marker against its exact family` |
| 460                 | `token-pending-marker-takeover-guard`   | `finalizes and revokes a pending marker whose lease is missing`             |

- [ ] Run `npm.cmd test -- --runInBand --runTestsByPath src/auth/token-session.service.spec.ts`. Confirm the existing assertions cover the rejection type/message and relevant durable state.
- [ ] Reproduce each mutant with a fresh targeted Stryker run. Save generated mutation code, active mutant identity, coverage/test names, status, and logs.
- [ ] Compare the normal custom-runner result with a diagnostic configuration that uses the standard Jest runner and otherwise retains the same transform and coverage analysis. Put diagnostic configuration and outputs in ignored evidence paths. Start each comparison from a fresh sandbox.
- [ ] If the standard runner kills a mutant that the custom runner reports as surviving, add a failing regression in `test/quality/mutation-jest-runner.test.mjs` for the demonstrated filtering, name, or inventory defect. Implement the minimal runner correction, then require both runner modes to agree on that mutant.
- [ ] If both runners report survival, examine control flow and persistence behavior. For distinguishable behavior, add a spec that fails with the active mutation and passes with the original implementation. Assert public outcomes and durable writes, including ordering or extra writes where relevant.
- [ ] If all supported outcomes are equivalent, record the exact fingerprint, source hash, proof covering fulfillment/rejection and downstream side effects, actual reviewer metadata, review time, and expiry. Follow the existing proof format. A generic denial after extra mutation of persistent state does not establish equivalence.
- [ ] Run all five smoke and complete shards as diagnosis proceeds. Classify every additional `Survived` or `NoCoverage` mutant that overlaps a critical rule. Reassess the three existing equivalence entries under the pinned runtime and toolchain.
- [ ] If the evidence requires an authentication implementation change, amend the plan before that change. Include fresh source/rule hashes, re-reviewed affected equivalents, recalculated profile counts, and a tested baseline migration preserving the existing score floor and truthful historical provenance.

## Task 5 — Migrate exact counts and preserve rejection behavior

**Files** — `scripts/quality/run-mutation.mjs`, `scripts/quality/mutation-policy.mjs`, `test/quality/mutation-runner.test.mjs`, `test/quality/mutation-policy.test.mjs`.

**Interfaces** — Existing smoke/complete merge functions, `validateCompleteProvenance`, and `recordBaseline` continue to enforce the canonical inventory.

- [ ] Add failing tests accepting the reviewed v10 smoke total of 1384 and complete total of 1772 with the table's per-shard ownership.
- [ ] Add rejection cases for v9-sized unions, missing and extra mutants, duplicate canonical identities with different IDs, wrong-source ownership, stale lockfile hashes, and a non-green shard.
- [ ] Change `SMOKE_MUTANT_COUNT` and `COMPLETE_MUTANT_COUNT` in the runner and the complete-count check/error in `validateCompleteProvenance` together.
- [ ] Update both test files' per-shard fixture arrays, totals, one-short cases, assertions, and descriptive test names. Keep explicit reviewed expectations in the tests so changing a production constant alone cannot make the tests pass.
- [ ] Preserve failure on incomplete artifacts, a timeout, invalid status, missing source, incorrect source hash, and inconsistent provenance.
- [ ] Run `node --test test/quality/mutation-runner.test.mjs test/quality/mutation-policy.test.mjs test/quality/mutation-jest-runner.test.mjs` and `npm.cmd run mutation:check`.
- [ ] Require passing tests and all 89 valid critical rules. Source/range changes require the Task 4 amendment and a freshly reviewed inventory.

## Task 6 — Complete verification and record the v10 baseline

**Files** — `test/quality/mutation-baseline.json` and any reviewed equivalent entries from Task 4.

**Interface** — Use `record-baseline` through `scripts/quality/mutation-policy.mjs` after a policy-green canonical complete merge.

- [ ] Preserve the previous baseline artifact and its score of `95.35550458715596%`. Retain the existing score floor throughout evaluation.
- [ ] Verify rejection of unapproved critical survivors, expired or wrong-hash equivalents, a score below the previous baseline, wrong count, stale/mixed commit evidence, and unsuccessful shard results.
- [ ] Capture the dependency, runner/test, and policy migration in a reviewable implementation commit before collecting baseline evidence. Record that revision and keep the evidence inputs fixed during collection. This step belongs to later authorized implementation.
- [ ] Produce fresh results for every smoke shard, then run `node scripts/quality/run-mutation.mjs smoke-merge`.
- [ ] Produce fresh results for every complete shard, then run `node scripts/quality/run-mutation.mjs complete-merge`.
- [ ] Require zero unapproved critical findings and a complete score at or above the old baseline. Investigate regressions among common mutant identities separately from newly introduced mutations.
- [ ] If all new equivalent mutants make the existing raw score floor unattainable, report the measured score, equivalence evidence, and common-mutant comparison to the user for a specific decision. Any change to the score policy needs explicit agreement and corresponding regression tests.
- [ ] Before moving HEAD, run `node scripts/quality/mutation-policy.mjs record-baseline reports/mutation/complete/mutation.json` against the actual implementation commit's complete report and summary.
- [ ] Review the generated baseline's score, source hashes, timestamp, and `generatedFromCommit`. Keep its reference to the tested implementation commit when the generated baseline is committed subsequently.

## Task 7 — Pass normal-entry-point and CI acceptance checks

**Deliverable** — Finished local compatibility checks and both finished CI mutation profiles from the reviewed upgrade candidate.

- [ ] Run the following checks with Node 24.19.0 and npm 11.9.0. Check each command's exit code before continuing.

```powershell
npm.cmd ci
npm.cmd ls --depth=0
npm.cmd run build
npm.cmd exec -- eslint "{src,apps,libs,test}/**/*.ts"
npm.cmd test -- --runInBand
npm.cmd run test:e2e
npm.cmd run test:quality-reporting
node --test test/quality/mutation-runner.test.mjs test/quality/mutation-policy.test.mjs test/quality/mutation-jest-runner.test.mjs
npm.cmd run mutation:check
git diff --check
```

- [ ] Run mutation profiles through the actual shard and merge entry points. For local diagnosis, run one shard at a time to avoid unrelated workload affecting timing.

The following local commands can produce the artifacts required by Task 6. CI can also supply those artifacts from the same implementation commit. Reuse completed, matching evidence between Tasks 6 and 7. A local timing failure requires diagnosis and recorded limitations, with CI acceptance decided from finished reference-runner results.

```powershell
$shards = 'token-session', 'identifier-repair', 'identifier-reconciliation', 'members', 'borrowings'
foreach ($shard in $shards) {
    node scripts/quality/run-mutation.mjs smoke-shard $shard
    if ($LASTEXITCODE -ne 0) { throw "Smoke shard failed or timed out - $shard" }
}
node scripts/quality/run-mutation.mjs smoke-merge
if ($LASTEXITCODE -ne 0) { throw 'Smoke merge failed' }

foreach ($shard in $shards) {
    node scripts/quality/run-mutation.mjs complete-shard $shard
    if ($LASTEXITCODE -ne 0) { throw "Complete shard failed or timed out - $shard" }
}
node scripts/quality/run-mutation.mjs complete-merge
if ($LASTEXITCODE -ne 0) { throw 'Complete merge failed' }
```

- [ ] Remember that `npm.cmd run mutation:complete` currently invokes the complete merge. The command requires five existing complete shard artifacts. The shard commands above generate those artifacts.
- [ ] Investigate the prior repair timeout using an isolated v9/v10 comparison on the same runtime and machine. Compare startup time, selected tests, time per mutant, timeout statuses, process-tree polling/cleanup, and sandbox input size. Use a demonstrated runner/configuration correction where needed.
- [ ] Run the existing GitHub Actions smoke profile and manually dispatch the complete profile on the candidate revision. Record run URLs, commit, Node/npm/Stryker versions, all five shard durations, merge outcomes, and worker-cleanup outcomes. Preserve the 350000/900000 ms budgets and the existing five-runner matrix.
- [ ] Re-run affected mutation evidence after a dependency, runner, compiler, source, range, or configuration change. Copy diagnostics to a separate evidence directory before an entry point invalidates active outputs.
- [ ] Add actual browser verification if a demonstrated fix changes browser-facing authentication behavior. Run `npm.cmd ci --prefix frontend`, `npm.cmd run build`, `npm.cmd run frontend:build`, and `npm.cmd run frontend:test:live`. The existing `frontend/tests/live/nestjs-upgrade.spec.ts` exercises sign-in, real refresh rotation, sign-out, permissions, and ownership through `frontend/playwright.live.config.ts` against the compiled backend.
- [ ] Review all final file diffs and report actual failures/skips. The acceptance result requires finished smoke and complete merges and their timing evidence.

## Task 8 — Prepare the upgrade for commit and rollback

- [ ] Review the focused dependency diff, survivor dispositions, inventory comparison, lockfile provenance tests, new baseline, and complete CI evidence together.
- [ ] Review the implementation commits prepared for baseline capture, then prepare the generated baseline as a subsequent reviewable commit. Preserve the tested implementation revision in baseline provenance.
- [ ] Document any runtime dependency changes retained through required deduplication and every equivalent-mutant decision. Attach concise verification results to the eventual PR or commit review.
- [ ] For rollback, revert the Stryker dependency and toolchain-specific count/baseline migration as a coherent set and run `npm.cmd ci`. Reverify smoke and complete profiles for the restored toolchain. Retain general test or security fixes only after checking their compatibility with the restored policy metadata.

## Completion checklist

- [ ] Both direct Stryker packages and their internal toolchain resolve to 10.1.1 through normal installation.
- [ ] The dependency diff is focused and the Scarf approval is removed.
- [ ] Lockfile changes invalidate captured mutation evidence.
- [ ] The reviewed v10 inventory matches both profiles' exact count and ownership checks.
- [ ] Every critical finding is killed or has a current exact-fingerprint equivalence proof.
- [ ] Fresh build, lint, backend, integration, reporting, and policy checks pass.
- [ ] Five smoke shards and five complete shards finish within their existing CI budgets, with successful canonical merges.
- [ ] The validated baseline CLI records the actual policy-green complete result while satisfying the previous score floor.
- [ ] The eventual commit review contains evidence links and a coherent rollback procedure.

## Upstream references

Stryker v10 introduces a Node 22 minimum and changes instrumentation through Babel 8 and additional mutations. The project already pins Node 24. [Stryker 10.0.0 release](https://github.com/stryker-mutator/stryker-js/releases/tag/v10.0.0)

Version 10.1.1 re-releases 10.1.0 after a release provenance issue. This plan targets the exact 10.1.1 release. [Stryker 10.1.1 release](https://github.com/stryker-mutator/stryker-js/releases/tag/v10.1.1)

Use the documented Stryker configuration semantics when preparing diagnostic configurations and mutation ranges. [Stryker configuration](https://stryker-mutator.io/docs/stryker-js/configuration/)
