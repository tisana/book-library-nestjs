# Members complete runner extension: scoped review

Reviewed `2bad03a2c4da9759aefae04737be592220ca9af3..5b8a59f9c6f2f5559f6a86cc0e2d59890fc58b6a`, including implementation `0659c2cf72cb2f08be86b41518d9a0ec62496a7b` and its evidence-only reporting correction. Scope: trusted members-complete extension of the previously reviewed public Jest runner, exact configuration selection, new regressions and bounded producer evidence.

**SPEC: PASS. QUALITY: APPROVE. Open actionable findings: none.** This approves the scoped implementation, not full mutation acceptance or release readiness.

## Code and semantic review

- `scripts/quality/mutation-jest-runner.cjs:6` defines an exact two-shard map: token-session smoke/complete and members complete. The selected source comes only from this private map. Sandbox profile/shard identity and source identity are included in the bound inventory (`:51`, `:86`); the existing realpath, full suite list, test-content, source-content and normalized configuration checks remain intact. Members smoke and unknown shards cannot publish or prune inventory.
- `stryker.config.mjs:146` enables the runner only for the added members-complete case. Members smoke retains its direct 54-test `testMatch`; the other shards and token profile selections are unchanged. No application or application-test source, compiler, package/lockfile, baseline, equivalent entry, manifest, deadline, concurrency policy, threshold, source selection or production mutator changed in this review range.
- `src/members/members.service.ts:546` exports `getMemberId`, which is genuinely called by AuthService and PermissionsService. The extension retains suites based on all matching baseline test names, rather than assuming all members coverage belongs to MembersService. The actual helper control verifies the required three-suite dispatch and exact caller test identities. Class-method controls legitimately omit only suites whose bodies remain pending under the original Jest pattern.
- Current registration was inspected, including AuthService's conditional module load and the related permission/controller suites. Member methods and `getMemberId` are exercised inside test callbacks; source-dependent module initialization remains on Stryker's static/unfiltered path. No-pattern/static dispatch still runs all discovered suites and cannot publish during an active mutation. The members real-Jest regression checks both selected caller identities and preservation of both synthetic initialization failures after inventory reuse. This approval is confined to the current two supported sources and configurations.
- Existing baseline-only publication, atomic sandbox inventory, cold-worker reuse, exact case-insensitive regex semantics and conservative invalid/stale/missing/unknown-pattern fallbacks were retained. No installed test-runner package was patched. Existing configuration provenance binds the changed runner bytes, so all previous shard collections require fresh evidence under the new configuration.

## Independently checked evidence

Read-only verification commands confirmed all **23** SHA256 entries in `members-runner-controls/provenance.json`. Frozen candidate runner/config bytes exactly equal the committed implementation; frozen original runner bytes equal `2bad03a`. Current canonical configuration is `17196a829ccf2cecdd793ab64fca18029d5b3392c89af5bd7e784cdc8bfd8d12`.

Independently compared the original and candidate report test-file objects, all evaluated mutant identities, locations, replacements, statuses, static flags, coveredBy/killedBy IDs, and every executed file/fullName/status entry from the raw event records. Both baselines contain **129 passed tests across ten suites**. All three controls are **Killed**, with no Timeout, RuntimeError or NoCoverage:

| Control location | Identical executed tests | Original suites | Candidate suites |
| --- | ---: | ---: | --- |
| Members line 84 | 1 | 10 | MembersService |
| Members line 350 | 5 | 10 | MembersService |
| `getMemberId` line 546 | 41 | 10 | MembersService, AuthService, PermissionsService |

Candidate worker 98232 produced the full baseline; worker 98233 subsequently executed the line-84 and helper controls using that inventory without a baseline run of its own. The baseline inventory independently confirms exact members/complete/source binding and 129 names in ten files. Saved logs report original 43 seconds and candidate 29 seconds. Seven ignored mutations are explicitly diagnostic exclusions; neither this pair nor its timing is represented as a complete accepted producer.

The saved exact explicit-file Node CI gate passes **134/134**, with zero failures/cancellations/skips/todo, including members static/import-error, caller-selection and trusted-map regressions. The manifest check passes **89 rules**. These existing producer gates were inspected and hash-verified, not redundantly rerun during the implementation.

The initial reporting result counted sandbox duplicates (136 executions/eight discovered suites), which this review independently identified. The correction preserves those exact original bytes as `reporting-with-sandbox-duplicates.txt`, honestly classifies them, and records deletion only of the failed members-owned sandbox after its failure evidence was preserved. The fresh canonical reporting log is **68 passed tests/four suites**, 2.879 seconds, exit 0. Verified the correction changes no runtime or test code and leaves the canonical configuration hash unchanged. This evidence issue is resolved; it is not an open code finding.

## Remaining acceptance

The actual complete members workload remains **286 mutants** and its **900000 ms** deadline is unchanged. The bounded 43-to-29-second result does not prove that workload will finish within budget or eliminate the previously observed timeouts. A fresh coherent all-five complete collection on one committed configuration, exact 1744-mutant merge, genuine current baseline and subsequent coherent five-shard smoke acceptance remain required. Successful shards from the prior configuration must not be rebound.

The coordinator's previously reviewed baseline carrier procedure remains unchanged: preserve historical bytes during all producers; only after all five complete shards succeed, use the explicitly authorized temporary current-source-hash carrier retaining the exact historical raw-score floor **95.2518818760857** for synchronous existing merge/record commands; restore original bytes on any failure and never commit the carrier. Only the genuine current complete producer's validated baseline may persist. This review performed no full producer, baseline rewrite, push, merge or deployment.
