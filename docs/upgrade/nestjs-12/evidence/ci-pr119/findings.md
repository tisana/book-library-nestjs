# PR119 initial CI failures

Head:64898654d30d6cf02a05dc3c10cb7de8636039ec; tested merge:25a949ef6151fd6508aff22b9eb9229ee28ec4da.

- CI run37129048372, production job111220286349: all54 production tests pass, then Jest exits1 because test-results/backend-production.json has no parent directory. Artifact upload also fails because the result does not exist; performance/image steps and dependent build are skipped. A new npm pretest:production:report hook creates the report directory, matching existing coverage/e2e hooks. Fresh exact command starting without test-results passes54/54 and writes valid JSON, exit0.
- Selective mutation run37129048363, token job111220286411: actual350021ms timeout at unchanged350000ms;2workers,211 generated,147 tested at final progress,2Timeout. Other4 shards pass. Aggregate111221320949 correctly fails missing token-session mutation.json. Original artifact logs/summary retained; no partial report is accepted and no budget/policy change was made. Throughput diagnosis continues.

## First fix confirmed remotely

Commit1ef70f173d8d54c454e2ae23e9c51fe1566211cb: main CI run37134555154 succeeds, including production/image/performance and dependent build. Selective mutation run37134555152 still fails. No mutation acceptance claim.

## Reviewed mutation fixes and current complete baseline

Supported public Jest runner avoids loading pending-only suites using the successful baseline inventory. Token-session smoke/complete and members complete retain exact matching caller tests, static/unfiltered discovery, source/config/test hashes, conservative fallback, and all existing selections/budgets/critical rules. Scoped independent reviews approve both changes. Current complete producer6871bb7 accepts1744 mutants, raw95.35550458715596% >= historical95.2518818760857%, all5under900000ms and only3unchanged approved equivalents. Actual baseline recorder replaces the historical source-hash gap with genuine current provenance; the temporary floor carrier was never committed. See current-complete-6871bb72/README.md and raw artifacts. Fresh current-baseline explicit Node gate134/134 passes. Coherent GitHub smoke and final main CI remain pending.

## Final remote acceptance

Head21c43547133b631beb7a2ef6ae1ef2df030c5505 / tested merge63b2e80306d479f1280a74910007d9054410eee9: main CI37180305467 and mutation CI37180305407 both fully SUCCESS. All7mainjobs and5smokeshards+aggregate pass. Actual coherent smoke1366/raw99.78038067349927%, only3unchanged critical equivalents/no violations; token79016ms,repair290553ms,reconciliation271127ms,members152567ms,borrowings69176ms below unchanged350000ms. Remote rawartifact11294654028/archiveSHA, summary/report/durations,source/config/producer metadata and job snapshots saved under github-21c4354. Read-only existing policy re-evaluation against the genuine current baseline reproduces PASS. Mutation acceptance blocker resolved; T1devcontainer andproductionprerequisites remain.
