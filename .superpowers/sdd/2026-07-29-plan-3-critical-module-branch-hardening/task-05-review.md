# Task 05 review

## Task
Task 5 — Reconciliation recovery, terminal ordering, and bounded cleanup.

## Reviewer model and reasoning
`gpt-5.6-sol`, high; separate-context reviewer identity `/root/plan3_task5_review`; model substitution none.

## Reviewed commit
`0c94b1aa845e6efda4d8f1d9d3d2d6e2e3b6f5a9` against base `38491688015d4e7945a7ed63f0f6fc8cb2cc98ab`.

## Commands and exits
- Supplied review diff `review-3849168..0c94b1a.diff` was read once as the primary change view. Its package records three changed files: the reconciliation spec plus the Task 5 report and progress ledger; no production, configuration, baseline, denominator, script, e2e, or frontend file is in the reviewed commit range.
- Read-only, line-numbered inspection of `src/auth/auth-identifier-reconciliation.service.spec.ts` and the unchanged reconciliation service exited `0`. The Task 5 block is at lines 1031-1727 and calls only public `reconcileOnce()`; private-path calls reported by `rg` are confined to pre-existing tests before that block.
- No Jest, coverage, ESLint, `git diff`, `git status`, or broad suite command was rerun, as required by the review assignment.
- ⚠️ The report's `55/55` GREEN result and reconciliation branch result `181/191` (required exact denominator `191`, floor `163/191`) are runtime claims and are not independently verifiable from the supplied diff.
- ⚠️ The supplied commit diff contains no generated artifacts, but the separate requirement that generated artifacts remain unstaged cannot be verified from a commit-range diff without the prohibited worktree-status check.

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
None; this is the initial review and findings I1-I3 remain open.

## Verdict
Changes requested — not approved. Open findings: `3` Important, `0` Critical, `0` Minor.
