# Task 03 Evidence

## Task

Create the source-hashed critical-rule manifest and strict empty allowlist, plus the review-candidate updater. Task 4 has not started.

## Implementer model and reasoning

Requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task3_implementer`; substitution none. The assignment was recorded before substantive implementation.

## Reviewer model and reasoning

Requested and actual reviewer: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task3_reviewer`; substitution none. Initial verdict: **CHANGES_REQUIRED** with Critical `0`, Important `1`, Minor `0`. The implementer has not performed or pre-approved the independent re-review.

## Base SHA

Task 3 starting SHA: `607e0b26e8590866e6bc1f5ab2399cf384ac17de`. Locked Plan 5 base: `b678209e23ef7020c21ff565327de1b229c835f6`, verified as an ancestor before work.

## Files changed

- `scripts/quality/update-critical-rule-manifest.mjs`
- `test/quality/mutation-policy.test.mjs`
- `test/quality/critical-rule-manifest.json`
- `test/quality/mutation-equivalents.json`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-03.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`

No production, dependency, runner, Stryker configuration, workflow, or Task 4+ file changed.

## RED command and exit

```powershell
node --test test/quality/mutation-policy.test.mjs
# exit 1
```

## RED evidence

The test-first run contained `43` tests: `37` passed and the `6` newly added Task 3 tests failed. Every new failure was the intended missing-artifact failure:

```text
Error: Cannot find module '...\scripts\quality\update-critical-rule-manifest.mjs'
code: 'MODULE_NOT_FOUND'
tests 43
pass 37
fail 6
duration_ms 415.2626
```

The pre-existing Task 2 policy tests stayed GREEN; the failure was neither test syntax nor fixture setup.

## GREEN command and exit

```powershell
node --test test/quality/mutation-policy.test.mjs
# exit 0

node scripts/quality/update-critical-rule-manifest.mjs --check
# exit 0
```

## GREEN evidence

Initial exact GREEN before the final formatting pass:

```text
tests 43
suites 0
pass 43
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 501.5477
TEST_EXIT=0
```

The standalone updater check reported:

```text
Critical mutation manifest check passed (29 rules).
CHECK_EXIT=0
```

Fresh post-format exact GREEN:

```text
tests 43
suites 0
pass 43
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 487.0329
TEST_EXIT=0
```

Fresh post-format standalone check again reported `Critical mutation manifest check passed (29 rules).` with `CHECK_EXIT=0`.

Focused non-mutating quality checks:

```powershell
npx --no-install eslint scripts/quality/update-critical-rule-manifest.mjs test/quality/mutation-policy.test.mjs
# ESLINT_EXIT=0

npx --no-install prettier --check scripts/quality/update-critical-rule-manifest.mjs test/quality/mutation-policy.test.mjs test/quality/critical-rule-manifest.json test/quality/mutation-equivalents.json
# PRETTIER_EXIT=0
```

Prettier reported `All matched files use Prettier code style!`; ESLint emitted no errors or warnings.

### Fix Round 1 RED and initial GREEN

The reviewer finding was converted into one focused regression that hand-inventories `93` Plan 3-reviewed critical occurrence points and requires every point to overlap at least one real tracked manifest range.

```powershell
node --test test/quality/mutation-policy.test.mjs
# FIX1_RED_EXIT=1
```

```text
tests 44
pass 43
fail 1
duration_ms 469.0597
```

The single intended failure, `covers every Plan 3-reviewed critical invariant occurrence with a manifest rule`, reported `59` uncovered points: token session `15`, repair `23`, reconciliation `9`, members `8`, and borrowings `4`. The failure included all reviewer examples and proved the defect before manifest changes.

After expanding only the tracked manifest:

```powershell
node --test test/quality/mutation-policy.test.mjs
# FIX1_INITIAL_GREEN_EXIT=0
```

```text
tests 44
pass 44
fail 0
duration_ms 474.1798
```

The strict standalone updater then exited `0` with `Critical mutation manifest check passed (60 rules).`

Fresh final pre-commit verification repeated the Node suite at `44/44`, exit `0`, `471.6878 ms`; repeated the updater check at `60` rules, exit `0`; focused ESLint exited `0`; and focused Prettier exited `0` with `All matched files use Prettier code style!`.

## Focused metrics

- `60` narrow critical rules cover all `93/93` hand-reviewed critical occurrence points and `5/5` selected production sources.
- All six required categories are represented: authorization/role denial; member/staff ownership; replay/revocation; revoked/expired token rejection; illegal borrowing transitions; and terminal event/cleanup/TTL ordering.
- Every rule contains exactly the schema-v1 fields, a positive inclusive range, the exact selected path, the source's full SHA-256, and exact unique start/end anchor lines. Final per-source counts are token session `12`, repair `18`, reconciliation `15`, members `8`, and borrowings `7`.
- `test/quality/mutation-equivalents.json` is exactly `{ "schemaVersion": 1, "entries": [] }`; no equivalent is presumed.
- `--check` is read-only and fail-closed. `--candidate` refreshes hashes/ranges only into `reports/mutation/critical-rule-manifest.candidate.json` and never overwrites tracked JSON.

### Reviewed rule inventory

Every supporting Plan 3 report/review cited below is independently approved in the Plan 3 ledger and ultimately covered by the approved Task 10 whole-plan handoff. Test titles are exact titles from the corresponding selected service spec.

#### `src/auth/token-session.service.ts`

Source SHA-256 for every rule in this group: `72da52c9835a71d59bca5cd6b367be54b0257541a5bf273d4396700809fcd051`. Supporting Plan 3 evidence: Task 1 report/review and Task 10 review.

| Rule id                                           | Inclusive range | Category                                     | Exact start anchor                                                            | Exact end anchor                                                            | Supporting Plan 3 test                                                                                                                                                                                                                                      |
| ------------------------------------------------- | --------------: | -------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token-rotation-input-and-interrupted-cas-denial` |         131-171 | replay/revocation; revoked/expired rejection | `  async rotate(refreshToken: string): Promise<RefreshTokenRotationResult> {` | `    if (!rotatedFamily) {`                                                 | `leaves an uncertain family CAS pending and takeover-eligible`; `finalizes an uncertain family CAS that installed a successor`                                                                                                                              |
| `token-active-unexpired-family-cas`               |         147-150 | replay/revocation; revoked/expired rejection | `            familyId: prepared.family.familyId,`                             | `            expiresAt: { $gt: now },`                                      | `commits a hash-only marker after operation-correlated family CAS`                                                                                                                                                                                          |
| `token-rotation-failure-revokes-family`           |         171-201 | replay/revocation                            | `    if (!rotatedFamily) {`                                                   | `    return this.rotationResult(rotatedFamily, nextRefreshToken);`          | `fails closed when the family compare-and-swap returns no successor`; `fails closed when marker commitment is interrupted after family CAS`; `fails closed when a completed rotation marker cannot be found`                                                |
| `token-expired-marker-reconciliation-revokes`     |         249-264 | replay/revocation; revoked/expired rejection | `          family?.status === RefreshTokenFamilyStatus.Active &&`             | `          reason,`                                                         | `reconciles orphaned rotations and leaves expired pre-CAS work for takeover`                                                                                                                                                                                |
| `token-direct-revocation-selectors`               |         275-310 | replay/revocation; member/staff ownership    | `  async revokeRefreshToken(`                                                 | `  hashRefreshToken(refreshToken: string): string {`                        | `revokes families and subjects idempotently`; `revokes current and all subject sessions without exposing token hashes`                                                                                                                                      |
| `token-prepare-marker-race-denial`                |         348-397 | replay/revocation; revoked/expired rejection | `  private async prepareRotation(`                                            | `  private async handleExistingMarker(`                                     | `leaves the family unchanged when pending marker insertion fails`; `denies a lost duplicate-marker race without mutating the family`; `rejects malformed, missing, expired, and revoked credentials without mutation`                                       |
| `token-rejects-missing-revoked-expired-family`    |         362-368 | revoked/expired rejection                    | `        currentTokenHash: tokenHash,`                                        | `    if (!family) {`                                                        | `rejects malformed, missing, expired, and revoked credentials without mutation`                                                                                                                                                                             |
| `token-committed-marker-replay-revokes`           |         401-410 | replay/revocation                            | `    if (marker.status === RefreshTokenReplayMarkerStatus.Committed) {`       | `    if (family?.lastRotationOperationId === marker.rotationOperationId) {` | `revokes on replay from any committed generation`                                                                                                                                                                                                           |
| `token-pending-marker-takeover-guard`             |         420-475 | replay/revocation; revoked/expired rejection | `    const canTakeOver =`                                                     | `  private async recoverAfterInterruptedCas(`                               | `denies an active pending lease without mutating the family`; `takes over an expired pre-CAS lease and rotates once`; `finalizes and revokes a pending marker whose lease is missing`; `denies a lost expired-marker takeover without creating a successor` |
| `token-interrupted-cas-finalization`              |         475-513 | replay/revocation; revoked/expired rejection | `  private async recoverAfterInterruptedCas(`                                 | `  private async commitMarker(`                                             | `leaves an uncertain family CAS pending and takeover-eligible`; `finalizes an uncertain family CAS that installed a successor`; `reconciles orphaned rotations and leaves expired pre-CAS work for takeover`                                                |
| `token-marker-commit-cas`                         |         513-536 | replay/revocation                            | `  private async commitMarker(`                                               | `  private async revokeAsReplay(familyId: string): Promise<void> {`         | `commits a hash-only marker after operation-correlated family CAS`; `fails closed when marker commitment is interrupted after family CAS`; `fails closed when a completed rotation marker cannot be found`                                                  |
| `token-replay-revocation-clears-current-hash`     |         536-553 | replay/revocation                            | `  private async revokeAsReplay(familyId: string): Promise<void> {`           | `      $unset: { currentTokenHash: 1 },`                                    | `revokes on replay from any committed generation`; `revokes current and all subject sessions without exposing token hashes`                                                                                                                                 |

