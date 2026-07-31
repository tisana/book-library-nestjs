# Selective Critical-Backend Mutation Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use `superpowers:test-driven-development` for Tasks 1–7 and `superpowers:verification-before-completion` before every task handoff and before the final handoff.

**Goal:** Add an independently reported mutation-quality gate for five critical backend services, with a raw combined mutation score of at least 70%, zero unreviewed surviving or no-coverage mutants in critical authorization/state-transition ranges, a pull-request smoke run no longer than five minutes, and a complete scheduled run no longer than fifteen minutes.

**Architecture:** Stryker mutates only the five approved service files and uses the existing Jest/ts-jest suite with supported `perTest` coverage analysis. A source-hashed critical-rule manifest identifies security and state-machine ranges. A test-first Node policy layer validates Stryker JSON, enforces the manifest, an exact-fingerprint equivalent-mutant allowlist, and an upward-only baseline. A budget-aware wrapper runs Stryker, preserves JSON/HTML output and duration metadata even on failure, and supplies narrow manifest ranges to the PR smoke profile without weakening the complete profile.

**Tech Stack:** Node.js 22, npm, Jest/ts-jest already present in the repository, Node's built-in test runner for quality tooling, `@stryker-mutator/core@9.6.1`, `@stryker-mutator/jest-runner@9.6.1`, GitHub Actions on `ubuntu-24.04`.

