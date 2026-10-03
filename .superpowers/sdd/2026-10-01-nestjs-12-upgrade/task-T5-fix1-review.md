# Independent T5 fix1 review

Reviewed on 2026-10-03: `e5cc50c0af9bc0b8cf1323b298021cd75c124f4a..5eb44651a4b6315ce95f1e0a78263d1459d82b7f`, branch `upgrade/nestjs-12`. HEAD independently confirmed. This is the scoped re-review of the two P2 findings in `task-T5-review.md`; the original report remains the historical verdict for its assessed commit. No production/test edits, commits, subagents, merge, push, deployment or expensive producer reruns were performed.

**SPEC: PASS for the scoped fixes.**

**QUALITY: APPROVE for the scoped fixes.**

Both actionable findings are resolved; no new actionable findings in this range. Combined with the original full review, the implementation is reviewed **DONE_WITH_CONCERNS**. This is not passing mutation acceptance or release approval.

## Resolution

- **Workflow-path regression:** The exact ordered `expectedPaths` list now includes `tsconfig.mutation.json` and `tsconfig.jest.json` immediately after `stryker.config.mjs`. The actual workflow filters remain present. Strict list comparison, five-shard topology and all policy assertions remain intact. Fresh execution of the actual CI command on the reviewed commit passed **106/106**, zero failed/cancelled/skipped/todo, in **15224.73ms**, exit0: `node --test test/quality/mutation-runner.test.mjs test/quality/mutation-policy.test.mjs`.
- **Runtime provenance:** `validateCompleteProvenance` now requires Node24 and reports the matching error. Positive canonical fixtures use24; the rejection case exercises the previous22 major. Saved RED evidence demonstrates that Node24 was rejected and Node22 was incorrectly accepted before the validator fix. Independently reran the bounded synthetic1744 all-Killed canonical control: **Node24 accepted, Node22 rejected** with `complete summary nodeMajor must equal 24.` Synthetic validation results were neither saved as a baseline nor presented as mutation producer evidence.

Inspected the complete three-file implementation diff: the runtime comparison/error and fixture/assertion expectations are the only baseline-policy changes. Exact current commit, source/config hashes, report schema,1744 canonical denominator,900000ms budget, five successful shard outcomes, evaluated score equality and historical raw-score floor remain strict. Independent byte comparison confirms the tracked historical baseline, Stryker configuration, mutation compiler config,89-rule manifest and3-equivalent allowlist are unchanged by this fix.

## Verification and evidence

Fresh `npm run test:quality-reporting` passed **68/68**, exactly **4 canonical suites**, exit0 in3.23s. Fresh `npm run mutation:check` passed **89rules**, exit0. Both checks ran on Node24.19.0. Independent SHA256 comparison confirmed all **10** inputs in `mutation-review-final-provenance.json` match the reviewed commit's bytes, including the unchanged historical baseline. The provenance correctly identifies input commit `97ec26d612d04993f5b9896913a7de6ebed42db9`; `5eb4465` adds evidence/reporting metadata.

The documented cleanup removed only the owned retained smoke-token `.stryker-tmp` root, resolving the local duplicate quality-suite discovery observed in the original review. Failed producer logs/reports/summaries remain preserved; no cleanup was used to fabricate producer success.

## Remaining blockers

Actual mutation acceptance remains explicitly **BLOCKED**: smoke350132ms exceeded the unchanged350000ms budget; complete token802494ms had1RuntimeError; the later narrow repair and bounded throughput control do not prove whole-profile acceptance. There are still no accepted coherent current five-shard1744 complete/1366 smoke merges. Historical token/reconciliation hash gaps remain until actual current complete provenance at or above95.2518818760857 and genuine smoke acceptance are obtained. This fix makes future genuine Node24 recording possible without rebinding or fabricating historical evidence.

T1's separate actual devcontainer/network verification blocker remains open. T6 may rehearse and document the blockers; no release, merge, push or deployment authorization is implied.
