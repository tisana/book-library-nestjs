# Plan 5 Whole-Plan Review — PRECOMMIT/CONDITIONAL

## Review identity and boundary

- Reviewer requested and actual: different fresh `/root/plan5_task9_reviewer`,
  `gpt-5.6-sol`, high reasoning; substitution none.
- Reviewed precommit boundary: exact clean Task 8 closeout HEAD
  `5a75302143778301786ffaf1d1b310ba43540a94`, plus the uncommitted
  append-only Task 9 evidence candidate.
- This is a **PRECOMMIT/CONDITIONAL** whole-plan verdict. It is not final Plan 5
  approval because the Task 9 handoff commit does not yet exist. The final
  verdict is pending exact postcommit SHA, scope, ancestry, and cleanliness
  verification.

## Dependency and base verdict

**PASS.** The progress ledger contains exactly one exact Base SHA:
`b678209e23ef7020c21ff565327de1b229c835f6`. Independent ancestry checks
returned exit `0` for reviewed Plan 3 handoff
`75d81b17b1ef8550a11ed62a3498907b0b72309c`, Plan 3 administrative boundary
`912131507fb8bbf58ad9a674e9b00906d23022d8`, Plan 5 Base SHA, accepted Action
SHA `bd056baa996160c17bac45dee8a68fc303030b5b`, and Task 8 closeout SHA against
the reviewed HEAD. Gate G2 is therefore a satisfied dependency and Plan 5 is
based on the exact approved boundary.

The accepted Task 00–08 implementation/fix/review commits are all present in
the single Base-to-HEAD ancestry chain. The ledger and reports record the
prescribed requested/actual models and reasoning before dispatch: Task 00 used
`gpt-5.6-terra` medium for implementation and a fresh `gpt-5.6-sol` high
reviewer; Tasks 01–08 used the prescribed `gpt-5.6-sol` high lanes; no
substitution is recorded. Task 9 uses a separate fresh reviewer from its
implementer.

## Exact audit sources

- Governing contracts: `AGENTS.md`,
  `specs/003-auth-roles-permissions/plan.md`, both 2026-07-31 priority and
  selective-mutation plans, all Plan 5 task reports and progress history, and
  the relevant reviewed Plan 3 handoff/G2 evidence.
- Tracked contracts: `test/quality/critical-rule-manifest.json`,
  `test/quality/mutation-equivalents.json`,
  `test/quality/mutation-baseline.json`, `stryker.config.mjs`,
  `scripts/quality/mutation-policy.mjs`, `scripts/quality/run-mutation.mjs`,
  and `.github/workflows/mutation.yml`.
