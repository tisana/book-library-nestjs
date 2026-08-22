# Task 06 Evidence

## Task

Plan 5 Task 6 — kill member and borrowing mutants and establish the upward-only baseline.

Binding runtime amendments: smoke uses exact `350000 ms` shard gates; complete is produced only by five disjoint full-source complete shards with concurrency `4`, exact `900000 ms` shard gates, and fail-closed canonical merge requiring exactly `1727` identities. The superseded monolithic complete producer is prohibited.

## Implementer model and reasoning

- Requested: `gpt-5.6-sol`, high reasoning.
- Actual: `gpt-5.6-sol`, high reasoning.
- Initial identity: `/root/plan5_task6_implementer`.
- Recovery identity: `/root/plan5_task6_recovery_implementer`.
- Substitution: none.

## Reviewer model and reasoning

- Required: fresh `gpt-5.6-sol`, high reasoning, separate from the implementer.
- Actual identity and verdict: pending controller dispatch after implementation.

## Base SHA

- Plan 5 base: `b678209e23ef7020c21ff565327de1b229c835f6`.
- Task 6 starting HEAD: `0383ac5d0d082ba9c065dc16638e573ff37174bd`.
- Task 5 dependency: independently `APPROVED`, Critical `0`, Important `0`, Minor `0`.
- Preflight: selected production bytes are unchanged from the Plan 5 base; the isolated worktree had only the controller-authored Task 6 dispatch ledger line; no concurrent protected-path work was present.

## Files changed

First commit:

