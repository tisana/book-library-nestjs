# Task 00 Evidence

## Task

Lock the reviewed Plan 3 integration base and establish the append-only Plan 5 evidence ledger. No production, specification, fixture, package, or mutation-tooling files were changed.

## Implementer model and reasoning

Requested and actual implementer: `gpt-5.6-terra`, medium reasoning. Required reviewer: fresh `gpt-5.6-sol`, high reasoning. Substitution: none. This identity record was made before substantive file creation.

## Reviewer model and reasoning

Pending controller dispatch of the required fresh `gpt-5.6-sol`, high-reasoning reviewer.

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

Pending required fresh reviewer. Implementer self-review: dependency relationship, selected-path byte identity, fixture export inventory, coverage-summary SHA-256, ownership boundary, commands, and report headings are all recorded; no Task 1+ work began.