- Smoke producer: local downloaded run root
  `reports/mutation/diagnostics/task8-corrected-reference-smoke-run-32990160510`
  and live GitHub Actions run
  [32990160510](https://github.com/tisana/book-library-nestjs/actions/runs/32990160510).
- Complete producer: local downloaded run root
  `reports/mutation/diagnostics/task8-corrected-reference-complete-run-32990164438`
  and live GitHub Actions run
  [32990164438](https://github.com/tisana/book-library-nestjs/actions/runs/32990164438).
- Existing integration producer:
  `reports/mutation/diagnostics/task8-step3-independent-gates-bd056baa-attempt5-20260828`.
- Live read-only metadata: both run/job records, both artifact inventories,
  and the live feature ref. Both runs and the feature ref resolve to exact
  accepted SHA `bd056baa996160c17bac45dee8a68fc303030b5b`; all twelve jobs are
  completed successfully and all twelve artifacts are present and unexpired.

## Selected-source and raw-score audit

The independently parsed canonical aggregate JSON in each profile contains
mutants from exactly these five files and no other file:

1. `src/auth/token-session.service.ts`
2. `src/auth/auth-identifier-repair.service.ts`
3. `src/auth/auth-identifier-reconciliation.service.ts`
4. `src/members/members.service.ts`
5. `src/borrowings/borrowings.service.ts`

Every selected file occurs once in each aggregate source map. Canonical mutant
identities are unique: smoke `1366/1366`, complete `1727/1727`, duplicates
`0`. Every report source hash equals the tracked manifest hash.

Raw Stryker semantics were recalculated directly as
`detected / (detected + undetected)`, excluding ignored mutants:

| Profile/module | Detected | Undetected | Ignored | Raw score |
| --- | ---: | ---: | ---: | ---: |
| Smoke aggregate | 1363 | 3 | 0 | 99.78038067349927 |
| Smoke token-session | 210 | 1 | 0 | 99.5260663507109 |
| Smoke identifier-repair | 400 | 1 | 0 | 99.75062344139651 |
| Smoke identifier-reconciliation | 414 | 1 | 0 | 99.75903614457832 |
| Smoke members | 204 | 0 | 0 | 100 |
| Smoke borrowings | 135 | 0 | 0 | 100 |
| Complete aggregate | 1647 | 80 | 0 | 95.36768963520556 |
| Complete token-session | 247 | 14 | 0 | 94.6360153256705 |
| Complete identifier-repair | 416 | 1 | 0 | 99.76019184652279 |
| Complete identifier-reconciliation | 500 | 32 | 0 | 93.98496240601504 |
| Complete members | 278 | 8 | 0 | 97.2027972027972 |
| Complete borrowings | 206 | 25 | 0 | 89.17748917748918 |

Smoke statuses are Killed `1356`, Timeout `7`, Survived `3`. Complete statuses
are Killed `1625`, Timeout `22`, Survived `67`, NoCoverage `13`. The raw
aggregate and module values exactly equal the tracked policy summaries; no
post-processing changes the raw score.

## Baseline comparison

The schema-v1 tracked complete baseline is `95.2518818760857`, generated at
`2026-08-22T03:56:59.043Z` from exact producer commit
`1b624f4c0b859d4fb2d8b8181ab1d3f6b9d8de99`. Its five selected sources and
five source hashes match the current complete producer. The retained Task 6
same-commit producer recorded exact `1727`, raw `95.2518818760857`, and the
second upward-only proof independently reproduced the same score.

The accepted complete score `95.36768963520556` is above both the absolute
`70` gate and the tracked upward-only baseline by
`0.11580775911986052` percentage points. Baseline verdict: **PASS**.

## Critical-rule audit and disposition

The tracked manifest contains exactly `89` rules: token `16`, repair `26`,
reconciliation `22`, members `13`, borrowings `12`. Every rule has at least one
overlapping mutant in the complete producer. Complete critical-overlap
associations are Killed `1458`, Timeout `10`, approved-equivalent Survived `3`,
unapproved Survived `0`, and unapproved NoCoverage `0`. Smoke associations are
Killed `1418`, Timeout `7`, approved-equivalent Survived `3`, with no
unapproved undetected critical mutant. The one smoke rule without an
instrumented overlap, `token-generic-refresh-denial`, has complete-profile
overlap and is not omitted from the manifest.

Exact rule IDs by source:

- Token: `token-rotation-input-and-interrupted-cas-denial`,
  `token-active-unexpired-family-cas`, `token-rotation-failure-revokes-family`,
  `token-family-resolution`, `token-expired-marker-reconciliation-revokes`,
  `token-direct-revocation-selectors`, `token-prepare-marker-race-denial`,
  `token-rejects-missing-revoked-expired-family`,
  `token-committed-marker-replay-revokes`,
  `token-pending-marker-takeover-guard`,
  `token-interrupted-cas-finalization`, `token-marker-commit-cas`,
  `token-replay-revocation-clears-current-hash`,
  `token-shared-revocation-update`, `token-duplicate-key-classification`,
  `token-generic-refresh-denial`.
- Repair: `repair-dry-run-authorizes-and-binds-claimants`,
  `repair-apply-authorizes-and-binds-manifest`,
  `repair-reauthorizes-every-apply-boundary`,
  `repair-cancel-authorizes-before-parent-failure`,
  `repair-batch-identity-and-checkpoint`,
  `repair-batch-transactional-ownership`,
  `repair-batch-activation-gate-ownership`,
  `repair-parent-conflict-ownership-finalization`,
  `repair-completed-event-precedes-terminal-state`,
  `repair-reverse-compensation-ownership`,
  `repair-failed-event-precedes-terminal-state`,
  `repair-replacement-reservation-ownership`,
  `repair-writes-only-owned-aggregate-field`,
  `repair-restores-exact-aggregate-owner`, `repair-loads-only-active-conflict`,
  `repair-manifest-covers-exact-conflict-claimants`,
  `repair-persisted-manifest-authorization`, `repair-key-availability`,
  `repair-operation-requirement`, `repair-transaction-support-requirement`,
  `repair-resume-actor-binding`, `repair-bounded-partition`,
  `repair-subject-key`, `repair-terminal-status-classification`,
  `repair-current-key-version`, `repair-assignment-bound`.
- Reconciliation: `reconciliation-renews-only-owned-lease`,
  `reconciliation-bounded-claim-processing`,
  `reconciliation-candidate-status-and-lease-filter`,
  `reconciliation-repair-key-availability`,
  `reconciliation-claims-exact-eligible-operation`,
  `reconciliation-terminal-cleanup-and-state-dispatch`,
  `reconciliation-invalid-state-fails-terminally`,
  `reconciliation-invalid-event-precedes-terminal-ttl`,
  `reconciliation-attaches-operation-owned-reservations`,
  `reconciliation-recovers-applied-ownership`,
  `reconciliation-recovers-compensated-ownership`,
  `reconciliation-terminal-event-and-ttl-ordering`,
  `reconciliation-bounded-gate-and-batch-cleanup`,
  `reconciliation-parent-ttl-after-cleanup-and-event`,
  `reconciliation-finds-exact-assignment-reservation`,
  `reconciliation-owned-transition-and-release`,
  `reconciliation-correlation-keying`, `reconciliation-secret-decoding`,
  `reconciliation-lease-duration`, `reconciliation-batch-bound`,
  `reconciliation-retention-duration`, `reconciliation-assignment-bound`.
- Members: `member-update-reservation-and-lifecycle-state`,
  `member-update-compensates-and-revokes-lifecycle`,
  `member-normalized-login-lookup`, `member-active-auth-status-required`,
  `member-owned-last-login-touch`, `member-credentials-deny-duplicate-owner`,
  `member-credential-reservation-and-revocation`, `member-required-document`,
  `member-auth-version-bump`, `member-login-normalization`,
  `member-reservation-enforces-exact-owner`,
  `member-release-requires-exact-active-owner`,
  `member-session-revocation-clears-token-hashes`.
- Borrowings: `borrowing-create-requires-staff-and-policy`,
  `borrowing-return-requires-staff-and-returnable-state`,
  `borrowing-member-detail-is-owner-scoped`,
  `borrowing-member-list-rejects-cross-owner-query`,
  `borrowing-list-state-filters`, `borrowing-overdue-policy-selector`,
  `borrowing-required-record`, `borrowing-required-book`,
  `borrowing-required-category`, `borrowing-required-member`,
  `borrowing-required-membership-policy`,
  `borrowing-transaction-and-staff-actor-boundary`.

## Equivalent-mutant audit

Exactly three entries exist; each fingerprint was independently recomputed
from canonical mutant identity plus the exact source SHA, matches exactly one
mutant in smoke and one in complete, is bound to exactly one critical rule,
has a concrete proof, and was approved by a separate fresh reviewer rather
than the implementer:

1. `0108d029ef22842e4c8a00d900136b2dbc483f0013d796483b852f024a550cc5` —
   `token-interrupted-cas-finalization`, source SHA
   `72da52c9835a71d59bca5cd6b367be54b0257541a5bf273d4396700809fcd051`;
   the unused rejection-handler fulfillment is `null` versus `undefined` and
   cannot change the awaited public behavior; reviewed `2026-08-12`, expires
   `2026-11-10`, fresh `gpt-5.6-sol` high.
2. `c010a2ec5f4bb9177df61f0bc8326b2d04d2463a59bf5dd2337b840dedc2f36e` —
   `repair-batch-identity-and-checkpoint`, source SHA
   `a8f4bf8847acfed54dc0c9a7258a01979bed058ba3f47bcdd37f84cae83b4e1f`;
   Node 22 HMAC string input treats the explicit UTF-8 and empty encoding as
   identical bytes for supported inputs; reviewed `2026-08-12`, expires
   `2026-11-10`, fresh `gpt-5.6-sol` high.
3. `b4a9385a539d4b16ca74d4f3f5c70adb2775a73e50a66a80aa1acf17e30bd51a` —
   `reconciliation-secret-decoding`, source SHA
   `b7f4f2b83c5cceb76bb19b37e0436a4493abb7b8d4591bc38cc0b5f064c65803`;
   Node 22 `Buffer.from` string decoding selects the same UTF-8 operation for
   explicit UTF-8 and empty encoding; reviewed `2026-08-16`, expires
   `2026-11-14`, fresh `gpt-5.6-sol` high.

All entries are unexpired on `2026-08-29`. Equivalent verdict: **PASS**; there
is no wildcard, stale hash, multi-match, self-approval, or fourth entry.

## Action URLs, artifacts, durations, and runtime

- Smoke run `32990160510`: success, manual dispatch, exact accepted SHA,
  `2026-08-26T16:45:01Z` through `16:49:29Z` (`268 s`). Shard durations in
  milliseconds: token `210293.28842`, repair `145850.623162`, reconciliation
  `181830.640373`, members `142894.021056`, borrowings `53710.496114`.
  Maximum `210293.28842/350000`; no timeout; every runner and artifact exit is
  `0`.
- Complete run `32990164438`: success, manual dispatch, exact accepted SHA,
  `2026-08-26T16:45:03Z` through `16:54:28Z` (`565 s`). Shard durations in
  milliseconds: token `157916.708493`, repair `120131.696297`, reconciliation
  `205518.263622`, members `503470.711527`, borrowings `84523.158408`.
  Maximum `503470.711527/900000`; no timeout; every runner and artifact exit is
  `0`.
- Both profiles contain six downloaded artifacts: one aggregate and exactly
  five named shards. Each aggregate has JSON, HTML, JSON summary, and Markdown
  summary. Each aggregate copy and each uploaded shard has JSON, HTML,
  `stryker.log`, `duration.json`, and JSON summary. No required file is
  missing.
- Independent SHA-256 manifest verification: smoke `57` entries, missing `0`,
  mismatches `0`, manifest digest
  `c062a6d4c47b21780b820553d0c9209e8c1a0af1c54538180e7e58b56ab9c6b5`;
  complete `57`, missing `0`, mismatches `0`, digest
  `8951395c8a6a3b5f9f367ab3d0ba22b7497bf90d0d0f18a1265ff81642c462fc`.
- GitHub runner application `2.336.0`; image `ubuntu-24.04`; image revisions
  `20260816.277.1` and `20260823.283.1`; provisioner versions `20260729.566`
  and `20260819.586`; Node `v22.23.2`; npm `10.9.8`; runtime OS Linux
  `6.17.0-1022-azure` x64.
- Installed mutation versions are exact
  `@stryker-mutator/core@9.6.1` and
  `@stryker-mutator/jest-runner@9.6.1`. Jest is `30.2.0`; ts-jest is
  `29.4.6`. The latter two equal the Plan 5 Base declarations and were not
  upgraded. Configuration uses supported `coverageAnalysis: perTest` and
  reporters `clear-text`, `progress`, `json`, `html`.

## Existing independent gate results

The retained Step 3 evidence has `475` independently hash-verified entries,
missing `0`, mismatches `0`, manifest digest
`320926b9dc91d279fde6330425e9d0bac0ee66c38a755277949612f3e5bc6814`.
Its `command-status.tsv` records all `19/19` commands at exit `0`:

- Quality policy: `68/68` tests, `4/4` suites.
- Backend unit: `559/559`, `35/35` suites. Coverage remains a separate stream:
  statements `2979/3659` (`81.41%`), branches `2141/2815` (`76.05%`),
  functions `492/605` (`81.32%`), lines `2860/3496` (`81.80%`).
- Backend E2E: `242/242`, `29/29` suites. Backend changed-line gate: applicable
  denominator `0/0`, green and reported as not applicable.
- Frontend unit: `182/182`. Coverage remains a separate stream: statements
  `882/1034` (`85.29%`), branches `601/729` (`82.44%`), functions `361/443`
  (`81.48%`), lines `848/988` (`85.82%`). Frontend changed-line gate:
  denominator `0/0`, green and reported as not applicable.
- Playwright E2E: `87/87`, failed `0`, flaky `0`, skipped `0`; desktop,
  tablet, and mobile each `29/29`.

No metric streams were combined or averaged. No post-Action implementation
path changed after `bd056baa996160c17bac45dee8a68fc303030b5b`, so rerunning the
expensive Task 8 producers is not required for this documentation-only
precommit phase.

Fresh deterministic reviewer checks also passed: `npm run mutation:check`
reported `89` rules at exit `0`; the mutation policy/runner Node suite reported
tests `102`, pass `101`, fail `0`, skipped `1` intentional POSIX-only case at
exit `0`; installed-version inspection passed. The initial sandboxed Node
suite attempt was invalidated solely by denied Windows CIM process inspection;
the identical permitted rerun above is the accepted result.

## Scope and prohibited-file audit

- Base-to-HEAD tracked path count: exactly `34`; `git diff --check` exit `0`.
- Exact selected-production-file diff from Base to HEAD: exit `0`, no output.
  All five production sources are byte-unchanged.
- Prohibited scopes are unchanged: `test/support/**`,
  `quality/coverage-baselines.json`, `frontend/**`, and every pre-existing
  workflow. The only workflow added by Plan 5 is
  `.github/workflows/mutation.yml`.
- The workflow is pinned to `ubuntu-24.04`, has explicit job deadlines, and
  does not weaken a producer or policy gate. Stryker thresholds remain high
  `80`, low `70`, break `70`; complete runner deadline remains `900000 ms` and
  smoke maximum remains `350000 ms`.
- Current precommit owned changes are only append-only `progress.md`, ignored
  new `task-09.md`, and reviewer-owned ignored new `review.md`. No
  implementation, generated producer, external ref, or staged path was
  changed by this review.

## Findings and precommit verdict

- Critical: `0`.
- Important: `0`.
- Minor: `0`.
- No actual placeholder or failure bypass has been accepted. No critical
  survivor/NoCoverage remains without an exact independent disposition.

## Step 4 unfinished-evidence search

The prescribed exact search ran after this review file existed and returned
exit `0` with exactly `84` matching lines across `10` files. Semantic audit of
every match found only literal angle-bracket language/configuration syntax:
TypeScript generic types and comparisons, HTML emitted by the mutation
producer and its tests, two Jest root-directory tokens, one regular-expression
named capture, a CLI argument notation, and exact TypeScript anchors in the
critical-rule manifest. No match is a guessed placeholder, unfinished task,
ellipsized test body, stale default-branch instruction, or failure bypass.
Classification verdict: **PASS, 84 legitimate syntax matches, 0 blocking
matches**.

**APPROVED_FOR_HANDOFF_COMMIT — PRECOMMIT/CONDITIONAL — C0/I0/M0.**

The implementer may create only the exact Task 9 evidence handoff commit and
backfill its exact SHA under the non-self-referential protocol. Final Plan 5
approval remains explicitly pending a different postcommit verification of
the exact commit SHA, committed path set, ancestry, clean/ignored-aware
status, and unchanged substantive evidence. No push, workflow dispatch, PR,
or merge is authorized by this verdict.
