# SDD ledger — plan: docs/superpowers/plans/2026-07-31-mobile-playwright-skip-elimination.md

## Base

- Working base SHA: `05a426ec944d8305edc621b12497d89a5f20457b`.
- Approved design SHA `d057d6efc40f55ed871e9fb407246e9f4f87d880` is an ancestor of the working base.
- Predecessor merge SHA: not-applicable (Wave A has no predecessor merge).

## Scope

- Plan 4 owns the mobile Playwright skip elimination while preserving all three configured projects, the 2,000 ms performance-risk budget, fixture scale, reporter/parser contract, retry setting, coverage baseline, and metric separation.
- Task 1 changes tracked evidence only. The one allowed behavior change for a later task is executing the staff seeded-scale test on mobile under unchanged 2,000 ms risk semantics.

## Task reports

- [Task 1 — baseline and deterministic readiness](task-01.md)
- [Task 2 — seeded-scale mobile performance contract](task-02.md) (pending)
- [Task 3 — repetition gate and report/parser proof](task-03.md) (pending)
- [Task 4 — repository verification and Plan 1 merge contract](task-04.md) (pending)

## Model substitutions

- None. Requested and actual implementer: `gpt-5.6-terra`, medium reasoning. Requested and actual reviewer: fresh `gpt-5.6-terra`, high reasoning.

## Baseline

- Clean initial status; working base `05a426ec944d8305edc621b12497d89a5f20457b`; predecessor merge not-applicable; approved design commit is an ancestor.
- Full baseline: 86 passed / 87 total (100.00% clean and eventual among executed tests), 1 explicit skip, 0 failed, 0 flaky. Project rows: desktop 29/29, tablet 29/29, mobile 28 passed + 1 skipped / 29.

## Focused evidence

- Literal prescribed root command exited 0 but nested npm consumed `--project`; it ran the three-project performance spec: 5 passed, 1 skipped, 0 failed.
- Equivalent direct frontend invocation produced the intended mobile-only raw JSON: 1 passed, 0 failed, 0 flaky, 1 skipped, 2 total. The skip reason was `Staff performance smoke targets desktop/tablet back-office layouts.`

## Full evidence

- Restored full producer and parser: exits 0 and 0; generated report records 86 passed, 1 skipped, 0 failed, 0 flaky, 87 total. Node `v24.18.0`; Playwright `1.60.0`.

## Review findings

- Fresh `gpt-5.6-terra` high review approved Task 1 with no issues.
- The reviewer accepted the dual-command evidence: the literal prescribed root command exited 0 but ran six cross-project cases because nested npm consumed `--project`; the unchanged equivalent direct frontend invocation supplied the intended mobile-only 1 passed / 1 skipped evidence, and the subsequent full producer/parser restored the authoritative 86 passed / 1 skipped / 87 total report.

## Commits

- Task 1: complete (commits 05a426e..HEAD, review clean)

## Deferred findings

- Plan 1 is concurrently unmerged. Its frontend-unit rerun is a future integration handoff requirement only; Task 1 makes no Plan 1 integration or success claim.
