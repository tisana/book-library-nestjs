# Independent T6 fix1 review

Reviewed on 2026-10-03: `76094d793fe52f7248518d2ed2e9608a0a428957..ad0cfea3feadbf8352d5445a7d22afb4e3462daf`, branch `upgrade/nestjs-12`. HEAD independently confirmed. This scoped re-review addresses the two P2 findings in `task-T6-review.md`; that original report remains the historical verdict for its assessed commit. No application edits, commits, subagents, merge, push, deployment or expensive full rehearsal/mutation runs were performed. Only this review report was created.

**SPEC: PASS for the scoped fixes.**

**QUALITY: APPROVE for the scoped fixes.**

Both findings are resolved. No new actionable findings were found in this range. Combined with the original full review, T6 implementation and runtime rollback evidence are reviewed **DONE_WITH_CONCERNS**, with production rollout still blocked by the independently documented T1/T5 and production prerequisites. This is not release approval.

## Findings resolved

1. Both exact published upgrade/rollback blocks now run in a subshell with `set -eu`. Explicitly checking the Docker `ps` assignment distinguishes query failure from a successful empty result; a separate guard aborts for any surviving predecessor. Replacement startup follows only successful empty state. Stop/pull/readiness failures also terminate the block. Fresh independent execution of the six command tests confirmed that each direction rejects both running predecessors and query errors without calling `up`, while safe empty state succeeds. The tests execute the published blocks against local mock commands and never invoke real Docker/HTTP/ingress.
2. The rehearsal outer `try/finally` now owns acquisition and setup, recording only successfully acquired fixture/directory handles. Container, fixture and environment cleanup are attempted independently. An original failure retains its diagnostic/outcome even if cleanup also fails; a cleanup failure without an original error still rejects. The shared disposable fixture uses `Promise.allSettled` around independently invoked connection/Mongo cleanup and propagates the first rejection after both attempts. Fresh independent execution of four fault/helper tests confirmed early Docker failure cleanup, temp removal despite later fixture-stop failure, retained original launch error, Mongo stop despite connection-close rejection and successful normal helper cleanup. Source inspection confirms environment-file write failure is inside this same cleanup boundary.

## Independent verification and provenance

- Fresh combined command/fault tests: **10/10 passing**, zero failures/skips/cancellations/todos.
- Focused TypeScript6 `tsc -p docs/upgrade/nestjs-12/evidence/t6/review-fix-tsconfig.json`: exit0; actual rehearsal/helper and imported dependencies checked with no output emission.
- Prettier checks of both changed TypeScript files and both test files: pass. Full fix-range `git diff --check`: pass.
- Every original provenance field is retained exactly. Historical execution input hashes independently match the pre-fix commit bytes; all six separately recorded `reviewFixInputHashes` match current final files. The old successful runtime result has not been attributed to the modified script/helper.
- Eight original runtime/build/diagnostic evidence files independently retain exact pre-fix bytes: rollback result, signal exits, document checks, old Dockerfile/build log and all three preserved failed diagnostics.
- No changes to application source, migrations, Dockerfile, Compose, package manifest or lock. Canonical parsed AST comparison confirms all five runtime-check functions (`http`, `rotate`, `stop`, `seedRecovery`, `verifyRecovery`) are unchanged apart from their surrounding ownership scope/formatting. Actual old/new runtime artifacts and the earlier reviewed successful normal rehearsal remain unchanged.
- The shared fixture change is confined to failure-safe cleanup. It affects quality verification scripts, not production lifecycle. Existing mutation workflow path filters already include `scripts/quality/**`; no CI configuration or selection/floor/budget weakening was introduced.

No full rehearsal was repeated because these fixes change operator/error cleanup paths and receive bounded direct regression proof. The prior real old/new/old readiness/session/recovery evidence, approved init/signal ruling, short2s fixture limitation and required>=365s production lease observation retain their original scope. T1 actual devcontainer verification, T5 current mutation acceptance, adopted production objectives, named deployment owner and deployed init/grace confirmation remain blockers.
