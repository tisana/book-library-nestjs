# Independent T2 fix-round-1 re-review

Reviewed `d47011f08e3438815ca5c76d9c6c0d009af6a60a..a35933addd37d60b58912ff7f6770d0d50ef8226` on 2026-10-02. HEAD matches the requested end. Scope is the two original P2 findings and new breakage in this fix diff only. Read the original review, binding T2 brief/global constraints, full fix package, FIXROUND1 report, AGENTS.md/auth plan, changed source, and available recorded RED/GREEN/final logs.

**Spec-compliance verdict: PASS for the scoped T2 correction.**

**Code-quality verdict: APPROVE.** No actionable severity/file findings in the fix diff.

## Original findings

1. **Histogram blind spot: ADDRESSED.** `test/production-bootstrap.e2e-spec.ts:699-755` inspects source buckets after every real HTTP request. Exactly one bucket must change by one; recurring groups must retain the same opaque key, new groups must have distinct keys, and total bucket count must match observed groups. The trusted sequence explicitly binds requests to `[client-a, client-a, client-b, peer, peer]`; the untrusted sequence stays in one peer bucket. Therefore swapping the trusted private proxy between the first two requests cannot pass as it did under sorted final counts. Identity assertions expose booleans rather than addresses or HMAC keys. Recorded wrong-hop compiled-resolver RED fails at the same-key boolean assertion; the report documents byte-for-byte restoration in `finally`, focused real-HTTP GREEN passes both cases, and final production verification rebuilds unchanged application source.

2. **Raw-buffer cutoff secret suffix: ADDRESSED.** `test/support/production-process.ts:102-105,129,149-164,182,198-199` retains at most the diagnostic limit plus the longest configured sensitive value, advances any cutoff inside a complete configured value past its end, and repeats the scan when another value intersects the advanced cutoff. The overlap preserves an unfinished trailing configured value between captures. Both successful-child diagnostics and startup failure output use the same redact-before-64,000-character-crop function. The synthetic split/overflow regression at `test/production-bootstrap.e2e-spec.ts:809-842` checks both the full secret and its suffix using boolean assertions and bounds exposed error length. Original-helper RED fails specifically on suffix presence; focused GREEN passes this probe and the existing split-chunk timeout/cleanup probe. No raw synthetic credential is included in the probe source or recorded failure excerpts.

## Evidence and change assessment

Available `/tmp/nestjs-t2-round1-*.log` summaries match the report: diagnostics RED and proxy RED each have one intentional failure with the expected opposite boolean; focused diagnostics and proxy GREEN each pass two tests. Final production build/run passes **48/48**, relevant existing unit tests pass **26/26 across 3 suites**, and isolated existing e2e passes **243/243 across 29 suites**. These complete final runs have no skips or recorded open-handle warning. Focused selector skips are explicitly distinguished from final acceptance runs. Recorded lint/format/scoped-diff and no-leak checks pass; inspected excerpts contain only the boolean mismatches and test counts, with no credential leak observed.

The fix touches only the two test/harness files, baseline documentation, and implementer report. Bucket assertions strengthen the actual compiled HTTP characterization without changing its application contract. Diagnostic retention stays bounded, the cutoff only advances, and startup retry/exit/cleanup control flow is preserved. Documentation correctly updates the count from 47 to 48 and describes both corrections. No application source, schema, migration, dependency, production entry path, quality policy, or threshold changes appear in this range.

No evidenced tests were rerun, no implementation files were changed, and no agents were spawned. Only this review document was written. T1's pending devcontainer verification and T3/T4/T5 integration responsibilities remain outside this review; this verdict does not claim release or deployment acceptance.
