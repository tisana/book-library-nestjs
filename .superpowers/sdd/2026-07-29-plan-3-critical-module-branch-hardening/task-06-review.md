# Task 06 review

## Task
Task 6 — Member identifier reservation and credential boundaries

## Reviewer model and reasoning
`gpt-5.6-sol`, high; separate-context reviewer identity `/root/plan3_task6_review`; model substitution none.

## Reviewed commit
Fix Round 1 head `59b2d60fdf9539adee0c600785144f9bfb29c007` against fix base `75cb4f501dfa8d878a85bd1fa30ba2aa6f2a8ca2`; original task base `76af392e25141b91c088596c44dc10cba7a4c9c6`.

## Commands and exits
- Read the required project plan, Task 6 brief, untrusted implementation report, review template, and supplied `review-76af392..75cb4f5.diff`; exit `0`. The supplied diff was read once as the primary change view and records only `src/members/members.service.spec.ts`, `task-06-report.md`, and `progress.md` in the reviewed range.
- Read-only, line-numbered inspection of the changed member spec, unchanged `MembersService`, approved Plan 3 `createMemberDocument`, and approved Plan 2 `queryResult`; exit `0`. New Task 6 cases call only public `setMemberCredentials`; no private service member is accessed.
- `npx jest --runInBand members/members.service.spec.ts --coverage --collectCoverageFrom=members/members.service.ts --coverageReporters=text`: exit `0`; `1/1` suite and `34/34` tests passed, snapshots `0`, statements `152/154` (`98.7%`), branches `152/188` (`80.85%`), functions `21/21` (`100%`), and lines `145/147` (`98.63%`). The exact denominator remains `188` and the Task 6 floor of `151/188` is exceeded.
- `npx eslint src/members/members.service.spec.ts --no-fix`: exit `0`.
- Narrow searches found no snapshot calls and no password/hash/token literals from the changed tests in `task-06-report.md` or `progress.md`; exit `0`.
- No Git command or broad suite was rerun, as required by the review assignment.
- ⚠️ The historical RED result, reported full backend suite, `git diff --check`, and generated-output staging state are implementer claims and were not independently rerun or inspected. The supplied commit-range diff contains no generated output.
- ⚠️ The local legacy `createMemberDocument` fixture at `src/members/members.service.spec.ts:51` is unchanged. The approved shared fixtures are imported read-only, and the supplied diff contains no production, configuration, baseline, denominator, script, e2e, frontend, Plan 2, or shared-fixture change.
- Fix Round 1 scoped re-review read only `rereview-75cb4f5..59b2d60.diff` and its appended report/progress evidence, as instructed; exit `0`. No Git, Jest, coverage, lint, or broad-suite command was rerun.
- ⚠️ Fix-round `34/34`, `152/188`, focused lint, and `git diff --check` results are implementer-provided evidence and were not independently rerun during this scoped re-review.

## Findings
### Spec Compliance

#### Critical

None.

#### Important

- **[I1] Reservation lookup and reactivation-update precision are not fully observable** — `src/members/members.service.spec.ts:479` and `src/members/members.service.spec.ts:549`. `createIdentifierModel` returns its configured result for any `findOne` argument, while none of the same-owner, foreign-owner, released, or create-error cases asserts the exact `{ normalizedIdentifier }` lookup. A regression to an unscoped or incorrectly normalized reservation query would therefore keep passing. The released-reservation assertion also uses `$set: expect.objectContaining(...)` without requiring `identifierType: AuthIdentifierType.LoginIdentifier` or `updatedBy: 'staff-user-id'`, so stale identifier type or missing audit attribution would pass despite the required reservation update precision. Assert the exact normalized lookup and the complete expected reactivation fields.

#### Minor

None.

### Task Quality

#### Critical

None.

#### Important

- **[I2] The same-normalized case duplicates the same-owner case instead of providing independent evidence** — `src/members/members.service.spec.ts:603`. Both tests create the same active member-owned reservation for the member's existing normalized login, invoke the same public call, and assert the same `updateOne`/version outcome; the earlier case at line 472 additionally asserts `create`. Removing the line-603 case loses no behavioral protection, contrary to the binding requirement for meaningful nonduplicate cases. Make the cases isolate distinct contracts—for example, let the same-owner reservation case use a member without that prior login and reserve the successful same-normalized case specifically for proving that post-save cleanup does not release the existing reservation.

#### Minor

None.

## Resolutions verified
- **I1 — ADDRESSED** — `src/members/members.service.spec.ts:495` and `src/members/members.service.spec.ts:562`. The fix asserts the exact normalized reservation lookup once across the same-owner, foreign-member/staff, released, duplicate-key, nonduplicate object/primitive, and same-normalized paths. Released recovery now also asserts the complete `$set`, including `AuthIdentifierType.LoginIdentifier` and `updatedBy: 'staff-user-id'`, plus the exact `releasedAt` unset.
- **I2 — ADDRESSED** — `src/members/members.service.spec.ts:473` and `src/members/members.service.spec.ts:626`. Same-owner idempotency now starts without a prior member login, so no post-save cleanup can mask reservation writes; the separate same-normalized case retains the prior login and additionally proves save completion, no create, and no update. Removing either case now loses distinct behavioral protection.
- **New Critical/Important breakage:** none in the scoped fix diff.
- **Out-of-scope observation:** the fix commit includes this reviewer-authored `task-06-review.md` content verbatim alongside the permitted member spec and Task 6 ledgers. This is non-blocking because the findings were preserved unchanged; no production, configuration, baseline, denominator, script, e2e, frontend, Plan 2, or shared-fixture change is present.
- Verified without qualification: exact `createServiceWithMember` signature/default model behavior and constructor integration order; foreign member/staff denial; duplicate-key normalization; unchanged propagation of nonduplicate coded/uncoded objects and string/null primitive rejections; exact compensation selector limited to the newly created normalized reservation; missing-identifier-model save/hash/version behavior; `bcrypt.compare` credential verification; no new snapshot or ledger disclosure; public-method-only access; and allowed file scope.

## Verdict
Approved at Fix Round 1 head `59b2d60fdf9539adee0c600785144f9bfb29c007`. Findings resolved: `2`; open Critical/Important/Minor findings: `0`.
