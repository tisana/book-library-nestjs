# Task 08 Evidence

## Task

Plan 5 Task 8 — prove the binding `ubuntu-24.04`/Node 22 reference-runner
budgets for both distributed mutation profiles, preserve every failed or stopped
attempt, run all existing integration gates as independent metric streams, and
remove the temporary default-branch workflow registration after the reference
artifacts were secured.

The accepted feature boundary is exact local and remote commit
`bd056baa996160c17bac45dee8a68fc303030b5b`. Task 9 was not started.

**Acceptance targets:** smoke maximum at most `350000 ms`; complete maximum at
most `900000 ms`; complete raw score at least `70.00` and at least the
`95.2518818760857` baseline; exactly five selected production sources; zero
unapproved critical findings; JSON, HTML, summary, duration, and log evidence
downloadable; all coverage, changed-line, backend E2E, frontend unit, and
Playwright gates remain separate and green.

**Stop rules:** stop and preserve evidence for any missing artifact, timeout,
scope/provenance/source drift, raw-score or baseline regression, unapproved
critical survivor/no-coverage mutant, or existing independent-gate regression.
Never recover by dropping a source/rule/mutator/reporter, raising a budget,
weakening an assertion, skipping/retrying a gate to obtain a favorable result,
or approving an unproved equivalent.

## Implementer model and reasoning

- Requested throughout Task 8: `gpt-5.6-sol`, high reasoning.
- Actual implementation/evidence agent through the reference, amendment,
  integration-gate, and cleanup checkpoints: `/root/plan5_task8_implementer`,
  `gpt-5.6-sol`, high reasoning.
- Actual acceptance-evidence continuation after the prior agent's usage-limit
  stop: fresh `/root/plan5_task8_evidence_continuation`, `gpt-5.6-sol`, high
  reasoning.
- Substitution: none. The usage-limit recovery retained the exact requested
  model and reasoning.

## Reviewer model and reasoning

- Final Task 8 reviewer: fresh `/root/plan5_task8_final_reviewer`, requested
  and actual `gpt-5.6-sol`, high reasoning; substitution none; separate from
  every Task 8 implementer; verdict `APPROVED`, Critical `0`, Important `0`,
  Minor `0`.
- Temporary-registration bootstrap reviewer: fresh
  `/root/plan5_task8_bootstrap_reviewer`, requested and actual `gpt-5.6-sol`,
  high reasoning; substitution none; verdict `APPROVED`, Critical `0`,
  Important `0`, Minor `0`.
- Reference-failure correction reviewer: fresh
  `/root/plan5_task8_fix_reviewer`, requested and actual `gpt-5.6-sol`, high
  reasoning; substitution none; verdict `APPROVED`, Critical `0`, Important
  `0`, Minor `0`.
- E2E stop-diagnosis reviewer: fresh
  `/root/plan5_task8_e2e_stop_reviewer`, requested and actual `gpt-5.6-sol`,
  high reasoning; substitution none; diagnosis/recommendation `APPROVED`,
  Critical `0`, Important `0`, Minor `0`. Task 8 itself remained stopped.
- Human-approved E2E lifecycle amendment reviewer: fresh
  `/root/plan5_task8_e2e_amendment_reviewer`, requested and actual
  `gpt-5.6-sol`, high reasoning; substitution none; amendment-only verdict
  `APPROVED`, Critical `0`, Important `0`, Minor `0`.
- Temporary-registration cleanup reviewer: fresh
  `/root/plan5_task8_cleanup_reviewer`, requested and actual `gpt-5.6-sol`,
  high reasoning; substitution none; verdict `APPROVED`, Critical `0`,
  Important `0`, Minor `0`.

## Base SHA

- Plan 5 Base SHA: `b678209e23ef7020c21ff565327de1b229c835f6`.
- The append-only ledger contains exactly one line matching
  `^Base SHA: ([0-9a-f]{40})$`; the value above is an ancestor of final HEAD.