**Planning references:** StrykerJS 9.6.1's official package metadata requires
Node 20 or newer; the official Jest runner supports custom Jest configuration
and `perTest` coverage analysis. Configuration, reporters, mutation ranges,
and breaking thresholds follow the official StrykerJS documentation:
[9.6.1 core package](https://github.com/stryker-mutator/stryker-js/blob/v9.6.1/packages/core/package.json),
[Jest runner](https://stryker-mutator.io/docs/stryker-js/jest-runner/), and
[configuration](https://stryker-mutator.io/docs/stryker-js/configuration/).

## Global Constraints

- Mutate only `token-session`, identifier repair, identifier reconciliation, members, and borrowings service files.
- Require raw combined selected-module mutation score `>= 70.00%`.
- Never lower the tracked raw mutation baseline.
- Permit no `Survived` or `NoCoverage` mutant in a reviewed critical range unless its exact fingerprint is independently proved equivalent.
- Keep PR smoke `<= 300000 ms` and complete scheduled/manual mutation `<= 900000 ms` on `ubuntu-24.04` with Node 22.
- Pin `@stryker-mutator/core` and `@stryker-mutator/jest-runner` to `9.6.1`; do not upgrade Jest or ts-jest.
- Use supported Jest `perTest` analysis plus JSON and HTML Stryker reports.
- Preserve all existing coverage, changed-line, frontend, and E2E gates as separate mandatory metrics.

---

## 1. Outcome contract

This plan produces a fifth metric. It does not merge mutation results into backend coverage, frontend coverage, or end-to-end pass rate.

| Metric | Required result |
|---|---:|
| Complete-profile raw combined mutation score across the five selected modules | `>= 70.00%` |
| Raw mutation-score baseline | Never decreases |
| `Survived` or `NoCoverage` mutants overlapping a reviewed critical rule | `0`, except an exact reviewed equivalent fingerprint |
| PR smoke elapsed time on `ubuntu-24.04`, Node 22 | `<= 300,000 ms` |
| Scheduled/manual complete elapsed time on `ubuntu-24.04`, Node 22 | `<= 900,000 ms` |
| Complete-profile production scope | Exactly five approved source files |
| Existing coverage, changed-line, and end-to-end gates | Unchanged and still required |

The raw Stryker aggregate is the reported score and baseline. Equivalent-mutant entries do not improve that score; they only satisfy the critical-range survivor rule after independent review.

## 2. Dependency and concurrency contract

**Hard dependency:** Begin only after Plan 3 Task 10 has been independently
approved and its handoff commit is `HEAD`. The handoff evidence must exist at
`.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/progress.md`.

The Plan 3 handoff must show these stabilized covered/total branch pairs:

- token session: `88/103`
- identifier repair: `94/110`
- identifier reconciliation: `163/191`
- members: `160/188`
- borrowings: `105/116`
- permissions control, monitored but not mutated: at least `71/74`

At Task 0, run `git rev-parse HEAD` and record that exact 40-character value as `Base SHA:` in the progress ledger via `apply_patch`. Every later task extracts it with:

```powershell
$progressPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md'
$baseShaMatch = Select-String -LiteralPath $progressPath -Pattern '^Base SHA: ([0-9a-f]{40})$'
if ($baseShaMatch.Matches.Count -ne 1) { throw 'Plan 5 requires exactly one recorded Base SHA.' }
$plan5BaseSha = $baseShaMatch.Matches[0].Groups[1].Value
git merge-base --is-ancestor $plan5BaseSha HEAD
```

Stop if the command exits non-zero, if the Plan 3 evidence is absent, or if a focused Plan 3 test fails.

**Concurrency:** After Task 0, policy tooling and manifest inventory may be researched in parallel, but their changes must merge in task order. Tasks 4–8 are sequential because they share the Stryker reports and baseline.

**Conflict rule:** Do not run this plan concurrently with work that modifies `package.json`, `package-lock.json`, the five selected service specs, `scripts/quality`, `test/quality`, or `.github/workflows/mutation.yml`. Rebase only before Task 1 or after Task 9; a mid-plan rebase invalidates source SHA review and requires Task 3 to be repeated.

## 3. Ownership boundaries

### Selected production files: read and mutate, but do not edit

```text
src/auth/token-session.service.ts
src/auth/auth-identifier-repair.service.ts
src/auth/auth-identifier-reconciliation.service.ts
src/members/members.service.ts
src/borrowings/borrowings.service.ts
```

If killing a mutant appears to require a production change, stop and file a separate defect plan. Do not conceal a behavioral fix inside this quality-infrastructure plan.

### Existing tests this plan may extend

```text
src/auth/token-session.service.spec.ts
src/auth/auth-identifier-repair.service.spec.ts
src/auth/auth-identifier-reconciliation.service.spec.ts
src/members/members.service.spec.ts
src/borrowings/borrowings.service.spec.ts
```

### Plan 2 and Plan 3 fixtures this plan consumes without changing

```text
test/support/backend-coverage-fixtures.ts
  deferred
  queryResult
  createStaffDocument
  createStaffModelHarness
  createIdentifierModelHarness

test/support/critical-auth-fixtures.ts
  createRefreshFamily
  createReplayMarker
  createIdentifierOperation
  createMemberDocument
  createBorrowingDocument
  CriticalQueryDouble
  criticalQueryResult
  createCriticalModelHarnesses
```

The handoff signatures are:

```ts
deferred<T>(): Deferred<T>
queryResult<T>(value: T): IdentifierQueryDouble<T>
createStaffDocument(
  overrides?: Partial<StaffUserDocument>,
): StaffUserDocument
createStaffModelHarness(options?: {
  document?: StaffUserDocument
  existsResult?: unknown
  findOneResult?: StaffUserDocument | null
  findResult?: StaffUserDocument[]
  startSession?: jest.Mock
}): {
  model: jest.Mock & {
    exists: jest.Mock
    findOne: jest.Mock
    find: jest.Mock
    updateOne: jest.Mock
    db: { startSession?: jest.Mock }
  }
  document: StaffUserDocument
  calls: StaffModelRecordedCalls
}
createIdentifierModelHarness(options?: {
  findOneResult?: AuthIdentifierDocument | null
}): {
  model: {
    findOne: jest.Mock
    updateOne: jest.Mock
    create: jest.Mock
  }
  calls: IdentifierModelRecordedCalls
}
createRefreshFamily(
  overrides?: Partial<RefreshTokenFamilyDocument>,
): RefreshTokenFamilyDocument
createReplayMarker(
  overrides?: Partial<RefreshTokenReplayMarkerDocument>,
): RefreshTokenReplayMarkerDocument
createIdentifierOperation(
  overrides?: Partial<AuthIdentifierOperationDocument>,
): AuthIdentifierOperationDocument
createMemberDocument(
  overrides?: Partial<MemberDocument>,
): MemberDocument
createBorrowingDocument(
  overrides?: Partial<BorrowingDocument>,
): BorrowingDocument
interface CriticalQueryDouble<T> extends IdentifierQueryDouble<T> {
  lean(): CriticalQueryDouble<T>
  sort(value: unknown): CriticalQueryDouble<T>
  limit(value: number): CriticalQueryDouble<T>
}
criticalQueryResult<T>(
  value: T,
  capture?: { sort?: unknown; limit?: number },
): CriticalQueryDouble<T>
createCriticalModelHarnesses(options?: {
  staffDocument?: StaffUserDocument
  identifier?: AuthIdentifierDocument | null
}): {
  staff: ReturnType<typeof createStaffModelHarness>
  identifier: ReturnType<typeof createIdentifierModelHarness>
}
```

### New or owned files

```text
package.json
package-lock.json
.gitignore
stryker.config.mjs
scripts/quality/mutation-policy.mjs
scripts/quality/run-mutation.mjs
scripts/quality/update-critical-rule-manifest.mjs
test/quality/mutation-policy.test.mjs
test/quality/mutation-runner.test.mjs
test/quality/critical-rule-manifest.json
test/quality/mutation-equivalents.json
test/quality/mutation-baseline.json
.github/workflows/mutation.yml
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-00.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-01.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-02.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-03.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-04.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-05.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-06.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-07.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-08.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-09.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/review.md
```

`reports/mutation/**` is generated evidence and must stay untracked. Do not modify backend/frontend coverage thresholds, changed-line ratchets, Playwright configuration, or existing quality workflows.

## 4. Agent and review assignments

Every dispatch must name its model and reasoning effort. A reviewer must be a fresh agent that did not implement the task.

| Phase | Tasks | Implementer | Required reviewer | Rationale |
|---|---|---|---|---|
| Inventory and dependency lock | 0 | `gpt-5.6-terra`, medium | `gpt-5.6-sol`, high | Mechanical evidence gathering, followed by security-aware contract review |
| Mutation infrastructure | 1–4 | `gpt-5.6-sol`, high | `gpt-5.6-sol`, high | Mutation schema, source-range integrity, process control, and fail-closed policy |
| Critical mutant hardening | 5–6 | `gpt-5.6-sol`, high | `gpt-5.6-sol`, high | Authorization, replay/revocation, ownership, lifecycle, and concurrency semantics |
| CI and acceptance | 7–9 | `gpt-5.6-sol`, high | `gpt-5.6-sol`, high | Supply-chain pinning, runtime gates, and whole-plan assurance |

If a named model is unavailable, stop. Substitution requires an equal-or-better model, the same or greater reasoning effort, and an entry under `Deferred findings` explaining who authorized it.

## 5. Evidence ledger

Create one report per task. Every report must contain these exact headings:

```markdown
# Task NN Evidence

## Task
## Implementer model and reasoning
## Reviewer model and reasoning
## Base SHA
## Files changed
## RED command and exit
## RED evidence
## GREEN command and exit
## GREEN evidence
## Focused metrics
## Full-suite commands and exits
## Runtime evidence
## Commit hash
## Deferred findings
## Reviewer decision
```

`progress.md` must contain:

```markdown
# Plan 5 Progress

Base SHA: one exact lowercase 40-character SHA returned by `git rev-parse HEAD`

## Dependency evidence
## Model dispatch ledger
## Task status
## Mutation score history
## Critical-rule decisions
## Runtime history
## Integration status
```

Replace the explanatory Base SHA sentence with the measured value when
creating the ledger. A report containing an unfinished marker, a guessed base
ref, or a fabricated hash fails review.

`Commit hash` always means the task's implementation commit, never an
self-referential evidence commit. After each task's implementation commit,
run `git rev-parse HEAD`, validate `^[0-9a-f]{40}$`, use `apply_patch` to put
that value in the task report, then make a distinct evidence-only commit:

```powershell
$implementationSha = (git rev-parse HEAD).Trim()
if ($implementationSha -notmatch '^[0-9a-f]{40}$') {
  throw 'Invalid implementation commit SHA.'
}
git add .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "docs: record Plan 5 task evidence"
```

The evidence-only commit is consumed as the next task's starting `HEAD`; it is
not written into its own report. Never amend a commit merely to record its own
hash.

---

### Task 0: Lock the reviewed Plan 3 base and establish the evidence ledger

**Recommended implementer:** `gpt-5.6-terra`, medium reasoning.

**Required reviewer:** Fresh `gpt-5.6-sol`, high reasoning.

**Depends on:** Reviewed Plan 3 Task 10 handoff commit at `HEAD`.

**Files:**

- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`
- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-00.md`
- Read: `.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/progress.md`
- Read: `coverage/backend-unit/coverage-summary.json`

**Interfaces:**

- Consumes: Plan 3 Task 10's reviewed commit, progress ledger, five focused
  Jest commands, stable fixture names, and stabilized branch pairs.
- Produces: one exact `Base SHA: [0-9a-f]{40}` record, the Plan 5 task-report
  schema, and a reviewed dependency verdict consumed by Tasks 1–9.

- [ ] **Step 1: Run the dependency RED check**

```powershell
$plan5Status = @(git status --short)
if ($LASTEXITCODE -ne 0 -or $plan5Status.Count -ne 0) { throw "plan-5-worktree-not-clean`n$($plan5Status -join "`n")" }
$plan5Head = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $plan5Head -notmatch '^[0-9a-f]{40}$') { throw 'invalid-plan-5-head' }
$plan3Progress = '.superpowers/sdd/2026-07-29-plan-3-critical-module-branch-hardening/progress.md'
if (-not (Test-Path -LiteralPath $plan3Progress)) { throw 'missing-reviewed-plan-3-handoff' }
$pairMatches = @(Select-String -LiteralPath $plan3Progress -Pattern '88/103|94/110|163/191|160/188|105/116|71/74' -AllMatches).Matches
if ($pairMatches.Count -lt 6) { throw 'incomplete-plan-3-critical-pair-evidence' }
$plan5Progress = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md'
if (-not (Test-Path -LiteralPath $plan5Progress)) { throw 'RED: missing-plan-5-progress-ledger' }
```

Expected RED: exit non-zero only at `missing-plan-5-progress-ledger`. A dirty
worktree, missing handoff, incomplete branch-pair evidence, or invalid `HEAD`
is a dependency failure, not acceptable RED evidence.

- [ ] **Step 2: Run all five focused Plan 3 commands**

```powershell
npx jest --runInBand auth/token-session.service.spec.ts --coverage --collectCoverageFrom=auth/token-session.service.ts --coverageReporters=text
npx jest --runInBand auth/auth-identifier-repair.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-repair.service.ts --coverageReporters=text
npx jest --runInBand auth/auth-identifier-reconciliation.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-reconciliation.service.ts --coverageReporters=text
npx jest --runInBand members/members.service.spec.ts --coverage --collectCoverageFrom=members/members.service.ts --coverageReporters=text
npx jest --runInBand borrowings/borrowings.service.spec.ts --coverage --collectCoverageFrom=borrowings/borrowings.service.ts --coverageReporters=text
```

Expected: all five exit `0`. Record duration and branch pair for each command.

- [ ] **Step 3: Create the ledger with `apply_patch`**

Insert the exact `git rev-parse HEAD` output as `Base SHA:` and create the Task 00 report with all required headings. Record the required fixture exports and the five selected production paths.

- [ ] **Step 4: Run the GREEN check**

```powershell
$progressPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md'
$taskPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-00.md'
if (-not (Test-Path $progressPath)) { throw 'Missing progress ledger.' }
if (-not (Test-Path $taskPath)) { throw 'Missing Task 00 report.' }
$baseShaMatch = Select-String -LiteralPath $progressPath -Pattern '^Base SHA: ([0-9a-f]{40})$'
if ($baseShaMatch.Matches.Count -ne 1) { throw 'Invalid Base SHA record.' }
git merge-base --is-ancestor $baseShaMatch.Matches[0].Groups[1].Value HEAD
```

Expected: exit `0`.

- [ ] **Step 5: Independent review and commit**

The reviewer checks the Plan 3 commit relationship, command evidence, fixtures, models, and clean ownership boundary.

```powershell
git add .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "docs: lock selective mutation testing baseline"
```

Apply the global evidence-commit protocol and record the implementation commit
in Task 00 without amending it.

---

### Task 1: Pin Stryker 9.6.1 and prove compatibility without upgrading Jest

**Recommended implementer:** `gpt-5.6-sol`, high reasoning.

**Required reviewer:** Fresh `gpt-5.6-sol`, high reasoning.

**Depends on:** Task 0 approved.

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-01.md`

**Interfaces:**

- Consumes: Task 0's reviewed Base SHA and the repository's existing
  Jest/ts-jest versions.
- Produces: exact dev dependencies `@stryker-mutator/core@9.6.1` and
  `@stryker-mutator/jest-runner@9.6.1`, plus recorded compatibility evidence
  for `perTest`, Jest custom-project mode, mutation ranges, thresholds, and
  JSON/HTML reporters.

- [ ] **Step 1: Capture the existing Jest tree and RED**

```powershell
npm ls jest ts-jest --depth=0
npx --no-install stryker --version
```

Expected RED: Jest/ts-jest resolve successfully; Stryker is absent or is not exactly `9.6.1`. Copy the exact Jest and ts-jest versions into Task 01 before changing dependencies.

- [ ] **Step 2: Install only the pinned Stryker packages**

```powershell
npm install --save-dev @stryker-mutator/core@9.6.1 @stryker-mutator/jest-runner@9.6.1
```

Do not run an npm update, do not change Jest or ts-jest, and do not accept a Stryker version range.

- [ ] **Step 3: Run the compatibility GREEN checks**

```powershell
npx --no-install stryker --version
npm ls @stryker-mutator/core @stryker-mutator/jest-runner jest ts-jest --depth=0
git diff -- package.json package-lock.json
npx jest --runInBand auth/token-session.service.spec.ts
```

Expected:

- Stryker prints `9.6.1`.
- Both Stryker packages resolve to `9.6.1`.
- Jest and ts-jest versions exactly match Step 1.
- The lockfile diff contains the two requested packages and their transitive dependencies, but no direct Jest/ts-jest upgrade.
- The focused Jest test exits `0`.

The reviewer also verifies from the installed 9.6.1 configuration schema/help that `coverageAnalysis: "perTest"`, the Jest runner, `json` and `html` reporters, mutation ranges, and threshold breaking are supported. Record the commands and exact outputs; do not rely on memory alone.

- [ ] **Step 4: Write evidence, review, and commit**

```powershell
git add package.json package-lock.json .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-01.md .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md
git commit -m "build: pin selective mutation tooling"
```

---

### Task 2: Build the fail-closed mutation policy parser test-first

**Recommended implementer:** `gpt-5.6-sol`, high reasoning.

**Required reviewer:** Fresh `gpt-5.6-sol`, high reasoning.

**Depends on:** Task 1 approved.

**Files:**

- Create: `scripts/quality/mutation-policy.mjs`
- Create: `test/quality/mutation-policy.test.mjs`
- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-02.md`

**Interfaces:**

- Consumes: Mutation Testing Elements JSON emitted by Stryker 9.6.1.
- Produces:

```javascript
sha256Text(text: string): string
mutantFingerprint(mutant: object, sourceSha256: string): string
validateCriticalManifest(manifest: object, sourceByPath: Map<string, string>): object
validateEquivalentAllowlist(allowlist: object, manifest: object, nowIso: string): object
evaluateMutationReport(input: {
  profile: 'smoke' | 'complete',
  report: object,
  manifest: object,
  allowlist: object,
  baseline: object | null
}): object
formatPolicySummary(evaluation: object): string
```

- [ ] **Step 1: Write failing Node tests**

Use `node:test`, `node:assert/strict`, and temporary directories created by the test process. The test module must cover:

- `rejects a raw combined score below 70`
- `rejects a score below the tracked upward-only baseline`
- `does not compare smoke score with the complete baseline`
- `rejects a surviving mutant overlapping a critical rule`
- `rejects a no-coverage mutant overlapping a critical rule`
- `accepts only an exact equivalent fingerprint tied to source SHA and rule id`
- `rejects stale source SHA, expired equivalent entries, and wildcard entries`
- `rejects reports whose mutated file set is not exactly the five selected files`
- `writes module scores and critical findings without changing the raw score`

Use compact inline Mutation Testing Elements report objects with real status strings (`Killed`, `Survived`, `NoCoverage`) and zero-based report locations. Include boundary tests proving that an overlap at the first or last manifest line is detected.

- [ ] **Step 2: Run RED**

```powershell
node --test test/quality/mutation-policy.test.mjs
```

Expected RED: module-not-found for `scripts/quality/mutation-policy.mjs` or missing exports.

- [ ] **Step 3: Implement the minimum policy module**

Export pure functions:

```javascript
export function sha256Text(text) {}
export function mutantFingerprint(mutant, sourceSha256) {}
export function validateCriticalManifest(manifest, sourceByPath) {}
export function validateEquivalentAllowlist(allowlist, manifest, nowIso) {}
export function evaluateMutationReport({ report, manifest, allowlist, baseline }) {}
export function formatPolicySummary(evaluation) {}
```

Fingerprint canonical input must include normalized source path, mutator name, replacement text, start/end line and column, and the manifest's source SHA-256. Sort object keys before hashing. Paths in tracked JSON must use `/`.

`evaluateMutationReport` must fail closed for:

- aggregate raw score below `70.00`;
- complete-profile aggregate raw score below the tracked complete baseline;
- missing or extra production files;
- malformed/unknown mutant status;
- stale source SHA;
- `Survived` or `NoCoverage` overlap without an exact, unexpired equivalent entry;
- an equivalent entry that does not name exactly one rule and one fingerprint.

Equivalent entries never alter the raw score.

Calculate the raw score using Stryker status semantics: detected mutants are
`Killed`, `Timeout`, `CompileError`, and `RuntimeError`; undetected mutants are
`Survived` and `NoCoverage`; `Ignored` mutants are excluded. The percentage is
`100 * detected / (detected + undetected)`, or `100` when both counts are zero.
Cross-check this calculation against Stryker's clear-text score table in the
real Task 4 probe.

- [ ] **Step 4: Run GREEN**

```powershell
node --test test/quality/mutation-policy.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Review and commit**

```powershell
git add scripts/quality/mutation-policy.mjs test/quality/mutation-policy.test.mjs .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "test: enforce selective mutation policy"
```

---

### Task 3: Create the source-hashed critical-rule manifest and strict allowlist

**Recommended implementer:** `gpt-5.6-sol`, high reasoning.

**Required reviewer:** Fresh `gpt-5.6-sol`, high reasoning.

**Depends on:** Task 2 approved; source files still byte-identical to Task 0.

**Files:**

- Create: `scripts/quality/update-critical-rule-manifest.mjs`
- Modify: `test/quality/mutation-policy.test.mjs`
- Create: `test/quality/critical-rule-manifest.json`
- Create: `test/quality/mutation-equivalents.json`
- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-03.md`

**Interfaces:**

- Consumes: Task 2's `sha256Text`, `validateCriticalManifest`, and
  `validateEquivalentAllowlist`; Plan 3's reviewed invariants and unchanged
  selected source files.
- Produces: schema-version-1 critical rules with exact source SHA-256 and
  inclusive ranges, schema-version-1 exact-fingerprint allowlist, and CLI
  modes `--check` and `--candidate`.

- [ ] **Step 1: Add failing manifest/updater tests**

Add tests that execute the updater with injected file content and assert:

- `--check` exits non-zero for a stale SHA or a missing/ambiguous anchor;
- `--candidate` emits a candidate under `reports/mutation/` and never overwrites the tracked manifest;
- every range has an id, invariant, exact source path, inclusive start/end lines, unique start/end anchors, and SHA-256;
- all five selected source files have at least one rule;
- the empty allowlist `{ "schemaVersion": 1, "entries": [] }` is valid;
- a source edit invalidates its rules.

Run:

```powershell
node --test test/quality/mutation-policy.test.mjs
```

Expected RED: updater or tracked JSON files are missing.

- [ ] **Step 2: Inventory and encode reviewed critical rules**

Read each selected service and its Plan 3 tests. Add ranges for all reviewed occurrences of:

- authorization/role denial;
- member/staff ownership checks;
- refresh-family replay detection and revocation;
- revoked/expired token rejection;
- illegal borrowing transitions;
- terminal event/cleanup ordering and TTL timing.

The tracked file must implement this exact schema:

```ts
interface CriticalRuleManifest {
  schemaVersion: 1
  rules: Array<{
    id: string
    invariant: string
    source:
      | 'src/auth/token-session.service.ts'
      | 'src/auth/auth-identifier-repair.service.ts'
      | 'src/auth/auth-identifier-reconciliation.service.ts'
      | 'src/members/members.service.ts'
      | 'src/borrowings/borrowings.service.ts'
    sourceSha256: string
    startLine: number
    endLine: number
    startAnchor: string
    endAnchor: string
  }>
}
```

Validation requires `sourceSha256` to match `^[0-9a-f]{64}$`, both line
numbers to be positive integers with `startLine <= endLine`, and both anchors
to be non-empty exact unique source lines. Populate measured values from the
reviewed sources. Never use broad whole-file ranges merely to avoid inventory
work.

Start `test/quality/mutation-equivalents.json` with:

```json
{
  "schemaVersion": 1,
  "entries": []
}
```

No equivalent is presumed.

- [ ] **Step 3: Implement the updater**

The CLI supports only:

```powershell
node scripts/quality/update-critical-rule-manifest.mjs --check
node scripts/quality/update-critical-rule-manifest.mjs --candidate
```

`--check` is read-only and fails for hash, anchor, path, order, or range mismatches. `--candidate` writes a review candidate below `reports/mutation/` but does not change tracked JSON. Promotion of a candidate requires `apply_patch` and independent review.

- [ ] **Step 4: Run GREEN**

```powershell
node --test test/quality/mutation-policy.test.mjs
node scripts/quality/update-critical-rule-manifest.mjs --check
```

Expected: both exit `0`.

- [ ] **Step 5: Independent security review and commit**

The reviewer compares every range against production code and Plan 3 tests, verifies all invariant categories above, and records each rule id in Task 03.

```powershell
git add scripts/quality/update-critical-rule-manifest.mjs test/quality/mutation-policy.test.mjs test/quality/critical-rule-manifest.json test/quality/mutation-equivalents.json .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "test: define critical mutation rules"
```

---

### Task 4: Add the Stryker configuration and budget-aware runner test-first

**Recommended implementer:** `gpt-5.6-sol`, high reasoning.

**Required reviewer:** Fresh `gpt-5.6-sol`, high reasoning.

**Depends on:** Task 3 approved.

**Files:**

- Create: `stryker.config.mjs`
- Create: `scripts/quality/run-mutation.mjs`
- Create: `test/quality/mutation-runner.test.mjs`
- Modify: `test/quality/mutation-policy.test.mjs`
- Modify: `.gitignore`
- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-04.md`

**Interfaces:**

- Consumes: Task 3's manifest/allowlist and Task 2's
  `evaluateMutationReport`/`formatPolicySummary`.
- Produces:

```javascript
buildStrykerConfig(profile: 'smoke' | 'complete', manifest: object): object
runMutation(profile: 'smoke' | 'complete', dependencies?: object): Promise<object>
```

  It also produces profile-specific `mutation.json`, `mutation.html`,
  `duration.json`, `summary.json`, and `summary.md`.

- [ ] **Step 1: Write failing runner/config tests**

Tests must inject a fake child-process launcher and monotonic clock. Cover:

- `complete profile mutates exactly five full source files`
- `smoke profile converts every reviewed rule to a supported mutation range`
- `both profiles use Jest, perTest, json and html reporters, and break at 70`
- `runner terminates smoke after 300000 ms and complete after 900000 ms`
- `runner preserves duration metadata and non-zero status after timeout`
- `runner writes commit, Node, OS, source hashes, score and policy result`
- `runner cannot bypass policy enforcement when Stryker exits zero`
- `mutation report directory is ignored by Git`

Run:

```powershell
node --test test/quality/mutation-runner.test.mjs
```

Expected RED: runner/config modules are absent.

- [ ] **Step 2: Implement `stryker.config.mjs`**

Export a testable `buildStrykerConfig(profile, manifest)` plus the default config. Both profiles require:

```javascript
{
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'json', 'html'],
  thresholds: { high: 80, low: 70, break: 70 },
  concurrency: 2,
  jest: {
    projectType: 'custom',
    configFile: 'package.json',
    enableFindRelatedTests: true
  }
}
```

At module load, validate `process.env.MUTATION_PROFILE` as exactly `smoke` or
`complete`; missing or any other value throws before Stryker starts. The
default export is
`buildStrykerConfig(process.env.MUTATION_PROFILE, reviewedManifest)`.

The complete `mutate` array is exactly the five production paths. The smoke `mutate` array is generated from every critical manifest range using the mutation-range syntax verified in Task 1; it may narrow lines but may not omit a rule. Reporter paths are profile-specific:

```text
reports/mutation/smoke/mutation.json
reports/mutation/smoke/mutation.html
reports/mutation/complete/mutation.json
reports/mutation/complete/mutation.html
```

Do not exclude mutator types to meet runtime.
Set a profile-specific `tempDirName` below `reports/mutation/` and add exactly
`/reports/mutation/` to `.gitignore`.

- [ ] **Step 3: Implement the wrapper**

The CLI accepts exactly `smoke` or `complete`:

```powershell
node scripts/quality/run-mutation.mjs smoke
node scripts/quality/run-mutation.mjs complete
```

Use `performance.now()` for elapsed time. Spawn local Stryker through `npx --no-install`, using `npx.cmd` on Windows and `npx` elsewhere, with `shell: false`. Apply `300000 ms` and `900000 ms` hard budgets. On expiry, send `SIGTERM`, allow ten seconds for cleanup, then send `SIGKILL`; preserve a non-zero result.

Always write `reports/mutation/{profile}/duration.json` with:

```ts
interface MutationDuration {
  profile: 'smoke' | 'complete'
  startedAt: string
  finishedAt: string
  durationMs: number
  budgetMs: 300000 | 900000
  timedOut: boolean
  strykerExitCode: number | null
  policyExitCode: number
  commitSha: string
  nodeVersion: string
  os: string
}
```

Validate timestamps as ISO-8601 UTC, `commitSha` as 40 lowercase hexadecimal
characters, non-negative durations, and profile/budget agreement.

After Stryker, parse JSON and call the policy module. Write `summary.json` and `summary.md`. Exit non-zero when Stryker, the runtime budget, or policy fails.
The wrapper passes the validated profile to the child only through
`MUTATION_PROFILE=smoke` or `MUTATION_PROFILE=complete`, preserving the rest
of the child environment.

- [ ] **Step 4: GREEN and real compatibility probe**

```powershell
node --test test/quality/mutation-runner.test.mjs test/quality/mutation-policy.test.mjs
node scripts/quality/update-critical-rule-manifest.mjs --check
node scripts/quality/run-mutation.mjs smoke
```

The first two commands must pass. The first real smoke run may still fail because it exposes live survivors; that is the mutation RED carried into Tasks 5–6. It must nevertheless prove that 9.6.1 accepts `perTest`, Jest custom config, every generated range, and all reporters, and that JSON/HTML/duration artifacts exist. A configuration/schema failure is not an acceptable RED; fix it before handoff.

- [ ] **Step 5: Review and commit**

```powershell
git add .gitignore stryker.config.mjs scripts/quality/run-mutation.mjs test/quality/mutation-runner.test.mjs test/quality/mutation-policy.test.mjs .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "test: add budgeted selective mutation runner"
```

---

### Task 5: Kill critical auth repair and reconciliation mutants

**Recommended implementer:** `gpt-5.6-sol`, high reasoning.

**Required reviewer:** Fresh `gpt-5.6-sol`, high reasoning.

**Depends on:** Task 4 approved and a valid smoke JSON report.

**Files:**

- Modify: `src/auth/token-session.service.spec.ts`
- Modify: `src/auth/auth-identifier-repair.service.spec.ts`
- Modify: `src/auth/auth-identifier-reconciliation.service.spec.ts`
- Read: `test/support/backend-coverage-fixtures.ts`
- Read: `test/support/critical-auth-fixtures.ts`
- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-05.md`

**Interfaces:**

- Consumes: `deferred<T>()`, `createRefreshFamily`,
  `createReplayMarker`, `createIdentifierOperation`,
  `createCriticalModelHarnesses`, smoke report JSON, and critical auth rule
  ids.
- Produces: focused observable-behavior tests that kill every non-equivalent
  critical auth/repair/reconciliation mutant and an independently reviewed
  disposition for every exact fingerprint encountered.

- [ ] **Step 1: Establish the mutation RED**

```powershell
node scripts/quality/run-mutation.mjs smoke
```

Expected RED: exit non-zero if any critical auth mutant is `Survived` or `NoCoverage`. Record actual mutant id, deterministic fingerprint, operator, replacement, source location, rule id, and status from `reports/mutation/smoke/mutation.json`. Do not invent expected mutant ids.

If the smoke report is already green for all auth rules, preserve it and add no speculative tests; proceed to the full-profile RED in Step 4.

- [ ] **Step 2: Add the smallest behavior assertions**

Use the Plan 2/3 fixtures to add one focused assertion for each real survivor. Prefer assertions on externally observable behavior and durable side effects:

- replay of a consumed refresh family is rejected and the family is revoked;
- revoked or expired sessions cannot be refreshed;
- identifier repair cannot cross actor/member ownership or bypass authorization;
- failed repair does not leave a durable partial state;
- terminal markers/TTL are not written before durable reconciliation events and cleanup;
- reconciliation retries are idempotent and cannot restore a revoked/forbidden identity.

For concurrency mutants, coordinate promises with `deferred`; do not use sleeps. Assert both result and ordered model/session calls through `createCriticalModelHarnesses`, `createReplayMarker`, and `createIdentifierOperation`.

- [ ] **Step 3: Run focused GREEN**

```powershell
npx jest --runInBand auth/token-session.service.spec.ts auth/auth-identifier-repair.service.spec.ts auth/auth-identifier-reconciliation.service.spec.ts
node scripts/quality/run-mutation.mjs smoke
```

Expected: Jest exits `0`; all auth critical-range mutants are killed or have an independently reviewed exact equivalent entry.

An equivalent entry requires:

- exact fingerprint;
- one rule id;
- matching source SHA-256;
- proof explaining why no input can distinguish the mutant;
- reviewer model/reasoning;
- review date and expiry date no more than 90 days later.

The implementer cannot approve an equivalent. Add it only after the fresh reviewer signs Task 05.

- [ ] **Step 4: Run the complete-profile RED**

```powershell
node scripts/quality/run-mutation.mjs complete
```

Expected RED is permitted for a raw score below 70 or non-critical survivors. It is not permitted for auth critical-range survivors, missing reports, scope drift, or timeout. Record module and combined scores for Task 06.
If the raw score is below 70 because of remaining auth, repair, or
reconciliation survivors, remain in Task 5 and add focused tests here. Task 6
may not modify the three auth specs.

- [ ] **Step 5: Review and commit**

```powershell
git add src/auth/token-session.service.spec.ts src/auth/auth-identifier-repair.service.spec.ts src/auth/auth-identifier-reconciliation.service.spec.ts test/quality/mutation-equivalents.json .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "test: harden critical auth mutations"
```

---

### Task 6: Kill member and borrowing mutants and establish the upward-only baseline

**Recommended implementer:** `gpt-5.6-sol`, high reasoning.

**Required reviewer:** Fresh `gpt-5.6-sol`, high reasoning.

**Depends on:** Task 5 approved.

**Files:**

- Modify: `src/members/members.service.spec.ts`
- Modify: `src/borrowings/borrowings.service.spec.ts`
- Create: `test/quality/mutation-baseline.json`
- Modify: `test/quality/mutation-equivalents.json` only with independent approval
- Modify: `test/quality/mutation-policy.test.mjs`
- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-06.md`

**Interfaces:**

- Consumes: `createMemberDocument`, `createBorrowingDocument`,
  `CriticalQueryDouble<T>`, `criticalQueryResult<T>`,
  `createCriticalModelHarnesses`, and the complete Task 5 report.
- Produces: complete-profile raw score `>= 70.00`, no unreviewed critical
  finding, and schema-version-1 upward-only baseline consumed by Tasks 7–9.

- [ ] **Step 1: Use the complete report as RED**

From `reports/mutation/complete/mutation.json`, rank survivors by:

1. critical `Survived`/`NoCoverage`;
2. ownership or illegal-state logic outside an inventoried range, which requires manifest correction before tests;
3. raw combined score contribution;
4. boundary and error-path value.

Expected RED: combined raw score below `70.00`, a critical finding exists, or the baseline file is absent.

- [ ] **Step 2: Add focused member and borrowing assertions**

Use `createMemberDocument`, `createBorrowingDocument`, `criticalQueryResult`, and `createCriticalModelHarnesses`. For every chosen mutant, add a failing assertion before changing the test fixture or expectation. Cover real survivors involving:

- member self-access versus cross-member access;
- staff-only mutation boundaries;
- already-returned, not-borrowed, unavailable, or limit-reached transitions;
- transactional rollback and retry behavior;
- event durability before terminal TTL/cleanup;
- exact state, persisted calls, and emitted result, not just thrown error type.

Do not assert private implementation details when a state/result assertion can kill the mutant.

- [ ] **Step 3: Run focused GREEN**

```powershell
npx jest --runInBand members/members.service.spec.ts borrowings/borrowings.service.spec.ts
node scripts/quality/run-mutation.mjs complete
```

Expected:

- Jest exits `0`.
- Complete profile stays within `900000 ms`.
- Raw combined selected-module score is at least `70.00`.
- No unapproved critical `Survived` or `NoCoverage` mutant remains.

- [ ] **Step 4: Record the first baseline through policy code**

Add a tested `recordBaseline` export/CLI mode that refuses to write unless the complete report is policy-green, score is at least 70, exact selected scope matches, and critical findings are zero after reviewed equivalents. The tracked file must implement:

```ts
interface MutationBaseline {
  schemaVersion: 1
  profile: 'complete'
  rawCombinedScore: number
  generatedFromCommit: string
  generatedAt: string
  selectedSources: [
    'src/auth/token-session.service.ts',
    'src/auth/auth-identifier-repair.service.ts',
    'src/auth/auth-identifier-reconciliation.service.ts',
    'src/members/members.service.ts',
    'src/borrowings/borrowings.service.ts'
  ]
  sourceSha256: Record<string, string>
}
```

Validate `rawCombinedScore >= 70`, an ISO-8601 UTC `generatedAt`, a
40-character lowercase hexadecimal `generatedFromCommit`, and exactly five
64-character lowercase source hashes.

First commit the reviewed member/borrowing tests so the baseline can name a
real committed test state:

```powershell
git add src/members/members.service.spec.ts src/borrowings/borrowings.service.spec.ts test/quality/mutation-equivalents.json .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "test: harden member and borrowing mutations"
$baselineRunSha = (git rev-parse HEAD).Trim()
if ($baselineRunSha -notmatch '^[0-9a-f]{40}$') {
  throw 'Invalid baseline run SHA.'
}
node scripts/quality/run-mutation.mjs complete
```

`generatedFromCommit` must equal `$baselineRunSha`.

Run:

```powershell
node scripts/quality/mutation-policy.mjs record-baseline reports/mutation/complete/mutation.json
node scripts/quality/run-mutation.mjs complete
```

Expected: baseline creation succeeds, and the second run proves the upward-only comparison.

- [ ] **Step 5: Review and commit**

The reviewer maps each previously surviving critical mutant to a killed test or approved equivalent, recalculates raw aggregate from JSON, and checks the baseline exactly matches it.

```powershell
git add test/quality/mutation-baseline.json scripts/quality/mutation-policy.mjs test/quality/mutation-policy.test.mjs .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "test: establish critical mutation baseline"
```

---

### Task 7: Add package scripts and a separate mutation workflow

**Recommended implementer:** `gpt-5.6-sol`, high reasoning.

**Required reviewer:** Fresh `gpt-5.6-sol`, high reasoning.

**Depends on:** Task 6 approved and baseline tracked.

**Files:**

- Modify: `package.json`
- Create: `.github/workflows/mutation.yml`
- Modify: `test/quality/mutation-runner.test.mjs`
- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-07.md`

**Interfaces:**

- Consumes: Task 4 runner CLI and Task 6 tracked baseline.
- Produces: npm scripts `mutation:check`, `mutation:smoke`, and
  `mutation:complete`; separate `Selective mutation` workflow with PR,
  schedule, and manual profile contracts plus always-uploaded artifacts.

- [ ] **Step 1: Add failing static contract tests**

Assert that `package.json` contains:

```json
{
  "mutation:check": "node scripts/quality/update-critical-rule-manifest.mjs --check",
  "mutation:smoke": "node scripts/quality/run-mutation.mjs smoke",
  "mutation:complete": "node scripts/quality/run-mutation.mjs complete"
}
```

Assert `.github/workflows/mutation.yml`:

- is named `Selective mutation`;
- uses `ubuntu-24.04` and Node `22`;
- runs PR smoke;
- runs complete on schedule and manual `workflow_dispatch`;
- supports manual `smoke` and `complete` profile choices;
- uses `npm ci`;
- uploads `reports/mutation/**` with `if: always()`;
- has least-privilege `contents: read`;
- has concurrency cancellation for PR smoke only;
- does not call or replace existing coverage, changed-line, or E2E workflows.

```powershell
node --test test/quality/mutation-runner.test.mjs
```

Expected RED: missing scripts/workflow.

- [ ] **Step 2: Implement the package scripts and workflow**

Trigger rules:

```yaml
pull_request:
  paths:
    - 'src/auth/token-session.service.ts'
    - 'src/auth/token-session.service.spec.ts'
    - 'src/auth/auth-identifier-repair.service.ts'
    - 'src/auth/auth-identifier-repair.service.spec.ts'
    - 'src/auth/auth-identifier-reconciliation.service.ts'
    - 'src/auth/auth-identifier-reconciliation.service.spec.ts'
    - 'src/members/members.service.ts'
    - 'src/members/members.service.spec.ts'
    - 'src/borrowings/borrowings.service.ts'
    - 'src/borrowings/borrowings.service.spec.ts'
    - 'test/support/**'
    - 'test/quality/**'
    - 'scripts/quality/**'
    - 'stryker.config.mjs'
    - 'package.json'
    - 'package-lock.json'
    - '.github/workflows/mutation.yml'
schedule:
  - cron: '17 3 * * *'
workflow_dispatch:
  inputs:
    profile:
      description: 'Mutation profile'
      required: true
      default: 'smoke'
      type: choice
      options:
        - 'smoke'
        - 'complete'
```

Use three explicitly conditioned execution steps: `pull_request` runs
`npm run mutation:smoke`; `schedule` runs `npm run mutation:complete`;
`workflow_dispatch` runs the script matching `inputs.profile`. No event may run
both profiles. Upload JSON, HTML, duration, and summaries even when mutation
fails. Set workflow job `timeout-minutes: 17`; the wrapper's 15-minute complete
budget remains the metric and leaves two minutes for artifact upload.

- [ ] **Step 3: Run GREEN locally**

```powershell
npm run mutation:check
node --test test/quality/mutation-runner.test.mjs test/quality/mutation-policy.test.mjs
npm run mutation:smoke
```

Expected: all exit `0`, and smoke duration is at most `300000 ms`.

- [ ] **Step 4: Review non-replacement and commit**

```powershell
git diff --name-only
git diff -- .github/workflows package.json
git add package.json .github/workflows/mutation.yml test/quality/mutation-runner.test.mjs .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "ci: report selective mutation quality"
```

The reviewer must confirm all pre-existing quality workflow files are byte-unchanged.

---

### Task 8: Prove reference-runner budgets and all integration gates

**Recommended implementer:** `gpt-5.6-sol`, high reasoning.

**Required reviewer:** Fresh `gpt-5.6-sol`, high reasoning.

**Depends on:** Task 7 approved; branch can be pushed and GitHub Actions can be manually dispatched.

**Files:**

- Modify only if evidence exposes a defect: owned Task 1–7 files
- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-08.md`

**Interfaces:**

- Consumes: Task 7 workflow, both runner profiles, all existing repository
  quality commands, and authorization to push/dispatch the implementation
  branch.
- Produces: reference-runner smoke/complete Action URLs and artifacts,
  measured durations, mutation-policy verdicts, and separate existing-gate
  results.

- [ ] **Step 1: Run local preflight**

```powershell
npm run mutation:check
node --test test/quality/mutation-policy.test.mjs test/quality/mutation-runner.test.mjs
npm run mutation:smoke
npm run mutation:complete
```

Expected: all exit `0`; local timing is diagnostic only.

- [ ] **Step 2: Dispatch both profiles on the reference runner**

After pushing the current branch with user authorization:

```powershell
$branchName = (git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branchName)) { throw 'A named branch is required.' }
gh workflow run mutation.yml --ref $branchName -f profile=smoke
gh workflow run mutation.yml --ref $branchName -f profile=complete
```

Use `gh run list --workflow mutation.yml --branch $branchName` to locate both real run ids, then `gh run watch` each id and `gh run download` its artifact. Record exact run URL, commit SHA, runner image, Node version, exit, score, critical findings, and `durationMs`.

Expected:

- smoke `durationMs <= 300000`;
- complete `durationMs <= 900000`;
- raw complete score `>= 70.00` and `>= baseline`;
- exact five-file complete scope;
- zero unapproved critical findings;
- JSON, HTML, summary, and duration artifacts downloadable for both.

Do not estimate reference timing from local runs.

- [ ] **Step 3: Run all existing independent gates**

Use non-mutating ESLint:

```powershell
npm run test:quality-reporting
npx eslint "{src,apps,libs,test}/**/*.ts"
npm run build
npm run test:cov
npm run test:e2e:report

$progressPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md'
$baseShaMatch = Select-String -LiteralPath $progressPath -Pattern '^Base SHA: ([0-9a-f]{40})$'
if ($baseShaMatch.Matches.Count -ne 1) { throw 'Invalid Plan 5 Base SHA.' }
$plan5BaseSha = $baseShaMatch.Matches[0].Groups[1].Value
New-Item -ItemType Directory -Force -Path 'test-results' | Out-Null
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$backendDiff = git diff --unified=0 "$plan5BaseSha...HEAD" -- src test
[System.IO.File]::WriteAllLines(
  (Join-Path (Resolve-Path 'test-results') 'pull-request.diff'),
  [string[]]$backendDiff,
  $utf8NoBom
)
node -e "const s=require('./coverage/backend-unit/coverage-summary.json');const t={'src/auth/token-session.service.ts':[88,103],'src/auth/auth-identifier-repair.service.ts':[94,110],'src/auth/auth-identifier-reconciliation.service.ts':[163,191],'src/members/members.service.ts':[160,188],'src/borrowings/borrowings.service.ts':[105,116],'src/auth/permissions.service.ts':[71,74]};for(const [suffix,[min,total]] of Object.entries(t)){const e=Object.entries(s).find(([k])=>k.replace(/\\/g,'/').endsWith(suffix));if(!e||e[1].branches.total!==total||e[1].branches.covered<min)process.exit(1)}"
npm run quality:report:backend -- --producer-outcome backend-unit=success --producer-outcome backend-e2e=success --changed-line-diff test-results/pull-request.diff --changed-line-lcov coverage/backend-unit/lcov.info
npm run quality:report:backend -- --check-only --producer-outcome backend-unit=success --producer-outcome backend-e2e=success --changed-line-diff test-results/pull-request.diff --changed-line-lcov coverage/backend-unit/lcov.info

npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:coverage
New-Item -ItemType Directory -Force -Path 'frontend/test-results' | Out-Null
$frontendDiff = git diff --unified=0 "$plan5BaseSha...HEAD" -- frontend/src
[System.IO.File]::WriteAllLines(
  (Join-Path (Resolve-Path 'frontend/test-results') 'pull-request.diff'),
  [string[]]$frontendDiff,
  $utf8NoBom
)
npm run quality:report:frontend-unit -- --producer-outcome frontend-lint=success --producer-outcome frontend-unit=success --changed-line-diff frontend/test-results/pull-request.diff --changed-line-lcov frontend/coverage/lcov.info
npm run quality:report:frontend-unit -- --check-only --producer-outcome frontend-lint=success --producer-outcome frontend-unit=success --changed-line-diff frontend/test-results/pull-request.diff --changed-line-lcov frontend/coverage/lcov.info
npm --prefix frontend run test:e2e:report
npm run quality:report:frontend-e2e -- --producer-outcome frontend-playwright=success
npm run quality:report:frontend-e2e -- --check-only --producer-outcome frontend-playwright=success
git diff --check "$plan5BaseSha...HEAD"
```

Expected: every command exits `0`; the mutation workflow supplements rather than replaces them.
Do not run the root `npm run lint` because it includes `--fix`.

- [ ] **Step 4: Apply runtime stop rules**

If a budget fails:

1. confirm reports are on `ubuntu-24.04`, Node 22 and correspond to the same commit;
2. remove redundant test setup and improve `perTest` test selection;
3. reduce mutation-run concurrency only if instability, or increase it only after three clean runs;
4. rerun both reference profiles.

Never meet the budget by dropping a selected file, dropping a critical rule, excluding a mutator, raising the budget, weakening assertions, or accepting an unproved equivalent. If the budget still fails after test-selection/configuration work, stop the plan and report it blocked.

- [ ] **Step 5: Review and commit evidence**

```powershell
git add .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "docs: record mutation acceptance evidence"
```

---

### Task 9: Whole-plan independent review and handoff

**Recommended implementer:** `gpt-5.6-sol`, high reasoning.

**Required reviewer:** A different fresh `gpt-5.6-sol`, high reasoning.

**Depends on:** Task 8 approved and reference evidence green.

**Files:**

- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-09.md`
- Create: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/review.md`
- Modify: `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`

**Interfaces:**

- Consumes: all task reports, reference artifacts, tracked manifest,
  allowlist/baseline, Task 0 Base SHA, and existing-gate evidence.
- Produces: final independent `APPROVED`/`REJECTED` verdict and the reviewed
  Plan 5 handoff commit.

- [ ] **Step 1: Verify scope and source integrity**

```powershell
$progressPath = '.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md'
$baseShaMatch = Select-String -LiteralPath $progressPath -Pattern '^Base SHA: ([0-9a-f]{40})$'
if ($baseShaMatch.Matches.Count -ne 1) { throw 'Invalid Plan 5 Base SHA.' }
$plan5BaseSha = $baseShaMatch.Matches[0].Groups[1].Value
git diff --name-only $plan5BaseSha..HEAD
git diff --check $plan5BaseSha..HEAD
git diff --exit-code $plan5BaseSha..HEAD -- src/auth/token-session.service.ts src/auth/auth-identifier-repair.service.ts src/auth/auth-identifier-reconciliation.service.ts src/members/members.service.ts src/borrowings/borrowings.service.ts
```

Expected: only owned files and approved test files changed; whitespace check passes; all five production files are unchanged.

- [ ] **Step 2: Re-run deterministic checks**

```powershell
npm run mutation:check
node --test test/quality/mutation-policy.test.mjs test/quality/mutation-runner.test.mjs
npm ls @stryker-mutator/core @stryker-mutator/jest-runner jest ts-jest --depth=0
```

Expected: all pass; both Stryker packages are exactly `9.6.1`; Jest/ts-jest match Task 1's pre-install versions.

- [ ] **Step 3: Audit generated reference evidence**

The reviewer recalculates the raw combined score from the complete JSON, verifies every reported mutant belongs to one of the five selected files, checks every critical overlap, validates all equivalent fingerprints and expiries, verifies the tracked baseline is not above the report that created it and not below the accepted current score, and confirms both duration budgets from downloaded Action artifacts.

`review.md` must include:

- dependency and base-SHA verdict;
- exact selected sources;
- raw aggregate and per-module mutation scores;
- baseline comparison;
- critical rule ids and disposition counts;
- every equivalent entry or `None`;
- smoke and complete Action URLs and durations;
- versions and runner image;
- existing gate results;
- prohibited-file check;
- final `APPROVED` or `REJECTED`.

- [ ] **Step 4: Search for unfinished evidence**

```powershell
rg -n "TBD|TODO|<[^>]+>|test\\([^)]*,\\s*\\.\\.\\.\\)|origin/main|origin/master|allow_failure|continue-on-error" .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing scripts/quality test/quality stryker.config.mjs .github/workflows/mutation.yml
```

Expected: no placeholder, guessed base ref, or failure-bypass match. Legitimate source-code TODOs outside this plan are out of scope.

- [ ] **Step 5: Final integration rerun and handoff commit**

Re-run the Task 8 integration commands if any tracked implementation file changed after its accepted Action run. A changed commit requires new smoke and complete reference runs.

```powershell
git add .superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing
git commit -m "docs: record selective mutation handoff"
```

The reviewer records the final commit hash after commit and amends only the handoff evidence.

---

## 6. Global stop and rollback rules

Stop immediately and preserve evidence when:

- Plan 3 Task 10 is not reviewed or is not an ancestor of `HEAD`;
- any selected production source changes after manifest review;
- Jest or ts-jest changes while installing Stryker;
- Stryker cannot prove supported `perTest` execution with the pinned Stryker
  9.6.1 Jest runner;
- JSON, HTML, or duration evidence is missing;
- complete mutation scope is not exactly the five selected files;
- a critical `Survived` or `NoCoverage` mutant lacks an exact independently reviewed equivalent fingerprint;
- raw combined score is below 70 or below the tracked baseline;
- smoke exceeds five minutes or complete exceeds fifteen minutes on the reference runner;
- an existing coverage, changed-line, frontend, or E2E gate regresses.

Rollback is commit-granular:

- revert Task 1 to remove both pinned Stryker packages together;
- revert Tasks 2–4 together if the policy/reporting contract is invalid;
- revert only the affected test-hardening commit for an incorrect behavioral assertion;
- remove `.github/workflows/mutation.yml` by reverting Task 7; never edit an existing workflow to compensate.

Do not delete failed JSON/HTML/duration artifacts until their details have been copied to the task report.

## 7. Definition of done

Plan 5 is complete only when:

- all ten task reports contain the exact ledger headings and real commit hashes;
- every implementation and review dispatch records model plus reasoning effort;
- `@stryker-mutator/core` and `@stryker-mutator/jest-runner` are pinned at `9.6.1`;
- Jest/ts-jest were not upgraded;
- both profiles use supported Jest `perTest` analysis and JSON/HTML reporters;
- complete mutation covers exactly the five selected services;
- raw combined score is at least 70 and does not fall below the tracked baseline;
- all critical-range survivors/no-coverage mutants are killed or exactly allowlisted after independent review;
- PR smoke and complete scheduled/manual profiles pass their reference budgets;
- the separate mutation workflow preserves artifacts and does not replace any existing quality gate;
- non-mutating lint, backend tests/coverage, frontend lint/coverage, Playwright, and changed-line checks pass;
- the final fresh reviewer writes `APPROVED`.
