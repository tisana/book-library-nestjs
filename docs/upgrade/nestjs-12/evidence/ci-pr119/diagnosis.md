# PR119 token-session mutation timeout: read-only diagnosis and bounded proofs

Date: 2026-10-03. Repository: /workspace/book-library-nestjs. No tracked source/config/test changes or commits were made by this diagnosis. All diagnostic code, generated reports, and producer sandboxes were confined to /tmp; existing repository artifacts were read only. Parent independently repaired the production-report prehook.

## Concrete cause

The actual CI artifact /workspace/attachments/7ce787a0-3ca7-47e2-b644-6e81da44b5a5/token-session-ci-failure.zip ends at147/211 tested,2Timeout,350021ms strict deadline. Its dry run ran98tests,121ms test bodies,3885ms overhead. This is dominated by repeatedly constructing Jest/Nest ESM module graphs, including suites whose test bodies are all skipped by Stryker's per-mutant pattern.

`jest --listTests --findRelatedTests src/auth/token-session.service.ts --runInBand --json` returns four actual import-related suites. Actual programmatic unmutated Jest execution confirms:

| Suite | Executed tests |
| --- | ---: |
| token-session.service.spec.ts |49|
| auth.service.spec.ts |34|
| auth.controller.spec.ts |11|
| auth-endpoint-throttle.guard.spec.ts |4|
| Total |98|

There is no duplicated token suite. Source import edges through AuthService/AuthController/AuthEndpointThrottleGuard explain the other49. The tests mock their TokenSession/AuthService dependencies. The retained full272-mutant token report has no `coveredBy` ID outside the token suite; this historical report is supporting evidence, not fresh full acceptance.

Installed @stryker-mutator/jest-runner9.6.1 `dist/src/jest-test-runner.js` mutantRun always calls runCLI with source findRelatedTests and testNamePattern. `dist/src/jest-test-adapters/jest-test-adapter.js` passes runInBand:true. Per-mutant testFilter IDs become a regex; they filter test bodies after each selected suite has imported its entire graph. The runner ignores the reloadEnvironment run option and invokes a new Jest CLI environment each mutant. Native Jest30.4.1 reloads Nest12's ESM graph through vm.SourceTextModule. Changing compiler/cache/diagnostics again has no demonstrated benefit and was not retried.

Jest's documented public `runner` configuration offers a supported interception point immediately before suite dispatch. Its TestRunner event API exposes actual test-file-success results, including fullName; the public constructor exposes globalConfig.testNamePattern. jest-circus constructs `new RegExp(pattern,'i')`, so the prototype uses the identical case-insensitive pattern semantics. No installed package was patched or version changed.

## Measured pattern equivalence

/tmp/ci-related-suite-proof.json contains complete executed [absolute file,fullName,status] IDs. Default runner token-only pattern still dispatched all four suites, with three pending-only suites;2141ms first control,2707ms repeat. Warm custom public runner dispatched just the matching token suite in457ms, retaining the identical one executed test. Unknown inventory first run dispatched all four suites. Unfiltered candidate still ran all98 tests in four suites, allPassed,3308ms versus baseline4291ms.

/tmp/ci-related-crosscaller-proof.json independently compares one exact actual test pattern from each import-related caller suite. All executed IDs/statuses match original:

| Selected actual suite | Original ms | Candidate ms |
| --- | ---: | ---: |
| AuthService |2942|850|
| AuthController |2205|801|
| AuthEndpointThrottleGuard |2653|910|

These prove generic suite filtering preserves a caller's executed IDs when its pattern is selected. They do not claim any token mutation is covered by those mock-based caller tests.

## Actual Stryker controls

Original /tmp/ci-related-mutants-control.json and prototype /tmp/ci-related-mutants-candidate.json both evaluate the exact five BlockStatement replacements in249–291 asKilled,zeroTimeout/RuntimeError, identical identities/location/replacement/coveredBy/killedBy IDs. Original elapsed25s versus preliminary in-memory prototype14s. This includes canonical249:70–291:4 `{}` whose earlier consumer-ownership fixture was already repaired. This diagnostic generates31mutants,26Ignored via diagnostic mutator exclusion,5evaluated; it is explicitly not mutation acceptance or a selection-policy proposal.

The safer baseline-only persisted prototype is /tmp/ci-baseline-suite-runner.cjs. It only publishes after successful unfiltered/unmutated all-suite execution with no pending/failed tests, writes a sibling scratch JSON atomically under the owned immutable sandbox, and verifies sandbox root, normalized Jest config, SHA256 of all four actual test files, and SHA256 of the instrumented token source before each filtered dispatch. It never learns from an active mutant. Missing/incomplete/corrupt/stale inventory dispatches all suites.

