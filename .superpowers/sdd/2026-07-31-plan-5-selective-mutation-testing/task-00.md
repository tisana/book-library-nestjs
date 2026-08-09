# Task 00 Evidence

## Task

Lock the reviewed Plan 3 integration base and establish the append-only Plan 5 evidence ledger. No production, specification, fixture, package, or mutation-tooling files were changed.

## Implementer model and reasoning

Requested and actual implementer: `gpt-5.6-terra`, medium reasoning. Required reviewer: fresh `gpt-5.6-sol`, high reasoning. Substitution: none. This identity record was made before substantive file creation.

## Reviewer model and reasoning

Requested and actual reviewer: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task0_reviewer`; substitution none. Initial verdict: Needs fixes.

## Base SHA

`b678209e23ef7020c21ff565327de1b229c835f6` on `codex/wave-c-plan5-selective-mutation`.

## Files changed

- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-00.md`

## RED command and exit

The prescribed dependency RED PowerShell command exited `1` at the expected `RED: missing-plan-5-progress-ledger` condition only.

## RED evidence

Before the expected missing-ledger check, the worktree was clean; `HEAD` resolved to the exact 40-character base SHA; the Plan 3 progress ledger existed; and all six required branch-pair records were present. No dependency failure occurred.

## GREEN command and exit

The prescribed ledger-existence/Base-SHA ancestry PowerShell command exited `0` after the ledger and this report were created.

## GREEN evidence

The ledger contains exactly one `Base SHA:` record. `git merge-base --is-ancestor` confirms that record is an ancestor of `HEAD`.

Fix Round 1 immutable relationship evidence:

- `git merge-base --is-ancestor 75d81b17ca826df4f8236fd153f89b155c1d9748 b678209e23ef7020c21ff565327de1b229c835f6` — exit `0`.
- `git merge-base --is-ancestor 912131507fb8bbf58ad9a674e9b00906d23022d8 b678209e23ef7020c21ff565327de1b229c835f6` — exit `0`.
- `git merge-base --is-ancestor 75d81b17ca826df4f8236fd153f89b155c1d9748 bb80f9b8e82a1f658acaaa479d01a021dfe7e79a` — exit `0`.
- `git merge-base --is-ancestor 912131507fb8bbf58ad9a674e9b00906d23022d8 bb80f9b8e82a1f658acaaa479d01a021dfe7e79a` — exit `0`.

## Focused metrics

All prescribed focused commands exited `0`; durations and verified Plan 3 branch pairs follow.

- `npx jest --runInBand auth/token-session.service.spec.ts --coverage --collectCoverageFrom=auth/token-session.service.ts --coverageReporters=text` — `6212 ms`; current focused coverage: statements `97.05%`, branches `86.40%`, functions `92.85%`, lines `97.74%`; Plan 3 pair `89/103`.
- `npx jest --runInBand auth/auth-identifier-repair.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-repair.service.ts --coverageReporters=text` — `6832 ms`; current focused coverage: statements `98.23%`, branches `93.63%`, functions `100%`, lines `98.12%`; Plan 3 pair `103/110`.
- `npx jest --runInBand auth/auth-identifier-reconciliation.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-reconciliation.service.ts --coverageReporters=text` — `6660 ms`; current focused coverage: statements `97.80%`, branches `94.76%`, functions `100%`, lines `97.78%`; Plan 3 pair `181/191`.
- `npx jest --runInBand members/members.service.spec.ts --coverage --collectCoverageFrom=members/members.service.ts --coverageReporters=text` — `9001 ms`; current focused coverage: statements `98.70%`, branches `87.23%`, functions `100%`, lines `98.63%`; Plan 3 pair `164/188`.
- `npx jest --runInBand borrowings/borrowings.service.spec.ts --coverage --collectCoverageFrom=borrowings/borrowings.service.ts --coverageReporters=text` — `6442 ms`; current focused coverage: statements `95.03%`, branches `90.51%`, functions `100%`, lines `94.92%`; Plan 3 pair `105/116`.

The preserved Plan 3 full-source permission monitor is `71/74`; its focused-only command measures `69/74` and remains outside this mutation boundary.

## Full-suite commands and exits

No Task 0 full-suite command was required or run. Verified inherited Plan 3 Task 10 evidence records exit `0` for quality reporting (`68/68`), full backend unit coverage (`469/469`), backend E2E (`242/242`), backend coverage reporting (`87` files), changed-line reporting (`not-applicable`, `0/0`, passed), non-fixing ESLint, build, and diff check.

## Runtime evidence

Focused-command durations total `35147 ms`; each is below the `300000 ms` PR-smoke limit. Verified inherited Plan 3 producer runtime was approximately `72 s`. Scheduled/manual Stryker mutation execution has not begun; its `900000 ms` Ubuntu 24.04/Node 22 limit is retained as a mandatory future gate.

## Commit hash

`b231461ef15ca7336e29cfed7c74883507066234` (`docs: lock selective mutation testing baseline`). The distinct evidence-only commit is intentionally not recorded here.

## Deferred findings

Plan 3's parked non-load-bearing Minor remains visible: aggregate assertions accept any string rather than the exact replacement/original identifiers. No Task 0 change addresses it.

## Reviewer decision

Initial fresh review by `/root/plan5_task0_reviewer` (`gpt-5.6-sol`, high; substitution none): Needs fixes, preserving Critical ledger-schema and Important ancestry-evidence findings. Implementer self-review: dependency relationship, selected-path byte identity, fixture export inventory, coverage-summary SHA-256, ownership boundary, commands, and report headings are all recorded; no Task 1+ work began.

