# Task 02 Evidence
## Task

Build the fail-closed selective mutation policy parser test-first.

## Implementer model and reasoning

Requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task2_implementer`; substitution none.

## Reviewer model and reasoning

Requested and actual reviewer: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task2_reviewer`; substitution none. Initial verdict: **Needs fixes**. The historical initial verdict and every finding are preserved under `## Reviewer decision`.

## Base SHA

`0ce5c4cf735af2d3b596b582de2dfb627f408d36`

## Files changed

- `scripts/quality/mutation-policy.mjs`
- `test/quality/mutation-policy.test.mjs`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-02.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`

No selected production service, tracked Task 3 manifest/allowlist, mutation runner, Stryker configuration, Jest/ts-jest dependency, or independent quality gate was changed.

## RED command and exit

```powershell
node --test test/quality/mutation-policy.test.mjs
# exit 1
```

## RED evidence

The exact RED failed for the intended missing production module, not for test syntax or setup:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'E:\dev\workspaces\nestjs\book-library-nestjs\.worktrees\wave-c-plan5-selective-mutation\scripts\quality\mutation-policy.mjs'
code: 'ERR_MODULE_NOT_FOUND'
tests 1
pass 0
fail 1
duration_ms 69.5397
```

All specified Node tests existed before the production module. Their names state the production break caught, they exercise the real exports, and their SHA-256/fingerprint expectations are fixed hand-derived literals.

## GREEN command and exit

```powershell
node --test test/quality/mutation-policy.test.mjs
# exit 0
```

## GREEN evidence

Initial exact GREEN:

```text
tests 29
suites 0
pass 29
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 125.6309
```

Fresh post-format exact GREEN:

```text
tests 29
suites 0
pass 29
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 115.4278
TEST_EXIT=0
```

Focused non-mutating quality checks:

```powershell
npx --no-install eslint scripts/quality/mutation-policy.mjs test/quality/mutation-policy.test.mjs
# ESLINT_EXIT=0

npx --no-install prettier --check scripts/quality/mutation-policy.mjs test/quality/mutation-policy.test.mjs
# PRETTIER_EXIT=0
```

Prettier reported `All matched files use Prettier code style!`; neither focused check emitted an error or warning.

## Focused metrics

- `29/29` Node tests pass.
- The tests cover all required score, complete-baseline, smoke-baseline bypass, exact scope, source SHA, status, location/range, allowlist, exact fingerprint, first/last-line overlap, module-score, critical-finding, and raw-score semantics.
- The raw status-semantics fixture hand-checks `8` detected, `2` undetected, `1` ignored, and raw score `80`.
- The equivalent fixture remains raw score `80`; equivalents affect only critical disposition, never the score numerator or denominator.

## Full-suite commands and exits

No full-suite command is required for Task 2. The exact focused Node suite and non-mutating MJS checks are the scoped verification; existing independent coverage, changed-line, frontend, E2E, mutation-runtime, and survivor gates were not replaced or weakened.

## Runtime evidence

- Exact RED Node-reported duration: `69.5397 ms`.
- Initial exact GREEN Node-reported duration: `125.6309 ms`.
- Fresh post-format GREEN Node-reported duration: `115.4278 ms`.
- Every Task 2 command is below the `300000 ms` smoke ceiling. No Stryker mutation run was authorized in Task 2; the future complete ceiling remains `900000 ms`.

## Commit hash

`6bd0cef92d04963aeb44d93ef09b082f44958db4` (`test: enforce selective mutation policy`). The distinct evidence-only commit is intentionally not recorded here.

## Deferred findings

- Stryker's installed report schema includes `Pending`, but the binding policy score semantics does not classify it. The parser deliberately rejects `Pending` fail-closed, and a focused test protects that behavior.
- The tracked manifest, tracked allowlist, updater, baseline recorder, runner, and real Stryker probe remain deferred to their assigned later tasks.

## Reviewer decision

The controller dispatched the requested and actual fresh reviewer `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task2_reviewer`; substitution none. Initial verdict: **Needs fixes** with these findings and two plan conflicts requiring human rulings:

1. The tests and parser treated Mutation Testing Elements locations as zero-based and added `1` during overlap checks. Installed Stryker 9.6.1 declares one-based line and column positions, so an actual one-based survivor on the last inclusive manifest line could escape.
2. The brief simultaneously allowed `baseline: object | null` and demanded fail-closed baseline handling without stating whether complete runs before Task 6 must reject `null`.
3. Report locations were checked only for integer shape and ordering, not against their corresponding report source's line and column bounds.
4. The required zero-denominator score of `100` had no explicit empty/ignored-only characterization test.
5. The first/last-line overlap fixtures did not use actual emitted one-based coordinates or prove that a last-line survivor is rejected.
6. Reviewer identity, initial verdict, findings, and resulting human rulings were not backfilled in the report or progress ledger.

### Human conflict rulings

- Actual Stryker 9.6.1 one-based Mutation Testing Elements coordinates govern. The parser validates positive one-based line/column values, compares emitted lines directly with one-based inclusive manifest ranges, and fingerprints the emitted one-based coordinates without shifting them.
- `baseline: null` remains valid before Task 6 creates the first baseline. Any supplied baseline object is validated fail-closed for both profiles; only `complete` compares its raw score with the baseline, while `smoke` never compares scores.

### Fix Round 1 report (2026-08-09)

Files changed remain strictly Task 2-owned:

- `scripts/quality/mutation-policy.mjs`
- `test/quality/mutation-policy.test.mjs`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-02.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`

The one-based fingerprint literals were derived independently without the production helper:

```powershell
node -e "const c=require('node:crypto'); const sourceSha256='dfbb14b8cdf560c0ad5ed64ae0f0fae8793880c2abfcd38763c9c32be6f2d3cb'; for (const line of [2,4]) { const canonical={endColumn:6,endLine:line,mutatorName:'ConditionalExpression',replacement:'false',source:'src/auth/token-session.service.ts',sourceSha256,startColumn:1,startLine:line}; const json=JSON.stringify(canonical); console.log(json); console.log(c.createHash('sha256').update(json).digest('hex')); }"
# exit 0
```

```text
{"endColumn":6,"endLine":2,"mutatorName":"ConditionalExpression","replacement":"false","source":"src/auth/token-session.service.ts","sourceSha256":"dfbb14b8cdf560c0ad5ed64ae0f0fae8793880c2abfcd38763c9c32be6f2d3cb","startColumn":1,"startLine":2}
04b269fc86fb3776a2f2c4f930609336afd7098516f7925d61d7d1338a3e1a46
{"endColumn":6,"endLine":4,"mutatorName":"ConditionalExpression","replacement":"false","source":"src/auth/token-session.service.ts","sourceSha256":"dfbb14b8cdf560c0ad5ed64ae0f0fae8793880c2abfcd38763c9c32be6f2d3cb","startColumn":1,"startLine":4}
ace30be0d737116114d5e96e76c5f4d8f07cb395c9fc40b09c64b2b7574d2089
```

Fix Round 1 RED was established before policy edits:

```powershell
node --test test/quality/mutation-policy.test.mjs
# exit 1
```

```text
tests 32
pass 29
fail 3
duration_ms 124.2426
```

The three expected failures were: the one-based last-line survivor returned `passed: true`; the out-of-source line fixture raised no exception; and the out-of-source column survivor raised no exception.

After only the coordinate-contract correction, the focused coordinate/fingerprint tests were GREEN while the full suite retained only the two intended bounds REDs:

```powershell
node --test --test-name-pattern="canonical mutant identity|rejects a surviving mutant overlapping|rejects a no-coverage mutant overlapping" test/quality/mutation-policy.test.mjs
# exit 0; tests 3, pass 3, fail 0, duration_ms 103.3163

node --test test/quality/mutation-policy.test.mjs
# exit 1; tests 34, pass 32, fail 2, duration_ms 127.4508
```

After passing each report source into endpoint validation and enforcing one-based line and `line.length + 1` column bounds, the exact suite was GREEN:

```powershell
node --test test/quality/mutation-policy.test.mjs
# exit 0; tests 34, pass 34, fail 0, duration_ms 122.5309
```

Baseline and zero-denominator characterization required no production change:

```powershell
node --test --test-name-pattern="smoke score|baseline|raw score 100" test/quality/mutation-policy.test.mjs
# exit 0; tests 15, pass 15, fail 0, duration_ms 109.4555
```

This proves a malformed supplied smoke baseline is rejected, a valid higher smoke baseline is validated but not compared, `baseline: null` remains accepted before Task 6, and both empty and ignored-only reports return raw score `100`.

Fresh post-format verification:

```powershell
node --test test/quality/mutation-policy.test.mjs
# FINAL_TEST_EXIT=0; tests 34, pass 34, fail 0, duration_ms 137.4697

npx --no-install eslint scripts/quality/mutation-policy.mjs test/quality/mutation-policy.test.mjs
# FINAL_ESLINT_EXIT=0

npx --no-install prettier --check scripts/quality/mutation-policy.mjs test/quality/mutation-policy.test.mjs
# FINAL_PRETTIER_EXIT=0; All matched files use Prettier code style!
```

Two already-correct characterization assertions then named `baseline: null` acceptance for both profiles and ordered one-based ranges explicitly. They required no production change. Final exact verification after those assertions:

```powershell
node --test test/quality/mutation-policy.test.mjs
# FINAL_TEST_EXIT=0; tests 36, pass 36, fail 0, duration_ms 121.0224

npx --no-install eslint scripts/quality/mutation-policy.mjs test/quality/mutation-policy.test.mjs
# FINAL_ESLINT_EXIT=0

npx --no-install prettier --check scripts/quality/mutation-policy.mjs test/quality/mutation-policy.test.mjs
# FINAL_PRETTIER_EXIT=0; All matched files use Prettier code style!
```

Ownership and whitespace verification:

```powershell
$changed=@(git diff --name-only)
$allowed=@('.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md','.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-02.md','scripts/quality/mutation-policy.mjs','test/quality/mutation-policy.test.mjs')
$unexpected=@($changed | Where-Object { $_ -notin $allowed })
$production=@(git diff --name-only -- src/auth/token-session.service.ts src/auth/auth-identifier-repair.service.ts src/auth/auth-identifier-reconciliation.service.ts src/members/members.service.ts src/borrowings/borrowings.service.ts)
git diff --check
# CHANGED_FILE_COUNT=4
# UNEXPECTED_FILE_COUNT=0
# SELECTED_PRODUCTION_CHANGE_COUNT=0
# DIFF_CHECK_EXIT=0
```

Fix Round 1 addresses all six findings under the approved rulings. No selected production service, Task 3 manifest/allowlist/updater artifact, dependency version, runner, or independent gate changed. Fresh reviewer re-review remains pending controller dispatch.

**Final scoped review closeout (2026-08-09):** Reviewer identity `/root/plan5_task2_reviewer`; requested and actual reviewer fresh `gpt-5.6-sol`, high reasoning; substitution none. All six prior findings are **ADDRESSED** under the human-approved coordinate and baseline rulings; new Critical/Important findings: None. The independent re-review verified Fix Round 1 commit `8f53887419398d0c3c4a4393b805cbee0bda6cf7`, Node `36/36`, focused ESLint and Prettier exits `0`, and a clean scoped diff with no selected production-file change. Final Task 2 decision: **APPROVED**.
