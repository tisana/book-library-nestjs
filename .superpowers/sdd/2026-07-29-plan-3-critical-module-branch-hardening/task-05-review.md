# Task 05 review

## Task
Task 5 — Reconciliation recovery, terminal ordering, and bounded cleanup.

## Reviewer model and reasoning
`gpt-5.6-sol`, high; separate-context reviewer identity `/root/plan3_task5_review`; model substitution none.

## Reviewed commit
Fix Round 1 head `11c14bc11b7636382ed367f5eba4ec6297363de4` against fix base `0c94b1aa845e6efda4d8f1d9d3d2d6e2e3b6f5a9`; original task base `38491688015d4e7945a7ed63f0f6fc8cb2cc98ab`.

## Commands and exits
- Supplied review diff `review-3849168..0c94b1a.diff` was read once as the primary change view. Its package records three changed files: the reconciliation spec plus the Task 5 report and progress ledger; no production, configuration, baseline, denominator, script, e2e, or frontend file is in the reviewed commit range.
- Read-only, line-numbered inspection of `src/auth/auth-identifier-reconciliation.service.spec.ts` and the unchanged reconciliation service exited `0`. The Task 5 block is at lines 1031-1727 and calls only public `reconcileOnce()`; private-path calls reported by `rg` are confined to pre-existing tests before that block.
- No Jest, coverage, ESLint, `git diff`, `git status`, or broad suite command was rerun, as required by the review assignment.
- ⚠️ The report's `55/55` GREEN result and reconciliation branch result `181/191` (required exact denominator `191`, floor `163/191`) are runtime claims and are not independently verifiable from the supplied diff.
- ⚠️ The supplied commit diff contains no generated artifacts, but the separate requirement that generated artifacts remain unstaged cannot be verified from a commit-range diff without the prohibited worktree-status check.
- Fix Round 1 scoped diff `rereview-0c94b1a..11c14bc.diff` and appended fix evidence were read without inspecting beyond the scoped package. The diff contains test assertions and Task 5 ledger evidence only; no production/configuration/baseline/denominator/script/e2e/frontend change is present.
- ⚠️ Fix-round RED `55/56`, GREEN `56/56`, focused lint, diff-check, and unchanged `181/191` coverage are supplied evidence and were not independently rerun during this scoped re-review.

## Findings
### Spec Compliance

#### Critical

None.

#### Important

- **[I1] Public terminal ordering never covers the terminal write that includes retention TTL** — `src/auth/auth-identifier-reconciliation.service.spec.ts:1481`. This case correctly proves event-before-status for `cleanupStatus: pending` and correctly asserts that `expiresAt` is omitted, but that setup deliberately bypasses the finalization branch that writes `expiresAt`. The parametrized clean-finalization cases at line 1392 inspect terminal metadata but do not record call order or assert the TTL pipeline. Consequently, the binding requirement that the terminal event precede terminal status **and TTL** is still supported only by the pre-existing private `finalize` test, not through public `reconcileOnce()`. Add a public clean-finalization case that captures event/write order and asserts the same terminal pipeline contains the terminal fields and bounded retention `expiresAt`.

#### Minor

None.

### Task Quality

#### Critical

None.

#### Important

- **[I2] Reservation recovery tests sequence results without verifying the reservation read requests** — `src/auth/auth-identifier-reconciliation.service.spec.ts:1302`. The HMAC attachment case supplies a matching reservation regardless of the argument passed to `identifiers.find`, and it does not capture/assert the `maxAssignments + 1` limit. A regression to an unscoped or unbounded discovery query could therefore attach another operation's same-subject/action reservation while this test still passes. The missing/mismatched case at line 1193 likewise never verifies which IDs were passed to `findById`. Assert the exact operation-scoped discovery filter and bound, plus the expected reservation IDs for direct lookups, so the sequenced results prove the requested model requests rather than only downstream writes.
- **[I3] Cleanup bounds are asserted, but cleanup ownership selectors are not** — `src/auth/auth-identifier-reconciliation.service.spec.ts:1551`. The cleanup cases capture `.limit(2)` / `.limit(1)` and assert ID-based writes, but their `find` and `exists` mocks return configured results for any query. Incorrect `activationGateOperationId`, `parentOperationId`, or `expiresAt: { $exists: false }` selectors would still pass and could clean another repair's gates/batches or prematurely complete the parent. Assert the exact gate/batch `find` and remainder `exists` requests in the failed/completed, capacity-exhausted, remaining-work, and empty-remainder cases.

#### Minor

None.

## Resolutions verified
- **I1 — ADDRESSED** — `src/auth/auth-identifier-reconciliation.service.spec.ts:1534`. The new public `reconcileOnce()` clean-finalization case captures `['event', 'operation']` ordering and asserts that the terminal operation pipeline contains status, event ID/timestamp, completion timestamp, and the bounded 90-day `expiresAt` expression.
- **I2 — ADDRESSED** — `src/auth/auth-identifier-reconciliation.service.spec.ts:1219` and `src/auth/auth-identifier-reconciliation.service.spec.ts:1329`. The fix asserts both sequenced `findById` arguments, the exact `{ pendingOperationId: 'operation-hmac' }` discovery selector, and the `maxAssignments + 1` limit of `3`.
- **I3 — ADDRESSED** — `src/auth/auth-identifier-reconciliation.service.spec.ts:1629`, `src/auth/auth-identifier-reconciliation.service.spec.ts:1676`, `src/auth/auth-identifier-reconciliation.service.spec.ts:1717`, and `src/auth/auth-identifier-reconciliation.service.spec.ts:1773`. Failed/completed cleanup, capacity exhaustion, remaining work, and empty completion now assert the exact operation-owned gate/batch `find` and remainder `exists` selectors in addition to the existing bounds and writes.
- **New Critical/Important breakage:** none in the scoped fix diff.
- **Out-of-scope observation:** the scoped fix commit includes this reviewer-authored review content verbatim alongside the permitted Task 5 ledgers. This is non-blocking because the finding text was preserved and there is no production or unrelated test change.

## Verdict
Approved at Fix Round 1 head `11c14bc11b7636382ed367f5eba4ec6297363de4`. Findings resolved: `3`; open Critical/Important/Minor findings: `0`.