#### `src/auth/auth-identifier-repair.service.ts`

Source SHA-256 for every rule in this group: `a8f4bf8847acfed54dc0c9a7258a01979bed058ba3f47bcdd37f84cae83b4e1f`. Supporting Plan 3 evidence: Tasks 2-3 reports/reviews and Task 10 review. The approved parked non-load-bearing Minor about `expect.any(String)` remains disclosed under Deferred findings.

| Rule id                                           | Inclusive range | Category                                                    | Exact start anchor                                                                    | Exact end anchor                                                                      | Supporting Plan 3 test                                                                                                                                                                                                                   |
| ------------------------------------------------- | --------------: | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repair-dry-run-authorizes-and-binds-claimants`   |          93-134 | authorization/role denial; member/staff ownership           | `  async dryRun(input: OfflineRepairRequest): Promise<OfflineRepairResult> {`         | `  async apply(input: OfflineRepairRequest): Promise<OfflineRepairResult> {`          | `dry-runs an existing matching operation without mutating any model`; `rejects an unavailable manifest key before looking up an operation`; Task 2 invalid-claimant proof                                                                |
| `repair-apply-authorizes-and-binds-manifest`      |         134-168 | authorization/role denial; member/staff ownership           | `  async apply(input: OfflineRepairRequest): Promise<OfflineRepairResult> {`          | `    const batches = this.partition(manifest);`                                       | `rejects a missing current key version before operation lookup or creation`; `fails closed when a resume manifest differs from the persisted hash`; `replays a completed operation without preparing or activating batches`              |
| `repair-reauthorizes-every-apply-boundary`        |         168-186 | authorization/role denial                                   | `    const batches = this.partition(manifest);`                                       | `      await this.completeParent(input, manifest, actor.subjectId);`                  | `uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically`; `fails closed before parent completion when authorization expires`                                                                         |
| `repair-cancel-authorizes-before-parent-failure`  |         202-250 | authorization/role denial                                   | `  async cancel(input: OfflineRepairRequest): Promise<OfflineRepairResult> {`         | `      await this.finishFailedParent(input.operationId, actor.subjectId);`            | `leaves cancellation retryable when authorization expires between compensation batches`; `revalidates authorization after the final compensation batch before parent mutations`                                                          |
| `repair-batch-identity-and-checkpoint`            |         265-325 | member/staff ownership                                      | `  private async prepareBatch(`                                                       | `        } else if (batch.checkpointHash !== checkpointHash) {`                       | `prepares a new bounded batch before applying its aggregate changes`; `rejects a mismatched pending batch checkpoint before aggregate mutation and ends the session`                                                                     |
| `repair-batch-transactional-ownership`            |         325-369 | member/staff ownership; terminal event/cleanup ordering     | `        } else if (batch.checkpointHash !== checkpointHash) {`                       | `  private async activateBatch(operationId: string, batchNumber: number) {`           | `prepares a new bounded batch before applying its aggregate changes`; `fails before repair writes when MongoDB transaction support is absent`; `updates staff email and member loginIdentifier while incrementing authVersion once`      |
| `repair-batch-activation-gate-ownership`          |         369-417 | member/staff ownership; terminal event/cleanup ordering     | `  private async activateBatch(operationId: string, batchNumber: number) {`           | `  private async completeParent(`                                                     | `activates a prepared batch and keeps its identifiers gated until parent completion`; `does not activate missing or already activated batches`; `rejects activation when a public apply observes a batch that is no longer prepared`     |
| `repair-parent-conflict-ownership-finalization`   |         417-464 | member/staff ownership; terminal event/cleanup/TTL ordering | `  private async completeParent(`                                                     | `              operationId: input.operationId,`                                       | `releases the original conflict under the first reassigned subject and records the terminal event first`; `completes the parent only after recording its terminal event`                                                                 |
| `repair-completed-event-precedes-terminal-state`  |         464-503 | terminal event/cleanup/TTL ordering                         | `              operationId: input.operationId,`                                       | `  private async compensateBatch(`                                                    | `completes the parent only after recording its terminal event`; `uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically`                                                                             |
| `repair-reverse-compensation-ownership`           |         503-564 | member/staff ownership; terminal event/cleanup ordering     | `  private async compensateBatch(`                                                    | `  private async finishFailedParent(operationId: string, actorId: string) {`          | `compensates batch assignments in reverse and releases their reservations`; `skips non-releasable cancellation assignments and still records a redacted failed terminal event first`; `does not compensate an already compensated batch` |
| `repair-failed-event-precedes-terminal-state`     |         564-610 | terminal event/cleanup/TTL ordering                         | `  private async finishFailedParent(operationId: string, actorId: string) {`          | `  private async reserveReplacement(`                                                 | `records a cancellation terminal event before failing its parent`; `reverse-compensates batches before terminal cancellation`                                                                                                            |
| `repair-replacement-reservation-ownership`        |         610-657 | member/staff ownership                                      | `  private async reserveReplacement(`                                                 | `  private async applyAggregateIdentifier(`                                           | `reserves a replacement with pending ownership for the repair operation`; `maps a null replacement upsert to the fixed unavailable error and ends the session`; `maps duplicate replacement writes to the fixed reservation conflict`    |
| `repair-writes-only-owned-aggregate-field`        |         657-679 | member/staff ownership                                      | `  private async applyAggregateIdentifier(`                                           | `      { $set: { [field]: item.newIdentifier }, $inc: { authVersion: 1 } },`          | `updates staff email and member loginIdentifier while incrementing authVersion once`                                                                                                                                                     |
| `repair-restores-exact-aggregate-owner`           |         684-706 | member/staff ownership                                      | `  private async setAggregateIdentifier(`                                             | `  private async loadConflict(conflictId: string): Promise<AuthIdentifierDocument> {` | `compensates batch assignments in reverse and releases their reservations`; `skips the aggregate update when the replacement identifier is already assigned`                                                                             |
| `repair-loads-only-active-conflict`               |         706-714 | member/staff ownership; authorization/role denial           | `  private async loadConflict(conflictId: string): Promise<AuthIdentifierDocument> {` | `  private validateManifestSubjects(`                                                 | Task 2 failure-path proof for indistinguishable missing/non-conflict reservations; `releases the original conflict under the first reassigned subject and records the terminal event first`                                              |
| `repair-manifest-covers-exact-conflict-claimants` |         714-733 | member/staff ownership                                      | `  private validateManifestSubjects(`                                                 | `        'Repair manifest must account for every conflict claimant',`                 | Task 2 failure-path proof for invalid claimant accounting; Task 3 `releases the original conflict under the first reassigned subject and records the terminal event first`                                                               |
| `repair-persisted-manifest-authorization`         |         738-762 | authorization/role denial; member/staff ownership           | `  private verifyPersistedManifest(`                                                  | `  private requireKey(version: number): string \| Buffer {`                           | `fails closed when a resume manifest differs from the persisted hash`; `rejects an unavailable manifest key before looking up an operation`                                                                                              |
| `repair-resume-actor-binding`                     |         788-807 | authorization/role denial; member/staff ownership           | `  private async recordResume(`                                                       | `  private partition(`                                                                | `uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically`; Task 2 unstable-resume-id failure-path proof                                                                                               |

#### `src/auth/auth-identifier-reconciliation.service.ts`

Source SHA-256 for every rule in this group: `b7f4f2b83c5cceb76bb19b37e0436a4493abb7b8d4591bc38cc0b5f064c65803`. Supporting Plan 3 evidence: Tasks 4-5 reports/reviews and Task 10 review.

| Rule id                                                | Inclusive range | Category                                                       | Exact start anchor                                                                | Exact end anchor                                                           | Supporting Plan 3 test                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | --------------: | -------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reconciliation-renews-only-owned-lease`               |         179-205 | member/staff ownership; terminal event/cleanup ordering        | `  async renewLease(operationId: string): Promise<boolean> {`                     | `  private registerSchedule(): void {`                                     | `uses MongoDB time for atomic lease acquisition and renewal`; `reports lost lease ownership without changing operation state`                                                                                                                               |
| `reconciliation-bounded-claim-processing`              |         222-267 | member/staff ownership; terminal event/cleanup ordering        | `  private async runBoundedPass(): Promise<AuthIdentifierReconciliationResult> {` | `  private candidateFilter(clientCutoff: Date): Record<string, unknown> {` | `caps claims at the configured batch size and releases every acquired lease`; `continues processing later claimed operations after one operation fails`; `releases every claimed lease when one public operation recovery fails`                            |
| `reconciliation-candidate-status-and-lease-filter`     |         267-289 | terminal event/cleanup/TTL ordering                            | `  private candidateFilter(clientCutoff: Date): Record<string, unknown> {`        | `  private repairKeyAvailable(`                                            | `processes claimed terminal cleanup and releases its lease through the public pass`; `ignores clean terminal operations`                                                                                                                                    |
| `reconciliation-claims-exact-eligible-operation`       |         304-360 | member/staff ownership; terminal event/cleanup ordering        | `  private async claim(`                                                          | `  private async process(`                                                 | `uses MongoDB time for atomic lease acquisition and renewal`; `counts a lost claim as examined without claiming or processing it`; `caps claims at the configured batch size and releases every acquired lease`                                             |
| `reconciliation-terminal-cleanup-and-state-dispatch`   |         360-378 | terminal event/cleanup/TTL ordering                            | `  private async process(`                                                        | `    switch (operation.status) {`                                          | `processes claimed terminal cleanup and releases its lease through the public pass`; `does not run cleanup mutations for a clean terminal operation`                                                                                                        |
| `reconciliation-invalid-state-fails-terminally`        |         378-405 | authorization/role denial; terminal event/cleanup/TTL ordering | `    switch (operation.status) {`                                                 | `        await this.failInvalidOperation(operation);`                      | `fails an invalid transition terminally with a redacted event`                                                                                                                                                                                              |
| `reconciliation-invalid-event-precedes-terminal-ttl`   |         444-495 | terminal event/cleanup/TTL ordering                            | `  private async failInvalidOperation(`                                           | `  private async attachMissingReservationReferences(`                      | `fails an invalid transition terminally with a redacted event`; `persists the idempotent terminal event before writing terminal TTL state`                                                                                                                  |
| `reconciliation-attaches-operation-owned-reservations` |         495-551 | member/staff ownership                                         | `  private async attachMissingReservationReferences(`                             | `  private async recoverApplying(`                                         | `discovers pending reservations and attaches an HMAC-only reference`; `attaches an HMAC-only reservation reference under the requested key version`; `ignores an unmatched discovered reservation without mutating assignments`                             |
| `reconciliation-recovers-applied-ownership`            |         551-596 | member/staff ownership; terminal event/cleanup ordering        | `  private async recoverApplying(`                                                | `  private async recoverCompensating(`                                     | `recovers applied reservations into finalization when every assignment is durable`; `returns incomplete application recovery to a retryable state`; `skips already-applied and already-compensated assignments during recovery`                             |
| `reconciliation-recovers-compensated-ownership`        |         596-654 | member/staff ownership; terminal event/cleanup ordering        | `  private async recoverCompensating(`                                            | `  private async finalize(`                                                | `compensates a pending reservation and advances a recovered operation to finalization`; `returns compensation with applied assignments to a retryable state`; `returns missing application and operation-mismatched compensation reservations to retryable` |
| `reconciliation-terminal-event-and-ttl-ordering`       |         654-712 | terminal event/cleanup/TTL ordering                            | `  private async finalize(`                                                       | `                  },`                                                     | `records the terminal event before finalizing cleanup-pending state without a parent TTL`; `records the terminal event before clean terminal state and retention TTL`                                                                                       |
| `reconciliation-bounded-gate-and-batch-cleanup`        |         721-758 | member/staff ownership; terminal event/cleanup/TTL ordering    | `  private async cleanup(`                                                        | `          { updatePipeline: true },`                                      | `bounds gate and batch cleanup and expires the parent only after both are clear`; `releases residual gates for a failed terminal repair instead of unlocking them`; `defers batch expiry when gated identifiers exhaust cleanup capacity`                   |
| `reconciliation-parent-ttl-after-cleanup-and-event`    |         763-805 | terminal event/cleanup/TTL ordering                            | `    await this.renewLease(operation.operationId);`                               | `  private async findReservation(`                                         | `keeps cleanup pending while gate or batch work remains`; `completes empty cleanup remainder and applies retention only after terminal event fields exist`                                                                                                  |
| `reconciliation-finds-exact-assignment-reservation`    |         805-820 | member/staff ownership                                         | `  private async findReservation(`                                                | `  private async transition(`                                              | `returns missing application and operation-mismatched compensation reservations to retryable`; `skips already-applied and already-compensated assignments during recovery`                                                                                  |
| `reconciliation-owned-transition-and-release`          |         820-846 | member/staff ownership; terminal event/cleanup ordering        | `  private async transition(`                                                     | `  private correlationFor(`                                                | `moves a recoverable failed operation through a valid retry transition`; `reports lost lease ownership without changing operation state`; `releases every claimed lease when one public operation recovery fails`                                           |

#### `src/members/members.service.ts`

Source SHA-256 for every rule in this group: `03e5a2d54626ef11cc9f9d73dfcda4a39d30d7bab3d2d249985dfeec2baf0ad9`. Supporting Plan 3 evidence: Tasks 6-7 reports/reviews and Task 10 review.

| Rule id                                           | Inclusive range | Category                                          | Exact start anchor                                                                   | Exact end anchor                                                                     | Supporting Plan 3 test                                                                                                                                                                                                                                       |
| ------------------------------------------------- | --------------: | ------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `member-update-reservation-and-lifecycle-state`   |         164-221 | member/staff ownership; replay/revocation         | `  async update(`                                                                    | `      if (emailChanged && previousEmail) {`                                         | `updates status, loan count, membership type, and audit actor`; `reserves a changed email, revokes active sessions, and audits identifier and status changes`; `initializes an absent auth version and revokes only active member families on status change` |
| `member-update-compensates-and-revokes-lifecycle` |         221-241 | member/staff ownership; replay/revocation         | `      if (emailChanged && previousEmail) {`                                         | `  async getPolicyStatus(id: string): Promise<MemberPolicyStatusResponseDto> {`      | `reserves a changed email, revokes active sessions, and audits identifier and status changes`; `releases a newly reserved email when saving the member change fails`; `clears email without reserving an empty identifier and revokes sessions`              |
| `member-active-auth-status-required`              |         284-291 | authorization/role denial                         | `  async findActiveById(id: string): Promise<MemberDocument> {`                      | `      throw new NotFoundException('Active member not found');`                      | `returns the active-member not-found contract when the member does not exist`; Task 7 public-contract proof for absent/non-active auth status                                                                                                                |
| `member-credentials-deny-duplicate-owner`         |         304-325 | member/staff ownership; authorization/role denial | `  async setMemberCredentials(`                                                      | `      throw new ConflictException('Member login identifier already exists');`       | `leaves member credentials unchanged when the normalized login identifier conflicts`; Task 6 identifier proof for foreign member/staff denial                                                                                                                |
| `member-credential-reservation-and-revocation`    |         328-370 | member/staff ownership; replay/revocation         | `    await this.reserveIdentifier(`                                                  | `  private async findDocumentById(id: string): Promise<MemberDocument> {`            | `sets normalized credentials, increments auth version, and records the actor`; `releases a newly reserved credential identifier when saving credentials fails`; `recovers a released credential identifier and revokes sessions after saving credentials`    |
| `member-reservation-enforces-exact-owner`         |         410-469 | member/staff ownership                            | `  private async reserveIdentifier(`                                                 | `  private async releaseIdentifier(`                                                 | `keeps a same-owner active identifier idempotent without a prior member login`; `reactivates a released reservation with member ownership and no release timestamp`; `maps an identifier create duplicate-key rejection to the fixed conflict`               |
| `member-release-requires-exact-active-owner`      |         469-492 | member/staff ownership                            | `  private async releaseIdentifier(`                                                 | `  private async revokeSessions(subjectId: string, reason: string): Promise<void> {` | `does not release its active reservation when credentials keep the same normalized identifier`; `releases only the newly acquired reservation when credential persistence fails`; Task 6 exact ownership-selector proof                                      |
| `member-session-revocation-clears-token-hashes`   |         492-506 | member/staff ownership; replay/revocation         | `  private async revokeSessions(subjectId: string, reason: string): Promise<void> {` | `        $unset: { currentTokenHash: '', previousTokenHash: '' },`                   | `initializes an absent auth version and revokes only active member families on status change`; `clears email without reserving an empty identifier and revokes sessions`                                                                                     |

#### `src/borrowings/borrowings.service.ts`

Source SHA-256 for every rule in this group: `91a41fb81abd1c1ebc57586fcb4f07299fc455735973f23289a62348c318b647`. Supporting Plan 3 evidence: Task 8 report/review and Task 10 review.

| Rule id                                                | Inclusive range | Category                                                 | Exact start anchor                     | Exact end anchor                                                     | Supporting Plan 3 test                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | --------------: | -------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `borrowing-create-requires-staff-and-policy`           |          54-104 | authorization/role denial; illegal borrowing transitions | `  async create(`                      | `      return this.toResponse(borrowing, borrowedAt, book, member);` | `requires an authenticated staff actor before creating borrowing records`; `creates a borrowing only after active member, book, category, and membership policy pass`; `does not change book availability or member loans when borrowing persistence fails`                                         |
| `borrowing-return-requires-staff-and-returnable-state` |         108-150 | authorization/role denial; illegal borrowing transitions | `  async returnBorrowing(`             | `      return this.toResponse(borrowing, returnedAt, book, member);` | `requires an authenticated staff actor before returning borrowing records`; `returns an overdue loan at the supplied time without a negative loan count`; `denies a non-returned loan in an illegal state without writes`; `rejects a duplicate return without changing availability or loan count` |
| `borrowing-member-detail-is-owner-scoped`              |         185-205 | member/staff ownership; authorization/role denial        | `  async findOneForMember(`            | `  async findOverdue(`                                               | `applies both borrowing and member ObjectId ownership filters for self-service detail`; `does not reveal a foreign borrowing when the owner filter is absent or wrong`                                                                                                                              |
| `borrowing-member-list-rejects-cross-owner-query`      |         211-219 | member/staff ownership; authorization/role denial        | `  async findByMember(`                | `    return this.findAll({ ...query, memberId });`                   | `rejects member self-service queries with a mismatched memberId`; `uses member ownership and requested pagination values for member borrowing history`                                                                                                                                              |
| `borrowing-list-state-filters`                         |         228-262 | illegal borrowing transitions                            | `  private buildListFilter(`           | `  private async hasOverdueLoans(`                                   | `filters current borrowings to unreturned active and overdue records`; `applies the overdue-only filter before listing overdue borrowings`                                                                                                                                                          |
| `borrowing-overdue-policy-selector`                    |         262-279 | illegal borrowing transitions; member/staff ownership    | `  private async hasOverdueLoans(`     | `  private async findBorrowing(`                                     | `creates a borrowing only after active member, book, category, and membership policy pass`; Task 8 exact overdue selector proof                                                                                                                                                                     |
| `borrowing-transaction-and-staff-actor-boundary`       |         359-380 | authorization/role denial; illegal borrowing transitions | `  private async runInTransaction<T>(` | `    return actor;`                                                  | `requires an authenticated staff actor before creating borrowing records`; `requires an authenticated staff actor before returning borrowing records`; Task 8 return-boundary proof that the session ends exactly once                                                                              |

## Full-suite commands and exits

No repository-wide suite or live mutation run is required or authorized for Task 3. The exact focused Node suite, standalone updater check, focused ESLint/Prettier, source byte-identity, ownership, and whitespace checks are the scoped verification.

Fix Round 1 also runs every supporting selected-service Plan 3 suite:

```powershell
npx --no-install jest --runInBand src/auth/token-session.service.spec.ts src/auth/auth-identifier-repair.service.spec.ts src/auth/auth-identifier-reconciliation.service.spec.ts src/members/members.service.spec.ts src/borrowings/borrowings.service.spec.ts
# FIX1_PLAN3_FOCUSED_EXIT=0
```

```text
Test Suites: 5 passed, 5 total
Tests:       193 passed, 193 total
Snapshots:   0 total
Time:        6.454 s
```

The reconciliation warnings are intentional outputs of its reviewed failure-containment cases; all suites passed.

```powershell
git diff --exit-code b678209e23ef7020c21ff565327de1b229c835f6 -- src/auth/token-session.service.ts src/auth/auth-identifier-repair.service.ts src/auth/auth-identifier-reconciliation.service.ts src/members/members.service.ts src/borrowings/borrowings.service.ts
# SOURCE_IDENTITY_EXIT=0

git diff --check
# DIFF_CHECK_EXIT=0
```

Fresh working-tree hashes exactly matched the manifest:

```text
72da52c9835a71d59bca5cd6b367be54b0257541a5bf273d4396700809fcd051 src/auth/token-session.service.ts
a8f4bf8847acfed54dc0c9a7258a01979bed058ba3f47bcdd37f84cae83b4e1f src/auth/auth-identifier-repair.service.ts
b7f4f2b83c5cceb76bb19b37e0436a4493abb7b8d4591bc38cc0b5f064c65803 src/auth/auth-identifier-reconciliation.service.ts
03e5a2d54626ef11cc9f9d73dfcda4a39d30d7bab3d2d249985dfeec2baf0ad9 src/members/members.service.ts
91a41fb81abd1c1ebc57586fcb4f07299fc455735973f23289a62348c318b647 src/borrowings/borrowings.service.ts
```

Ownership inspection showed only the six Task 3-authorized implementation/evidence paths listed under Files changed. The ignored Task 03 report is force-added explicitly by the plan's commit command. No changed shared state or foreign dirty path appeared.

## Runtime evidence

- Exact RED Node-reported duration: `415.2626 ms`.
- Initial exact GREEN Node-reported duration: `501.5477 ms`.
- Fresh post-format GREEN Node-reported duration: `487.0329 ms`.
- Fix Round 1 RED Node-reported duration: `469.0597 ms`.
- Fix Round 1 initial GREEN Node-reported duration: `474.1798 ms`.
- Fix Round 1 final Node-reported duration: `471.6878 ms`.
- Fix Round 1 final focused Plan 3 Jest time: `6.454 s` for `193/193` tests.
- Every observed Task 3 command is below the `300000 ms` smoke ceiling.
- No Stryker mutation run was authorized; scheduled/manual mutation execution remains deferred to later tasks under the `900000 ms` complete ceiling.

## Commit hash

Initial implementation: `4c1e61318792c2f09d359fd609f871e708a2a33a` (`test: define critical mutation rules`). Fix Round 1 implementation: `2511d7d43931b245fecda39a3e6a384ffd779bc0` (`fix: complete critical mutation rule inventory`). The immutable Fix Round 1 SHA is backfilled without amend; the distinct evidence-only commit is intentionally not recorded in itself.

## Deferred findings

- Task 4 Stryker configuration, budget-aware runner, and live mutation execution remain out of scope and untouched.
- Plan 3's approved parked non-load-bearing Minor remains visible: repair aggregate tests accept `expect.any(String)` for replacement/original identifiers. This does not weaken the manifest's exact source identity, field-selection range, or independent-review requirement.
- One proposed `borrowing-member-detail-is-owner-scoped` end anchor was duplicated elsewhere in the source. Before encoding, the range was adjusted to the next exact unique method-boundary line, `  async findOverdue(` at line `205`; all tracked anchors now validate as unique and no range/anchor ambiguity remains.

## Reviewer decision

Initial independent review by fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task3_reviewer`: **CHANGES_REQUIRED**. Findings: Critical `0`, Important `1`, Minor `0`.

Important I1: the mechanically valid 29-rule manifest did not inventory every Plan 3-reviewed occurrence of the six required invariants, leaving uncovered critical branches protected only by aggregate mutation score. Reviewer examples included token rotation/revocation gaps, borrowing state effects/transitions, and member reservation/lifecycle changes, with a requirement to re-inventory all five modules rather than patch only the examples.

### Fix Round 1 report

- A test-first `93`-point reviewed-occurrence matrix failed against the original manifest with `59` uncovered points across every selected source.
- The manifest now contains `60` narrow exact rules: token session `12`, repair `18`, reconciliation `15`, members `8`, and borrowings `7`.
- The regression now proves `93/93` reviewed occurrence points overlap the zero-survivor critical gate, with all six required categories and all five sources represented.
- All source SHA, exact path, ordered positive inclusive range, exact unique anchor, read-only `--check`, review-only `--candidate`, and empty exact allowlist contracts remain enforced.
- Fix Round 1 was submitted with implementer-known findings `0`, but subsequent independent re-review kept I1 open. The implementer did not mark Task 3 approved and did not start Task 4.

## Fix Round 2 correction and evidence

The Fix Round 1 completeness statements above are historical and inaccurate: the `93` points were a lower-bound smoke inventory, caller/signature proxies were accepted as coverage, and the overlap check did not require a rule to carry the same invariant category. The Fix Round 1 re-review therefore remained **CHANGES_REQUIRED**, with Critical `0`, Important `1`, Minor `0`; Important I1 remained open. Reviewer identity/model stayed `/root/plan5_task3_reviewer`, requested and actual fresh `gpt-5.6-sol`, high reasoning, substitution none.

Fix Round 2 replaces that completeness claim with a category-aware matrix of exact executable ranges. Each matrix row names its selected production source, exact inclusive executable range, one or more of the six controlled categories, exact named Plan 3 tests present in the corresponding service spec, and the approved Plan 3 review file(s). The regression reads those real files, rejects signature-only boundaries, requires every line in every executable range to overlap a tracked rule, and requires every matrix category to match at least one same-source overlapping rule classification.

The exact manifest schema is unchanged. Classification is encoded in the existing required `invariant` string as the controlled prefix `[categories: category | category]`; no `category` property or other field was added. The regression rejects a missing, duplicated, or unknown category classification. The six allowed values remain authorization/role denial; member/staff ownership; replay/revocation; revoked/expired token rejection; illegal borrowing transitions; and terminal event/cleanup/TTL ordering.

### Fix Round 2 RED

```powershell
node --test test/quality/mutation-policy.test.mjs
# FIX2_RED_EXIT=1
```

```text
tests 45
pass 44
fail 1
duration_ms 497.358
```

The only failure was `protects named Plan 3 executable ranges with same-category manifest rules`. Against the Fix Round 1 manifest it reported `41` uncovered executable ranges and `126` category mismatches. The RED included every reviewer minimum example: token `resolveFamilyId`, duplicate-key classification and generic denial; the eight repair key/operation/transaction/partition/subject/terminal/config helpers; reconciliation repair-key, correlation, secret and bound helpers; member lookup/version/normalization helpers; and all five borrowing lookup/policy helpers. The initial RED matrix had `89` ranges; during the test-only correction before GREEN, the mixed member credential range was split into distinct owner-denial and lifecycle occurrences, producing the final `90` exact ranges without weakening the RED assertion.

### Fix Round 2 GREEN and verification

Implementation commit: `db8d7d078d632b83d00736426c089481ef9cf626` (`fix: protect reviewed critical helper bodies`). It changes only `test/quality/critical-rule-manifest.json` and `test/quality/mutation-policy.test.mjs`.

```text
node scripts/quality/update-critical-rule-manifest.mjs --check
Critical mutation manifest check passed (89 rules).
exit 0

node --test test/quality/mutation-policy.test.mjs
tests 45
pass 45
fail 0
duration_ms 579.2292

npx --no-install jest --runInBand src/auth/token-session.service.spec.ts src/auth/auth-identifier-repair.service.spec.ts src/auth/auth-identifier-reconciliation.service.spec.ts src/members/members.service.spec.ts src/borrowings/borrowings.service.spec.ts
Test Suites: 5 passed, 5 total
Tests:       193 passed, 193 total
Time:        7.598 s

npx --no-install eslint test/quality/mutation-policy.test.mjs
exit 0

npx --no-install prettier --check test/quality/mutation-policy.test.mjs test/quality/critical-rule-manifest.json
All matched files use Prettier code style!
exit 0
```

`--candidate` wrote the review candidate successfully, proving every real anchor was present and unique. `git diff --no-index --exit-code -- test/quality/critical-rule-manifest.json reports/mutation/critical-rule-manifest.candidate.json` exited `0`, proving refreshed hashes and anchor-derived ranges were byte-identical to the tracked manifest; the temporary candidate was then removed. `git diff --check` exited `0`. Source-identity comparison against locked Plan 5 base `b678209e23ef7020c21ff565327de1b229c835f6` exited `0` for all five selected production sources.

Final source hashes remain:

```text
72da52c9835a71d59bca5cd6b367be54b0257541a5bf273d4396700809fcd051 src/auth/token-session.service.ts
a8f4bf8847acfed54dc0c9a7258a01979bed058ba3f47bcdd37f84cae83b4e1f src/auth/auth-identifier-repair.service.ts
b7f4f2b83c5cceb76bb19b37e0436a4493abb7b8d4591bc38cc0b5f064c65803 src/auth/auth-identifier-reconciliation.service.ts
03e5a2d54626ef11cc9f9d73dfcda4a39d30d7bab3d2d249985dfeec2baf0ad9 src/members/members.service.ts
91a41fb81abd1c1ebc57586fcb4f07299fc455735973f23289a62348c318b647 src/borrowings/borrowings.service.ts
```

### Final matrix and rule counts

- Executable occurrences: `90` total — token session `18`, repair `26`, reconciliation `21`, members `12`, borrowings `13`.
- Occurrence/category links: authorization `23`, ownership `45`, replay/revocation `20`, revoked/expired rejection `5`, illegal borrowing transitions `10`, terminal/cleanup/TTL ordering `25`.
- Manifest rules: `89` total — token session `16`, repair `26`, reconciliation `22`, members `13`, borrowings `12`.
- Fix Round 2 proved all `90/90` executable occurrences had any-category line coverage and all `128` occurrence/category declarations had some same-source overlap. It did not prove category coverage for every executable line; Fix Round 3 below supersedes this insufficient completeness statement.

The executable matrix in `test/quality/mutation-policy.test.mjs` is the authoritative exact occurrence-to-test/evidence linkage. It contains each exact named test and reads each cited Plan 3 review file. The original retained-rule tables above continue to identify named tests for the pre-Fix-Round-2 rules, subject to the corrected ranges below. The following table completes the rule-by-rule linkage for all `29` newly added rules.

| New rule id                              | Final range | Controlled category                                            | Exact Plan 3 test linkage                                                                                                                         |
| ---------------------------------------- | ----------: | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token-family-resolution`                |     204-231 | replay/revocation                                              | `resolves only a family id for active and replayed refresh credentials`                                                                           |
| `token-shared-revocation-update`         |     546-557 | replay/revocation                                              | `revokes families and subjects idempotently`                                                                                                      |
| `token-duplicate-key-classification`     |     577-586 | replay/revocation                                              | `denies a lost duplicate-marker race without mutating the family`                                                                                 |
| `token-generic-refresh-denial`           |     586-587 | authorization/role denial; revoked/expired token rejection     | `rejects malformed, missing, expired, and revoked credentials without mutation`                                                                   |
| `repair-key-availability`                |     762-771 | authorization/role denial                                      | `rejects an unavailable manifest key before looking up an operation`; `rejects a missing current key version before operation lookup or creation` |
| `repair-operation-requirement`           |     771-779 | authorization/role denial                                      | `replays a completed operation without preparing or activating batches`                                                                           |
| `repair-transaction-support-requirement` |     779-788 | authorization/role denial; terminal event/cleanup/TTL ordering | `fails before repair writes when MongoDB transaction support is absent`                                                                           |
| `repair-bounded-partition`               |     807-823 | member/staff ownership                                         | `uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically`                                                      |
| `repair-subject-key`                     |     842-846 | member/staff ownership                                         | `updates staff email and member loginIdentifier while incrementing authVersion once`                                                              |
| `repair-terminal-status-classification`  |     846-853 | terminal event/cleanup/TTL ordering                            | `replays a completed operation without preparing or activating batches`; `replays terminal cancellation without compensation mutations`           |
| `repair-current-key-version`             |     853-861 | authorization/role denial                                      | `rejects a missing current key version before operation lookup or creation`                                                                       |
| `repair-assignment-bound`                |     861-865 | member/staff ownership                                         | `uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically`                                                      |
| `reconciliation-repair-key-availability` |     289-304 | authorization/role denial                                      | `skips an offline repair with unavailable audit material before claiming it`                                                                      |
| `reconciliation-correlation-keying`      |     846-875 | member/staff ownership                                         | `attaches an HMAC-only reservation reference under the requested key version`                                                                     |
| `reconciliation-secret-decoding`         |     875-882 | member/staff ownership                                         | `attaches an HMAC-only reservation reference under the requested key version`                                                                     |
| `reconciliation-lease-duration`          |     882-889 | member/staff ownership; terminal event/cleanup/TTL ordering    | `uses MongoDB time for atomic lease acquisition and renewal`                                                                                      |
| `reconciliation-batch-bound`             |     897-905 | terminal event/cleanup/TTL ordering                            | `caps claims at the configured batch size and releases every acquired lease`                                                                      |
| `reconciliation-retention-duration`      |     905-912 | terminal event/cleanup/TTL ordering                            | `records the terminal event before clean terminal state and retention TTL`                                                                        |
| `reconciliation-assignment-bound`        |     912-916 | member/staff ownership; terminal event/cleanup/TTL ordering    | `defers batch expiry when gated identifiers exhaust cleanup capacity`                                                                             |
| `member-normalized-login-lookup`         |     267-284 | authorization/role denial; member/staff ownership              | `looks up credentials with normalized login identifiers and the password hash selected`                                                           |
| `member-owned-last-login-touch`          |     297-304 | member/staff ownership                                         | `updates last login atomically without loading the member document`                                                                               |
| `member-required-document`               |     370-382 | authorization/role denial; member/staff ownership              | `returns not found for missing members`                                                                                                           |
| `member-auth-version-bump`               |     382-393 | replay/revocation                                              | `rejects a missing member when bumping its auth version`                                                                                          |
| `member-login-normalization`             |     406-410 | member/staff ownership                                         | `sets normalized credentials, increments auth version, and records the actor`                                                                     |
| `borrowing-required-record`              |     279-295 | illegal borrowing transitions                                  | `rejects a duplicate return without changing availability or loan count`; `returns not found when a borrowing lookup has no matching record`      |
| `borrowing-required-book`                |     295-311 | illegal borrowing transitions                                  | `creates a borrowing only after active member, book, category, and membership policy pass`                                                        |
| `borrowing-required-category`            |     311-327 | illegal borrowing transitions                                  | `creates a borrowing only after active member, book, category, and membership policy pass`                                                        |
| `borrowing-required-member`              |     327-343 | illegal borrowing transitions; member/staff ownership          | `creates a borrowing only after active member, book, category, and membership policy pass`                                                        |
| `borrowing-required-membership-policy`   |     343-359 | illegal borrowing transitions                                  | `creates a borrowing only after active member, book, category, and membership policy pass`                                                        |

The following retained rules were deliberately extended to cover their exact reviewed executable tails; this table supersedes their historical ranges above while retaining the same named-test linkage:

| Retained rule id                                       | Correct final range |
| ------------------------------------------------------ | ------------------: |
| `token-expired-marker-reconciliation-revokes`          |             231-275 |
| `token-committed-marker-replay-revokes`                |             401-420 |
| `repair-reauthorizes-every-apply-boundary`             |             168-202 |
| `repair-cancel-authorizes-before-parent-failure`       |             202-265 |
| `reconciliation-terminal-event-and-ttl-ordering`       |             654-721 |
| `reconciliation-bounded-gate-and-batch-cleanup`        |             721-763 |
| `member-active-auth-status-required`                   |             284-297 |
| `member-session-revocation-clears-token-hashes`        |             492-511 |
| `borrowing-create-requires-staff-and-policy`           |              54-108 |
| `borrowing-return-requires-staff-and-returnable-state` |             108-154 |

Fix Round 2 implementation candidate `db8d7d078d632b83d00736426c089481ef9cf626` was submitted with implementer-known open findings `0`, but independent Fix Round 2 re-review kept Important I1 open because the category check was not per-line. Task 3 was not approved and Task 4 remained blocked and unstarted.

## Fix Round 3 correction and evidence

Fix Round 2 re-review by `/root/plan5_task3_reviewer` (requested and actual fresh `gpt-5.6-sol`, high reasoning; substitution none) was **CHANGES_REQUIRED**, with Critical `0`, Important `1`, Minor `0`. Completeness beyond I1 was accepted. I1 remained open solely because the regression required any-category coverage on every executable line and merely one same-category overlap per occurrence, rather than a same-category rule on every executable line.

### Fix Round 3 RED

The regression was strengthened before the manifest changed. It now expands every one of the `90` matrix occurrences into each inclusive executable source line crossed with each declared category, and reports the exact occurrence id, line, and missing category.

```powershell
node --test test/quality/mutation-policy.test.mjs
# FIX3_RED_EXIT=1
```

```text
tests 45
pass 44
fail 1
duration_ms 486.8926
uncoveredExecutableRanges 0
missingLineCategoryPairs 63
```

The sole intended failure, `protects every named Plan 3 executable line with same-category manifest rules`, reported exactly the independently audited `63` gaps:

- `repair-batch-transactional-ownership`: terminal event/cleanup/TTL ordering on lines `305-324` (`20` pairs).
- `repair-completed-event-order`: terminal event/cleanup/TTL ordering on lines `461-463` (`3` pairs).
- `reconciliation-bounded-cleanup`: member/staff ownership on lines `764-803` (`40` pairs).

### Minimal manifest correction

Implementation commit: `65d3d3e2512f9552d6e3e071901a2f56bcac7295` (`fix: enforce per-line critical categories`). It changes only the tracked manifest and its policy regression.

- `repair-batch-transactional-ownership` now begins at the unique checkpoint/transaction prelude anchor on line `298`, covering the terminally ordered transactional body through line `369`. A proposed line-`305` anchor was rejected by the updater because that exact session-acquisition line occurs five times; the final line-`298` anchor occurs once.
- `repair-completed-event-precedes-terminal-state` now begins at the unique original-conflict update selector on line `457`, covering the event creation beginning at line `461` through the terminal state write.
- `reconciliation-parent-ttl-after-cleanup-and-event` retains its exact `763-805` range and now classifies the operation-owned gate/batch remainder and parent update as both member/staff ownership and terminal event/cleanup/TTL ordering.

No rule was added or removed. The exact schema, `90`-occurrence matrix, empty allowlist, source hashes, and source files are unchanged.

### Fix Round 3 GREEN and exact denominator

```text
node --test test/quality/mutation-policy.test.mjs
tests 45
pass 45
fail 0
duration_ms 490.0548

node scripts/quality/update-critical-rule-manifest.mjs --check
Critical mutation manifest check passed (89 rules).
exit 0

npx --no-install jest --runInBand src/auth/token-session.service.spec.ts src/auth/auth-identifier-repair.service.spec.ts src/auth/auth-identifier-reconciliation.service.spec.ts src/members/members.service.spec.ts src/borrowings/borrowings.service.spec.ts
Test Suites: 5 passed, 5 total
Tests:       193 passed, 193 total
Time:        6.61 s
```

The final matrix expands to exactly `3151` executable line/category pairs, and the strengthened regression proves `3151/3151` have a same-source covering manifest rule with that exact category. Manifest counts remain `89`: token session `16`, repair `26`, reconciliation `22`, members `13`, borrowings `12`. Occurrence counts remain `90`: `18/26/21/12/13`. The six controlled categories and their occurrence-level counts remain authorization `23`, ownership `45`, replay/revocation `20`, revoked/expired rejection `5`, illegal borrowing transitions `10`, and terminal/cleanup/TTL ordering `25`.

Focused ESLint and Prettier exited `0`. The updater `--candidate` resolved all anchors uniquely and produced a byte-identical tracked manifest. Source identity against locked base `b678209e23ef7020c21ff565327de1b229c835f6`, all five SHA-256 values, `git diff --check`, and implementation scope checks exited `0`.

Important I1 is addressed in Fix Round 3 implementation candidate `65d3d3e2512f9552d6e3e071901a2f56bcac7295`; implementer-known open findings are `0`. Fresh independent Fix Round 3 re-review remains pending. Task 3 is not marked approved, and Task 4 remains blocked and unstarted.