**Fix Round 1 report (2026-08-09):** Addressed the Critical binding-ledger contract finding by correcting `progress.md` to exact title `# Plan 5 Progress` and all mandatory sections: `## Dependency evidence`, `## Model dispatch ledger`, `## Task status`, `## Mutation score history`, `## Critical-rule decisions`, `## Runtime history`, and `## Integration status`. Addressed the Important immutable-relationship finding with these fresh commands and output: `git merge-base --is-ancestor 75d81b17ca826df4f8236fd153f89b155c1d9748 b678209e23ef7020c21ff565327de1b229c835f6` exit `0`; `git merge-base --is-ancestor 912131507fb8bbf58ad9a674e9b00906d23022d8 b678209e23ef7020c21ff565327de1b229c835f6` exit `0`; `git merge-base --is-ancestor 75d81b17ca826df4f8236fd153f89b155c1d9748 bb80f9b8e82a1f658acaaa479d01a021dfe7e79a` exit `0`; `git merge-base --is-ancestor 912131507fb8bbf58ad9a674e9b00906d23022d8 bb80f9b8e82a1f658acaaa479d01a021dfe7e79a` exit `0`. Covering Task 0 GREEN and schema-validation command results will be appended after execution. No Jest suite rerun is required for this docs-only correction.

Covering validation command: `$progressPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md'; $taskPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-00.md'; if (-not (Test-Path $progressPath)) { throw 'Missing progress ledger.' }; if (-not (Test-Path $taskPath)) { throw 'Missing Task 00 report.' }; $baseShaMatch = Select-String -LiteralPath $progressPath -Pattern '^Base SHA: ([0-9a-f]{40})$'; if ($baseShaMatch.Matches.Count -ne 1) { throw 'Invalid Base SHA record.' }; git merge-base --is-ancestor $baseShaMatch.Matches[0].Groups[1].Value HEAD`. Exit `0`; relevant output: `TASK0_GREEN_EXIT=0`.

Focused schema-validation command: `$progressPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md'; $requiredTitle = '# Plan 5 Progress'; $requiredSections = @('## Dependency evidence','## Model dispatch ledger','## Task status','## Mutation score history','## Critical-rule decisions','## Runtime history','## Integration status'); $lines = Get-Content -LiteralPath $progressPath; if ($lines[0] -cne $requiredTitle) { throw "invalid-ledger-title: $($lines[0])" }; $baseMatches = @(Select-String -LiteralPath $progressPath -Pattern '^Base SHA: ([0-9a-f]{40})$').Matches; if ($baseMatches.Count -ne 1) { throw "invalid-base-sha-count: $($baseMatches.Count)" }; foreach ($section in $requiredSections) { if (@($lines | Where-Object { $_ -ceq $section }).Count -ne 1) { throw "invalid-required-section: $section" } }`. Exit `0`; relevant output: `SCHEMA_TITLE=# Plan 5 Progress`, `SCHEMA_BASE_SHA_COUNT=1`, `SCHEMA_REQUIRED_SECTIONS=7`, `TASK0_SCHEMA_EXIT=0`.

**Fix Round 2 report (2026-08-09):** Addresses the remaining schema-order finding by placing the exact Base SHA immediately after the title and its required blank line, followed immediately by `## Dependency evidence`; all subsequent mandatory sections remain in binding order. No Jest suite rerun is required for this docs-only correction.

Covering Task 0 GREEN command: `$progressPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md'; $taskPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-00.md'; if (-not (Test-Path $progressPath)) { throw 'Missing progress ledger.' }; if (-not (Test-Path $taskPath)) { throw 'Missing Task 00 report.' }; $baseShaMatch = Select-String -LiteralPath $progressPath -Pattern '^Base SHA: ([0-9a-f]{40})$'; if ($baseShaMatch.Matches.Count -ne 1) { throw 'Invalid Base SHA record.' }; git merge-base --is-ancestor $baseShaMatch.Matches[0].Groups[1].Value HEAD`. Exit `0`; relevant output: `TASK0_GREEN_EXIT=0`.

Strengthened positional schema-validation command: `$progressPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md'; $requiredPrefix = @('# Plan 5 Progress', '', 'Base SHA: b678209e23ef7020c21ff565327de1b229c835f6', '', '## Dependency evidence'); $requiredSections = @('## Dependency evidence','## Model dispatch ledger','## Task status','## Mutation score history','## Critical-rule decisions','## Runtime history','## Integration status'); $lines = @(Get-Content -LiteralPath $progressPath); for ($index = 0; $index -lt $requiredPrefix.Count; $index++) { if ($lines[$index] -cne $requiredPrefix[$index]) { throw "invalid-prefix-position-${index}: $($lines[$index])" } }; $baseMatches = @(Select-String -LiteralPath $progressPath -Pattern '^Base SHA: ([0-9a-f]{40})$').Matches; if ($baseMatches.Count -ne 1) { throw "invalid-base-sha-count: $($baseMatches.Count)" }; $priorIndex = -1; foreach ($section in $requiredSections) { $positions = @($lines | ForEach-Object -Begin { $i = 0 } -Process { $result = if ($_ -ceq $section) { $i } else { $null }; $i++; $result } | Where-Object { $null -ne $_ }); if ($positions.Count -ne 1) { throw "invalid-required-section-count: $section" }; if ($positions[0] -le $priorIndex) { throw "invalid-required-section-order: $section" }; $priorIndex = $positions[0] }`. Exit `0`; relevant output: `SCHEMA_PREFIX_LINES=5`, `SCHEMA_BASE_SHA_COUNT=1`, `SCHEMA_SECTION_ORDER=## Dependency evidence > ## Model dispatch ledger > ## Task status > ## Mutation score history > ## Critical-rule decisions > ## Runtime history > ## Integration status`, `TASK0_SCHEMA_ORDER_EXIT=0`.
