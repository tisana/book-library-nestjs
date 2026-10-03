# PR119 initial CI failures

Head:64898654d30d6cf02a05dc3c10cb7de8636039ec; tested merge:25a949ef6151fd6508aff22b9eb9229ee28ec4da.

- CI run37129048372, production job111220286349: all54 production tests pass, then Jest exits1 because test-results/backend-production.json has no parent directory. Artifact upload also fails because the result does not exist; performance/image steps and dependent build are skipped. A new npm pretest:production:report hook creates the report directory, matching existing coverage/e2e hooks. Fresh exact command starting without test-results passes54/54 and writes valid JSON, exit0.
- Selective mutation run37129048363, token job111220286411: actual350021ms timeout at unchanged350000ms;2workers,211 generated,147 tested at final progress,2Timeout. Other4 shards pass. Aggregate111221320949 correctly fails missing token-session mutation.json. Original artifact logs/summary retained; no partial report is accepted and no budget/policy change was made. Throughput diagnosis continues.
