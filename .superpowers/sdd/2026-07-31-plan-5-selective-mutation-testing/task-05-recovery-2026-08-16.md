# Task 05 interruption recovery — 2026-08-16

Read `task-05-brief.md` first; this file only records the exact resume point.

## Git and ownership state

- HEAD remains Task 4 review closeout
  `dad7c524330c1c60ea016b357c3feedae68e47c9`.
- Task 5 has no commits yet.
- Authorized uncommitted paths are the three auth specs,
  `test/quality/mutation-equivalents.json`, the narrowly amended tracked
  allowlist assertion in `test/quality/mutation-policy.test.mjs`, and Task 5
  evidence/ledger files.
- No Stryker, Jest, or mutation-runner descendant remains after interruption.

## Exact mutation state

- Token is complete: 88 unique critical mutants Killed, zero NoCoverage, and
  sole Survived fingerprint
  `0108d029ef22842e4c8a00d900136b2dbc483f0013d796483b852f024a550cc5`
  independently approved and allowlisted under
  `token-interrupted-cas-finalization`. The two missing-family candidates were
  independently rejected and then Killed. Final report is preserved at
  `reports/mutation/diagnostics/task5-token-session-final/`.
- Repair pass 7 is preserved at
  `reports/mutation/diagnostics/task5-identifier-repair-pass7/`. The full
  report contains Killed `396`, Timeout `3`, Survived `2`. The two survivors
  are mutant `103` line 292 replacement `""`, exact fingerprint
  `c010a2ec5f4bb9177df61f0bc8326b2d04d2463a59bf5dd2337b840dedc2f36e`,
  independently approved/allowlisted HMAC equivalent; and mutant `152` line
  380 replacement
  `batch.assignments.map(item => item.targetReservationId)`, which must be
  Killed. The spec already changed the distinguishing assertion from
  `toEqual` to `toStrictEqual`. Repair pass 8 was interrupted after archival;
  no active repair JSON exists. Rerun pass 8 from current bytes and preserve it.
- Reconciliation pass 4 is preserved at
  `reports/mutation/diagnostics/task5-identifier-reconciliation-pass4/` with
  38 unique Survived and zero NoCoverage. Exact remaining groups were: bounded
  claim 4; repair-key availability 1; invalid-state dispatch 1; invalid-event
  actor ternary 2; over-cap attachment 1; applied recovery 2; compensated
  recovery 8; terminal event/TTL 6; bounded gate/batch cleanup 4; parent TTL
  after cleanup/event 5; correlation fallback 1; secret decode 1; lease default
  1; retention default 1.
- A second independently approved repair equivalent entry exists for HMAC
  fingerprint `c010a2ec...c2f36e`. The tracked allowlist should contain exactly
  the approved token and repair entries, and the narrow integrity test should
  assert both exact fingerprints. No other equivalent is approved.

## Resume contract

1. Verify worktree scope, current allowlist entries, full policy tests, and the
   three focused auth specs before mutation.
2. Rerun repair pass 8. Require only the approved HMAC survivor and zero other
   critical findings; preserve the report.
3. Continue strict RED/GREEN reconciliation hardening from the exact pass-4
   survivors until zero unapproved critical findings.
4. Regenerate same-commit auth shard evidence as necessary, merge exact five
   sources/provenance/1,366 identities, and run the required complete-profile
   RED. Missing report, timeout, scope drift, or auth critical survivor is not
   acceptable.
5. Finish Task 5 evidence, self-review, and exact commit protocol. Do not start
   Task 6, push, or dispatch Actions.

Replacement implementer requested and actual: fresh `gpt-5.6-sol`, high
reasoning, identity `/root/plan5_task5_recovery_implementer`; substitution none.

## User-approved runtime amendment

After the preserved Windows reconciliation timeouts, the user approved one
binding correction: smoke uses exactly `350000 ms` and complete remains exactly
`900000 ms`. The correction changes no selected production source, range,
mutator, reporter, score or critical gate, or concurrency value. Its required
reconciliation retry is a unique clean WSL-native snapshot using
`nvm use lts/jod`, Node 22, and a fresh `npm ci`. Requested and actual model
remain fresh `gpt-5.6-sol`, high reasoning; substitution none.

## Complete-profile distributed recovery amendment

The later user-approved recovery replaces the forbidden monolithic complete
retry with five full-source `complete-shard` runs followed by `complete-merge`.
Each shard retains concurrency `4` and an independent exact `900000 ms` gate;
the merge must fail closed unless the same-provenance canonical union is
exactly `1727`. This amendment narrowly authorizes corresponding runner,
configuration, deterministic regression, governing-plan, and Task 5 evidence
changes. It does not authorize production, package, manifest, mutator,
reporter, threshold, smoke, Task 6+, push, or Actions changes.
