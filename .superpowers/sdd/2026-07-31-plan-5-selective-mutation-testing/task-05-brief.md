# Plan 5 Task 5 brief — auth mutation hardening

Read this first. It supplements, but does not weaken, the exact Task 5 text in
`docs/superpowers/plans/2026-07-31-selective-mutation-testing.md`.

## Dependency state

Task 4 is independently APPROVED at review closeout commit
`dad7c524330c1c60ea016b357c3feedae68e47c9`. Its accepted whole-source merged
smoke report is:

`reports/mutation/diagnostics/node22-nvm-ubuntu24-sequential-c4-valid-policy-red/mutation.json`

The matching summary/duration and lossless shard archive are in the same
directory. The report has exactly 1,366 unique mutants, raw score
`70.79062957540263`, and 410 critical findings. Task 8 distributed reference
wall-clock proof remains deferred, not waived.

## Required Task 5 execution

- Work only in the three auth service specs, Task 5 evidence, and the exact
  allowlist path if independently approved. Do not edit production files,
  member/borrowing specs, manifest, baseline, runner/config, dependencies,
  workflows, or Tasks 6+.
- Parse the accepted report and enumerate every auth critical Survived or
  NoCoverage fingerprint with operator, replacement, one-based location, rule
  id, and status before selecting tests.
- Use the Task 3 manifest and Task 2 policy code to map findings. Never infer
  identities from console progress or invent Stryker ids.
- For each real survivor chosen, add the smallest observable-behavior test with
  strict RED then GREEN. Use Plan 2/3 fixtures and deferred promises for
  concurrency; no sleeps. Do not merely assert mocks or private structure.
- Rerun focused Jest, then rerun the three affected whole-source auth shards
  sequentially with the approved runner. Reuse unchanged same-commit member and
  borrowing reports only when provenance/source hashes/config identity match;
  otherwise regenerate them. Merge exactly five sources and require 1,366
  identities.
- Continue until all auth critical findings are killed or an exact equivalent
  has the plan-required independent review evidence. The implementer cannot add
  or approve an equivalent unilaterally.
- Run the complete-profile RED required by Task 5. Missing reports, timeout,
  scope drift, or remaining auth critical findings are not acceptable REDs.
- Preserve every failed report before another run.
- Follow Task 5's exact RED/GREEN/review/commit sequence. The implementation
  commit subject is `test: harden critical auth mutations`; backfill immutable
  SHA/evidence without amend in the established evidence-only protocol.
- Do not start Task 6, push, or dispatch Actions.

## Model assignment

Implementer requested and actual: fresh `gpt-5.6-sol`, high reasoning,
identity `/root/plan5_task5_implementer`; substitution none. Reviewer will be a separate fresh
`gpt-5.6-sol`, high-reasoning agent after implementation.

Write the full report to
`.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-05.md`.

## Binding runtime amendment — 2026-08-16

The user-approved Task 5 amendment raises only the smoke hard/runtime gate from
`300000 ms` to exactly `350000 ms`. The complete gate remains exactly
`900000 ms`; selected production scope, mutators, reporters, score and critical
gates, and the `2/2/2/4/2` smoke concurrency map remain unchanged. This narrow
amendment authorizes the corresponding runner test, runner constant, governing
plan, and Task 5 evidence updates despite the earlier general runner/config
prohibition. The reconciliation rerun must use a unique clean WSL-native
snapshot with `nvm use lts/jod`, Node 22, and a fresh `npm ci`; it must stop if
that run structurally fails or exceeds `350000 ms`.

## Binding complete-profile distributed amendment — 2026-08-16

After the same-snapshot monolithic complete producer timed out at
`900335.251824/900000 ms` without JSON/HTML, the user approved replacing only
that producer with five disjoint full-source complete shards and a fail-closed
canonical merge. Each shard owns one exact selected production file, retains
concurrency `4` and its own exact `900000 ms` hard/runtime gate, and writes
isolated JSON/HTML/log/duration/summary/temp evidence. All shards must agree on
commit, Node major, source hashes, configuration hash, schema, and budget. The
merge ignores report-local mutant ids, rejects overlapping or incomplete
current artifacts, requires the preserved exact complete union of `1727`, and
runs Task 2 policy once. Smoke behavior, production, manifest, mutators,
reporters, thresholds, dependencies, Task 6+, push, and Actions remain outside
this amendment.

## Binding Fix Round 1 review remediation — 2026-08-16

The initial independent Task 5 reviewer returned `CHANGES_REQUIRED`, Critical
`0`, Important `3`, Minor `0`. Fix Round 1 must address only those findings:

- reconstruct the Task 5 RED ledger from recorded commands and preserved
  reports, explicitly distinguishing report-based survivor REDs from focused
  Jest GREEN checks;
- make the changed-file and authorization record match implementation
  `f539eda1c1f99622df59ca13181b9a71f96219a5`, including the approved
  `350000 ms` smoke and distributed-complete amendments; and
- replace the cited direct private-method/getter tests with assertions through
  public token rotation, reconciliation, and repair entrypoints.

Because all three auth specs change, acceptance requires a new clean WSL-native
Node 22 snapshot with fresh `npm ci`, five final smoke shards plus exact `1366`
merge, and five full-source complete shards plus exact `1727` merge. Preserve
old and new reports. Production, member/borrowing specs, dependencies, manifest,
Task 6+, push, and Actions remain unauthorized.

Fix Round 1 implementation is immutable commit
`b90460231c8cbdb5ceeee3de6bde93c424f8ecc0` (`test: use public auth mutation
paths`); its evidence is committed separately without amend before re-review.