- Task 8 starting HEAD after approved Task 7:
  `f5153a5be2d09cdf9d489ade6b866e30b2236a1d`.
- Reference-runner correction commit:
  `19fc1fd0e10a285dabecd0e5bb07c24b4a3842c1`, parent
  `f5153a5be2d09cdf9d489ade6b866e30b2236a1d`.
- Final accepted feature/local/remote SHA:
  `bd056baa996160c17bac45dee8a68fc303030b5b`, parent
  `19fc1fd0e10a285dabecd0e5bb07c24b4a3842c1`.
- `origin/codex/wave-c-plan5-selective-mutation` equals exact final HEAD.
- Current `origin/master` is cleanup squash merge
  `95be0de590b573b4d0a336a09d7afd9e864d0a37` and does not contain
  `.github/workflows/mutation.yml`.
- Base-to-final-feature-HEAD changes exactly `33` tracked paths before this new
  Task 8 report; after the documentation-only evidence commit the exact
  Base-to-HEAD path count is `34`, with this report as the only new path.

The five selected production sources are byte-unchanged from the Plan 5 Base
SHA through final feature HEAD:

- `src/auth/token-session.service.ts`
- `src/auth/auth-identifier-repair.service.ts`
- `src/auth/auth-identifier-reconciliation.service.ts`
- `src/members/members.service.ts`
- `src/borrowings/borrowings.service.ts`

## Files changed

Task 8 implementation before this evidence-only closeout:

- `scripts/quality/mutation-policy.mjs`
- `scripts/quality/update-critical-rule-manifest.mjs`
- `stryker.config.mjs`
- `test/quality/mutation-policy.test.mjs`
- `test/quality/mutation-runner.test.mjs`
- `test/auth.e2e-spec.ts`

Commit `19fc1fd0e10a285dabecd0e5bb07c24b4a3842c1` owns only the five
reference-runner correction paths. Commit
`bd056baa996160c17bac45dee8a68fc303030b5b` owns only
`test/auth.e2e-spec.ts`, with one insertion and one deletion. No production
source, package manifest/lockfile, dependency, timeout, threshold, critical
rule, equivalent decision, selected scope, mutator set, reporter, existing
quality workflow, frontend source, or other E2E test changed.

This acceptance-evidence closeout changes and stages only:

- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-08.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`

All generated mutation/reference/integration evidence remains ignored and is
not staged.

## RED command and exit

The append-only failure and stop history is retained; none of these events is
reported as green:

1. The first authorized `gh workflow run mutation.yml` attempt at
   `f5153a5...` returned HTTP `404` because GitHub required the workflow name
   to be registered on default branch `master`. No Action run existed and the
   complete dispatch was not attempted.
2. After reviewed bootstrap PR `#98` registered the dispatch-only stub, smoke
   run `32564466412` and complete run `32564473686` both concluded `failure`
   at exact `f5153a5...`. Smoke members timed out at
   `350122.718521/350000 ms` with `timedOut: true`, Stryker exit `null`,
   artifact/policy exits `1/1`; the aggregate failed closed. Complete's five
   shards completed, but the aggregate rejected CRLF-derived manifest hashes
   against canonical LF GitHub source bytes. Both failed-run logs and
   artifacts remain preserved under their run-id-specific diagnostic roots.
3. Reference-correction TDD preserved a members-config RED at temporary
   provenance `d3a0d8c1...`: exit nonzero in `6661.183534 ms`, Stryker/
   artifact/policy `1/1/1`. It then passed at `72dd1658...` in
   `133573.230316/350000 ms`, with all exits zero and exact `204` mutants.
4. Step 3 at reviewed `19fc1fd...` stopped on command 5:
   `npm run test:e2e:report` exited `1`, with `28/29` suites and `241/242`
   tests. The failing concurrent cross-instance throttle case raised
   `ECONNRESET`. Later gates were not run. The preserved 260-file manifest is
   `acf8227158180ae9494a9d567cd865827650ab17a4aa93aed8491a98b52eae46`.
