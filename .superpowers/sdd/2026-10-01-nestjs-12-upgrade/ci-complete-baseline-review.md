# Current complete mutation baseline: evidence review

Reviewed 2026-10-04 against producer HEAD `6871bb72035229e3a262b020a8c82e1ca25efa65`, the pending `test/quality/mutation-baseline.json` change, and `docs/upgrade/nestjs-12/evidence/ci-pr119/current-complete-6871bb72/`. Scope is the genuine five-shard complete evidence and baseline recording procedure. No runtime changes, full producers or broad test reruns were performed by this review.

**SPEC: PASS. QUALITY: APPROVE. Open actionable findings: none.** The current complete collection and resulting baseline satisfy the existing policy. Coherent current five-shard smoke/remote CI acceptance remains separate and pending; this verdict does not establish overall release readiness.

## Independent verification

- All **35** file hashes listed in `provenance.json` match the saved bytes, including five raw JSON/HTML/log/duration/summary sets, aggregate artifacts, execution script, collection proof and both baselines.
- Every shard retains producer SHA `6871bb72035229e3a262b020a8c82e1ca25efa65`, Node `v24.19.0`, the same five current source hashes and configuration SHA `17196a829ccf2cecdd793ab64fca18029d5b3392c89af5bd7e784cdc8bfd8d12`. The current configuration recomputes to that value. Current source content, report source content, all 89 manifest entries, summaries and new baseline agree using the policy's existing canonical CRLF source hashing. No application/runtime/compiler/policy/allowlist change exists since the previously reviewed members fix.
- Independently compared each shard's source report object with the aggregate and counted **1,744 distinct canonical identities**, with no omitted or duplicated mutants. Shard counts are exactly 272 token-session, 417 identifier-repair, 538 identifier-reconciliation, 286 members and 231 borrowings.
- All five actual shard duration/summary records agree, exit/artifact codes are zero, and no shard exceeded its unchanged 900000 ms deadline. Saved raw logs contain the corresponding final Stryker summaries and completion messages. The first three reports retain their October 3 timestamps; the remaining two retain their October 4 timestamps after environment restart. They are a coherent single-commit/configuration collection, not reattributed reports from earlier configurations.

| Shard | Mutants | Duration ms | Killed | Timeout | Survived | NoCoverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| token-session | 272 | 288185.755574 | 254 | 1 | 9 | 8 |
| identifier-repair | 417 | 474935.958781 | 410 | 6 | 1 | 0 |
| identifier-reconciliation | 538 | 414452.909294 | 508 | 0 | 30 | 0 |
| members | 286 | 561416.397984 | 276 | 2 | 5 | 3 |
| borrowings | 231 | 182067.834414 | 206 | 0 | 25 | 0 |
| Total | 1744 | — | 1654 | 9 | 70 | 11 |

There are zero RuntimeError, CompileError or Ignored results. The nine individual mutant timeouts remain present and count as detected under the unchanged existing policy; successful shard completion must not be described as zero mutant timeouts.

## Policy and baseline authenticity

Ran the existing exported `evaluateMutationReport` and `recordBaseline` functions read-only against the archived report/summary, current manifest/allowlist and an in-memory carrier preserving the exact historical floor. The evaluation independently reproduces policy PASS, every module score, the saved raw score, and an empty violations array. Baseline reconstruction exactly equals both the archived `recorded-baseline.json` and the pending tracked baseline.

The only three critical findings are the existing approved equivalents: `token-interrupted-cas-finalization`, `repair-batch-identity-and-checkpoint` and `reconciliation-secret-decoding`. The allowlist is unchanged and each exact fingerprint remains validated by the existing policy. No new equivalence or critical-rule exception was introduced.

The historical baseline bytes hash to `cb1932bfb4f06cdd9a59ae617048143d696fc3fc0dedf8b66e2193d3209ce51a` and exactly equal the still-committed baseline at producer HEAD. The recorded baseline hashes to `02e0d8da195cc24c331a6d41b946252a4d739adab0f49186d1984890aded136c`; its producer is the actual collection HEAD and its `generatedAt` is `2026-10-04T05:29:57.774Z`, after every shard finished. Its score increases from **95.2518818760857%** to **95.35550458715596%**, an increase of **0.10362271107025833 percentage points**.

Inspected `resume-complete.py`: it verifies the historical baseline against committed bytes and preserves it through all shard checks, validates the settled reports without changing their producer metadata, then introduces the authorized source-hash carrier only inside the merge/record try/finally. It retains the historical floor, invokes the existing complete-merge and record-baseline CLIs, checks the genuine result, and restores the original bytes on failure. The final working file is the reconstructed genuine baseline; the temporary carrier is not the committed baseline or the pending result. The historical snapshot remains byte-faithful. The empty complete-merge stdout log is consistent with that command's file-based output; the policy summary and reproduced evaluation supply the result evidence.

The coordinator's fresh explicit-file Node gate in `/tmp/nestjs-pr119-ci/current-baseline-gate.txt` records **134 passed**, zero failed/cancelled/skipped/todo, 16888.109553 ms. Its output was inspected without repeating the gate. Commit/push and subsequent smoke/remote CI verification remain coordinator actions outside this review.
