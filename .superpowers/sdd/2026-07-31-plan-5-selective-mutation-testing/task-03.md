# Task 03 Evidence

## Task

Create the source-hashed critical-rule manifest and strict empty allowlist, plus the review-candidate updater. Task 4 has not started.

## Implementer model and reasoning

Requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task3_implementer`; substitution none. The assignment was recorded before substantive implementation.

## Reviewer model and reasoning

Requested reviewer: fresh `gpt-5.6-sol`, high reasoning; actual reviewer identity and decision remain pending controller dispatch after implementation. The implementer has not performed or pre-approved the independent review.

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

## Focused metrics

- `29` narrow critical rules cover `5/5` selected production sources.
- All six required categories are represented: authorization/role denial; member/staff ownership; replay/revocation; revoked/expired token rejection; illegal borrowing transitions; and terminal event/cleanup/TTL ordering.
- Every rule contains exactly the schema-v1 fields, a positive inclusive range, the exact selected path, the source's full SHA-256, and exact unique start/end anchor lines.
- `test/quality/mutation-equivalents.json` is exactly `{ "schemaVersion": 1, "entries": [] }`; no equivalent is presumed.
- `--check` is read-only and fail-closed. `--candidate` refreshes hashes/ranges only into `reports/mutation/critical-rule-manifest.candidate.json` and never overwrites tracked JSON.

### Reviewed rule inventory

Every supporting Plan 3 report/review cited below is independently approved in the Plan 3 ledger and ultimately covered by the approved Task 10 whole-plan handoff. Test titles are exact titles from the corresponding selected service spec.

#### `src/auth/token-session.service.ts`

Source SHA-256 for every rule in this group: `72da52c9835a71d59bca5cd6b367be54b0257541a5bf273d4396700809fcd051`. Supporting Plan 3 evidence: Task 1 report/review and Task 10 review.

| Rule id | Inclusive range | Category | Exact start anchor | Exact end anchor | Supporting Plan 3 test |
| --- | ---: | --- | --- | --- | --- |
| `token-active-unexpired-family-cas` | 147-150 | replay/revocation; revoked/expired rejection | `            familyId: prepared.family.familyId,` | `            expiresAt: { $gt: now },` | `commits a hash-only marker after operation-correlated family CAS` |
| `token-rotation-failure-revokes-family` | 171-189 | replay/revocation | `    if (!rotatedFamily) {` | `          'refresh-rotation-orphaned',` | `fails closed when the family compare-and-swap returns no successor`; `fails closed when a completed rotation marker cannot be found` |
| `token-expired-marker-reconciliation-revokes` | 249-264 | replay/revocation; revoked/expired rejection | `          family?.status === RefreshTokenFamilyStatus.Active &&` | `          reason,` | `reconciles orphaned rotations and leaves expired pre-CAS work for takeover` |
| `token-rejects-missing-revoked-expired-family` | 362-368 | revoked/expired rejection | `        currentTokenHash: tokenHash,` | `    if (!family) {` | `rejects malformed, missing, expired, and revoked credentials without mutation` |
| `token-committed-marker-replay-revokes` | 401-410 | replay/revocation | `    if (marker.status === RefreshTokenReplayMarkerStatus.Committed) {` | `    if (family?.lastRotationOperationId === marker.rotationOperationId) {` | `revokes on replay from any committed generation` |
| `token-pending-marker-takeover-guard` | 420-445 | replay/revocation; revoked/expired rejection | `    const canTakeOver =` | `    if (marker.leaseExpiresAt && marker.leaseExpiresAt > now) {` | `denies an active pending lease without mutating the family`; `takes over an expired pre-CAS lease and rotates once`; `denies a lost expired-marker takeover without creating a successor` |
| `token-replay-revocation-clears-current-hash` | 536-553 | replay/revocation | `  private async revokeAsReplay(familyId: string): Promise<void> {` | `      $unset: { currentTokenHash: 1 },` | `revokes on replay from any committed generation`; `revokes current and all subject sessions without exposing token hashes` |

#### `src/auth/auth-identifier-repair.service.ts`

Source SHA-256 for every rule in this group: `a8f4bf8847acfed54dc0c9a7258a01979bed058ba3f47bcdd37f84cae83b4e1f`. Supporting Plan 3 evidence: Tasks 2-3 reports/reviews and Task 10 review. The approved parked non-load-bearing Minor about `expect.any(String)` remains disclosed under Deferred findings.

| Rule id | Inclusive range | Category | Exact start anchor | Exact end anchor | Supporting Plan 3 test |
| --- | ---: | --- | --- | --- | --- |
| `repair-apply-authorizes-and-binds-manifest` | 134-147 | authorization/role denial; ownership | `  async apply(input: OfflineRepairRequest): Promise<OfflineRepairResult> {` | `    await this.recordResume(operation, actor.subjectId, input.resumeId);` | `rejects a missing current key version before operation lookup or creation`; `fails closed when a resume manifest differs from the persisted hash` |
| `repair-reauthorizes-every-apply-boundary` | 168-186 | authorization/role denial | `    const batches = this.partition(manifest);` | `      await this.completeParent(input, manifest, actor.subjectId);` | `uses bounded unique batches, reauthorizes each mutation boundary, and completes atomically`; `fails closed before parent completion when authorization expires` |
| `repair-cancel-authorizes-before-parent-failure` | 202-250 | authorization/role denial | `  async cancel(input: OfflineRepairRequest): Promise<OfflineRepairResult> {` | `      await this.finishFailedParent(input.operationId, actor.subjectId);` | `leaves cancellation retryable when authorization expires between compensation batches`; `revalidates authorization after the final compensation batch before parent mutations` |
| `repair-completed-event-precedes-terminal-state` | 464-487 | terminal event/cleanup/TTL ordering | `              operationId: input.operationId,` | `                httpStatus: 200,` | `completes the parent only after recording its terminal event` |
| `repair-failed-event-precedes-terminal-state` | 564-594 | terminal event/cleanup/TTL ordering | `  private async finishFailedParent(operationId: string, actorId: string) {` | `                httpStatus: 409,` | `records a cancellation terminal event before failing its parent` |
| `repair-writes-only-owned-aggregate-field` | 657-679 | member/staff ownership | `  private async applyAggregateIdentifier(` | `      { $set: { [field]: item.newIdentifier }, $inc: { authVersion: 1 } },` | `updates staff email and member loginIdentifier while incrementing authVersion once` |
| `repair-manifest-covers-exact-conflict-claimants` | 714-733 | member/staff ownership | `  private validateManifestSubjects(` | `        'Repair manifest must account for every conflict claimant',` | Task 2 failure-path proof for invalid claimant accounting; Task 3 `releases the original conflict under the first reassigned subject and records the terminal event first` |

#### `src/auth/auth-identifier-reconciliation.service.ts`

Source SHA-256 for every rule in this group: `b7f4f2b83c5cceb76bb19b37e0436a4493abb7b8d4591bc38cc0b5f064c65803`. Supporting Plan 3 evidence: Tasks 4-5 reports/reviews and Task 10 review.

| Rule id | Inclusive range | Category | Exact start anchor | Exact end anchor | Supporting Plan 3 test |
| --- | ---: | --- | --- | --- | --- |
| `reconciliation-invalid-state-fails-terminally` | 378-405 | authorization/role denial; terminal event/cleanup/TTL ordering | `    switch (operation.status) {` | `        await this.failInvalidOperation(operation);` | `fails an invalid transition terminally with a redacted event` |
| `reconciliation-invalid-event-precedes-terminal-ttl` | 444-495 | terminal event/cleanup/TTL ordering | `  private async failInvalidOperation(` | `  private async attachMissingReservationReferences(` | `fails an invalid transition terminally with a redacted event`; `persists the idempotent terminal event before writing terminal TTL state` |
| `reconciliation-terminal-event-and-ttl-ordering` | 654-712 | terminal event/cleanup/TTL ordering | `  private async finalize(` | `                  },` | `records the terminal event before finalizing cleanup-pending state without a parent TTL`; `records the terminal event before clean terminal state and retention TTL` |
| `reconciliation-bounded-gate-and-batch-cleanup` | 721-758 | ownership; terminal event/cleanup/TTL ordering | `  private async cleanup(` | `          { updatePipeline: true },` | `bounds gate and batch cleanup and expires the parent only after both are clear`; `releases residual gates for a failed terminal repair instead of unlocking them`; `defers batch expiry when gated identifiers exhaust cleanup capacity` |
| `reconciliation-parent-ttl-after-cleanup-and-event` | 763-805 | terminal event/cleanup/TTL ordering | `    await this.renewLease(operation.operationId);` | `  private async findReservation(` | `keeps cleanup pending while gate or batch work remains`; `completes empty cleanup remainder and applies retention only after terminal event fields exist` |

#### `src/members/members.service.ts`

Source SHA-256 for every rule in this group: `03e5a2d54626ef11cc9f9d73dfcda4a39d30d7bab3d2d249985dfeec2baf0ad9`. Supporting Plan 3 evidence: Tasks 6-7 reports/reviews and Task 10 review.

| Rule id | Inclusive range | Category | Exact start anchor | Exact end anchor | Supporting Plan 3 test |
| --- | ---: | --- | --- | --- | --- |
| `member-update-compensates-and-revokes-lifecycle` | 221-235 | member/staff ownership; replay/revocation | `      if (emailChanged && previousEmail) {` | `        await this.releaseIdentifier(nextEmail, getMemberId(member), actor?.id);` | `reserves a changed email, revokes active sessions, and audits identifier and status changes`; `releases a newly reserved email when saving the member change fails` |
| `member-active-auth-status-required` | 284-291 | authorization/role denial | `  async findActiveById(id: string): Promise<MemberDocument> {` | `      throw new NotFoundException('Active member not found');` | `returns the active-member not-found contract when the member does not exist`; Task 7 public-contract proof for absent/non-active auth status |
| `member-credentials-deny-duplicate-owner` | 304-325 | member/staff ownership; authorization/role denial | `  async setMemberCredentials(` | `      throw new ConflictException('Member login identifier already exists');` | `leaves member credentials unchanged when the normalized login identifier conflicts`; Task 6 identifier proof for foreign member/staff denial |
| `member-reservation-enforces-exact-owner` | 410-444 | member/staff ownership | `  private async reserveIdentifier(` | `      return;` | `keeps a same-owner active identifier idempotent without a prior member login`; `reactivates a released reservation with member ownership and no release timestamp` |
| `member-session-revocation-clears-token-hashes` | 492-506 | member/staff ownership; replay/revocation | `  private async revokeSessions(subjectId: string, reason: string): Promise<void> {` | `        $unset: { currentTokenHash: '', previousTokenHash: '' },` | `initializes an absent auth version and revokes only active member families on status change`; `clears email without reserving an empty identifier and revokes sessions` |

#### `src/borrowings/borrowings.service.ts`

Source SHA-256 for every rule in this group: `91a41fb81abd1c1ebc57586fcb4f07299fc455735973f23289a62348c318b647`. Supporting Plan 3 evidence: Task 8 report/review and Task 10 review.

| Rule id | Inclusive range | Category | Exact start anchor | Exact end anchor | Supporting Plan 3 test |
| --- | ---: | --- | --- | --- | --- |
| `borrowing-create-requires-staff-and-policy` | 54-94 | authorization/role denial; illegal borrowing transitions | `  async create(` | `      }).save({ session });` | `requires an authenticated staff actor before creating borrowing records`; `creates a borrowing only after active member, book, category, and membership policy pass` |
| `borrowing-return-requires-staff-and-returnable-state` | 108-129 | authorization/role denial; illegal borrowing transitions | `  async returnBorrowing(` | `        throw new ConflictException('Borrowing record cannot be returned');` | `requires an authenticated staff actor before returning borrowing records`; `denies a non-returned loan in an illegal state without writes`; `rejects a duplicate return without changing availability or loan count` |
| `borrowing-member-detail-is-owner-scoped` | 185-205 | member/staff ownership; authorization/role denial | `  async findOneForMember(` | `  async findOverdue(` | `applies both borrowing and member ObjectId ownership filters for self-service detail`; `does not reveal a foreign borrowing when the owner filter is absent or wrong` |
| `borrowing-member-list-rejects-cross-owner-query` | 211-219 | member/staff ownership; authorization/role denial | `  async findByMember(` | `    return this.findAll({ ...query, memberId });` | `rejects member self-service queries with a mismatched memberId`; `uses member ownership and requested pagination values for member borrowing history` |
| `borrowing-transaction-and-staff-actor-boundary` | 359-380 | authorization/role denial; illegal borrowing transitions | `  private async runInTransaction<T>(` | `    return actor;` | `requires an authenticated staff actor before creating borrowing records`; `requires an authenticated staff actor before returning borrowing records`; Task 8 return-boundary proof that the session ends exactly once |

## Full-suite commands and exits

No repository-wide suite or live mutation run is required or authorized for Task 3. The exact focused Node suite, standalone updater check, focused ESLint/Prettier, source byte-identity, ownership, and whitespace checks are the scoped verification.

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
- Every observed Task 3 command is below the `300000 ms` smoke ceiling.
- No Stryker mutation run was authorized; scheduled/manual mutation execution remains deferred to later tasks under the `900000 ms` complete ceiling.

## Commit hash

`4c1e61318792c2f09d359fd609f871e708a2a33a` (`test: define critical mutation rules`). This full immutable implementation SHA was backfilled without amend. The distinct evidence-only commit is intentionally not recorded in itself.

## Deferred findings

- Task 4 Stryker configuration, budget-aware runner, and live mutation execution remain out of scope and untouched.
- Plan 3's approved parked non-load-bearing Minor remains visible: repair aggregate tests accept `expect.any(String)` for replacement/original identifiers. This does not weaken the manifest's exact source identity, field-selection range, or independent-review requirement.
- One proposed `borrowing-member-detail-is-owner-scoped` end anchor was duplicated elsewhere in the source. Before encoding, the range was adjusted to the next exact unique method-boundary line, `  async findOverdue(` at line `205`; all tracked anchors now validate as unique and no range/anchor ambiguity remains.

## Reviewer decision

Pending independent review. This implementer does not mark Task 3 approved and does not start Task 4.