5. The approved diagnosis reproduced the unbound shared-server lifecycle race
   `14/20` versus explicit-listening control `0/20`; the independent reviewer
   reproduced `18/20` versus `0/20`. A no-change favorable rerun was expressly
   prohibited.
6. At final `bd056baa...`, Step 3 attempts stopped without being called green:
   the first invocation failed in the outer PowerShell parser before command
   2 launched; the restart passed commands 1-5 then its Bash Base-SHA selector
   mishandled CRLF; attempt 3 passed commands 1-6 then command 7's nested
   JavaScript quoting failed before evaluation; attempt 4 passed commands 1-15
   then Playwright found no lockfile-pinned Chromium build `1223`, producing
   `0` expected and `87` environment failures before browser launch.

## RED evidence

- Initial failed reference runs:
  `reports/mutation/diagnostics/task8-reference-smoke-run-32564466412/` and
  `reports/mutation/diagnostics/task8-reference-complete-run-32564473686/`.
- Reference-correction focused evidence:
  `reports/mutation/diagnostics/task8-fix-members-config-red-d3a0d8c1/` and
  `reports/mutation/diagnostics/task8-fix-members-smoke-green-72dd1658/`.
- Stopped E2E producer and reviewed causal evidence:
  `reports/mutation/diagnostics/task8-step3-independent-gates-19fc1fd0/`.
- Human-approved E2E amendment brief, implementation report, review package,
  and 31-file evidence manifest:
  `reports/mutation/diagnostics/task8-e2e-amendment/`; manifest SHA-256
  `1775b64f4a56ec7d5b03a0a01fada472750cce94a1fdf972c9c7c5216138b787`.
- Stopped corrected-SHA Step 3 attempts remain in separate directories:
  `task8-step3-independent-gates-bd056baa/`,
  `task8-step3-independent-gates-bd056baa-restart-20260828/`,
  `task8-step3-independent-gates-bd056baa-attempt3-20260828/`, and
  `task8-step3-independent-gates-bd056baa-attempt4-20260828/`.
- The CRLF-selector restart manifest is
  `2b08fc5e8f0234abdd5ec6e048def35eff1ce0206cb98ffbd421a2d632990f35`;
  attempt 3 is
  `ca2e97f61561cc17bf398be67e70ead5991af9ad3ec5b8553d578d2817497b83`;
  attempt 4 is
  `0e19243f627c7a492d8dc2ec5d8f96c0013f368db46fc1990ef8cba7aeccdba8`.

## GREEN command and exit

Reference-runner GREEN at exact `bd056baa...`:

- `Selective mutation` manual `smoke`, run
  `https://github.com/tisana/book-library-nestjs/actions/runs/32990160510`:
  workflow result `success`; all five shard jobs and aggregate job succeeded.
- `Selective mutation` manual `complete`, run
  `https://github.com/tisana/book-library-nestjs/actions/runs/32990164438`:
  workflow result `success`; all five shard jobs and aggregate job succeeded.

Human-approved E2E amendment GREEN:

- Focused concurrent throttle case: `20/20` fresh-process passes.
- Full `test/auth.e2e-spec.ts`: `12/12` twice.
- Authoritative `npm run test:e2e:report`: `242/242` twice.
- Amendment commit `bd056baa...` was independently approved before push and
  corrected-SHA reference dispatch.

Final Step 3 attempt 5:

- All `19/19` documented commands ran in exact order and exited `0` from a
  clean WSL Node `v22.22.2` snapshot at exact `bd056baa...`.
- The lockfile-installed Playwright `1.60.0` CLI first restored only Chromium/
  headless-shell build `1223` and bundled FFmpeg; it did not change tracked
  files, dependencies, or system packages.

## GREEN evidence

- Corrected-SHA smoke evidence:
  `reports/mutation/diagnostics/task8-corrected-reference-smoke-run-32990160510/`.
- Corrected-SHA complete and combined validation evidence:
  `reports/mutation/diagnostics/task8-corrected-reference-complete-run-32990164438/`.