Initially hashing the entire normalized project config correctly caused conservative fallback: actual dry-run `testLocationInResults:true` versus mutant `false` differed. /tmp/ci-baseline-configs.jsonl records both workers' actual config/binding snapshots. This is the **only** normalized project config delta. Excluding only this reporting field fixes reuse; all remaining config fields/source/test hashes match. No general config relaxation is justified.

Strict bound prototype report /tmp/ci-related-mutants-baseline-bound-blocks.json again matches all five original mutant identities/statuses/coverage/killer IDs exactly, allKilled,zeroTimeout/RuntimeError. It finished11s, with98 unmutated dry-run tests and3834ms overhead. /tmp/ci-baseline-suite-dispatch.jsonl proves both workers independently read the same successful baseline: dry-run selects4/4; all five per-mutant dispatches select1/4. Cold second worker also reports `verified-baseline`.

The actual sole static token mutation in the retained272 report is top-level genericRefreshDenial StringLiteral at27. /tmp/ci-related-mutants-baseline-only-static.json performs this actual1-mutant control:Killed,98unmutated baseline tests,12s. Dispatch telemetry shows no pattern, all four suites retained for the active static mutant.

## Conservative cases and initialization errors

/tmp/ci-baseline-fallback-proof.json is a controlled public-runner API proof with a fake underlying executor, not a Jest producer. It demonstrates selection4/all-or2/all in its two-suite fixture for missing/corrupt/incomplete inventory, changed test/source SHA, changed normalized config, and static/noPattern. Active-mutant, pending-baseline and failed-baseline executions cannot publish inventory.

/tmp/ci-static-initializer-proof.json is an actual Jest producer on synthetic /tmp fixtures. Both fixtures import a module that throws only while the active-mutant environment variable is set. After a successful two-suite baseline, default and persisted-inventory candidate unfiltered/static executions each report the identical two initialization RuntimeErrors. The candidate does not mask static module initialization failure.

Actual AST inventory of the four relevant spec files finds imports/declarations/describe registration, with test hooks and application behavior inside callbacks. AuthService has conditional `describeIfImplemented` based on require('./auth.service'); this is why learning from mutated runs is unsafe and was rejected. Runtime token method mutations do not alter that module import/registration; module-declaration mutation must take the unfiltered/static path. The production design must retain that guard. A generic arbitrary future mutation source or dynamically registered test requires the same soundness review before enabling this optimization.

## Minimal implementation proposal for parent approval

1. Add a small public Jest runner under scripts/quality, selected only by the token-session mutation Jest config. Keep perTest coverage, exact source/mutation selectors, all89 rules, thresholds,211token/1366smoke/1744complete counts, default mutators and350000/900000ms deadlines unchanged. Mandatory ordinary typed Jest/production suites remain unchanged.
2. Publish inventory only from successful unmutated unfiltered complete related-suite baseline. Bind actual full discovered suite list, sandbox identity/root, all test-content SHAs, instrumented selected-source SHA, and normalized config excluding only the proven reporting-only testLocationInResults field. Atomic publication occurs under the owned ephemeral Stryker sandbox; no shared historical report/cache or tracked source file is used. Parent should replace the prototype's /tmp-only path guard with an explicit owned Stryker sandbox guard before production use.
3. Before runtime patterned dispatch, verify the complete inventory and match actual fullNames with the same case-insensitive regex Jest already uses. Unknown/invalid/stale data, no pattern, static declaration/import execution, and any unsupported case dispatch all original suites. Do not alter executed matching test bodies or suppress initialization errors for static mutants. Validate inventory string schemas rather than trusting parsed JSON.
4. Preserve safe fallback when persistence fails; scratch inventory optimization errors should not create acceptance errors or reduce tests. Hash-bind the new runner bytes with stryker.config.mjs in canonical configurationSha256 and runner/provenance fixtures; CI path scripts/quality/** already covers the code. A bare config path is insufficient provenance.
5. Add meaningful regression checks for cold worker reuse, exact executed IDs, static initialization RuntimeError preservation, all metadata-failure fallbacks, partial/failed/skipped/active-mutant baseline rejection, and canonical configuration hash changes when runner bytes change.
6. Next authorized bounded real producer should use the unchanged all-mutator238–291 range (37mutants in prior evidence:35Killed,2Timeout) on committed implementation, compare exact statuses and relevant test IDs with controls, and measure genuine improvement before retrying full211 token smoke. No diagnostic is a full accepted report. Remaining268conditional-true/277OptionalChaining timeout classification may stay unchanged because those fixture/source paths genuinely hang; it must not be presented as fixed without actual evidence.

The11s five-control result and ~0.45–0.9s selected-suite runs support this candidate. They do not establish the full211 mutation shard fits350000ms, nor repair the historical baseline source hash/provenance gap. That still requires actual coherent current complete and smoke producers under unchanged policies/budgets.
