# Task 07 Evidence

## Task

Plan 5 Task 7 — add the exact package entry points and the separate distributed
`Selective mutation` GitHub Actions workflow.

Binding runtime amendments remain authoritative: smoke uses five disjoint
`smoke-shard` producers with exact `350000 ms` gates; complete uses five
disjoint full-source `complete-shard` producers at concurrency `4` with exact
`900000 ms` gates and a fail-closed `complete-merge` requiring exactly `1727`
canonical identities. The superseded monolithic complete producer is not used.

## Implementer model and reasoning

- Requested: fresh `gpt-5.6-sol`, high reasoning.
- Actual: fresh `gpt-5.6-sol`, high reasoning.
- Identity: `/root/plan5_task7_implementer`.
- Substitution: none.

## Reviewer model and reasoning

- Required: fresh `gpt-5.6-sol`, high reasoning, separate from the implementer.
- Actual: pending fresh independent review.
- Substitution: none expected; approval is not presumed.

## Base SHA

- Starting HEAD: `3a2c021ff9766ceb22834b5ea6721edd02252282`.
- Task 6 dependency: independently `APPROVED`, Critical `0`, Important `0`,
  Minor `0`; upward-only baseline is tracked.
- Preflight status: clean except the controller-authored Task 7 dispatch line in
  this plan's append-only `progress.md`; no concurrent protected-path work was
  authorized.

## Files changed

- `package.json`
- `.github/workflows/mutation.yml` (new)
- `test/quality/mutation-runner.test.mjs`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-07.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`

No `package-lock.json`, Jest/ts-jest, production, specification, threshold,
mutation scope/mutator/reporter/budget, baseline, allowlist/manifest,
runner/config implementation, frontend, pre-existing workflow, or Task 8+ path
changed.

## RED command and exit

WSL Node 22 focused command:

`node --test --test-name-pattern='package exposes|mutation workflow' test/quality/mutation-runner.test.mjs`

Exit `1`; `0/2` focused tests passed.

## RED evidence

- `package exposes the exact selective mutation entry points` failed because
  `mutation:check` was `undefined` instead of the exact manifest check command.
- `mutation workflow distributes five shards and merges one exact profile`
  failed with `ENOENT` for `.github/workflows/mutation.yml`.
- This was a genuine focused RED under WSL Node `v22.22.2`; both new static
  assertions executed and the failures reflected only the missing Task 7
  package scripts/workflow.
- An earlier Windows full-file attempt was interrupted after a known
  environment-only `Get-CimInstance` access failure and is not counted as RED.

## GREEN command and exit

The same WSL Node 22 focused command exited `0`; `2/2` focused tests passed.

## GREEN evidence

- Package scripts are exact: `mutation:check`, `mutation:smoke`, and
  `mutation:complete` retain the plan literals. The runner's current `complete`
  alias is merge-only, so the package literal does not revive the prohibited
  monolithic producer.
- The separate workflow has exact PR paths, schedule, manual choices,
  least-privilege permissions, PR-only cancellation, Ubuntu 24.04, Node 22,
  `npm ci`, five named shards, three mutually exclusive event-conditioned shard
  steps, dynamic smoke/complete merge, 17-minute job timeouts, and always-run
  uploads of `reports/mutation/**`.
- The workflow does not invoke or replace coverage, changed-line, frontend, or
  E2E workflows.

## Focused metrics

- Static Task 7 contract: RED `0/2`; GREEN `2/2`.
- Final deterministic runner/policy verification: `98/98`, no skips under WSL
  Node 22.
- Critical-rule manifest verification: `89` rules.
- Local smoke canonical merge: exact `1366`, raw combined score
  `99.78038067349927`, policy PASS, zero violations/unapproved critical
  findings, and exactly three approved auth equivalents.

## Full-suite commands and exits

- `npm run mutation:check`: exit `0`, exact `89` manifest rules.
- `node --test test/quality/mutation-runner.test.mjs test/quality/mutation-policy.test.mjs`:
  exit `0`, `98/98`, no skips under WSL Node 22.
- `npm run mutation:smoke`: exit `0` on the clean WSL-native snapshot.
- Prettier, ESLint, workflow identity, exact-scope, and whitespace checks are
  recorded in the final pre-commit verification below.

## Runtime evidence

- Authoritative clean WSL-native snapshot:
  `/home/tisana/book-library-plan5-task7-smoke-20260822-M6DFI9/repo`.
- Temporary immutable provenance:
  `29b33184b4b96d57ee8da4c69601a1b0b6712cc2`.
- Runtime: Node `v22.22.2`, npm `10.9.8`; fresh `npm ci` exited `0` in `19 s`.
- The nine overlaid Task 7/protected source inputs were byte-identical to the
  Windows worktree; pre-smoke snapshot checks passed manifest `89`, runner and
  policy `98/98`, Prettier, and clean Git status.
- Exact smoke shard durations against independent `350000 ms` gates:
  token-session `122783.37599 ms`; identifier-repair `93676.79712799999 ms`;
  identifier-reconciliation `102392.15925799997 ms`; members
  `185345.765855 ms`; borrowings `35115.24989600002 ms`. All had
  `timedOut: false`, Stryker exit `0`, and artifact exit `0`.
- Sequential wrapper diagnostic elapsed time was `539461.816783 ms`; it is not
  the binding per-shard metric. Maximum binding shard duration was
  `185345.765855/350000 ms`.
- Smoke artifacts include aggregate and per-shard JSON, HTML, duration,
  summary, and logs. Aggregate hashes: mutation JSON
  `4e520034cfcdf67dabff1bbb01a5f23798236e2e2b96bd7cb9bc6513883df469`;
  summary JSON
  `593624e1e4c2119bf232056da5980a57ae025d587ccef42a95f52074cc2bb5b2`;
  duration JSON
  `e1ca76cabfc2ab357d71820ed0c1c5f7daf0bbe670eb78d18b3afbdd372bb901`.
- Durable ignored archive:
  `reports/mutation/diagnostics/task7-smoke-wsl-350k.tar`, `8888320` bytes,
  SHA-256
  `df9d5f3e8a156ad81eb0377079d0f1da2b2963eab165c4f817cd07f7a9c70c6e`.
- After exit, no `run-mutation`, Stryker, or mutation worker descendants
  remained.

## Commit hash

- Pending the required independent review and exact Task 7 commit.
- Required subject: `ci: report selective mutation quality`.

## Deferred findings

- Task 8 alone owns pushing the branch, manually dispatching GitHub Actions,
  collecting reference-runner URLs/artifacts/timing, and rerunning all existing
  independent integration gates. No push or Actions dispatch occurred here.
- Local timing is diagnostic for Task 8 reference-runner proof; no reference
  timing was inferred from WSL.

## Reviewer decision

- Pending fresh independent Task 7 review; no approval is presumed.