- Step 3 final evidence:
  `reports/mutation/diagnostics/task8-step3-independent-gates-bd056baa-attempt5-20260828/`.
- Playwright prerequisite evidence:
  `reports/mutation/diagnostics/task8-step3-playwright-prerequisite-20260828/`.
- The accepted Step 3 evidence manifest covers `475` files and has SHA-256
  `320926b9dc91d279fde6330425e9d0bac0ee66c38a755277949612f3e5bc6814`.
- The prerequisite manifest has SHA-256
  `22fbe339d48037a415242f2b1c749967603f204ad34a5398ed10b7364c70c4a7`.

## Focused metrics

Mutation remains separate from every coverage and E2E stream.

- Smoke: exact `1366` canonical mutants; detected/undetected/ignored
  `1363/3/0`; raw score `99.78038067349927`; maximum shard
  `210293.28842/350000 ms`; policy PASS; zero violations; zero unapproved
  critical findings.
- Complete: exact `1727` canonical mutants; detected/undetected/ignored
  `1647/80/0`; raw score `95.36768963520556`; baseline
  `95.2518818760857`; delta `+0.11580775911986052` percentage points; maximum
  shard `503470.711527/900000 ms`; policy PASS; zero violations; zero
  unapproved critical findings.
- Both profiles contain exactly the five selected sources. Every shard has
  `timedOut: false` and Stryker/policy/artifact exits `0/0/0`.
- Both profiles report exactly three independently reviewed, unexpired
  equivalents; equivalents do not improve the raw score:
  - `token-interrupted-cas-finalization`, fingerprint
    `0108d029ef22842e4c8a00d900136b2dbc483f0013d796483b852f024a550cc5`,
    reviewed `2026-08-12`, expires `2026-11-10`.
  - `repair-batch-identity-and-checkpoint`, fingerprint
    `c010a2ec5f4bb9177df61f0bc8326b2d04d2463a59bf5dd2337b840dedc2f36e`,
    reviewed `2026-08-12`, expires `2026-11-10`.
  - `reconciliation-secret-decoding`, fingerprint
    `b4a9385a539d4b16ca74d4f3f5c70adb2775a73e50a66a80aa1acf17e30bd51a`,
    reviewed `2026-08-16`, expires `2026-11-14`.

Independent existing gates:

- Backend unit coverage: `559/559`, `35/35` suites; statements
  `2979/3659 = 81.41%`, branches `2141/2815 = 76.05%`, functions
  `492/605 = 81.32%`, lines `2860/3496 = 81.80%`.
- Backend E2E: `242/242`, `29/29` suites; clean and eventual pass rates 100%.
- Backend changed-line: independently not-applicable `0/0`, policy green.
- Frontend unit coverage: `182/182`, `42` test files; statements
  `882/1034 = 85.29%`, branches `601/729 = 82.44%`, functions
  `361/443 = 81.48%`, lines `848/988 = 85.82%`.
- Frontend changed-line: independently not-applicable `0/0`, policy green.
- Frontend Playwright E2E: `87/87`, with `0` failed, `0` flaky, `0` skipped;
  desktop/tablet/mobile each `29/29`; clean and eventual pass rates 100%.

## Full-suite commands and exits

Final Step 3 attempt 5 ran these commands/gates in the documented order; all
exited `0`:

1. `npm run test:quality-reporting` — `68/68`, `4/4` suites.
2. `npx eslint "{src,apps,libs,test}/**/*.ts"` — non-mutating ESLint.
3. `npm run build`.
4. `npm run test:cov` — backend unit `559/559`.
5. `npm run test:e2e:report` — backend E2E `242/242`.
6. Exact one-match `^Base SHA: [0-9a-f]{40}$` selection after stripping only
   terminal CR, followed by
   `git diff --unified=0 "$plan5BaseSha...HEAD" -- src test` into
   `test-results/pull-request.diff`.