- `src/members/members.service.spec.ts`
- `src/borrowings/borrowings.service.spec.ts`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-06.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`

No production, allowlist, manifest, package, runner/config, frontend, workflow, or Task 7+ path changed.

## RED command and exit

The Task 6 RED is the preserved, accepted Task 5 complete canonical merge:

`reports/mutation/diagnostics/task5-fix-round1-final-complete-wsl-900k/mutation.json`

The merge/policy command exited `1` solely for the member/borrowing critical findings below. The five complete shards and canonical merge otherwise passed artifact, provenance, scope, runtime, and raw-score gates.

## RED evidence

- Canonical identities: exact `1727`.
- Raw combined score: `90.79328314997105`.
- Statuses: `1565` Killed, `132` Survived, `27` NoCoverage, `3` Timeout.
- Auth unapproved critical findings: `0`; exact reviewed equivalents: `3`.
- Member unapproved critical associations: `26` (`25` Survived, `1` NoCoverage).
- Borrowing unapproved critical associations: `51` (`39` Survived, `12` NoCoverage).
- Exact unique member/borrowing fingerprints: `77/77`.
- Tracked `test/quality/mutation-baseline.json`: absent.

Exact inventory, in accepted report order (`source | mutant id | status | rule | fingerprint`):

- `src/members/members.service.ts` | `77` | `NoCoverage` | `member-update-reservation-and-lifecycle-state` | `bf8518f4306469c1293c4c02eb6092e4241d0604387d1fde554608afe8e03b13`
- `src/members/members.service.ts` | `55` | `Survived` | `member-update-reservation-and-lifecycle-state` | `d22b1c0ae00aea736376c2d340f5272e41c343a792643b7d99a0fc04392058da`
- `src/members/members.service.ts` | `75` | `Survived` | `member-update-reservation-and-lifecycle-state` | `b02fc62b94d5d692ca8b254e29d1d1522c77d3df87279a4fc8c9fbf93c128887`
- `src/members/members.service.ts` | `105` | `Survived` | `member-update-compensates-and-revokes-lifecycle` | `bf3ef5cd27050f64372f83832e23f7937a9f28438d3f286aa9d263a188f2c47f`
- `src/members/members.service.ts` | `109` | `Survived` | `member-update-compensates-and-revokes-lifecycle` | `901e86035a2f9efe5d931938919fc74c584e3f2ad84ca373fed4c75a7652dcb7`
- `src/members/members.service.ts` | `107` | `Survived` | `member-update-compensates-and-revokes-lifecycle` | `91b05facec5d7a7adf9fad77f6e3ac9176fbdeac279a5f5f4c0189574943c76e`
- `src/members/members.service.ts` | `133` | `Survived` | `member-active-auth-status-required` | `45979eaae7e0ef934630479904a76328004afb937ecce98c68cdfc7b87e20757`
- `src/members/members.service.ts` | `150` | `Survived` | `member-credentials-deny-duplicate-owner` | `51907a9e35453862df74577ace6e9030d4905535485913b4424b7c650d411614`
- `src/members/members.service.ts` | `151` | `Survived` | `member-credentials-deny-duplicate-owner` | `532a1c4980a4587b3c828c2f8e970f4df123b8003f161403ed320a7f9b74b8b0`
- `src/members/members.service.ts` | `153` | `Survived` | `member-credentials-deny-duplicate-owner` | `d861029d1380adfe1b16248dd88f2c5f756c5940b7f7eb25d8101d3846b28318`
- `src/members/members.service.ts` | `154` | `Survived` | `member-credential-reservation-and-revocation` | `64942adaad1f92b276b3b9b4cbb8774ba00d5ecca901874d6acac907d1b5403e`
- `src/members/members.service.ts` | `157` | `Survived` | `member-credential-reservation-and-revocation` | `8ee39737b9d2f5a5ef0bb30c9c957c02e28dc2a91bf582bfd5569af284a3cbf1`
- `src/members/members.service.ts` | `160` | `Survived` | `member-credential-reservation-and-revocation` | `6ebf3e932c6278cbf985bec2e7fffab4cb1ed586ec4d05873ce1707e3f443461`
- `src/members/members.service.ts` | `164` | `Survived` | `member-credential-reservation-and-revocation` | `c947c2bb74254ae70b73684c4278a45e4a37bc82f4eae5c191c5ed52f992d6c5`
- `src/members/members.service.ts` | `165` | `Survived` | `member-credential-reservation-and-revocation` | `c23448d517011cd91364e40fda9946c88a7bb33410e1e803a3fe10020c48e6ce`
- `src/members/members.service.ts` | `168` | `Survived` | `member-credential-reservation-and-revocation` | `306ff93a9886b3b8e8ed028aab4262065305a79d687060784d665d4798a4d4e1`
- `src/members/members.service.ts` | `170` | `Survived` | `member-credential-reservation-and-revocation` | `7f7af5ec565ea7e7350ed2f86486388b62793f8ee21ff0189e5544a038c5fe8c`
- `src/members/members.service.ts` | `172` | `Survived` | `member-required-document` | `11c9ef6938021353b2f17a77a4efbcba192ad88f72b5b1c79f4c36e10c43c4f3`
- `src/members/members.service.ts` | `177` | `Survived` | `member-required-document` | `b983f5aa21c98da846cb224e77bfc0eb59ccc5f7d0b3dd0520eeaac85281e2a7`
- `src/members/members.service.ts` | `182` | `Survived` | `member-auth-version-bump` | `9599c794b8c41cc41daeafd5840f2ead68c6cb2d78a78efbd49a466725ea7468`
- `src/members/members.service.ts` | `186` | `Survived` | `member-auth-version-bump` | `ac25db6acdfc3aec1a6270d0f3ee14e676dacdc7489336f901013115248d2856`
- `src/members/members.service.ts` | `193` | `Survived` | `member-reservation-enforces-exact-owner` | `db7dafaecbc6474ec979a0a95340ac63c66252247cac6075514e94638149aa22`
- `src/members/members.service.ts` | `205` | `Survived` | `member-reservation-enforces-exact-owner` | `bcba82491ba6d57824cf44a09b19a9deabe955734f04b18435ab219bd265079e`
- `src/members/members.service.ts` | `206` | `Survived` | `member-reservation-enforces-exact-owner` | `9d7ba92ae9563dcd8ab261df4affb7f94096fc310632d2c6cc832255b66724c4`
- `src/members/members.service.ts` | `207` | `Survived` | `member-reservation-enforces-exact-owner` | `fc2fe0d15f632b8354c2709fa3ab6fb0102c6901eb6bddbf783b5fc5a02499bb`
- `src/members/members.service.ts` | `209` | `Survived` | `member-reservation-enforces-exact-owner` | `dd672de5e29998c46484658bb6c5f9f10678730724d956f4024c0fe0f4e4afe8`
- `src/borrowings/borrowings.service.ts` | `82` | `NoCoverage` | `borrowing-list-state-filters` | `1d21465765d651319f772ddb35ab514bc52558917acad4791cb3e56242bd0cfa`
- `src/borrowings/borrowings.service.ts` | `83` | `NoCoverage` | `borrowing-list-state-filters` | `7935bdbb8dc814a5280b840b7a148f2a72a99afba258af2435439719469f8b14`
- `src/borrowings/borrowings.service.ts` | `101` | `NoCoverage` | `borrowing-list-state-filters` | `12881df19da6987d50e219dad0ef4aafc04cd7386233d8cbff1304f329a9d059`
- `src/borrowings/borrowings.service.ts` | `115` | `NoCoverage` | `borrowing-required-record` | `9adc6e6da628d989fbfdf861f514cdd2f0c07ec69cb304743c9e0299f0ebee75`
- `src/borrowings/borrowings.service.ts` | `116` | `NoCoverage` | `borrowing-required-record` | `926b6bd2d4939f10032909c5601c1c6955b869081d69f151e188defd1d3ba849`
- `src/borrowings/borrowings.service.ts` | `123` | `NoCoverage` | `borrowing-required-book` | `3a3ccd5937682454c2dafb1836472c9b8d9d7fd478a054a8182bb995ca1ff0e8`
- `src/borrowings/borrowings.service.ts` | `124` | `NoCoverage` | `borrowing-required-book` | `19fbbaf984f5af76e7ed9e6969053a44687e2132d904c2f9e520333aad5d856a`
- `src/borrowings/borrowings.service.ts` | `131` | `NoCoverage` | `borrowing-required-category` | `25942c886ea46f8a72da48b30518e9c3c103620c6b0b6dcea810fefd911b8576`
- `src/borrowings/borrowings.service.ts` | `132` | `NoCoverage` | `borrowing-required-category` | `9b02082d74f8f50d3b9844eee8e165aaf4447a7f0b348eadc4a174256813751a`
- `src/borrowings/borrowings.service.ts` | `139` | `NoCoverage` | `borrowing-required-member` | `d2fc5d9d0d1e249116f00af49b63cbb3996878235dd41aab3d16341565523541`
- `src/borrowings/borrowings.service.ts` | `140` | `NoCoverage` | `borrowing-required-member` | `77b0547249e56dfd951604a7a1553459b24e45c12889aa9ad20a607981dc081f`
- `src/borrowings/borrowings.service.ts` | `147` | `NoCoverage` | `borrowing-required-membership-policy` | `37815cf3177ebf5909bf0230fa8ee228b1b677d9c7b8666d9029d43e4ed83393`
- `src/borrowings/borrowings.service.ts` | `148` | `NoCoverage` | `borrowing-required-membership-policy` | `80f786c58662605e16d7d09166b6de2679d9ae55585011b19cb9c24538ce87e6`
- `src/borrowings/borrowings.service.ts` | `12` | `Survived` | `borrowing-return-requires-staff-and-returnable-state` | `4e8e23a1756deb1909d104f4ff179b30ec9b48043bcd9eca4784c4b45f5de9c7`
- `src/borrowings/borrowings.service.ts` | `13` | `Survived` | `borrowing-return-requires-staff-and-returnable-state` | `62b5f68e0c44ef8dec9bbc2403295fd7ea04f12127aa7121517499fbbba4bf11`
- `src/borrowings/borrowings.service.ts` | `14` | `Survived` | `borrowing-return-requires-staff-and-returnable-state` | `2a6076abac0466b6d40799ef90b43aa2afd3f22a63167eb3ca4b3491c8006636`
- `src/borrowings/borrowings.service.ts` | `16` | `Survived` | `borrowing-return-requires-staff-and-returnable-state` | `8eded9ed1112d9eb657841362cac4f9b8044fe2ab904e52c11d04698811c7a50`
- `src/borrowings/borrowings.service.ts` | `17` | `Survived` | `borrowing-return-requires-staff-and-returnable-state` | `ff39479648ce3e859e69cf02fdc501a97ebb85d7eb06c830fddfd5443f98012d`
- `src/borrowings/borrowings.service.ts` | `30` | `Survived` | `borrowing-return-requires-staff-and-returnable-state` | `96b9531db886a6e3b006ef5f00a254bbcbb3272f4488446c4b580126bc04a3ec`
- `src/borrowings/borrowings.service.ts` | `31` | `Survived` | `borrowing-return-requires-staff-and-returnable-state` | `6964810f33410809cba53f67940f0131382bdc8ef0baf8b7284922370e50bae9`
- `src/borrowings/borrowings.service.ts` | `32` | `Survived` | `borrowing-return-requires-staff-and-returnable-state` | `503a979f6ddc9375ee00db9a6b09a34c759ad682441888c82dfa575f74dcbdfe`
- `src/borrowings/borrowings.service.ts` | `52` | `Survived` | `borrowing-member-detail-is-owner-scoped` | `20f4a3f6f84fe454a8b4a21a986e6a9b26c27db9a155fa008821bc3eb58b3632`
- `src/borrowings/borrowings.service.ts` | `54` | `Survived` | `borrowing-member-detail-is-owner-scoped` | `ff93d51b6b7fac279bc939aca9218656ecaff7e37e1857d3205ed1dc27c81d56`
- `src/borrowings/borrowings.service.ts` | `53` | `Survived` | `borrowing-member-detail-is-owner-scoped` | `e0ae7c714355cfd42ad7a545db546d32f74925e52d1a029003c1b02716a2817a`
- `src/borrowings/borrowings.service.ts` | `67` | `Survived` | `borrowing-member-list-rejects-cross-owner-query` | `cb1fafdd7e42c73992788473646d77736a05278622bba861dbe7c46d7c8d7434`
- `src/borrowings/borrowings.service.ts` | `70` | `Survived` | `borrowing-member-list-rejects-cross-owner-query` | `23603fdb48dc1cf1654feb3a5ac14427314b9bc0782a06d85b914bfecf9123e4`
- `src/borrowings/borrowings.service.ts` | `79` | `Survived` | `borrowing-list-state-filters` | `70ed01e1c2f5fb2d2f308582d7987ff0277326d1ed4f4ead77cd69db01c1defb`
- `src/borrowings/borrowings.service.ts` | `81` | `Survived` | `borrowing-list-state-filters` | `da1296944393d733f89f62d03ad47cb1f4de8a506a09e99f192651e976f5dcb9`
- `src/borrowings/borrowings.service.ts` | `100` | `Survived` | `borrowing-list-state-filters` | `69e8785d07883bd68c841034c61cc5f84818d714718f57d2ac1284bc92c63779`
- `src/borrowings/borrowings.service.ts` | `103` | `Survived` | `borrowing-overdue-policy-selector` | `f068c78c056fcc830db0006c395e1ad6365d21cf30c537d5d23d2f940fb0fa7a`
- `src/borrowings/borrowings.service.ts` | `104` | `Survived` | `borrowing-overdue-policy-selector` | `3002fc5db7e28f9edb950205edf5a0000fa354e34deffa1105f94531fcc0a98d`
- `src/borrowings/borrowings.service.ts` | `105` | `Survived` | `borrowing-overdue-policy-selector` | `5e435e7121907b773a5df5bd70efbf37448fbc2b36956fe10566e8f3cf8c80ce`
- `src/borrowings/borrowings.service.ts` | `106` | `Survived` | `borrowing-overdue-policy-selector` | `9084df66c12036b3933ae56735d1cfa93f6352ca9e8d5f10eb91d1784868004a`
- `src/borrowings/borrowings.service.ts` | `107` | `Survived` | `borrowing-overdue-policy-selector` | `5d3381662f48c1fcca6fd51cc4692cae71e10eb827b25453797b759d2a73f4db`
- `src/borrowings/borrowings.service.ts` | `108` | `Survived` | `borrowing-overdue-policy-selector` | `eccf8a09f8162009039daa02448afa97b754c4f9f3422c73716de5d8ebf0a42e`
- `src/borrowings/borrowings.service.ts` | `109` | `Survived` | `borrowing-overdue-policy-selector` | `be0ea12ba8af4513d752109bcd0c8dcbaf2dae2ab3bf5368f94947b52d958633`
- `src/borrowings/borrowings.service.ts` | `111` | `Survived` | `borrowing-required-record` | `006d18dc0a13a486cf158ade805eec4c6757e7a88042f1fbcc015c9128eefa18`
- `src/borrowings/borrowings.service.ts` | `114` | `Survived` | `borrowing-required-record` | `396c0bd6c956c4d34b8098d29aebf357eeb1282b1dc503b76d302b4c7ce8edad`
- `src/borrowings/borrowings.service.ts` | `118` | `Survived` | `borrowing-required-book` | `2fab68edb098a1bb3ae4ed84eaaa9f7f5b9c4a19bea4d4d4eca907b0eab4383c`
- `src/borrowings/borrowings.service.ts` | `119` | `Survived` | `borrowing-required-book` | `5258a86257657c169690f930185671c36e8594074a205d3cf56970f4aeb8ccd6`
- `src/borrowings/borrowings.service.ts` | `122` | `Survived` | `borrowing-required-book` | `ef98f86dfe8afcb13403acb89bcce6a6429d01943fe5997b8a73983060e32347`
- `src/borrowings/borrowings.service.ts` | `126` | `Survived` | `borrowing-required-category` | `6a4ffd1a95d9628950786f7b25f791c24537b89242d1bdc1ce070591f9db5eae`
- `src/borrowings/borrowings.service.ts` | `127` | `Survived` | `borrowing-required-category` | `a07bbb0d24f8bd3cee17690ce0da51cd8d01b7b2e6ca5ab976e590e5aae7267b`
- `src/borrowings/borrowings.service.ts` | `130` | `Survived` | `borrowing-required-category` | `7d9fbc93cc429c855e623a69b41ca1f5e9f88ef1ddf3c3dfaa4858a2d1766856`
- `src/borrowings/borrowings.service.ts` | `134` | `Survived` | `borrowing-required-member` | `98da1ffcf7c55b3809ecb954c3ec971a8f5b71aaf700ecb98a7bcc1d042152ce`
- `src/borrowings/borrowings.service.ts` | `135` | `Survived` | `borrowing-required-member` | `a05b30d65e30a96a7fc483d24ab4e6f355576071e19da208dda9292683500f53`
- `src/borrowings/borrowings.service.ts` | `138` | `Survived` | `borrowing-required-member` | `dc43056c3b5082028fc11f2b63946825c90e615bf6bccc7c0398b567d9767adc`
- `src/borrowings/borrowings.service.ts` | `143` | `Survived` | `borrowing-required-membership-policy` | `b0a0cb1440b0d68f349700a56c0925ae4b5f5161bb5ba6229a063c9e8911bf82`
- `src/borrowings/borrowings.service.ts` | `142` | `Survived` | `borrowing-required-membership-policy` | `2e93324c754d7e440facef8adb7eaf663e9d626f7eb7bf09ca5c8bd05ac4a9d9`
- `src/borrowings/borrowings.service.ts` | `146` | `Survived` | `borrowing-required-membership-policy` | `80775e1056928e842eef79a4b6be5bbb102cadeead413b2d409d21b6b21cc243`
- `src/borrowings/borrowings.service.ts` | `159` | `Survived` | `borrowing-transaction-and-staff-actor-boundary` | `381dbd37b3cfeac29dfa8d4b8b5dd4ea5ccd00d9ff45f0038847e6abacdc365f`

## GREEN command and exit

Authoritative formatted-test commands:

- `npx jest --runInBand members/members.service.spec.ts borrowings/borrowings.service.spec.ts` exited `0` with `93/93` tests.
- `npx jest --runInBand` exited `0` with `559/559` tests across `35/35` suites.
- `node --test test/quality/mutation-policy.test.mjs test/quality/mutation-runner.test.mjs` exited `0` on Windows with `92` passed and one intentional POSIX skip.
- The byte-exact WSL snapshot passed focused Jest `93/93`, deterministic runner/policy `93/93` with no skips, manifest check `89` rules, and Prettier.
- `node scripts/quality/run-mutation.mjs smoke-sequential` exited `0`.
- Each of the five `complete-shard` commands and `complete-merge` exited `0`.

## GREEN evidence

- Authoritative clean WSL-native snapshot: `/home/tisana/book-library-plan5-task6-precommit4-20260822/repo`.
- Temporary immutable provenance: `b8f6c7def9a74f1a9918f13c8d8da34f5e9a8eff`.
- Runtime: Node `v22.22.2`, npm `10.9.8`; fresh `npm ci` completed in `21.16 s`.
- The two formatted specs, runner, config, policy, allowlist, manifest, and five protected production files matched the Windows worktree byte-for-byte before execution; snapshot Git status and cached diff were clean.
- Smoke canonical merge: exact `1366`, raw `99.78038067349927`, policy PASS, zero violations/unapproved critical findings, and exactly three approved auth equivalents. Aggregate JSON SHA-256: `c8254d66ec15f78f7da5ffc53fbdf7ee9979aee2402e10e4397ca858de24b295`.
- Complete canonical merge: exact `1727`, raw `95.2518818760857`, policy PASS, zero violations/unapproved critical findings, and exactly three approved auth equivalents. Aggregate JSON SHA-256: `c434aa535811d5b872afc4d765406e3ed2fdf3fb96b14327611d3b48e86a489a`.
- Member and borrowing critical findings from the Task 5 RED are now `0`; no new equivalent entry was requested or added.
- Preserved authoritative trees:
  - `reports/mutation/diagnostics/task6-precommit4-final-smoke-wsl-350k/` (tree hash `b0331b4cd58812f37b8f6f1164d80b4dd1422c679bca5076ec3e52979de8c7de`).
  - `reports/mutation/diagnostics/task6-precommit4-final-complete-wsl-900k/` (tree hash `3013133978b19bb8a3b5687235546a29f66c4eca9d8b66c5582b9b4c27e11bab`).

## Interruption recovery and superseded evidence

- Retained snapshot `/home/tisana/book-library-plan5-task6-precommit3-20260816/repo` was clean at `507d88170b5126e46f6090d18278ca35e2020466`, with no surviving mutation descendants.
- The interrupted members shard had only `stryker.log`; no JSON, HTML, duration, or summary existed. Its preserved log SHA-256 is `3c39a53d6b0b20f360b3ab9abe093627ef800870e6afc71876e148af9f292432`.
- Recovery on that exact snapshot completed members in `337942.779889 ms`, borrowings in `38062.719489 ms`, and merged exact `1727` at raw `95.2518818760857` with policy PASS.
- Pre-commit Prettier verification then correctly failed for both changed specs. Only Prettier formatting was applied, changing member/borrowing raw SHA-256 from `77f2e0fcadda7df26c8a8bfc751e76b97d31714ca446e7fea5da6cf2ff0d0d13` / `fb9bd69ccd6d5095ff787b8e4c172ec46966e2e44e2656fb11cdfb3dbd539137` to `4da38e5d048321df1bbeacf73a6b97aa58d118db2bbc86d7a7d79642ba12b163` / `ed4ad760d819baab62bde04e3d6e7ea07e794d367f7abd4b2ca0e155f2689ef6`.
- All `507d881...` mutation evidence remains preserved but is superseded and is not accepted as final evidence for the formatted first commit.

## Focused metrics

- Members: `54/54` focused Jest; complete score `97.2027972027972` (`278` detected, `8` undetected), zero critical findings.
- Borrowings: `39/39` focused Jest; complete score `89.17748917748918` (`206` detected, `25` undetected), zero critical findings.

## Full-suite commands and exits

- Focused Jest: exit `0`, `93/93`.
- Full backend unit: exit `0`, `559/559`, `35/35` suites.
- Windows runner/policy: exit `0`, `92` passed, `0` failed, one intentional POSIX skip.
- WSL runner/policy: exit `0`, `93/93`, no skips.
- ESLint on both changed specs: exit `0`.
- Prettier on both changed specs and mutation interfaces: exit `0` after the documented format-only correction.
- Manifest updater check: exit `0`, `89` rules.
- `git diff --check`: exit `0`.

## Runtime evidence

- Smoke exact `350000 ms` gates: token `144140.581126`, repair `109032.665821`, reconciliation `121805.903822`, members `235145.30313699995`, borrowings `40534.341934000026`; all required artifacts present, no timeout.
- Complete exact `900000 ms` gates at concurrency `4`: token `115500.21817`, repair `60808.076845999996`, reconciliation `98881.84506`, members `286728.066774`, borrowings `36610.310016999996`; all required JSON/HTML/log/duration/summary artifacts present, no timeout.

## Commit hash

Pending until the first immutable Task 6 implementation commit exists. Its full SHA will be backfilled in the distinct baseline/evidence commit without amending the first commit.

## Deferred findings

- None at dispatch.
- Reference-runner distributed wall-clock proof remains deferred to Task 8 and is not waived.
- Push and GitHub Actions dispatch remain unauthorized.

## Reviewer decision

Pending fresh independent review after implementation.
