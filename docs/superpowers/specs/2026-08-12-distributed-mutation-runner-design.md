# Distributed Mutation Runner Amendment

## Status

Approved by the user on 2026-08-12. Implementation and local commits are
authorized. Pushing the branch and manually dispatching GitHub Actions remain
unauthorized until a later explicit approval.

## Objective

Unblock Plan 5 Tasks 4–7 without weakening mutation scope, policy, thresholds,
reporting, or runtime budgets. Defer only the reference-runner wall-clock proof
to Task 8, where the five smoke shards will execute on independent runners.

## Evidence behind the design

The unchanged smoke workload is 1,366 mutants across five reviewed production
files. A single eight-core host cannot finish it within 300,000 ms. Increasing
same-host concurrency and splitting token/member ranges increased contention;
the seven-shard trial timed out six shards and also produced only 1,365 mutants
because a line boundary omitted one token mutant. In contrast, whole-source
shards preserve the exact denominator, and four of five source shards completed
under the budget even while sharing the same host.

## Architecture

Smoke uses exactly five whole-source shards: token session, identifier repair,
identifier reconciliation, members, and borrowings. Each shard receives every
reviewed manifest range owned by its source, uses Stryker concurrency 2, has an
independent 300,000 ms hard budget, and writes isolated JSON, HTML, duration,
summary, log, and temporary artifacts. No line-window subdivision remains.

The runner exposes three local operations in addition to the unchanged complete
profile:

- run one named smoke shard;
- merge five already-produced smoke shard reports;
- run all five smoke shards sequentially as a diagnostic/evidence operation.

Sequential local execution is not reference-budget evidence. It exists to
produce truthful mutation fingerprints for Tasks 5–6 without same-host CPU
contention. Every shard report must have the same commit SHA, Node major,
selected-source hashes, configuration identity, and schema. The merge rejects a
missing/extra source, duplicate/omitted canonical mutant, or a unique union other
than exactly 1,366, then evaluates the Task 2 policy exactly once.

Task 7 adds a five-job GitHub Actions matrix plus an aggregate job. Each matrix
job runs one whole-source shard on its own Ubuntu 24.04 / Node 22 runner and
uploads artifacts even on mutation-policy failure. The aggregate job downloads
all five artifacts, performs the exact merge/policy operation, and publishes the
canonical report. No push or workflow dispatch occurs during Tasks 4–7.

## Dependency amendment

Task 4 may be approved after deterministic cross-platform tests and a cold local
sequential compatibility run prove all five shard reports, exact 1,366 identity
union, canonical merge, policy RED, budgets per shard, and process cleanup. The
five-minute reference wall-clock verdict is explicitly deferred—not waived—to
Task 8.

Task 5 consumes the valid merged smoke report and may rerun the three auth shards
locally. Task 6 consumes local whole-source/complete reports and must still meet
the complete 900,000 ms budget, raw score >=70, baseline, and zero-unapproved-
critical-findings gates. Task 7 may be implemented after Task 6. Task 8 remains
blocked before push/dispatch; Task 9 remains blocked until fresh Task 8 reference
evidence is green.

## Non-negotiable gates

- Production mutation targets remain exactly the five reviewed service files.
- The 89-rule manifest and selected production sources are read-only.
- Stryker packages stay pinned at 9.6.1; Jest and ts-jest are unchanged.
- Jest `perTest`, reporters, thresholds 80/70/break 70, all mutators, smoke
  300,000 ms per shard, and complete 900,000 ms remain unchanged.
- Complete remains one exact five-source run using the already approved
  concurrency 4 setting.
- No unapproved critical Survived or NoCoverage mutant is accepted.
- Raw complete score remains at least 70 and never below baseline.
- Existing backend, changed-line, frontend, and E2E gates remain independent.
- Failed artifacts are preserved before any retry.
- No push or GitHub Actions dispatch occurs without later user authorization.

## Acceptance and failure behavior

Task 4 fails closed on any absent shard report, mismatched provenance, source
drift, duplicate/omitted canonical identity, denominator other than 1,366,
invalid policy summary, timeout, or surviving descendant. A non-zero merged
policy verdict caused only by real surviving/NoCoverage critical mutants is the
expected mutation RED for Task 5, provided all required artifacts exist.

Task 8 later requires three clean distributed smoke executions, each shard at
or below 300,000 ms, exact union 1,366, downloadable artifacts, and a green
canonical policy result. Complete still must pass at or below 900,000 ms. Queue
and dependency-install time are recorded separately and never substituted for
the runner's mutation duration fields.