7. `node "$DIAGNOSTICS/critical-branch-assertion.cjs"` — the plan's exact
   assertion through the approved ignored helper; all six exact totals/minima
   passed.
8. `npm run quality:report:backend -- --producer-outcome backend-unit=success --producer-outcome backend-e2e=success --changed-line-diff test-results/pull-request.diff --changed-line-lcov coverage/backend-unit/lcov.info`.
9. The same backend command with `--check-only` immediately after the script
   name.
10. `npm --prefix frontend run lint`.
11. `npm --prefix frontend run build`.
12. `npm --prefix frontend run test:coverage` — `182/182`.
13. `git diff --unified=0 "$plan5BaseSha...HEAD" -- frontend/src` into
    `frontend/test-results/pull-request.diff` — empty diff.
14. `npm run quality:report:frontend-unit -- --producer-outcome frontend-lint=success --producer-outcome frontend-unit=success --changed-line-diff frontend/test-results/pull-request.diff --changed-line-lcov frontend/coverage/lcov.info`.
15. The same frontend-unit command with `--check-only` immediately after the
    script name.
16. `npm --prefix frontend run test:e2e:report` — `87/87`.
17. `npm run quality:report:frontend-e2e -- --producer-outcome frontend-playwright=success`.
18. `npm run quality:report:frontend-e2e -- --check-only --producer-outcome frontend-playwright=success`.
19. `git diff --check "$plan5BaseSha...HEAD"`.

The exact per-command exit/duration table is preserved at
`reports/mutation/diagnostics/task8-step3-independent-gates-bd056baa-attempt5-20260828/command-status.tsv`.

## Runtime evidence

Reference runner for all twelve jobs: runner application `2.336.0`,
`ubuntu-24.04`, project Node `v22.23.2`, npm `10.9.8`. GitHub allocated image
revisions `20260816.277.1` and `20260823.283.1`; provenance, configuration,
source hashes, schema, and policy were identical across them.

Binding shard durations in milliseconds:

| Profile  |      token-session | identifier-repair | identifier-reconciliation |       members |   borrowings |      Budget |
| -------- | -----------------: | ----------------: | ------------------------: | ------------: | -----------: | ----------: |
| smoke    |       210293.28842 |     145850.623162 |             181830.640373 | 142894.021056 | 53710.496114 | 350000 each |
| complete | 157916.70849299998 |     120131.696297 |        205518.26362200003 | 503470.711527 | 84523.158408 | 900000 each |

The smoke and complete evidence directories each contain six downloaded
artifacts and a verified 57-entry checksum manifest:

- Smoke manifest SHA-256:
  `c062a6d4c47b21780b820553d0c9209e8c1a0af1c54538180e7e58b56ab9c6b5`.
- Complete manifest SHA-256:
  `8951395c8a6a3b5f9f367ab3d0ba22b7497bf90d0d0f18a1265ff81642c462fc`.
- Smoke aggregate JSON/HTML/summary JSON/summary Markdown SHA-256:
  `20298a8b5af3bbc0dd45ae25eb17a4ff378215173e1ae22356b5c02266e48c82`,
  `a50dc832f0f127535fd8500272aacc7670258831f63a4ae05b31598ad7b8988f`,
  `e620027413ee96bb20e69e7793989082dcfa3b688960b3b675b60459154d13dc`,
  `c61ac64595d6acd72a6bc8629df927835fbce90719af3d784c48b48d88e6d516`.
- Complete aggregate JSON/HTML/summary JSON/summary Markdown SHA-256:
  `9352481b52767ea31edfeaf61cf56be4210de28eada9c23f08f1feb7a238910f`,
  `737b1846c97af6b6dd846d8888e82283bbb736b0c6a961b71289e5d8c76ca5c4`,
  `b22ec279a818bab1b388abe63b8da4d37da696b485eb06b4b4720d951a3296ab`,
  `8000bc1dcef9f52fdf17c3d41dbcca10711cf6d4d210b1318691881e495f28b1`.

Temporary registration lifecycle:

- Bootstrap PR `#98`: `https://github.com/tisana/book-library-nestjs/pull/98`;
  squash merge `ba54f6d69c07ec51191ddf5f39942a26c4f30265`, parent
  `25449419081548e6f8bb437bd7cdf6f47f194c19`, adding only the 24-line
  dispatch-only `.github/workflows/mutation.yml` stub.
- Reviewed cleanup commit:
  `8a4bad4d7bca08c3f627880ee3dcb1bc74036384`, parent
  `63ccbbcf5131859d53833c5e3db8501d18e657f4`, deleting only that 24-line
  stub; cleanup review `APPROVED`, Critical/Important/Minor `0/0/0`.
- Cleanup PR `#99`: `https://github.com/tisana/book-library-nestjs/pull/99`;
  checks `Unit Tests`, `CodeQL Analysis`, `Build & Upload Artifact`, and
  `CodeQL` passed; squash merge
  `95be0de590b573b4d0a336a09d7afd9e864d0a37`, exact reviewed tree and sole
  parent `63ccbbcf5131859d53833c5e3db8501d18e657f4`.
- Fresh `origin/master` does not contain `.github/workflows/mutation.yml`;
  remote feature SHA remains exact `bd056baa...`.

## Commit hash

- Reference-runner correction implementation:
  `19fc1fd0e10a285dabecd0e5bb07c24b4a3842c1` (`fix: stabilize selective
mutation reference runs`).
- Human-approved E2E lifecycle amendment implementation and final accepted
  feature boundary: `bd056baa996160c17bac45dee8a68fc303030b5b`
  (`test: stabilize auth throttle e2e lifecycle`).
- Temporary default-branch cleanup implementation:
  `8a4bad4d7bca08c3f627880ee3dcb1bc74036384` (`chore(ci): remove mutation
bootstrap workflow`); reviewed tree squash-merged as `95be0de...`.

The Task 8 evidence-only commit uses exact subject
`docs: record mutation acceptance evidence` and is intentionally not written
into its own report, preserving the plan's non-self-referential evidence
protocol.

## Deferred findings

- Fresh independent final Task 8 review approved immutable evidence commit
  `fdc7f15fccfa457560358beadbfd8601ed6d50d1` with Critical `0`, Important
  `0`, Minor `0`. Task 8 has no open review findings and is closed.
- Task 9 was not started by this review closeout.
- GitHub emitted a non-blocking notice that JavaScript Actions targeting Node
  20 were forced onto the Actions runtime's Node 24. Project processes and all
  mutation artifacts still record the required Node `v22.23.2`.
- No acceptance target or stop rule was weakened: exact five-source scope,
  exact `350000`/`900000 ms` budgets, mutation score floor and upward-only
  baseline, critical-rule/equivalent policy, existing coverage/changed-line/
  E2E gates, and no-production-edit boundary all remain intact.

## Reviewer decision

Final Task 8 reviewer decision: **APPROVED**, Critical `0`, Important `0`,
Minor `0`.

Fresh `/root/plan5_task8_final_reviewer`, requested and actual
`gpt-5.6-sol`, high reasoning, substitution none, independently reviewed
immutable evidence commit `fdc7f15fccfa457560358beadbfd8601ed6d50d1`.
The reviewer confirmed exact scope and selected-source integrity; recalculated
both accepted mutation profiles and their thresholds; verified every smoke,
complete, Step 3, E2E-amendment, and Playwright-prerequisite manifest entry;
confirmed all Step 3 commands `19/19` with separate metric streams and every
preserved failure classification; checked live refs, runs, artifacts, and the
PR `#98`/`#99` registration lifecycle; and passed manifest `89`, mutation
policy/runner `101` with one intentional POSIX skip, scoped ESLint, and diff
checks. The reviewer found the corrections minimal and maintainable with no
gate weakening.

Implementer self-review of this acceptance-evidence closeout: Critical `0`,
Important `0`, Minor `0`. Task 8 is closed; Task 9 was not started by this
review closeout.
