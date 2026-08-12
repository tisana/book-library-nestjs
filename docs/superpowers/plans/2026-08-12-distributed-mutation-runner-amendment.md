# Distributed Mutation Runner Amendment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Plan 5 Tasks 4–7 locally using exact whole-source mutation artifacts while deferring distributed reference-runner execution to Task 8.

**Architecture:** Five whole-source smoke shards run sequentially for local evidence and as a five-runner matrix in CI. A fail-closed canonical merge validates common provenance, exact five-source ownership, 1,366 unique mutant identities, and Task 2 policy exactly once.

**Tech Stack:** Node.js 22, Stryker 9.6.1, Jest/ts-jest at the locked versions, GitHub Actions, Node test runner.

## Global Constraints

- Do not edit the five selected production services or the 89-rule manifest.
- Do not change Stryker/Jest/ts-jest versions, mutator selection, reporters, thresholds, source scope, or runtime budgets.
- Smoke shard concurrency is exactly 2; complete retains approved concurrency 4.
- A smoke shard hard-stops at 300000 ms; complete hard-stops at 900000 ms.
- Local sequential smoke is evidence generation, not reference wall-clock acceptance.
- Do not push or dispatch GitHub Actions during this plan.
- Preserve every failed mutation artifact before retrying.

---

### Task A: Finish Plan 5 Task 4 with whole-source shard contracts

**Files:**
- Modify: `stryker.config.mjs`
- Modify: `scripts/quality/run-mutation.mjs`
- Modify: `test/quality/mutation-runner.test.mjs`
- Modify: `test/quality/mutation-policy.test.mjs`
- Modify: `.gitignore`
- Modify: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-04.md`
- Modify: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`

**Interfaces:**
- Produces a named whole-source shard run, local sequential evidence operation, fail-closed five-report merge, and unchanged complete operation.
- The merge returns exactly five source records and rejects a canonical denominator other than 1366.

- [ ] Write focused regressions that fail against the seven range-shard candidate: exact five whole-source configs, concurrency 2, sequential non-overlapping execution, same-provenance validation, exact 1366 merge, isolated artifacts, and exact process cleanup.
- [ ] Run the focused tests and record the expected RED caused by the seven range-shard topology.
- [ ] Implement the minimum five whole-source shard and merge behavior; remove all line-window behavior.
- [ ] Run focused and full deterministic GREEN on Windows and Ubuntu 24.04 after `nvm use lts/jod`.
- [ ] Run manifest, ESLint, Prettier, protected-byte, scope, and diff checks.
- [ ] From one unique cold WSL-native snapshot, run all five shards sequentially. Require each JSON/HTML/duration artifact, <=300000 ms per shard, common provenance, exact 1366 union, merged summary, and empty descendants. Preserve the merged policy RED for Task 5.
- [ ] Follow Task 4's implementation/evidence commit protocol and dispatch a fresh gpt-5.6-sol/high reviewer. The reviewer records that reference wall-clock proof remains a Task 8 condition.

### Task B: Execute Plan 5 Task 5 against valid auth shard evidence

**Files:** exactly the Task 5 files in the reviewed Plan 5 plan.

- [ ] Use exact fingerprints from the merged report; add no speculative test.
- [ ] For each selected auth survivor, write and verify an observable-behavior RED before the minimal assertion/fixture change.
- [ ] Run the focused three-spec Jest command.
- [ ] Rerun the affected whole-source auth shards locally and merge with same-commit source shards until no unapproved auth critical finding remains.
- [ ] Preserve exact equivalent evidence only after independent reviewer approval.
- [ ] Follow Task 5's commit and fresh-review sequence.

### Task C: Execute Plan 5 Task 6 and establish the baseline

**Files:** exactly the Task 6 files in the reviewed Plan 5 plan.

- [ ] Use exact member/borrowing and complete-report fingerprints as RED.
- [ ] Add one observable-behavior test at a time with verified RED/GREEN.
- [ ] Run focused Jest and the unchanged complete profile within 900000 ms.
- [ ] Require raw combined score >=70 and zero unapproved critical findings.
- [ ] Record the schema-v1 upward-only baseline only from a committed, policy-green complete report.
- [ ] Follow Task 6's two commits and fresh-review sequence.

### Task D: Execute Plan 5 Task 7 as a distributed workflow, without dispatch

**Files:**
- Modify: `package.json`
- Create: `.github/workflows/mutation.yml`
- Modify: `test/quality/mutation-runner.test.mjs`
- Create/modify: Task 7 evidence files.

- [ ] Write static and behavioral RED tests for five independent smoke matrix jobs and one aggregate job.
- [ ] Implement the exact five-source matrix on Ubuntu 24.04 / Node 22, one shard per job, artifact upload with `if: always()`, and a merge/policy aggregate job.
- [ ] Preserve scheduled/manual complete behavior, least privileges, existing workflows, and all original path filters.
- [ ] Run local static/deterministic tests plus package mutation checks; do not push or dispatch.
- [ ] Follow Task 7's commit and fresh-review sequence, recording Task 8 as pending external validation.

### Task E: Park Tasks 8–9 at the authorization boundary

- [ ] Prepare but do not execute the exact Task 8 push/dispatch commands.
- [ ] Record the local preflight and the explicit missing reference URLs/artifacts as pending, not green.
- [ ] Stop before push/manual dispatch and request user authorization later.
- [ ] Task 9 remains undispatched until Task 8 is approved with fresh smoke/complete reference evidence.

