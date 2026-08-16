# Task 05 — Auth mutation hardening

## Execution identity

- Requested model: `gpt-5.6-sol`, high reasoning
- Actual model: `gpt-5.6-sol`, high reasoning
- Identity: `/root/plan5_task5_implementer`
- Substitution: none

## Task

Kill every non-equivalent critical auth mutation using focused observable-behavior tests, then prove the exact smoke and distributed complete-profile contracts. Production code remains protected; the only gate change is the separately human-approved smoke-budget amendment from `300000` to exactly `350000 ms`.

## Implementer model and reasoning

Requested and actual implementer: fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task5_implementer`; substitution none. This identity was recorded before substantive analysis or test changes.

## Reviewer model and reasoning

Initial final reviewer requested and actual: separate fresh `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task5_final_reviewer`; substitution none. Verdict: `CHANGES_REQUIRED`, Critical `0`, Important `3`, Minor `0`. Fix Round 1 requested and actual implementer: `/root/plan5_task5_recovery_implementer`, `gpt-5.6-sol`, high reasoning; substitution none. Re-review remains pending and is not presumed.

## Base SHA

Task 5 starting SHA: `dad7c524330c1c60ea016b357c3feedae68e47c9`. Locked Plan 5 base: `b678209e23ef7020c21ff565327de1b229c835f6`.

## Files changed

- `src/auth/token-session.service.spec.ts`
- `src/auth/auth-identifier-repair.service.spec.ts`
- `src/auth/auth-identifier-reconciliation.service.spec.ts`
- `docs/superpowers/plans/2026-07-31-selective-mutation-testing.md`
- `scripts/quality/run-mutation.mjs`
- `stryker.config.mjs`
- `test/quality/mutation-equivalents.json`
- `test/quality/mutation-policy.test.mjs`
- `test/quality/mutation-runner.test.mjs`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-05.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-05-brief.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-05-recovery-2026-08-16.md`

Implementation `f539eda1c1f99622df59ca13181b9a71f96219a5` changed the governing selective-mutation plan, runner, Stryker configuration, three auth specs, equivalent allowlist, policy regression, and runner regressions. Evidence commit `1819b85433b798fb4e25e2e751bb381b5ab02400` added the four Task 5 ledgers/briefs. Fix Round 1 additionally changes only the same three auth specs, the policy quality regression, and those Task 5 evidence files. The runner/config work is exactly the approved `350000 ms` smoke amendment and five-shard distributed-complete amendment; complete remains `900000 ms`, concurrency remains `4`, and the selected sources, mutators, reporters, score/critical gates, and smoke concurrency map remain unchanged. Exactly three independently approved allowlist entries are present. Production sources, member/borrowing specs, dependencies and lockfile, critical-rule manifest, baseline, workflows, frontend, and Tasks 6+ remain protected and unchanged.

## RED command and exit

Task 5's auth TDD RED is primarily report based: a critical `Survived` or
`NoCoverage` fingerprint in a structurally valid Stryker report is the failing
behavioral assertion. Focused Jest commands are GREEN checks unless an actual
Jest failure was recorded. No unrecorded Jest failure is inferred here.

- Historical clean baseline command, recorded exactly:
  `npx --no-install jest --runInBand src/auth/token-session.service.spec.ts src/auth/auth-identifier-repair.service.spec.ts src/auth/auth-identifier-reconciliation.service.spec.ts`;
  exit `0`, suites `3/3`, tests `127/127`, `6.142 s`.
- The smoke-budget runner regression is recorded as exit `1`, `0/1`, with
  `0 !== 5` while the runner scheduled `300000 ms`; after the one-constant
  implementation it was exit `0`, `1/1`. The historical ledger did not retain
  its literal `--test-name-pattern`, so none is invented.
- The complete-distributed topology/orchestration/merge regression is recorded
  as exit `1`, `0/13`; after implementation it was exit `0`, `13/13`. The
  historical ledger did not retain a more specific command than the focused
  runner test invocation, so none is invented.
- Fix Round 1 public-path guard, exact command:
  `node --test --test-name-pattern "keeps Task 5 mutation assertions on public service paths" test/quality/mutation-policy.test.mjs`;
  RED exit `1`, `0/1`. It listed direct private access in all three cited auth
  specs. The same command after replacement exited `0`, `1/1`.
- Fix Round 1 report-based RED: the first clean WSL smoke merge exited `1` on
  policy and retained unapproved fingerprint
  `646a86b2242963771f866c8e1eac7a192151eb099421e4a7e2912b51b3b14967`.
  No focused Jest RED is claimed for this mutation; its failing assertion is
  the preserved survivor disposition in the merged report.

## RED evidence

### Auditable RED-to-GREEN reconstruction

- Initial report-based RED:
  `reports/mutation/diagnostics/node22-nvm-ubuntu24-sequential-c4-valid-policy-red/mutation.json`,
  SHA-256
  `b07c6c6db1312e0e210e4b301e51e150a91fff26c2e4fce1a85988ed11ee10c6`;
  matching summary SHA-256
  `6d157f57c6c9451f8425cb9e8f9a04c27e7fc9d1761881cd1e60077ad6673751`.
  It contains exact `1366` identities and `322` unique auth critical mutants.
- Pre-Fix-Round-1 accepted GREEN report:
  `reports/mutation/diagnostics/task5-auth-final-wsl-350k-aggregate/mutation.json`,
  SHA-256
  `f1f5154f39199da5bd64b297e646449372055f2712a45b73824e982ced024ecb`;
  auth unapproved `0`, exact three approved equivalents.
- Fix Round 1 public-path smoke RED:
  `reports/mutation/diagnostics/task5-fix-round1-public-path-smoke-red-wsl/mutation.json`,
  SHA-256
  `ef6a5b69c22c1487e216be210c7d757c0b2552bb02dab50f3e6932cf1d47cbf9`;
  summary SHA-256
  `7f715addc9ffd22565a6922d937c043c0c5b794861eb766ea132e9ab16f8520a`.
  It is structurally complete at exact `1366`, raw
  `94.07027818448023`, and has exactly one unapproved auth finding:
  `646a86b2...b14967` (`ArrayDeclaration`, `[] -> ["Stryker was here"]`,
  line `719`, rule `repair-manifest-covers-exact-conflict-claimants`).
- Fix Round 1 final smoke GREEN:
  `reports/mutation/diagnostics/task5-fix-round1-final-smoke-wsl-350k/mutation.json`,
  SHA-256
  `cb3e454dc510268da17021f9044b6c26616e8dea748cf8c7ebc46aa531446266`;
  summary SHA-256
  `afbcf3bd2b3aa00d7c25b85f77fcdd51014b36bca12c9135cc071d57a1fd38e1`.
  It is exact `1366`, raw `94.14348462664715`, auth unapproved `0`, with only
  the exact three approved auth equivalents.

Selected canonical survivor-to-killed mappings are reproduced by applying the
tracked `mutantFingerprint` function and current manifest source SHA to the
preserved before/after reports; report-local mutant ids are not identities.

| Behavioral cluster                                      | Canonical fingerprint                                              | Before evidence                   | Final smoke disposition |
| ------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------- | ----------------------- |
| Token public `rotate` denies missing family             | `4fb5f831f9fc9ad857dabf2f21c2163ae4b9caf4072bca0c38bd5356ee1a15ce` | Initial accepted report: Survived | Killed                  |
| Token public `rotate` preserves denial block            | `f0bf4e31f52bffd31fd107762464346659a753454b2816fa9b5757bcd18ec496` | Initial accepted report: Survived | Killed                  |
| Repair public manifest claimant validation              | `646a86b2242963771f866c8e1eac7a192151eb099421e4a7e2912b51b3b14967` | Fix Round 1 smoke RED: Survived   | Killed                  |
| Reconciliation canonical-base64url decode               | `d091a1157065b74f4f283a857e7f198ddcf4a327a868a1c1bfe434f89fb67011` | Initial accepted report: Survived | Killed                  |
| Reconciliation canonical-base64url branch               | `142a9a4c2ffad7c50d5409881176bcdb7f027092b2e535c934a2862b4b05b22d` | Initial accepted report: Survived | Killed                  |
| Reconciliation noncanonical secret fallback             | `3a4d522d574e06ab378cc6b50e5070abdb4848591e74e3fc696d1bad9392e950` | Initial accepted report: Survived | Killed                  |
| Reconciliation base64url equality direction             | `05c5027479738dd7c3752a724bf623711c15a21247f99548371db695f626ca5d` | Initial accepted report: Survived | Killed                  |
| Reconciliation default lease through claim              | `1becc71a04c3d1d517dce5c4aaed80677619a6a67ad6a554faed70125bd9cfe3` | Initial accepted report: Survived | Killed                  |
| Reconciliation default retention through terminal write | `4ba5285d033a19887630adbf7502df270a089e9c7d2ef16ecc83c693bee6d283` | Initial accepted report: Survived | Killed                  |

Fingerprint `b4a9385a...bd51a` remains Survived by design and is not represented as
killed: independent review approved its exact Node 22 UTF-8 equivalence, and
the tracked schema-v1 allowlist records that decision.

### Accepted mutation artifact preflight

- Accepted report: `reports/mutation/diagnostics/node22-nvm-ubuntu24-sequential-c4-valid-policy-red/mutation.json`.
- Report SHA-256: `b07c6c6db1312e0e210e4b301e51e150a91fff26c2e4fce1a85988ed11ee10c6`.
- Summary SHA-256: `6d157f57c6c9451f8425cb9e8f9a04c27e7fc9d1761881cd1e60077ad6673751`.
- Lossless archive SHA-256: `cd44aee362c0e07e09f2aac091e3c1a1ec8445ef28c64b04fb70b724019b0d8f`; archive entries: `37`.
- Exact canonical identities: `1,366`; raw score: `70.79062957540263`; total critical finding-to-rule associations: `410`.
- Auth-only inventory: `333` finding-to-rule associations representing `322` unique mutants.
- Token session: `90` Survived + `3` NoCoverage associations (`86` + `3` unique mutants).
- Identifier repair: `94` Survived + `8` NoCoverage associations (`89` + `8` unique mutants).
- Identifier reconciliation: `135` Survived + `3` NoCoverage associations (`133` + `3` unique mutants).
- Focused clean baseline: `npx --no-install jest --runInBand src/auth/token-session.service.spec.ts src/auth/auth-identifier-repair.service.spec.ts src/auth/auth-identifier-reconciliation.service.spec.ts` exited `0`; suites `3/3`, tests `127/127`, time `6.142 s`.

### Exact accepted auth critical finding inventory

Coordinates are the report's one-based `startLine:startColumn-endLine:endColumn`. Every row is one accepted finding-to-rule association; repeated fingerprints are retained when one mutant overlaps multiple reviewed rules.

#### Token session

| +   | Mutant     | Status                                                           | Fingerprint           | Operator                                                                                                                                 | Replacement   | One-based location                              | Rule id |
| --- | ---------- | ---------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------- | ------- |
| 66  | NoCoverage | 1bf138bd17bde174792ffb29d3e587f2e97d2b0c6116bb4d5dba14cce752a5d9 | StringLiteral         | "\"\""                                                                                                                                   | 259:15-259:43 | token-expired-marker-reconciliation-revokes     |
| 130 | NoCoverage | f793e6bbfd8a007af621eb2d939fd118ab8e9a63998e1a4872bb6c23af36e01e | BlockStatement        | "{}"                                                                                                                                     | 425:23-433:6  | token-pending-marker-takeover-guard             |
| 131 | NoCoverage | 74096648120fbd3c7456753d67e0048c7430ad384d422c175838723737b01eee | StringLiteral         | "\"\""                                                                                                                                   | 430:9-430:37  | token-pending-marker-takeover-guard             |
| 5   | Survived   | fa564f5327f68b2ea7c6116c9ada300642db4822c477ad3c1a5720c0a13b1969 | ObjectLiteral         | "{}"                                                                                                                                     | 146:11-151:12 | token-rotation-input-and-interrupted-cas-denial |
| 5   | Survived   | fa564f5327f68b2ea7c6116c9ada300642db4822c477ad3c1a5720c0a13b1969 | ObjectLiteral         | "{}"                                                                                                                                     | 146:11-151:12 | token-active-unexpired-family-cas               |
| 6   | Survived   | c87816c5a3084d63c368039d4427880ee6613170273ef3571f67d7a3bb266890 | ObjectLiteral         | "{}"                                                                                                                                     | 150:24-150:36 | token-rotation-input-and-interrupted-cas-denial |
| 6   | Survived   | c87816c5a3084d63c368039d4427880ee6613170273ef3571f67d7a3bb266890 | ObjectLiteral         | "{}"                                                                                                                                     | 150:24-150:36 | token-active-unexpired-family-cas               |
| 9   | Survived   | 72d8aa0a0c1e4e87d4dd2b0b345b9a7551cc5c7ab03d7e0e075e7579018af241 | ObjectLiteral         | "{}"                                                                                                                                     | 159:11-159:38 | token-rotation-input-and-interrupted-cas-denial |
| 10  | Survived   | c56167992bfefb9af2b9ed72db1e24eb38ba50862c4287a8054af861623f1849 | StringLiteral         | "\"\""                                                                                                                                   | 159:29-159:36 | token-rotation-input-and-interrupted-cas-denial |
| 36  | Survived   | 043b10f0a85b05de94edfb015913111cb802b5d6f60f060eff671f3b1e178b4a | ObjectLiteral         | "{}"                                                                                                                                     | 223:16-223:29 | token-family-resolution                         |
| 38  | Survived   | 238043457a1cd8a28aa908ce412832a5b89b87ce28f9d897d2b248f0cbe80db7 | OptionalChaining      | "marker.familyId"                                                                                                                        | 228:12-228:28 | token-family-resolution                         |
| 40  | Survived   | 5082221834994299e1716457305cef3cd036d4a1fc014be251d740ad4b877a52 | MethodExpression      | "this.replayMarkerModel.find({<br> status: RefreshTokenReplayMarkerStatus.Pending,<br> leaseExpiresAt: {<br> $lte: now<br> }<br>})"      | 232:27-237:35 | token-expired-marker-reconciliation-revokes     |
| 41  | Survived   | a6bc8da7bce0d1220a6ab611cf004e46a41a755e45310c5c8afd290edcbb7194 | ObjectLiteral         | "{}"                                                                                                                                     | 233:13-236:8  | token-expired-marker-reconciliation-revokes     |
| 42  | Survived   | e05a04a467a3d220186a950ffc33b77f7e29660c706c566f6d0cd730a0f9aa5f | ObjectLiteral         | "{}"                                                                                                                                     | 235:25-235:38 | token-expired-marker-reconciliation-revokes     |
| 43  | Survived   | 75317a9b5b55663576e229102006bf590c2bb7f4c8246b7126000a484785c417 | ObjectLiteral         | "{}"                                                                                                                                     | 237:13-237:34 | token-expired-marker-reconciliation-revokes     |
| 52  | Survived   | 4536e27ffea25a45d2f5072098a6f4fab53b9a99e573cac5025c7f1ab93e4b9e | ConditionalExpression | "true"                                                                                                                                   | 249:11-249:61 | token-expired-marker-reconciliation-revokes     |
| 54  | Survived   | 423d185ef6d324b363c5510aa604876aee7dd5de131f60ff6bde492caecb2439 | OptionalChaining      | "family.status"                                                                                                                          | 249:11-249:25 | token-expired-marker-reconciliation-revokes     |
| 57  | Survived   | 796ba511eac6e19043e7bcc98db95000002edf5bff0a9a45f2d6bc4029216162 | ConditionalExpression | "true"                                                                                                                                   | 251:11-251:33 | token-expired-marker-reconciliation-revokes     |
| 58  | Survived   | 97fb4d27621f5dffb2d1321ea8b54f9a67edfcb26c5e9407799b51bb9950d647 | EqualityOperator      | "family.expiresAt >= now"                                                                                                                | 251:11-251:33 | token-expired-marker-reconciliation-revokes     |
| 61  | Survived   | 77eca440587ff68091074ebf8948cc116babf41a3618f26078fb7f49005fb448 | ConditionalExpression | "true"                                                                                                                                   | 257:11-257:73 | token-expired-marker-reconciliation-revokes     |
| 62  | Survived   | d91244087a57dfdf00e0cd478d9da98ff9c7596eb8d2f34c8265b12d7cdfee3c | ConditionalExpression | "false"                                                                                                                                  | 257:11-257:73 | token-expired-marker-reconciliation-revokes     |
| 63  | Survived   | 81a86c0abf519806c635d425d3a36598493f2fe2cac47ffe0e2e6d41051d7215 | EqualityOperator      | "family?.lastRotationOperationId !== marker.rotationOperationId"                                                                         | 257:11-257:73 | token-expired-marker-reconciliation-revokes     |
| 64  | Survived   | 40d94173f6f3a9efe13d80e739395b2d83879142989e55b0c90b413232bf46a8 | OptionalChaining      | "family.lastRotationOperationId"                                                                                                         | 257:11-257:42 | token-expired-marker-reconciliation-revokes     |
| 65  | Survived   | 0462a08f3da5fbd30bb603a9300d29619dd2965c967112d4926f6a1366e7ceab | StringLiteral         | "\"\""                                                                                                                                   | 258:15-258:42 | token-expired-marker-reconciliation-revokes     |
| 68  | Survived   | b102dddd8d0b38bf96cdf2832d0599d24cdd91b06da340e02b6b8755f5e62c88 | BlockStatement        | "{}"                                                                                                                                     | 267:15-269:8  | token-expired-marker-reconciliation-revokes     |
| 69  | Survived   | 4eaa34eb6521ca2ac74541367df4e94a000c6e95c4662697348c6c74eee91d3a | StringLiteral         | "\"\""                                                                                                                                   | 268:27-268:74 | token-expired-marker-reconciliation-revokes     |
| 89  | Survived   | 4fb5f831f9fc9ad857dabf2f21c2163ae4b9caf4072bca0c38bd5356ee1a15ce | ConditionalExpression | "false"                                                                                                                                  | 368:9-368:16  | token-prepare-marker-race-denial                |
| 89  | Survived   | 4fb5f831f9fc9ad857dabf2f21c2163ae4b9caf4072bca0c38bd5356ee1a15ce | ConditionalExpression | "false"                                                                                                                                  | 368:9-368:16  | token-rejects-missing-revoked-expired-family    |
| 90  | Survived   | f0bf4e31f52bffd31fd107762464346659a753454b2816fa9b5757bcd18ec496 | BlockStatement        | "{}"                                                                                                                                     | 368:18-370:6  | token-prepare-marker-race-denial                |
| 90  | Survived   | f0bf4e31f52bffd31fd107762464346659a753454b2816fa9b5757bcd18ec496 | BlockStatement        | "{}"                                                                                                                                     | 368:18-370:6  | token-rejects-missing-revoked-expired-family    |
| 93  | Survived   | 220f0f68fe30561787e62a5e75e1e341a4c082538f41bd6c40a6f162a3d10d64 | ArithmeticOperator    | "now.getTime() - rotationLeaseMs"                                                                                                        | 379:34-379:65 | token-prepare-marker-race-denial                |
| 95  | Survived   | f568228dfe6b23346201c7e756c5f087f1ad05209d56878e4989a4ba4dd0cd2c | ConditionalExpression | "true"                                                                                                                                   | 383:11-383:42 | token-prepare-marker-race-denial                |
| 96  | Survived   | 8659b1802dbedac2c4543f9d3fb6dc96e825e6692e26c6a9c41e9f03c387cd8f | ConditionalExpression | "false"                                                                                                                                  | 383:11-383:42 | token-prepare-marker-race-denial                |
| 97  | Survived   | d2dbbbe36baa90fabc84f180a393dc76b6ccdd1ca6aab4a53be399a017e5369e | BlockStatement        | "{}"                                                                                                                                     | 383:44-390:8  | token-prepare-marker-race-denial                |
| 98  | Survived   | e85f76f29a4fe66964d7a54ea919ac4a9d9f1387a86daf3df73d03a0e348ee30 | ObjectLiteral         | "{}"                                                                                                                                     | 385:20-385:33 | token-prepare-marker-race-denial                |
| 100 | Survived   | 1655e072bda03b12b329d5c68c85fd730ef193e22c5fa5b6c968a20d0a316801 | ConditionalExpression | "false"                                                                                                                                  | 387:13-387:24 | token-prepare-marker-race-denial                |
| 101 | Survived   | 2d511fddda376e4f1011b6d18202b02ef8dc77123f898c69db9ca5980dc601be | BlockStatement        | "{}"                                                                                                                                     | 387:26-389:10 | token-prepare-marker-race-denial                |
| 107 | Survived   | aa376c60df034fbc9defb1764b949dc22430e4fac4974536d7eeb2ea3902495d | ObjectLiteral         | "{}"                                                                                                                                     | 407:16-407:45 | token-committed-marker-replay-revokes           |
| 109 | Survived   | e6af25c58581481f7b8355a6d7795fbf851b234ec7ac03650fc33ecacec8e227 | ConditionalExpression | "false"                                                                                                                                  | 410:9-410:71  | token-committed-marker-replay-revokes           |
| 111 | Survived   | e6ffbfb8d3ad8e28fc89df15745e24f3b7a0cb5829d0c023e8d11a1893e9c506 | OptionalChaining      | "family.lastRotationOperationId"                                                                                                         | 410:9-410:40  | token-committed-marker-replay-revokes           |
| 112 | Survived   | 83f6910a694fa500c41980f0ad729f47388bb01c937dadbe9478ae022ebacc75 | BlockStatement        | "{}"                                                                                                                                     | 410:73-418:6  | token-committed-marker-replay-revokes           |
| 113 | Survived   | 1dbfc6736fd5b4568745fba9553cbc4dac8e7e9aea83c821305f56967627b028 | StringLiteral         | "\"\""                                                                                                                                   | 415:9-415:36  | token-committed-marker-replay-revokes           |
| 114 | Survived   | 1407d5427d40fc8aed7a0f438dbcf41df0e42bc8f58358ff2be4d5ac37e4724d | ConditionalExpression | "true"                                                                                                                                   | 421:7-423:29  | token-pending-marker-takeover-guard             |
| 116 | Survived   | a16b6938fef3ce8ababf48b21227e4bc91f6a888d7f67e5c43fe24ed7cc08f1b | LogicalOperator       | "family?.status === RefreshTokenFamilyStatus.Active && family.currentTokenHash === marker.tokenHash &#124;&#124; family.expiresAt > now" | 421:7-423:29  | token-pending-marker-takeover-guard             |
| 117 | Survived   | 44b8e29419907e958d1ed2d32ef2f51f6f4666b916fb1abe3f71e713db294d77 | ConditionalExpression | "true"                                                                                                                                   | 421:7-422:51  | token-pending-marker-takeover-guard             |
| 118 | Survived   | 00890ae858d444b29d7db21ff46d7637ab935a5490d1db366d0e4cdb3650bea5 | LogicalOperator       | "family?.status === RefreshTokenFamilyStatus.Active &#124;&#124; family.currentTokenHash === marker.tokenHash"                           | 421:7-422:51  | token-pending-marker-takeover-guard             |
| 119 | Survived   | dcfb252b0c8f35abcba4ecf2c9bff37c4b51aa8b4d06eff18846489cd299db95 | ConditionalExpression | "true"                                                                                                                                   | 421:7-421:57  | token-pending-marker-takeover-guard             |
| 121 | Survived   | d88ff94a5bb0af08edc5a6210b4cfaac03802cb8cbd5b9cb70ef0e0614629180 | OptionalChaining      | "family.status"                                                                                                                          | 421:7-421:21  | token-pending-marker-takeover-guard             |
| 122 | Survived   | 0dec8835e3a00ba50720e44cbb0d85be42e2754e36ea4b6d0258f8ccc0f4f893 | ConditionalExpression | "true"                                                                                                                                   | 422:7-422:51  | token-pending-marker-takeover-guard             |
| 124 | Survived   | c7c77ec7e90d2470ad7cbbce5566cad7be4ecb7375ac003333a9ada4de07914e | ConditionalExpression | "true"                                                                                                                                   | 423:7-423:29  | token-pending-marker-takeover-guard             |
| 125 | Survived   | 1b1e7b411f7571735d4d309fee93ad862f6e8f2c0f0c713d7c2acd63952281d4 | EqualityOperator      | "family.expiresAt >= now"                                                                                                                | 423:7-423:29  | token-pending-marker-takeover-guard             |
| 129 | Survived   | 8ec266b9e265d0902394e993d72c94ea136806e8513d336c81e9739b02f32054 | ConditionalExpression | "false"                                                                                                                                  | 425:9-425:21  | token-pending-marker-takeover-guard             |
| 136 | Survived   | e9ace13d0302144bec05c6e6d2324f57f17d2f42464b9425cd757427a488c91b | StringLiteral         | "\"\""                                                                                                                                   | 440:9-440:37  | token-pending-marker-takeover-guard             |
| 138 | Survived   | 9928e7d8ba8050b83a8de72266e19f0a81063a5988404f243b73f2e27414697e | ConditionalExpression | "false"                                                                                                                                  | 445:9-445:61  | token-pending-marker-takeover-guard             |
| 141 | Survived   | 3b9f7feba81972a46ce0d3494ebf999354b3ed5cabf114c99cca3f0da5945989 | EqualityOperator      | "marker.leaseExpiresAt >= now"                                                                                                           | 445:34-445:61 | token-pending-marker-takeover-guard             |
| 143 | Survived   | a2dd53250f0c2e632d7521d19c050489505c31f13f64d221a6364ee135f7afbb | BlockStatement        | "{}"                                                                                                                                     | 445:63-447:6  | token-pending-marker-takeover-guard             |
| 144 | Survived   | f848ed73de5ebe9a1c7af6aeb751e0970337441c6933f3a765ba750f6299182a | ObjectLiteral         | "{}"                                                                                                                                     | 452:9-457:10  | token-pending-marker-takeover-guard             |
| 145 | Survived   | 44ad82c1cafaa9242b6017087d8bbf7f09088a87ed01dc79e17dc41df2102222 | ObjectLiteral         | "{}"                                                                                                                                     | 456:27-456:40 | token-pending-marker-takeover-guard             |
| 148 | Survived   | 27c1e0430e39bb57e7f945c3ccab6dc4551f14840dcdf975bb2afd74ba121006 | ArithmeticOperator    | "now.getTime() - rotationLeaseMs"                                                                                                        | 461:38-461:69 | token-pending-marker-takeover-guard             |
| 149 | Survived   | c6c01bfb863c39f2651257c8b436e21d38af2f2c0a868059eb742a21ff7606c8 | ObjectLiteral         | "{}"                                                                                                                                     | 464:9-464:36  | token-pending-marker-takeover-guard             |
| 150 | Survived   | 1f37983c0c4ba43f7e73bcdcff24207d6c8597c66bff795f1b381c7eeec7b2e1 | StringLiteral         | "\"\""                                                                                                                                   | 464:27-464:34 | token-pending-marker-takeover-guard             |
| 158 | Survived   | 54f6e78b810de687c0ebc83f5b5b0afda31e8ce2ab26ff21601c6095228778a4 | ObjectLiteral         | "{}"                                                                                                                                     | 482:18-482:30 | token-interrupted-cas-finalization              |
| 159 | Survived   | 17e47fac939fea66d1b13ebf90c088a5beb41808ab97ee17feef49e79a976910 | ConditionalExpression | "true"                                                                                                                                   | 485:9-485:56  | token-interrupted-cas-finalization              |
| 160 | Survived   | 5c69198b055003b784ecffd2c234186889e732b73b879987660e0848f6aa92f2 | ConditionalExpression | "false"                                                                                                                                  | 485:9-485:56  | token-interrupted-cas-finalization              |
| 162 | Survived   | 842e10c64ebe3972775a0db8385d058ed001748ecbb55a32cbdb69f178786126 | OptionalChaining      | "family.lastRotationOperationId"                                                                                                         | 485:9-485:40  | token-interrupted-cas-finalization              |
| 161 | Survived   | 54b42d8a1cc837519af77a99b317a62cc7edf597a0679d8d3391f1ae74b4bb81 | EqualityOperator      | "family?.lastRotationOperationId !== operationId"                                                                                        | 485:9-485:56  | token-interrupted-cas-finalization              |
| 163 | Survived   | df197d5a6ac6f64a9d27ed4514589f5e403c52fc1fc1a3cb049b69036263458b | StringLiteral         | "\"\""                                                                                                                                   | 486:13-486:40 | token-interrupted-cas-finalization              |
| 164 | Survived   | 072354f796fc4a1d7dba5fff61469d56a073dd11e3939ea26225bb4ac110c0d7 | StringLiteral         | "\"\""                                                                                                                                   | 487:13-487:41 | token-interrupted-cas-finalization              |
| 170 | Survived   | fff27a60b37239b916f9952c28f9a31f346504d717135193cd784d6c6279c6ce | ConditionalExpression | "true"                                                                                                                                   | 490:9-490:59  | token-interrupted-cas-finalization              |
| 172 | Survived   | ddffbf11b49525cedb027819042ab9b0764d5c7eb6ace788c39f4cd50b72bb9b | OptionalChaining      | "family.status"                                                                                                                          | 490:9-490:23  | token-interrupted-cas-finalization              |
| 175 | Survived   | 40e0cfa079539ad27bb9cf408cb0896b35b270d902b8dbf7dd2614002ff16482 | ConditionalExpression | "true"                                                                                                                                   | 492:9-492:38  | token-interrupted-cas-finalization              |
| 176 | Survived   | b77c0731209ef06d80dd331221da81bdb63cbfb2178193033cef5e82b28e8442 | EqualityOperator      | "family.expiresAt >= new Date()"                                                                                                         | 492:9-492:38  | token-interrupted-cas-finalization              |
| 180 | Survived   | 0108d029ef22842e4c8a00d900136b2dbc483f0013d796483b852f024a550cc5 | ArrowFunction         | "() => undefined"                                                                                                                        | 509:59-509:69 | token-interrupted-cas-finalization              |
| 182 | Survived   | b73d11fd0618bc41b7ed4a127a01dbda32b1dcf5d7a356ebe474cac13914d739 | ObjectLiteral         | "{}"                                                                                                                                     | 519:9-523:10  | token-marker-commit-cas                         |
| 186 | Survived   | 5a025d4503c1c1c39ac931d20bbbabca84b39cf8c39f4d5d3d445ed0d7ab8083 | ObjectLiteral         | "{}"                                                                                                                                     | 531:9-531:36  | token-marker-commit-cas                         |
| 187 | Survived   | 73bfa5ecd93eae6f7e20d864c61896a3a6d0ed2a4fba1e597b7ee88722aa903c | StringLiteral         | "\"\""                                                                                                                                   | 531:27-531:34 | token-marker-commit-cas                         |
| 189 | Survived   | f09940d728ca4160400f77b058b6bec2d7a8657001d02bdfab508491170bf908 | ObjectLiteral         | "{}"                                                                                                                                     | 538:7-538:60  | token-replay-revocation-clears-current-hash     |
| 195 | Survived   | 678d937294d54034d6a7bbdd5d4061fd47a6566f89cf7c559627e09d2b2a0937 | BlockStatement        | "{}"                                                                                                                                     | 577:56-584:4  | token-duplicate-key-classification              |
| 196 | Survived   | 3eaceb58c9f0faa66909456a00a6a94ffa09ed72072608274c9fd232e81f2e48 | ConditionalExpression | "true"                                                                                                                                   | 579:7-582:50  | token-duplicate-key-classification              |
| 197 | Survived   | ed76f166a7dd8d08478f9af8c0f25e9f79abb6b7a354efb9211ced5550abf114 | ConditionalExpression | "false"                                                                                                                                  | 579:7-582:50  | token-duplicate-key-classification              |
| 198 | Survived   | fd2326ea16863da53570b369e2b6dcddfe4d9f7567fce100e73973ea6486f857 | LogicalOperator       | "typeof error === 'object' && error !== null && 'code' in error &#124;&#124; (error as {<br> code?: number;<br>}).code === 11000"        | 579:7-582:50  | token-duplicate-key-classification              |
| 199 | Survived   | e3c9f9269351d8d72c634b09713c55d5dee7f062928be6d779e94e4be30859f5 | ConditionalExpression | "true"                                                                                                                                   | 579:7-581:22  | token-duplicate-key-classification              |
| 200 | Survived   | d37a7bdeaa050a9b37e72208d044f1826f837c0d33285bfed9ec1e99bd0195bd | LogicalOperator       | "typeof error === 'object' && error !== null &#124;&#124; 'code' in error"                                                               | 579:7-581:22  | token-duplicate-key-classification              |
| 201 | Survived   | 2045a1417c21fc8b895705dc0d5c27083db15087c19e226f0bb4cfcccbf86141 | ConditionalExpression | "true"                                                                                                                                   | 579:7-580:21  | token-duplicate-key-classification              |
| 202 | Survived   | b02b4815d3fb5a44e5378155737a70df89924714fb028dc7544b42fcf264a7d7 | LogicalOperator       | "typeof error === 'object' &#124;&#124; error !== null"                                                                                  | 579:7-580:21  | token-duplicate-key-classification              |
| 203 | Survived   | 9fd9859c2bcea77b0c5a1ce2fa9b25bfb3f93086432af67c3e05a8d2739517ac | ConditionalExpression | "true"                                                                                                                                   | 579:7-579:32  | token-duplicate-key-classification              |
| 205 | Survived   | 38a701ff0e72dabfff98f93e5a3e1f120ddd23f29880cf659e4f366b49776f77 | StringLiteral         | "\"\""                                                                                                                                   | 579:24-579:32 | token-duplicate-key-classification              |
| 204 | Survived   | a6cd709c53f51614f8e6b653ffe2ec13da42f4b7e80eadc53df1c2e27e4a97eb | EqualityOperator      | "typeof error !== 'object'"                                                                                                              | 579:7-579:32  | token-duplicate-key-classification              |
| 206 | Survived   | 75ead682ea97fbcc917fc4dc5cc29331919481c9dfc52b9c8c8c21ac5ab5c3a6 | ConditionalExpression | "true"                                                                                                                                   | 580:7-580:21  | token-duplicate-key-classification              |
| 207 | Survived   | 94f8e13ad7388bf7c34fb5426674987aa4b85b3799dd9faf233e5def890a456f | EqualityOperator      | "error === null"                                                                                                                         | 580:7-580:21  | token-duplicate-key-classification              |
| 208 | Survived   | c331a386d9ffe9cc57751eca6006342528c063a893754cd26359e8d276eed353 | StringLiteral         | "\"\""                                                                                                                                   | 581:7-581:13  | token-duplicate-key-classification              |
| 209 | Survived   | cf8eb7f76f1fb677cba7936c1dee7294aa1d9174ff359bb0bb27b80698aaf745 | ConditionalExpression | "true"                                                                                                                                   | 582:7-582:50  | token-duplicate-key-classification              |
| 210 | Survived   | 6238f670b03d8f98da9cd84dc9e433b47db346d2df9855cef31c1738c347717e | EqualityOperator      | "(error as {<br> code?: number;<br>}).code !== 11000"                                                                                    | 582:7-582:50  | token-duplicate-key-classification              |

#### Identifier repair

| +   | Mutant     | Status                                                           | Fingerprint           | Operator                                                                                                                                        | Replacement   | One-based location                              | Rule id |
| --- | ---------- | ---------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------- | ------- |
| 19  | NoCoverage | 5870d52625012a663a8b6f2e91c1a858662850d5233bc99893d236824f39f41e | ObjectLiteral         | "{}"                                                                                                                                            | 116:38-129:6  | repair-dry-run-authorizes-and-binds-claimants   |
| 20  | NoCoverage | abdc960ad4d44ca035f64cf1b544912f8888a3fb585b9995fd7ed8c8ec4afdc3 | ArrayDeclaration      | "[\"Stryker was here\"]"                                                                                                                        | 120:20-120:22 | repair-dry-run-authorizes-and-binds-claimants   |
| 21  | NoCoverage | 54059789903d551258d38b48ffef07a34e64efe5bd94a9a898cc0dc14d705e4e | ObjectLiteral         | "{}"                                                                                                                                            | 124:20-127:8  | repair-dry-run-authorizes-and-binds-claimants   |
| 22  | NoCoverage | b2ce483a181e2a63346926160c9c614f65a577d138ca842b3306685e42ae39ae | BooleanLiteral        | "true"                                                                                                                                          | 131:64-131:69 | repair-dry-run-authorizes-and-binds-claimants   |
| 300 | NoCoverage | f42e1eb8bfae761b343fc0deeab602a86a1b8087c5f111f435d463e814b70541 | StringLiteral         | "\"\""                                                                                                                                          | 697:11-697:18 | repair-restores-exact-aggregate-owner           |
| 317 | NoCoverage | 646a86b2242963771f866c8e1eac7a192151eb099421e4a7e2912b51b3b14967 | ArrayDeclaration      | "[\"Stryker was here\"]"                                                                                                                        | 719:40-719:42 | repair-manifest-covers-exact-conflict-claimants |
| 342 | NoCoverage | 2c2223200ede9243f13bf564f8082cdfb660f98e0b42b9a25668253262271861 | BlockStatement        | "{}"                                                                                                                                            | 746:7-748:6   | repair-persisted-manifest-authorization         |
| 343 | NoCoverage | a90ac89fd4688347a74a7f37d33ed30082239d35664f6c15e647d308cf401b2a | StringLiteral         | "\"\""                                                                                                                                          | 747:35-747:64 | repair-persisted-manifest-authorization         |
| 1   | Survived   | 4ec25d88ac07e4d4e8149774b0f08203b19642862dd6f779afd7f3868adf161c | ObjectLiteral         | "{}"                                                                                                                                            | 102:16-102:50 | repair-dry-run-authorizes-and-binds-claimants   |
| 2   | Survived   | b4ae4b457047ad22027230c7473710792028d88c560a4235a206c167fe5842e3 | ConditionalExpression | "true"                                                                                                                                          | 105:9-105:17  | repair-dry-run-authorizes-and-binds-claimants   |
| 34  | Survived   | 416119478f31a3abb5f2964cf71ecbf4f5cf34041ac1634015a3a00596763506 | ConditionalExpression | "true"                                                                                                                                          | 150:7-151:73  | repair-apply-authorizes-and-binds-manifest      |
| 35  | Survived   | 3e4083f5cbb24c86a0c7d63745bb6a9d15bb98cf954e34ee8e4bb7950de6391f | ConditionalExpression | "false"                                                                                                                                         | 150:7-151:73  | repair-apply-authorizes-and-binds-manifest      |
| 36  | Survived   | a4cb443b1463aa267c0eb2287af1502f44b009d047bc9d31b908c3200d808763 | LogicalOperator       | "operation.status === AuthIdentifierOperationStatus.Pending && operation.status === AuthIdentifierOperationStatus.FailedRetryable"              | 150:7-151:73  | repair-apply-authorizes-and-binds-manifest      |
| 37  | Survived   | e32f71031b8eb99795cd4efcbeaaf628223be54a1d293e86cbb2d5215e8c7371 | ConditionalExpression | "false"                                                                                                                                         | 150:7-150:65  | repair-apply-authorizes-and-binds-manifest      |
| 38  | Survived   | c449ca5cc57082847c92583838abf6f2a33050375d5f193e1707231f57e40dcf | EqualityOperator      | "operation.status !== AuthIdentifierOperationStatus.Pending"                                                                                    | 150:7-150:65  | repair-apply-authorizes-and-binds-manifest      |
| 39  | Survived   | ee197b3f7ddff1b57104901fb4aea8d929c076883ca568367a1efe862333a3a2 | ConditionalExpression | "false"                                                                                                                                         | 151:7-151:73  | repair-apply-authorizes-and-binds-manifest      |
| 40  | Survived   | 437419d464f1b89531f278b70816c1a2f272d979b318c2fc05eef646b5195e14 | EqualityOperator      | "operation.status !== AuthIdentifierOperationStatus.FailedRetryable"                                                                            | 151:7-151:73  | repair-apply-authorizes-and-binds-manifest      |
| 41  | Survived   | 82f093b906a1f024703caf6af384ef7a5a2c3c525cc6d6d1c776030b04034ce0 | BlockStatement        | "{}"                                                                                                                                            | 152:7-166:6   | repair-apply-authorizes-and-binds-manifest      |
| 42  | Survived   | 5f90ec1130dc873325ef6409e0a39332b941f6c09f6b6b44ffc7f070c736ae1b | ObjectLiteral         | "{}"                                                                                                                                            | 154:9-154:69  | repair-apply-authorizes-and-binds-manifest      |
| 43  | Survived   | 559b2556be266b936622c709b91eef12d9ce358e1d0681320abe2ce9d282e9f0 | ObjectLiteral         | "{}"                                                                                                                                            | 155:9-164:10  | repair-apply-authorizes-and-binds-manifest      |
| 44  | Survived   | b23791b00c28bd6ddcc1fc57e8d77869b14a53ddab2e635cd405fe2903547b86 | ObjectLiteral         | "{}"                                                                                                                                            | 156:17-163:12 | repair-apply-authorizes-and-binds-manifest      |
| 45  | Survived   | d0cceef64dc41e1dfa051e307d953a11e11ed62d7730bfb280059c66688f93d1 | ObjectLiteral         | "{}"                                                                                                                                            | 158:28-161:14 | repair-apply-authorizes-and-binds-manifest      |
| 64  | Survived   | 325661ce6066d71eea8c9b03aeeafad4a4bf66496448338e55893992003c25fd | BooleanLiteral        | "true"                                                                                                                                          | 199:66-199:71 | repair-reauthorizes-every-apply-boundary        |
| 70  | Survived   | 4b82c4cae73fc5b616c081872a43e59eca7010b43f49e5fa66e81831b905c795 | ObjectLiteral         | "{}"                                                                                                                                            | 211:7-220:8   | repair-cancel-authorizes-before-parent-failure  |
| 71  | Survived   | 4c2eb04d712b4b4e7a4c0924622e67616c2b474f75e332503049ba8edce10254 | ObjectLiteral         | "{}"                                                                                                                                            | 213:17-219:10 | repair-cancel-authorizes-before-parent-failure  |
| 72  | Survived   | cd02ecbcf9586cfc8db9753cfe680c0ae9024dba098498c8027796f742a7cdfb | ArrayDeclaration      | "[]"                                                                                                                                            | 214:16-218:12 | repair-cancel-authorizes-before-parent-failure  |
| 73  | Survived   | 9b4acc94a3551d264a862b31ad1ad01ab6de0c64549ebffa4d8652bb1090fb96 | ObjectLiteral         | "{}"                                                                                                                                            | 221:7-221:71  | repair-cancel-authorizes-before-parent-failure  |
| 74  | Survived   | a0c01742f0144064e0b33e3ef1370eb39c2eb8e230757da1668ffc892ef520d8 | ObjectLiteral         | "{}"                                                                                                                                            | 221:15-221:69 | repair-cancel-authorizes-before-parent-failure  |
| 76  | Survived   | 3dd753f1a5c39f292c4f3afe706ab3c15a5462f78631dc1bd2fcba6c04b22767 | ObjectLiteral         | "{}"                                                                                                                                            | 224:13-224:53 | repair-cancel-authorizes-before-parent-failure  |
| 77  | Survived   | 58a4e0241cc6317bf501e7359ade09bc7f164c01bcd32968e8a6eda7ca1703c0 | ObjectLiteral         | "{}"                                                                                                                                            | 225:13-225:32 | repair-cancel-authorizes-before-parent-failure  |
| 78  | Survived   | 43a6ea6f6956e42651da9c8b2f04f567b01bf8670164f8d061e6404c782a5066 | UnaryOperator         | "+1"                                                                                                                                            | 225:28-225:30 | repair-cancel-authorizes-before-parent-failure  |
| 84  | Survived   | 4679d567e6c590053d90e385daa2b7192fe652c73fa843b0f346fe94bf070f1e | ObjectLiteral         | "{}"                                                                                                                                            | 244:9-247:10  | repair-cancel-authorizes-before-parent-failure  |
| 85  | Survived   | 672272e3ee5bfbde1ad218e691117ed52991d06a8405aec2db8ed7f7e131b31c | ObjectLiteral         | "{}"                                                                                                                                            | 248:9-248:71  | repair-cancel-authorizes-before-parent-failure  |
| 86  | Survived   | 3f997c8f6c782f1e1213f202a5d8cd03beca0af47977adb51bb8ec6bcce89539 | ObjectLiteral         | "{}"                                                                                                                                            | 248:17-248:69 | repair-cancel-authorizes-before-parent-failure  |
| 91  | Survived   | 8ad8f9d12868a5af1275a4f8d64f8deb95559bce10b2999bab4a4f8762f19ebe | BooleanLiteral        | "true"                                                                                                                                          | 262:66-262:71 | repair-cancel-authorizes-before-parent-failure  |
| 92  | Survived   | 81fd75b4999e68f8bca2047541f4ca03640370f251ac39f921802bc9c18dc29f | ObjectLiteral         | "{}"                                                                                                                                            | 272:58-275:6  | repair-batch-identity-and-checkpoint            |
| 100 | Survived   | 84755aeaa2cb2ff824de005f8ab41f233de37dc8e0b046816904146a5c6fc5ac | ObjectLiteral         | "{}"                                                                                                                                            | 285:18-296:8  | repair-batch-identity-and-checkpoint            |
| 101 | Survived   | f4c85427e13173ef5a732251342b3a7560cdef21900c3dd2618ff44aa3344de8 | StringLiteral         | "``"                                                                                                                                            | 286:23-286:87 | repair-batch-identity-and-checkpoint            |
| 103 | Survived   | c010a2ec5f4bb9177df61f0bc8326b2d04d2463a59bf5dd2337b840dedc2f36e | StringLiteral         | "\"\""                                                                                                                                          | 292:39-292:45 | repair-batch-identity-and-checkpoint            |
| 104 | Survived   | 778dedb2f69b3cda78b2629e2a72233c0baa86bbeeb331a3845174167c4d0450 | StringLiteral         | "\"\""                                                                                                                                          | 293:19-293:30 | repair-batch-identity-and-checkpoint            |
| 106 | Survived   | f8737ea9c64c6461c7d4a3356dd7b67cf92164568ea7a02fbcac51c6a81bc420 | StringLiteral         | "``"                                                                                                                                            | 300:9-302:23  | repair-batch-identity-and-checkpoint            |
| 106 | Survived   | f8737ea9c64c6461c7d4a3356dd7b67cf92164568ea7a02fbcac51c6a81bc420 | StringLiteral         | "``"                                                                                                                                            | 300:9-302:23  | repair-batch-transactional-ownership            |
| 107 | Survived   | 11a919cab5bb45e5240a32b8ab20ceb5dd1c76cdcf26068b086a8d22ce2e6032 | ArrowFunction         | "() => undefined"                                                                                                                               | 301:16-301:43 | repair-batch-identity-and-checkpoint            |
| 107 | Survived   | 11a919cab5bb45e5240a32b8ab20ceb5dd1c76cdcf26068b086a8d22ce2e6032 | ArrowFunction         | "() => undefined"                                                                                                                               | 301:16-301:43 | repair-batch-transactional-ownership            |
| 108 | Survived   | b078bcab81e494bc124a1274431d722f98109ecf11f2aafeab0ec850a966bac1 | StringLiteral         | "\"\""                                                                                                                                          | 302:17-302:20 | repair-batch-identity-and-checkpoint            |
| 108 | Survived   | b078bcab81e494bc124a1274431d722f98109ecf11f2aafeab0ec850a966bac1 | StringLiteral         | "\"\""                                                                                                                                          | 302:17-302:20 | repair-batch-transactional-ownership            |
| 109 | Survived   | 30b0412a050de64ea071474a372a84a6e51b4a44d8042dcde11bb622c581a7ea | StringLiteral         | "\"\""                                                                                                                                          | 304:15-304:26 | repair-batch-identity-and-checkpoint            |
| 109 | Survived   | 30b0412a050de64ea071474a372a84a6e51b4a44d8042dcde11bb622c581a7ea | StringLiteral         | "\"\""                                                                                                                                          | 304:15-304:26 | repair-batch-transactional-ownership            |
| 119 | Survived   | 2dd92a8385741d65c9394dac50c7c5449548c1d12b0a1b660d23add413acc698 | ConditionalExpression | "true"                                                                                                                                          | 325:20-325:59 | repair-batch-identity-and-checkpoint            |
| 119 | Survived   | 2dd92a8385741d65c9394dac50c7c5449548c1d12b0a1b660d23add413acc698 | ConditionalExpression | "true"                                                                                                                                          | 325:20-325:59 | repair-batch-transactional-ownership            |
| 129 | Survived   | 136ae4c301aae2dafea9a74e39753d2e78ba69b0e9a80639a97f3fbcc9768f0f | ObjectLiteral         | "{}"                                                                                                                                            | 338:13-342:14 | repair-batch-transactional-ownership            |
| 131 | Survived   | f70da7d4f9fc98a948f71814d8a89e3c37907aa9b107ae18e3f935152ce65499 | ObjectLiteral         | "{}"                                                                                                                                            | 344:21-348:16 | repair-batch-transactional-ownership            |
| 130 | Survived   | 92fde739b0c55cda3bd30634677f8a377b2bf3c9815147acf947a28eb12ba869 | ObjectLiteral         | "{}"                                                                                                                                            | 343:13-349:14 | repair-batch-transactional-ownership            |
| 132 | Survived   | 1b568e6c2cc2339b8040c151a95973e01ade85987f8f7ce7b09df555ab7c7b8b | ObjectLiteral         | "{}"                                                                                                                                            | 350:13-350:24 | repair-batch-transactional-ownership            |
| 139 | Survived   | 8f73d496ffcbe0767b60631e3714f6996d89d048a767240e689d044d4490e680 | ObjectLiteral         | "{}"                                                                                                                                            | 370:55-373:6  | repair-batch-activation-gate-ownership          |
| 152 | Survived   | 5a92a9e1760716308adc365454070d8db783f89bea6a2b31a10d01a888538a34 | MethodExpression      | "batch.assignments.map(item => item.targetReservationId)"                                                                                       | 380:23-382:23 | repair-batch-activation-gate-ownership          |
| 153 | Survived   | 69233cec68766a37fea8978d36ef7fc711a99bdfa3b6250af734a072c2ad16c9 | ArrowFunction         | "() => undefined"                                                                                                                               | 381:12-381:46 | repair-batch-activation-gate-ownership          |
| 157 | Survived   | 59591d3913d7acdf3f6f759d3dfa137568bde999d63be6e88c93c90341bf4c9f | ObjectLiteral         | "{}"                                                                                                                                            | 388:18-388:36 | repair-batch-activation-gate-ownership          |
| 160 | Survived   | 9f52b8a28af41ba37cc39039582a4bcb73d3408960ab2eeb6776d343640972c0 | ObjectLiteral         | "{}"                                                                                                                                            | 397:21-397:66 | repair-batch-activation-gate-ownership          |
| 161 | Survived   | 48c39c01d2f25a25b2e2e6c0eed27fbda2c1eac3673ec92b0e20e62bd3184c73 | StringLiteral         | "\"Stryker was here!\""                                                                                                                         | 397:43-397:45 | repair-batch-activation-gate-ownership          |
| 162 | Survived   | 790adba06cd3a27b76ad314a03a1134ef9190f91a73a3a4a82aa33dabae7591d | StringLiteral         | "\"Stryker was here!\""                                                                                                                         | 397:62-397:64 | repair-batch-activation-gate-ownership          |
| 169 | Survived   | 63c6dd373c1fafa9a4af571ab1fdda8103aa152625a24b5194c2364208ecf6e3 | ObjectLiteral         | "{}"                                                                                                                                            | 426:13-440:14 | repair-parent-conflict-ownership-finalization   |
| 170 | Survived   | 25830b02a48bc10626bd68b6f9267c9ccab6a415d3def5136c5e532464745f39 | ObjectLiteral         | "{}"                                                                                                                                            | 427:21-432:16 | repair-parent-conflict-ownership-finalization   |
| 171 | Survived   | c3bc9ac19495a031cbdbf51b14c2998edfe35fffc075f4fbf3724677ebc71ff2 | ObjectLiteral         | "{}"                                                                                                                                            | 433:23-439:16 | repair-parent-conflict-ownership-finalization   |
| 172 | Survived   | 060636194b9ae75fcde0f91cdc78b1691ef46b8b36232b1f9fb0f0c8b52acc8b | StringLiteral         | "\"Stryker was here!\""                                                                                                                         | 434:38-434:40 | repair-parent-conflict-ownership-finalization   |
| 173 | Survived   | d8dc9809796ef2e30e0f7dbebd9cf020a22aa655598db9883c56581ce1a18c46 | StringLiteral         | "\"Stryker was here!\""                                                                                                                         | 435:43-435:45 | repair-parent-conflict-ownership-finalization   |
| 174 | Survived   | 6c35d42b7b97f269df8bcea307f23864082995305872db7afd48eea2654a4b30 | StringLiteral         | "\"Stryker was here!\""                                                                                                                         | 436:37-436:39 | repair-parent-conflict-ownership-finalization   |
| 175 | Survived   | 9588b1d42df1a20070553f4e3711e0b6362afa859946bf9badbb52c781fc9ca5 | StringLiteral         | "\"Stryker was here!\""                                                                                                                         | 437:32-437:34 | repair-parent-conflict-ownership-finalization   |
| 176 | Survived   | 093532bdab9e781cf9c78361a4a55daf1f72f4cd12009403b8ec9e0fa47525c7 | StringLiteral         | "\"Stryker was here!\""                                                                                                                         | 438:29-438:31 | repair-parent-conflict-ownership-finalization   |
| 193 | Survived   | 3edf97e5c63abdabb031a50e73d0d5cdfe22f602b09e11965a4f3096f8ed4a1d | ObjectLiteral         | "{}"                                                                                                                                            | 484:23-488:16 | repair-completed-event-precedes-terminal-state  |
| 194 | Survived   | 287f38d2de03c5ddb4ce0b5d478d227d2e1f70074a1b712a63b6de5e43a92a41 | StringLiteral         | "\"\""                                                                                                                                          | 486:33-486:70 | repair-completed-event-precedes-terminal-state  |
| 206 | Survived   | 32c04803dd57c5cab220dbfbd408f303647e3b1b23f522ae1b2b09a72a0aafbd | MethodExpression      | "[...batch.assignments]"                                                                                                                        | 519:34-519:66 | repair-reverse-compensation-ownership           |
| 219 | Survived   | 754d13114ea796c35d12a89d756c37a120e469bd1130a623d7a857fad6dd28ef | ObjectLiteral         | "{}"                                                                                                                                            | 538:25-542:18 | repair-reverse-compensation-ownership           |
| 220 | Survived   | 95d3e05b76d38a52cea25ec9bef71e3fd9457119156aafba2b7a9c4413695bb7 | StringLiteral         | "\"Stryker was here!\""                                                                                                                         | 539:46-539:48 | repair-reverse-compensation-ownership           |
| 221 | Survived   | 56677bc524d60fe5af2e984904f8ea14579559de1d3d26369bf16ee2471030e6 | StringLiteral         | "\"Stryker was here!\""                                                                                                                         | 540:39-540:41 | repair-reverse-compensation-ownership           |
| 222 | Survived   | 8ad798272b5c7d6d194b8a008297e92894881b327635b0138219977380cc86cf | StringLiteral         | "\"Stryker was here!\""                                                                                                                         | 541:34-541:36 | repair-reverse-compensation-ownership           |
| 239 | Survived   | 3ebe9c0539f3519aa4fca229b2a71fd994e941bdbf8d85c0710d8e99505e7b3d | ObjectLiteral         | "{}"                                                                                                                                            | 591:23-595:16 | repair-failed-event-precedes-terminal-state     |
| 240 | Survived   | ddfd8792f614967e35031fcd40575f3db07ca06a09cd398be5c4ac39eb4eca1e | StringLiteral         | "\"\""                                                                                                                                          | 593:33-593:70 | repair-failed-event-precedes-terminal-state     |
| 246 | Survived   | 0aee8901c0b5d73a2cfd8219c9a59927e20398690b07309a5510089d291df784 | ArrayDeclaration      | "[]"                                                                                                                                            | 619:16-622:12 | repair-replacement-reservation-ownership        |
| 247 | Survived   | 5756ed45dbeb0adaaf726f9e8cbd575381eb17d615dafd8414dba5f2af70bd7d | ObjectLiteral         | "{}"                                                                                                                                            | 620:13-620:58 | repair-replacement-reservation-ownership        |
| 248 | Survived   | dffcad383aba8f34fd502e23a74208b1b053fe372975a211d9049733202bd4b3 | ObjectLiteral         | "{}"                                                                                                                                            | 621:13-621:54 | repair-replacement-reservation-ownership        |
| 251 | Survived   | 3729878d2edb0763d1a9b6c5dc2c86b8034fb079ce9574d4717a330631c1cfe6 | ConditionalExpression | "true"                                                                                                                                          | 628:15-628:67 | repair-replacement-reservation-ownership        |
| 252 | Survived   | b60889e044e3fcb82e989e449f16b276c6f1078acfcbe3f319372401e97d893c | ConditionalExpression | "false"                                                                                                                                         | 628:15-628:67 | repair-replacement-reservation-ownership        |
| 253 | Survived   | 76e4d90600102004705dc5d559280b9b68fb20f7fb691edbc5910fe4114d39eb | EqualityOperator      | "item.subjectType !== AuthIdentifierSubjectType.Staff"                                                                                          | 628:15-628:67 | repair-replacement-reservation-ownership        |
| 254 | Survived   | d2a67580cd89f17c2bde50669cc772dea2927693851d46cf18721c986f6536a5 | ObjectLiteral         | "{}"                                                                                                                                            | 638:25-638:71 | repair-replacement-reservation-ownership        |
| 257 | Survived   | 61341e6666b887725dc4ccf66ad5f4f9747e84057209e1946f1c448a76a40b76 | StringLiteral         | "\"\""                                                                                                                                          | 640:41-640:48 | repair-replacement-reservation-ownership        |
| 265 | Survived   | 925714644a9d947ae07b5d4797830cc243e94fb80016041fc330e9e75e373567 | LogicalOperator       | "typeof error === 'object' && error !== null && 'code' in error &#124;&#124; (error as {<br> code?: number;<br>}).code === 11000"               | 646:9-649:52  | repair-replacement-reservation-ownership        |
| 266 | Survived   | 28044f38fe83140fe1a7f5b2d6285441a122f6b8a278215d79d0ed4709f0790d | ConditionalExpression | "true"                                                                                                                                          | 646:9-648:24  | repair-replacement-reservation-ownership        |
| 267 | Survived   | ebdc98782d15dd339d588f4ba4554b62caa52dbd6861e62edcd49f31e610b20c | LogicalOperator       | "typeof error === 'object' && error !== null &#124;&#124; 'code' in error"                                                                      | 646:9-648:24  | repair-replacement-reservation-ownership        |
| 268 | Survived   | e02d17950502d5e08bd039a9c37fe755ca0598700eb36a7d1cd9e477ebfc4bba | ConditionalExpression | "true"                                                                                                                                          | 646:9-647:23  | repair-replacement-reservation-ownership        |
| 269 | Survived   | 406523a77c0f7732a3e0f0c0383a1433c8dd6265f19d5e3eda0b51f9acaae212 | LogicalOperator       | "typeof error === 'object' &#124;&#124; error !== null"                                                                                         | 646:9-647:23  | repair-replacement-reservation-ownership        |
| 270 | Survived   | 3c3f1ac099731700ec5f1142da95acd7f4ff49195d8ee4db916c518839d89405 | ConditionalExpression | "true"                                                                                                                                          | 646:9-646:34  | repair-replacement-reservation-ownership        |
| 273 | Survived   | 80f300e5c5a2a51b8c55b73fad6493e89318097e0c41327d18845e8389525eb2 | ConditionalExpression | "true"                                                                                                                                          | 647:9-647:23  | repair-replacement-reservation-ownership        |
| 276 | Survived   | 91caf9d94988a0c7f91a697fc46ec6fbfdce9349a22e7f19904ecfab67cc6a9a | ConditionalExpression | "true"                                                                                                                                          | 649:9-649:52  | repair-replacement-reservation-ownership        |
| 298 | Survived   | 304b226932df64abdab1550918c50d8ccd803d29ebc8aaa17dd422be43db4b9b | ConditionalExpression | "false"                                                                                                                                         | 696:7-696:54  | repair-restores-exact-aggregate-owner           |
| 334 | Survived   | fd69fed22f5a2fdb3d15a92b03cfee9ba92bc9588b8bef999dcf0f5edde2f9da | ConditionalExpression | "false"                                                                                                                                         | 743:7-745:36  | repair-persisted-manifest-authorization         |
| 335 | Survived   | 3c4cca54e8c606ad4dfba044dc68195a13d81fb0c01fc9d8d9ddb9722dd33a7b | LogicalOperator       | "(operation.operationType !== AuthIdentifierOperationType.OfflineRepair &#124;&#124; !operation.manifestHash) && !operation.manifestKeyVersion" | 743:7-745:36  | repair-persisted-manifest-authorization         |
| 336 | Survived   | d728d5484ed56c8e6481c3fb030633f3ccc51ddd7725d67106b31b8786745132 | ConditionalExpression | "false"                                                                                                                                         | 743:7-744:30  | repair-persisted-manifest-authorization         |
| 337 | Survived   | 36fee0ed58ae81135ecd2bd0e06813a84d59dd82559230f6845af84e8055cd4d | LogicalOperator       | "operation.operationType !== AuthIdentifierOperationType.OfflineRepair && !operation.manifestHash"                                              | 743:7-744:30  | repair-persisted-manifest-authorization         |
| 338 | Survived   | 952527e695b1a0820057db1719a30c4f1f3d672c272ef4a14257c4bb752986b3 | ConditionalExpression | "false"                                                                                                                                         | 743:7-743:76  | repair-persisted-manifest-authorization         |
| 358 | Survived   | ccb74d8899676f0743301ec10aad0079c80db938580e3a24fc781a10d9233876 | ObjectLiteral         | "{}"                                                                                                                                            | 774:57-774:72 | repair-operation-requirement                    |
| 394 | Survived   | cfe3441292c45993705803ee9cbc08be2535f45cf980791c82059d52994af8f2 | StringLiteral         | "\"\""                                                                                                                                          | 855:7-855:40  | repair-current-key-version                      |

#### Identifier reconciliation

| +   | Mutant     | Status                                                           | Fingerprint           | Operator                                                                                                                                                                                       | Replacement   | One-based location                                   | Rule id |
| --- | ---------- | ---------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------- | ------- |
| 153 | NoCoverage | 86505c1e5be5568cd7dfbcb0aa046c127c90c4ca13bd0398a4d2539c0d8d7ec3 | BlockStatement        | "{}"                                                                                                                                                                                           | 503:52-510:6  | reconciliation-attaches-operation-owned-reservations |
| 362 | NoCoverage | 71995bdc1814c9f7de9d3210fe21c0998763f68b903c319af86faf296a8c099c | ObjectLiteral         | "{}"                                                                                                                                                                                           | 812:41-817:6  | reconciliation-finds-exact-assignment-reservation    |
| 367 | NoCoverage | bfebc0bb6d448c64986da2816552553b192750b77c3041a632183487e1ee9775 | BlockStatement        | "{}"                                                                                                                                                                                           | 825:22-827:6  | reconciliation-owned-transition-and-release          |
| 4   | Survived   | 52aa4afb58582069b079ab90d5ce15c3853fe34fe23e6535b9da93a4705ddec9 | StringLiteral         | "\"\""                                                                                                                                                                                         | 184:24-184:41 | reconciliation-renews-only-owned-lease               |
| 10  | Survived   | 2d69a22ba9cb2e817ba2e93241943afd7bf3ebabc06923e1446d0fcf4adc58e7 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 190:25-194:16 | reconciliation-renews-only-owned-lease               |
| 11  | Survived   | 2b14d7613614bc5b9039eb9d36636d93345b964f3f2ea99ccca5d810f2f6d850 | StringLiteral         | "\"\""                                                                                                                                                                                         | 191:28-191:35 | reconciliation-renews-only-owned-lease               |
| 12  | Survived   | 967410fd5e91baa76f04bac866545ed2d950c3242f19aac173ecaf6617deb2cf | StringLiteral         | "\"\""                                                                                                                                                                                         | 192:23-192:31 | reconciliation-renews-only-owned-lease               |
| 13  | Survived   | a937c34bfd4f4d2ad82b5e366b0b8eebbe274b647930d6ec8e8b48be2422a221 | StringLiteral         | "\"\""                                                                                                                                                                                         | 196:24-196:31 | reconciliation-renews-only-owned-lease               |
| 14  | Survived   | 46847fa4e21ce373065d994d4ebdcc549a65fc8aa8b2371477f522cf07608d93 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 200:7-200:56  | reconciliation-renews-only-owned-lease               |
| 15  | Survived   | f8aa507b32232b9bd24a6417c0c46d5e1446fb83be9e4981175a3fbeb6c1182b | StringLiteral         | "\"\""                                                                                                                                                                                         | 200:25-200:32 | reconciliation-renews-only-owned-lease               |
| 16  | Survived   | 8828927b04e1901313949b4cf698513aeb5e78d31926733a3f71a4817fcc8d44 | BooleanLiteral        | "false"                                                                                                                                                                                        | 200:50-200:54 | reconciliation-renews-only-owned-lease               |
| 18  | Survived   | 08953885c6942d3cac9958439b51092910f1a3d5b361d446c728eb5187b61c55 | MethodExpression      | "this.operationModel.find(this.candidateFilter(new Date(Date.now() - CLOCK_SKEW_SECONDS \* 1000)))"                                                                                            | 223:30-227:38 | reconciliation-bounded-claim-processing              |
| 19  | Survived   | 0ac2c60153285f94cd27dad8d1383296e6ac56d8e4d8622debc43430e8b82d0c | ArithmeticOperator    | "Date.now() + CLOCK_SKEW_SECONDS \* 1000"                                                                                                                                                      | 225:39-225:77 | reconciliation-bounded-claim-processing              |
| 20  | Survived   | fda303371c0c60e23d4f167453c85ab5aa2a2bddc493e068b979570797e1f04f | ArithmeticOperator    | "CLOCK_SKEW_SECONDS / 1000"                                                                                                                                                                    | 225:52-225:77 | reconciliation-bounded-claim-processing              |
| 21  | Survived   | 574e05b0f5638df791a8729f67285c0a5d798827d56a753556e8625e9e742787 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 227:13-227:37 | reconciliation-bounded-claim-processing              |
| 42  | Survived   | 4b19a9dbfdd68650d402f649c4118566f58d5a11344fe7001eefa5f9e30506fd | BlockStatement        | "{}"                                                                                                                                                                                           | 257:15-259:8  | reconciliation-bounded-claim-processing              |
| 43  | Survived   | f86ce7a713d5d7e5d89c32c5034ef8c4c047b7e2263d60ba5b2ec525f03fddf2 | StringLiteral         | "\"\""                                                                                                                                                                                         | 258:26-258:75 | reconciliation-bounded-claim-processing              |
| 45  | Survived   | 1dd54217118ac226ab941c2abdd25fa687fbe1c90cc44ffdd422eec1202af393 | BlockStatement        | "{}"                                                                                                                                                                                           | 267:72-287:4  | reconciliation-bounded-claim-processing              |
| 45  | Survived   | 1dd54217118ac226ab941c2abdd25fa687fbe1c90cc44ffdd422eec1202af393 | BlockStatement        | "{}"                                                                                                                                                                                           | 267:72-287:4  | reconciliation-candidate-status-and-lease-filter     |
| 46  | Survived   | 416b856de165ecf75c4c9bbb094f241aca0b89eb9185cc46edc12806d12517fc | ObjectLiteral         | "{}"                                                                                                                                                                                           | 268:12-286:6  | reconciliation-candidate-status-and-lease-filter     |
| 47  | Survived   | 2036c6f375c0f2109f98a42eebc278a8cf628bab4db258b44ab92f32f942b777 | ArrayDeclaration      | "[]"                                                                                                                                                                                           | 269:13-285:8  | reconciliation-candidate-status-and-lease-filter     |
| 48  | Survived   | 9ffb2c0e9b5fc0b80f083eb98dc466dee64b79aecc15d99375d37a8a3d398850 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 270:9-278:10  | reconciliation-candidate-status-and-lease-filter     |
| 49  | Survived   | bebb4364ceb576aff3d2f0b692b44dd253b6aa13e9ae9620944383bf5b4fd0ee | ArrayDeclaration      | "[]"                                                                                                                                                                                           | 271:16-277:12 | reconciliation-candidate-status-and-lease-filter     |
| 50  | Survived   | e04571774b6fc1677664687a9282b9f45cf45b9212af62bb05d27f8b626ed83c | ObjectLiteral         | "{}"                                                                                                                                                                                           | 272:13-272:55 | reconciliation-candidate-status-and-lease-filter     |
| 51  | Survived   | effdf1d4cfdb66d3deb91ef16df35bd4435a7cde878678e2b7fc6e0be324dbcb | ObjectLiteral         | "{}"                                                                                                                                                                                           | 272:23-272:53 | reconciliation-candidate-status-and-lease-filter     |
| 52  | Survived   | 56e527e7a6576ecad2b879be11bfe315856e9206de5656ed08e08e226b5c65b9 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 273:13-276:14 | reconciliation-candidate-status-and-lease-filter     |
| 53  | Survived   | 754d26757896937478cc68c950d534233963439d41e573a836f73128bebb5889 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 274:23-274:49 | reconciliation-candidate-status-and-lease-filter     |
| 54  | Survived   | ec204b56ed1296864f7b3b7bf6c328035379d085aa34ac5f82e712ab3cb7185a | ObjectLiteral         | "{}"                                                                                                                                                                                           | 279:9-284:10  | reconciliation-candidate-status-and-lease-filter     |
| 55  | Survived   | 2e2fc069260113dc21c7835f1c6a54ca9a7952b7f468c33ae071b4ee7bc2d7bc | ArrayDeclaration      | "[]"                                                                                                                                                                                           | 280:16-283:12 | reconciliation-candidate-status-and-lease-filter     |
| 56  | Survived   | 0036dcf44c1a74f9f2de6d172f0ee194e3999476e6f919a7ea2bafe02f1cf708 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 281:13-281:51 | reconciliation-candidate-status-and-lease-filter     |
| 57  | Survived   | 8756d58bb889adb77fe32a8203ae7090860b56f4a73e7c52bf511410ce000dab | ObjectLiteral         | "{}"                                                                                                                                                                                           | 281:31-281:49 | reconciliation-candidate-status-and-lease-filter     |
| 58  | Survived   | 6a72b6379e1d7032f933749cecb3ee833c9d8cb6bdabcfc46a87edb9f06cc13e | BooleanLiteral        | "true"                                                                                                                                                                                         | 281:42-281:47 | reconciliation-candidate-status-and-lease-filter     |
| 59  | Survived   | b87cbbdbfd1562576c9563d3a216a227af0a70789674ed26763af59491b2bbb8 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 282:13-282:55 | reconciliation-candidate-status-and-lease-filter     |
| 60  | Survived   | f97819cc1eeda9814b262350df4db5520ebddbbe8a57e306be23307f377a6f01 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 282:31-282:53 | reconciliation-candidate-status-and-lease-filter     |
| 68  | Survived   | c0b13d078c67e3500b96c76be2fadcbad23165e38f45164c0a34a4a447d060cc | ConditionalExpression | "false"                                                                                                                                                                                        | 299:7-300:75  | reconciliation-repair-key-availability               |
| 73  | Survived   | 2cca65ebd56e6fbced2e620c987552158b85412e0c69110d099f2c2db356e220 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 311:11-319:12 | reconciliation-claims-exact-eligible-operation       |
| 74  | Survived   | 410c39349a333113a5aead04e9f444867ea1a96cb500f0dcc658b07e00db9458 | ArrayDeclaration      | "[]"                                                                                                                                                                                           | 312:18-318:14 | reconciliation-claims-exact-eligible-operation       |
| 75  | Survived   | f4b70253ca67951f649636edaf1fd5eab99aea9376c0bd6c0278ea7319341bde | ObjectLiteral         | "{}"                                                                                                                                                                                           | 313:15-313:57 | reconciliation-claims-exact-eligible-operation       |
| 76  | Survived   | 5cc8ea061488f014c1e2f1a26c2394c9c160bf041e19384acb10e8b2c02b2785 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 313:25-313:55 | reconciliation-claims-exact-eligible-operation       |
| 77  | Survived   | a0e270abdc1c86eda205870e1a95913698a45a943c594eabbe57141799adffaf | ObjectLiteral         | "{}"                                                                                                                                                                                           | 314:15-317:16 | reconciliation-claims-exact-eligible-operation       |
| 78  | Survived   | 1f4f97a68cf3abd1c30b632e70c299e10b89f1c45b44b8f753bd3726ef413fb2 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 315:25-315:51 | reconciliation-claims-exact-eligible-operation       |
| 81  | Survived   | 13f1353dab79266e0412f011c21958a022f0df76964752853346f108efccfc9a | ObjectLiteral         | "{}"                                                                                                                                                                                           | 322:15-322:53 | reconciliation-claims-exact-eligible-operation       |
| 82  | Survived   | 25f151c2760dd80a0c1a0c46276c0afbd953c590c04ef749443d6b003d0af634 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 322:33-322:51 | reconciliation-claims-exact-eligible-operation       |
| 83  | Survived   | 46dac6dc118163712b49243f0d3b2c3cc154ce286c5cfbacba24337493dd8c22 | BooleanLiteral        | "true"                                                                                                                                                                                         | 322:44-322:49 | reconciliation-claims-exact-eligible-operation       |
| 87  | Survived   | 1c772eaca460fed26716b0ea5526f1c6242edef9d77d8ff5beef5e53b7bfe102 | StringLiteral         | "\"\""                                                                                                                                                                                         | 326:21-326:38 | reconciliation-claims-exact-eligible-operation       |
| 89  | Survived   | 7f7477493c96c96311001a010ea88ff9f4e55a89ebe6752aa0010696da910895 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 328:38-332:24 | reconciliation-claims-exact-eligible-operation       |
| 90  | Survived   | b300d81c23c4bada6201dc143a76240c57c47fd7ea969b80a8525c26219083ca | StringLiteral         | "\"\""                                                                                                                                                                                         | 329:36-329:43 | reconciliation-claims-exact-eligible-operation       |
| 91  | Survived   | 5330841c791bfe6f03f11f5372514c3740ddfb31a27e4ab5f8503446af8b5319 | StringLiteral         | "\"\""                                                                                                                                                                                         | 330:31-330:39 | reconciliation-claims-exact-eligible-operation       |
| 95  | Survived   | 0a31682dcf2e37c2231c7d2388a25da8d9cfe321c4d42c22775abbc7baec582e | ObjectLiteral         | "{}"                                                                                                                                                                                           | 345:29-351:14 | reconciliation-claims-exact-eligible-operation       |
| 96  | Survived   | 207b419e19e3726f1bbec9e2023656e63202aba6fb0185c26d532dc00f5a04b1 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 346:25-350:16 | reconciliation-claims-exact-eligible-operation       |
| 97  | Survived   | 3f52a38e184cdc05de8f9d4a2562a089367b1d01bce7b3c41f3cb89e45ff0672 | StringLiteral         | "\"\""                                                                                                                                                                                         | 347:28-347:35 | reconciliation-claims-exact-eligible-operation       |
| 98  | Survived   | 8ec7eb655a78b3b4259c0c231abe823172efa9ac78c5e59f3f6faa85762f7c34 | StringLiteral         | "\"\""                                                                                                                                                                                         | 348:23-348:31 | reconciliation-claims-exact-eligible-operation       |
| 99  | Survived   | 518b53ba3f80db3ad26b0d4d364ec3d28aef5b2be15f0b7163b617d23d42c3ec | StringLiteral         | "\"\""                                                                                                                                                                                         | 352:24-352:31 | reconciliation-claims-exact-eligible-operation       |
| 100 | Survived   | feb64b8816fae075895b5ef9f2bda0081a3b777f37324ba3f8de60bbd7c0ab82 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 356:7-356:56  | reconciliation-claims-exact-eligible-operation       |
| 101 | Survived   | 9206fdfc6a27fa9547f645e3c007aae76381d7ab20a384d1336cff6fe8f21d83 | StringLiteral         | "\"\""                                                                                                                                                                                         | 356:25-356:32 | reconciliation-claims-exact-eligible-operation       |
| 102 | Survived   | f4963947929429e2a439f377f2d286230e667fb35a7c2033a7feedb7fbc70ac3 | BooleanLiteral        | "false"                                                                                                                                                                                        | 356:50-356:54 | reconciliation-claims-exact-eligible-operation       |
| 110 | Survived   | 91b2da0ac7de9585d58fadde256185de634cf606708813a93a26d1a6d89267be | ConditionalExpression | "case AuthIdentifierOperationStatus.Pending:"                                                                                                                                                  | 379:7-385:15  | reconciliation-invalid-state-fails-terminally        |
| 124 | Survived   | 046f713bd29edbaa1b343bb5a161cca6b1a9ea26af8f9a000b01f89450405c14 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 452:16-458:10 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 125 | Survived   | 77cbb5879f2521f70aae06c67dc6a72a4811d57fcb7b9b9a1aae047b761e9478 | ConditionalExpression | "true"                                                                                                                                                                                         | 454:13-454:59 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 126 | Survived   | 974ee0e66d1d2d578eb0241327cfc84454335970bff3e76fdc48cf5ffd0497d7 | ConditionalExpression | "false"                                                                                                                                                                                        | 454:13-454:59 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 127 | Survived   | b68cfaf387ee29afcef6fdab64f75cfd9ff61afa6a4f034bff37cc08a5d1be9f | EqualityOperator      | "operation.requestedBy.subjectType !== 'member'"                                                                                                                                               | 454:13-454:59 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 128 | Survived   | 8c0b67dee64634a8dfe9924f7859cc77bbea00e456992de5c393cee90b555748 | StringLiteral         | "\"\""                                                                                                                                                                                         | 454:51-454:59 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 130 | Survived   | 888d7e78fd05783bf4bfbfafe1c5d3c0e2ec3dff1493fb0ba6b678cce637cc9e | ObjectLiteral         | "{}"                                                                                                                                                                                           | 463:7-467:8   | reconciliation-invalid-event-precedes-terminal-ttl   |
| 131 | Survived   | c772b297fe421805d0d1adc3638501fd7fa6a3c930c5e9f116e69ae5bada777d | ArrayDeclaration      | "[]"                                                                                                                                                                                           | 468:7-490:8   | reconciliation-invalid-event-precedes-terminal-ttl   |
| 132 | Survived   | 6c838177c9db86c6c661c7a7d79dc7e8039d589add596f1578e661b648d282ce | ObjectLiteral         | "{}"                                                                                                                                                                                           | 469:9-489:10  | reconciliation-invalid-event-precedes-terminal-ttl   |
| 133 | Survived   | 0d63b7a4b75ca051aadb5ee829b2108a860da3988cbc1cf2c8563a12198fa007 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 470:17-488:12 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 134 | Survived   | a9512e11fdd165d19c32b207ecff00240ef3f5760c63db38cd226b52f9425660 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 472:21-476:14 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 135 | Survived   | 05e83f150e206ee8def04074a077fb59c9c03f5bc7aeb85372b8ef42ae94db87 | StringLiteral         | "\"\""                                                                                                                                                                                         | 474:31-474:67 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 136 | Survived   | 0efbe03e9deaf8442f2ba070c00155ac216a8803c4189d10fd47b0bd131ae6e8 | StringLiteral         | "\"\""                                                                                                                                                                                         | 478:38-478:45 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 137 | Survived   | 0ec7026192523c6d809dcb8a224631b4c55659efa9dd820e1d4cbf89bb9aadb6 | StringLiteral         | "\"\""                                                                                                                                                                                         | 479:26-479:33 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 138 | Survived   | 9fc85d71401aac06932c90c215bc0037ae4238529b1bc9d02d2f9a175d856b3c | ObjectLiteral         | "{}"                                                                                                                                                                                           | 480:24-486:14 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 139 | Survived   | 68c7497b7ba85e56441155991584fa132443df1d24f684f180d74edf21a61b9a | ObjectLiteral         | "{}"                                                                                                                                                                                           | 481:25-485:16 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 140 | Survived   | aebda905d60d8e66d9ba911fe58512aff199b857ed377597d172b174ffdff083 | StringLiteral         | "\"\""                                                                                                                                                                                         | 482:28-482:35 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 141 | Survived   | 9775ad14aee7bc8f74ab48f887ce55cc873fd0562f8fabd7e900d571e1cb2504 | StringLiteral         | "\"\""                                                                                                                                                                                         | 483:23-483:28 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 142 | Survived   | c8d8e54ace743a3581bcff52ad2814bac911f008ae1060a95829f1cf51109bb4 | StringLiteral         | "\"\""                                                                                                                                                                                         | 487:24-487:31 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 143 | Survived   | 12c58b86edd48a861e32df8b3589a7dc6e3db33b5f6746074f052ab4e0b1052f | ObjectLiteral         | "{}"                                                                                                                                                                                           | 491:7-491:56  | reconciliation-invalid-event-precedes-terminal-ttl   |
| 144 | Survived   | 432d68825d8882770b3cafa31343698ddaa1677d9d443648933e2b13292f3c5a | StringLiteral         | "\"\""                                                                                                                                                                                         | 491:25-491:32 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 145 | Survived   | b44b5ad51dd25bd1e7f30771e22bfab773fa2e8e1abf2c68a7a12d665d4b46b6 | BooleanLiteral        | "false"                                                                                                                                                                                        | 491:50-491:54 | reconciliation-invalid-event-precedes-terminal-ttl   |
| 150 | Survived   | 5eb89a53e7977b2fde9fd9ee1043bdbfa62cfcdaca18946268a7177d8c4917f1 | ConditionalExpression | "false"                                                                                                                                                                                        | 503:9-503:50  | reconciliation-attaches-operation-owned-reservations |
| 151 | Survived   | 93189e5421aa81e99347eebc9e76f1fad3a499741edc233090088f4f8ded4d02 | EqualityOperator      | "reservations.length >= this.maxAssignments"                                                                                                                                                   | 503:9-503:50  | reconciliation-attaches-operation-owned-reservations |
| 158 | Survived   | 7cd8b503178f05e972fa6340571971919ff8d1bff3f759da0def74626ced9cee | LogicalOperator       | "!item.targetReservationId && item.subjectType === reservation.subjectType && item.subjectId === reservation.subjectId &#124;&#124; String(item.action) === String(reservation.pendingAction)" | 515:11-518:68 | reconciliation-attaches-operation-owned-reservations |
| 159 | Survived   | 3107524236f9976190c45c300311a0d9a6e9d5cad6f693bf141775624d063609 | ConditionalExpression | "true"                                                                                                                                                                                         | 515:11-517:51 | reconciliation-attaches-operation-owned-reservations |
| 160 | Survived   | 2ea24506e99b34fedfcbf286d4d5371ffc92bd87c5ca1f35d6fc35127950dbaa | LogicalOperator       | "!item.targetReservationId && item.subjectType === reservation.subjectType &#124;&#124; item.subjectId === reservation.subjectId"                                                              | 515:11-517:51 | reconciliation-attaches-operation-owned-reservations |
| 161 | Survived   | 73791cbf79df503788b0179e57fd841c2f1b4dfa10e3f4eb73363c33e18eafd3 | ConditionalExpression | "true"                                                                                                                                                                                         | 515:11-516:55 | reconciliation-attaches-operation-owned-reservations |
| 162 | Survived   | f9772ba411bb237e84447554896dc2dd282a7e3eec1b691e03e66ec19f853ba5 | LogicalOperator       | "!item.targetReservationId &#124;&#124; item.subjectType === reservation.subjectType"                                                                                                          | 515:11-516:55 | reconciliation-attaches-operation-owned-reservations |
| 164 | Survived   | df390dc5aae9a06f6e493bdf07d6c5d3103dc06e27c4e77d1e92f6228913cd6d | ConditionalExpression | "true"                                                                                                                                                                                         | 516:11-516:55 | reconciliation-attaches-operation-owned-reservations |
| 166 | Survived   | b967df44749279f512356e6e56c6f988fe21b20b30a2de5eee89a6b658bf0fc7 | ConditionalExpression | "true"                                                                                                                                                                                         | 517:11-517:51 | reconciliation-attaches-operation-owned-reservations |
| 168 | Survived   | 1f430a2cc03dcc262df5c133a09f69355e941c09fc7364079561d7964a4d0ec8 | ConditionalExpression | "true"                                                                                                                                                                                         | 518:11-518:68 | reconciliation-attaches-operation-owned-reservations |
| 175 | Survived   | 1bf82869c528558ba46770b069eff991cee74ca5e302aa97e215bbf01ea8c25f | ObjectLiteral         | "{}"                                                                                                                                                                                           | 532:46-532:64 | reconciliation-attaches-operation-owned-reservations |
| 176 | Survived   | 172a75bad795256bfc0513800055475c146fa27dfc613bd10c96b6009ccb44c4 | BooleanLiteral        | "true"                                                                                                                                                                                         | 532:57-532:62 | reconciliation-attaches-operation-owned-reservations |
| 193 | Survived   | c0645f4a02bd0ff035f505d3f387a57004a0c6e9ec633af8f118539623682615 | ConditionalExpression | "false"                                                                                                                                                                                        | 561:9-561:40  | reconciliation-recovers-applied-ownership            |
| 195 | Survived   | 8a216628ea60b64ea07ffa08b9fd304e637eecac4d7c36ab6ee8b97acf0cc1fd | StringLiteral         | "\"\""                                                                                                                                                                                         | 561:31-561:40 | reconciliation-recovers-applied-ownership            |
| 202 | Survived   | 76a1821e3c8c762da60eeed1f9dcbf0aeb9fe19e8fcf38448479495b6b53998e | ConditionalExpression | "true"                                                                                                                                                                                         | 566:9-566:62  | reconciliation-recovers-applied-ownership            |
| 213 | Survived   | faf3c0678ac8ad4d1beeb1a0d79ffd68dd564081738a0e4ae56bc4694bd0097b | MethodExpression      | "[...operation.assignments]"                                                                                                                                                                   | 600:30-600:66 | reconciliation-recovers-compensated-ownership        |
| 222 | Survived   | a2cc97c360464380e93fabd1ef75b730b87b0cd9fd492a0394ead91027374229 | ConditionalExpression | "false"                                                                                                                                                                                        | 604:11-604:42 | reconciliation-recovers-compensated-ownership        |
| 224 | Survived   | 3b10c2df2474e7fc3cd2e09278439fe36d5c4cbd74afaf24f561f8942e9a5a39 | StringLiteral         | "\"\""                                                                                                                                                                                         | 604:33-604:42 | reconciliation-recovers-compensated-ownership        |
| 225 | Survived   | 9477ac80a053fb5f3a7a4e322d6803238e07ba122e9380a0f83da64378dd3379 | BlockStatement        | "{}"                                                                                                                                                                                           | 604:44-607:8  | reconciliation-recovers-compensated-ownership        |
| 250 | Survived   | 2b13505b1fb53ed0462328b3e81681e52434ea5ae223f656021c24bde5fa25d2 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 640:9-640:60  | reconciliation-recovers-compensated-ownership        |
| 249 | Survived   | a2f5e8c5c778de9f41f0a0bc43b8d4f69ceedda9f28e9d2669d1294a92935dc2 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 635:9-639:10  | reconciliation-recovers-compensated-ownership        |
| 251 | Survived   | c6559889e997f509fe42703bc030275eb9c3837dccdbe4720f3401bf5b78c249 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 640:17-640:58 | reconciliation-recovers-compensated-ownership        |
| 252 | Survived   | 97c492049b7a3b299cdb82453dc9aa704cb84bad9fb63a58b4ee249db0ebe6cd | StringLiteral         | "\"\""                                                                                                                                                                                         | 640:43-640:56 | reconciliation-recovers-compensated-ownership        |
| 260 | Survived   | 5ce79784dcdf531c673427450eacd8ba5c61d3dfe5c40c564501fc9caf3e5111 | MethodExpression      | "operation.assignments.some(item => item.status === 'compensated')"                                                                                                                            | 660:7-660:75  | reconciliation-terminal-event-and-ttl-ordering       |
| 279 | Survived   | 151d460bb9b63594777cba071c5e98b855d3009e60ec1e514b9087b2026cb5bc | ObjectLiteral         | "{}"                                                                                                                                                                                           | 690:7-694:8   | reconciliation-terminal-event-and-ttl-ordering       |
| 285 | Survived   | 8e3a3030bc748acf21e72952b3c8d112476f01e314fdcd26166e2bf89e4e0688 | StringLiteral         | "\"\""                                                                                                                                                                                         | 702:24-702:31 | reconciliation-terminal-event-and-ttl-ordering       |
| 291 | Survived   | 64852be08a1715b159ee1c7c06980dedb8d6296052be1ffdc6cce9a92977636d | ObjectLiteral         | "{}"                                                                                                                                                                                           | 717:7-717:56  | reconciliation-terminal-event-and-ttl-ordering       |
| 292 | Survived   | 73325bcdda3efa2410b02cb35d16ead17225c5a034083ab945ea86c64d8b94f9 | StringLiteral         | "\"\""                                                                                                                                                                                         | 717:25-717:32 | reconciliation-terminal-event-and-ttl-ordering       |
| 293 | Survived   | 6153ac299ee66738748c20bbe01bee9a3564b2996e2e2a7c17e490e8d49c446d | BooleanLiteral        | "false"                                                                                                                                                                                        | 717:50-717:54 | reconciliation-terminal-event-and-ttl-ordering       |
| 295 | Survived   | e6e16e36fdfceb3b594cdea849d5411a77b966a75fe72afbbc5791e5399f0690 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 727:15-727:25 | reconciliation-bounded-gate-and-batch-cleanup        |
| 296 | Survived   | 0ff0a2004840d531dbbb7ed0b7629d12b5ad591519938728e1049666d61d8aec | ConditionalExpression | "true"                                                                                                                                                                                         | 731:9-731:21  | reconciliation-bounded-gate-and-batch-cleanup        |
| 319 | Survived   | adc423007bf2f9b519af07fd006b3d70625aab58b98208d50fbb61edaa3446fc | ObjectLiteral         | "{}"                                                                                                                                                                                           | 750:17-750:27 | reconciliation-bounded-gate-and-batch-cleanup        |
| 320 | Survived   | a478dce43e248882c7a6d5cbebf93dd6393f227e55ac5bcce1ebd34861b22ae7 | ConditionalExpression | "true"                                                                                                                                                                                         | 754:11-754:25 | reconciliation-bounded-gate-and-batch-cleanup        |
| 342 | Survived   | 9527e62e106bc4c128de45088db97c5cbef5d68df697c1473f5320da40f40509 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 780:17-780:43 | reconciliation-parent-ttl-after-cleanup-and-event    |
| 354 | Survived   | ffc916162a002fdf529ee3beaf3cfb42c5c7374cb8505801eb7933f487727aa2 | StringLiteral         | "\"\""                                                                                                                                                                                         | 797:24-797:31 | reconciliation-parent-ttl-after-cleanup-and-event    |
| 355 | Survived   | 130def197d710692e02d79ebb3b532511ddccab7a5d250165b75bc01d2002170 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 801:7-801:56  | reconciliation-parent-ttl-after-cleanup-and-event    |
| 356 | Survived   | df59d9c02e70a6b0b32469103cb0fff0efee3283e45fd49c63bb1d79d87807c1 | StringLiteral         | "\"\""                                                                                                                                                                                         | 801:25-801:32 | reconciliation-parent-ttl-after-cleanup-and-event    |
| 357 | Survived   | 7b5de33e89fc6a6d1214c281355e6debc25a9203134d33ac1376031f49651c9f | BooleanLiteral        | "false"                                                                                                                                                                                        | 801:50-801:54 | reconciliation-parent-ttl-after-cleanup-and-event    |
| 359 | Survived   | 0df766d4dd306181ac15320b17a30a37cbb119665dc1a4ba91ed45c223ec2f4e | ConditionalExpression | "true"                                                                                                                                                                                         | 809:9-809:39  | reconciliation-finds-exact-assignment-reservation    |
| 365 | Survived   | aed476068b1784a9992dfa8987e107e45830a44d48cf34838ecfe58d64b33e11 | ConditionalExpression | "false"                                                                                                                                                                                        | 825:9-825:20  | reconciliation-owned-transition-and-release          |
| 373 | Survived   | fe6aca404c0417f1966ceff8625b4d46cf529065ee4be69b5904317e19bc9a1b | ArrayDeclaration      | "[]"                                                                                                                                                                                           | 837:7-841:8   | reconciliation-owned-transition-and-release          |
| 374 | Survived   | f2469d19ba57a3a5629379d0fe4520d3441613f27f8ceaa890c724f07d0769fa | ObjectLiteral         | "{}"                                                                                                                                                                                           | 838:9-840:10  | reconciliation-owned-transition-and-release          |
| 375 | Survived   | f7927c7441cc75846134b59f0363622e6678fecf43df81bf1187353979828dbd | ObjectLiteral         | "{}"                                                                                                                                                                                           | 839:17-839:64 | reconciliation-owned-transition-and-release          |
| 376 | Survived   | efbeeb962085848c117a41904e04fb8705badc9c01592b88e902693b8ee4ff56 | StringLiteral         | "\"\""                                                                                                                                                                                         | 839:35-839:42 | reconciliation-owned-transition-and-release          |
| 377 | Survived   | bf8fa6d0951b25df527b79e5191ee19e8a745be870dcac7bca5528cdeb7b8a4f | StringLiteral         | "\"\""                                                                                                                                                                                         | 839:55-839:62 | reconciliation-owned-transition-and-release          |
| 378 | Survived   | bde9692f6df64058289d4a00b9847efed0336e30823dcb6f4026055b812f5a16 | ObjectLiteral         | "{}"                                                                                                                                                                                           | 842:7-842:31  | reconciliation-owned-transition-and-release          |
| 379 | Survived   | 77e73c2e72d94cf5e1cecc65e4a9cd2d4124c6c8d727a03ced02ff21cddf952d | BooleanLiteral        | "false"                                                                                                                                                                                        | 842:25-842:29 | reconciliation-owned-transition-and-release          |
| 384 | Survived   | ce0e5c5abdddcb9c8ecb64705966c7c4bb6db0639bb1062b180fc416246bf358 | StringLiteral         | "\"\""                                                                                                                                                                                         | 855:38-855:71 | reconciliation-correlation-keying                    |
| 395 | Survived   | 34d4c4a41289051a5061ce4f421a0c9f675ca75d7c9bf00ab43f37d51dc463b6 | StringLiteral         | "\"\""                                                                                                                                                                                         | 868:17-868:67 | reconciliation-correlation-keying                    |
| 398 | Survived   | d091a1157065b74f4f283a857e7f198ddcf4a327a868a1c1bfe434f89fb67011 | StringLiteral         | "\"\""                                                                                                                                                                                         | 876:40-876:51 | reconciliation-secret-decoding                       |
| 399 | Survived   | 142a9a4c2ffad7c50d5409881176bcdb7f027092b2e535c934a2862b4b05b22d | ConditionalExpression | "true"                                                                                                                                                                                         | 877:12-877:51 | reconciliation-secret-decoding                       |
| 400 | Survived   | 3a4d522d574e06ab378cc6b50e5070abdb4848591e74e3fc696d1bad9392e950 | ConditionalExpression | "false"                                                                                                                                                                                        | 877:12-877:51 | reconciliation-secret-decoding                       |
| 401 | Survived   | 05c5027479738dd7c3752a724bf623711c15a21247f99548371db695f626ca5d | EqualityOperator      | "decoded.toString('base64url') !== value"                                                                                                                                                      | 877:12-877:51 | reconciliation-secret-decoding                       |
| 403 | Survived   | b4a9385a539d4b16ca74d4f3f5c70adb2775a73e50a66a80aa1acf17e30bd51a | StringLiteral         | "\"\""                                                                                                                                                                                         | 879:28-879:34 | reconciliation-secret-decoding                       |
| 404 | Survived   | 5bf7341622a017b7639151304161ce97406afe7ad71bef02ef1192a24a402d3e | BlockStatement        | "{}"                                                                                                                                                                                           | 882:38-887:4  | reconciliation-secret-decoding                       |
| 404 | Survived   | 5bf7341622a017b7639151304161ce97406afe7ad71bef02ef1192a24a402d3e | BlockStatement        | "{}"                                                                                                                                                                                           | 882:38-887:4  | reconciliation-lease-duration                        |
| 405 | Survived   | 1becc71a04c3d1d517dce5c4aaed80677619a6a67ad6a554faed70125bd9cfe3 | LogicalOperator       | "this.configService.get<number>('auth.identifierLeaseSeconds') && DEFAULT_LEASE_SECONDS"                                                                                                       | 884:7-885:28  | reconciliation-lease-duration                        |
| 406 | Survived   | 2813e7fe8e80ed0903de0d9b4586a98c5c32271da4c86a822f4a2a4ceb8c5d5a | StringLiteral         | "\"\""                                                                                                                                                                                         | 884:38-884:67 | reconciliation-lease-duration                        |
| 411 | Survived   | 4ba5285d033a19887630adbf7502df270a089e9c7d2ef16ecc83c693bee6d283 | LogicalOperator       | "this.configService.get<number>('auth.identifierOperationRetentionDays') && DEFAULT_RETENTION_DAYS"                                                                                            | 907:7-908:29  | reconciliation-retention-duration                    |
| 412 | Survived   | bab198870e9451578cb1a7c05e23106112927688044c5b5b8d953f360a1cdbbd | StringLiteral         | "\"\""                                                                                                                                                                                         | 907:38-907:77 | reconciliation-retention-duration                    |

## Task 5 smoke-budget amendment and reconciliation pass 7

- The user-approved binding amendment raises only the smoke hard/runtime gate
  from `300000 ms` to exactly `350000 ms`; complete remains exactly
  `900000 ms`. Selected production scope, mutators, reporters, score/critical
  gates, and the `2/2/2/4/2` concurrency map are unchanged.
- Deterministic runner TDD was exact: the focused `350000 ms` scheduling
  regression first exited `1`, `0/1`, with `0 !== 5` while the runner still
  used `300000 ms`, then exited `0`, `1/1` after the one-constant correction.
  Full Windows runner/policy verification was `82` passed, `0` failed, one
  intentional POSIX skip; the explicit complete `900000 ms` test passed.
- The accepted clean WSL-native snapshot is
  `/home/tisana/book-library-plan5-task5-reconciliation-350k-20260816-1620/repo`
  at provenance `dad7c524330c1c60ea016b357c3feedae68e47c9`. Its
  normalized source/snapshot binary diff SHA is
  `698e4cd6b031c149caa65e27bf91d923bbf1643833711aef6408f8776a572be7`,
  protected-source ledger SHA is
  `503d23f1be8a71300b4c6dec77a2e4f0754201236e09dd672d3b83ee1c1b20d5`,
  runner SHA is
  `8a92cd9f27fd0614cc97c470617701debdeb21d78f3bf70dccd657ad43794e04`,
  and unchanged config SHA is
  `e65a708152cdbc95ab850ba8546bbec3af4690895e91f86b4970d884f761562a`.
  `nvm use lts/jod` selected Node `v22.22.2`/npm `10.9.8`; fresh `npm ci`
  exited `0` in `22.81 s`; WSL manifest verification passed `89` rules and
  the full runner/policy suite passed `83/83`, no skips.
- Reconciliation pass 7 completed with JSON/HTML in
  `123501.000308/350000 ms`, `timedOut: false`, and Stryker/artifact/policy
  exits `0/0/0`. Exact status count is `414` Killed, `1` Survived, and zero
  NoCoverage from `415` mutants. Durable evidence is preserved at
  `reports/mutation/diagnostics/task5-identifier-reconciliation-pass7-wsl-350k/`;
  mutation JSON SHA is
  `463a524f94625ffaea7b783f78a5f59f2247c28cdd92802d5345595b5a7557c5`.
- The sole finding is mutant `403`, `StringLiteral`, replacement `""`,
  location `879:28-879:34`, rule `reconciliation-secret-decoding`, exact
  fingerprint
  `b4a9385a539d4b16ca74d4f3f5c70adb2775a73e50a66a80aa1acf17e30bd51a`.
  It replaces explicit `utf8` with an empty encoding. Node 22's shipped
  `buffer` implementation routes `!encoding` and `encoding === 'utf8'` to the
  same `encodingOps.utf8`; representative ASCII, invalid-base64, Unicode,
  embedded-NUL, and lone-surrogate inputs also produced byte-identical output.
  The existing observable fallback test already asserts the UTF-8 bytes, so an
  argument-spy-only mutation kill would violate Task 5's good-test constraint.
- Pre-dispatch equivalent review is recorded without an allowlist change:
  reviewer requested fresh `gpt-5.6-sol`, high reasoning; actual fresh
  `gpt-5.6-sol`, high reasoning; substitution none. The exact review candidate
  is fingerprint
  `b4a9385a539d4b16ca74d4f3f5c70adb2775a73e50a66a80aa1acf17e30bd51a`.
- Fresh independent review verdict: `APPROVED_EQUIVALENT` for only fingerprint
  `b4a9385a539d4b16ca74d4f3f5c70adb2775a73e50a66a80aa1acf17e30bd51a`.
  The exact reviewer-provided schema-v1 entry was added without altering either
  prior entry. Narrow allowlist TDD first failed `2 !== 3` (`0/1`, exit `1`)
  after the ordered integrity expectation required the approved third
  fingerprint, then the full policy suite passed `46/46`, exit `0`, after the
  verbatim approved entry was added. Requested and actual reviewer model:
  fresh `gpt-5.6-sol`, high reasoning; substitution none.
- Read-only current-report validation confirms token final has exact `210`
  Killed/`1` approved-equivalent Survived from `211`, no timeout, JSON SHA
  `2c0d4de38140eeabec6c6a20986930a8efd6ebb6632ae3b23554412f55a4fc8f`;
  repair pass 8 has exact `397` Killed/`3` Timeout/`1`
  approved-equivalent Survived from `401`, no shard timeout, JSON SHA
  `6a8dfd644978e69112bb9b1941f05aabd09180c49929b531444ea83ba8ad3c76`.
  Both preserved reports are commit `dad7c52` but Node 24 and the historical
  `300000 ms` budget, so the exact final Node 22/`350000 ms` merge producer
  must regenerate them rather than relabel or reuse them.

## GREEN command and exit

- Focused final auth command:
  `npm exec --no -- jest --runInBand src/auth/token-session.service.spec.ts src/auth/auth-identifier-repair.service.spec.ts src/auth/auth-identifier-reconciliation.service.spec.ts`;
  exit `0`.
- Final allowlist policy command:
  `node --test test/quality/mutation-policy.test.mjs`; exit `0`.
- Same-snapshot named smoke commands for token, repair, reconciliation,
  members, and borrowings each settled with complete JSON/HTML and artifact
  exit `0`. Standalone `smoke-merge` exited `1` solely from the expected
  untouched Task 6/7 policy findings.

## GREEN evidence

- Pre-Fix-Round-1 focused auth Jest: `3/3` suites and `188/188` tests passed.
- Allowlist policy: `46/46` tests passed and validates exactly three ordered,
  independently approved fingerprints.
- Final same-provenance smoke durations were token `149865.12891`, repair
  `114286.59524099999`, reconciliation `123501.000308`, members
  `224989.141534`, and borrowings `37732.896585999995 ms`, each against exact
  `350000 ms`, with no shard timeout and all JSON/HTML present.
- The merge accepted exactly five sources and `1366` canonical identities at
  commit `dad7c52`, Node major `22`, and config SHA
  `e65a708152cdbc95ab850ba8546bbec3af4690895e91f86b4970d884f761562a`.
  Aggregate raw score is `94.14348462664715`; exact statuses are `1283`
  Killed, `66` Survived, `3` Timeout, and `14` NoCoverage. All three auth
  critical findings are approved equivalents and auth unapproved count is
  zero. The `77` violations are exactly `26` members and `51` borrowings
  findings deferred to Tasks 6/7. Aggregate JSON SHA is
  `f1f5154f39199da5bd64b297e646449372055f2712a45b73824e982ced024ecb`.

## Focused metrics

- Token: `210` Killed and `1` approved-equivalent Survived of `211`.
- Repair: `397` Killed, `3` Timeout, and `1` approved-equivalent Survived of
  `401`.
- Reconciliation: `414` Killed and `1` approved-equivalent Survived of `415`.
- Auth critical disposition: exact `3` findings, all independently approved;
  zero unapproved Survived or NoCoverage.

## Full-suite commands and exits

- Windows deterministic runner/policy: `82` passed, `0` failed, one intentional
  POSIX skip; the complete `900000 ms` regression passed.
- WSL Node 22 deterministic runner/policy: `83/83`, no skips.
- Manifest updater check: `89` rules. ESLint, Prettier, `git diff --check`, and
  protected production/config/dependency identity checks passed before the
  clean snapshot and mutation producer.
- The required complete mutation profile exited `1` on the forbidden runtime
  timeout described below; therefore Task 5 did not reach final full-suite,
  commit, or final-review acceptance.
- The later human-approved complete-distributed amendment supersedes only that
  producer. Its focused deterministic RED was `0/13`; focused GREEN was
  `13/13`. Final Windows runner/policy verification was `91` pass, `0` fail,
  one intentional POSIX skip. The byte-exact WSL Node 22 snapshot passed
  `92/92`, with no skips. Manifest `89`, ESLint, Prettier, `git diff --check`,
  and protected production/package/manifest identity checks passed. Final
  pre-Fix-Round-1 focused auth Jest remained `3/3` suites and `188/188`
  tests.
- Existing quality streams remain independent and were referenced rather than
  recomputed in this test/runner-only Task 5 scope. Task 0's verified inherited
  Plan 3 Task 10 evidence records backend unit `469/469`, backend E2E
  `242/242`, quality reporting `68/68`, all-source backend reporting `87`
  files, and changed-line `not-applicable` `0/0` passed. The integrated quality
  index's accepted G3/G4 handoff records frontend coverage above its independent
  minimum and Playwright `87/87` with zero failed/flaky/skipped; the current
  untouched baseline remains frontend statements `85.29%`, branches `82.44%`,
  functions `81.48%`, and lines `85.82%`. Task 5 changes no coverage baseline,
  frontend path, Playwright configuration, quality workflow, or reporting
  semantics; Task 8 retains the authoritative fresh integration rerun.

## Runtime evidence

- Final same-commit smoke merge evidence is preserved across the five
  `task5-*-wsl-350k` diagnostic directories plus
  `reports/mutation/diagnostics/task5-auth-final-wsl-350k-aggregate/`.
- Required complete profile used the same snapshot, Node `v22.22.2`, all five
  full sources, exact `1727` mutants, concurrency `4`, and unchanged
  `900000 ms` gate. Its 329-test dry run passed, but the profile timed out at
  `900335.251824/900000 ms`, signal `SIGTERM`, with last console progress
  `1702/1727`, `130` Survived, and `3` individual mutant Timeouts.
- Complete `mutation.json`, `mutation.html`, and Stryker log were not produced;
  `rawCombinedScore` is null and baseline/critical disposition cannot be
  accepted. Duration, summary JSON/Markdown, and the non-recursive temporary
  sandbox archive are preserved at
  `reports/mutation/diagnostics/task5-complete-profile-timeout-wsl-900k/`.
  Duration SHA is
  `2b78e9f583c2dbef4b7f7848593ecacdfff755c32d245dacf9ef50a295e741d7`;
  sandbox archive SHA is
  `2a57aa40e83143f692e590fb51b852e69e0ed1aafebdab6562b527f2bfeaaa51`.
- Per the binding stop condition this is not an acceptable Task 5 RED. No
  retry, threshold/budget/config/scope change, Task 6 work, commit, push, or
  Actions dispatch followed.
- The user subsequently authorized five full-source complete shards without
  changing the `900000 ms` gate. The accepted byte-exact snapshot is
  `/home/tisana/book-library-plan5-task5-complete-shards-exact-20260816-2000/repo`
  at commit `dad7c524330c1c60ea016b357c3feedae68e47c9`, Node `v22.22.2`, npm
  `10.9.8`, fresh `npm ci` `23.70 s`, runner SHA
  `f6352077e62e4ef37a050655ce58f33d5b6aa5b8e3a1c19e8a736518480796f9`,
  and configuration SHA
  `3e960072b82654cf7ecf2e43ca43f7227719117bb332206101baf984b25c26e2`.
  Two earlier no-shard snapshots are preserved as preflight failures: the
  first inherited CRLF for changed JavaScript and failed WSL Prettier; the
  second normalized protected production to LF and correctly failed manifest
  source hashes. Neither started Stryker or produced mutation evidence.
- Accepted full-source shards were sequential and isolated: token `261`
  mutants in `114714.184835 ms`; repair `417` in `76678.565423 ms`;
  reconciliation `532` in `106823.370522 ms`; members `286` in
  `316857.54179700004 ms`; borrowings `231` in `42058.691993 ms`. Every shard
  had JSON/HTML/log/duration/summary, concurrency `4`, exact `900000 ms`
  budget, no shard timeout, the same commit/Node major/source hashes/config,
  and artifact exit `0`.
- Canonical merge accepted exactly five disjoint sources and exact `1727`
  identities independent of report-local ids. Statuses are `1565` Killed,
  `132` Survived, `27` NoCoverage, and `3` Timeout. Raw combined score is
  `90.79328314997105`, above the `70` gate and above any absent pre-Task-6
  baseline. Module raw scores are token `94.25287356321839`, repair
  `99.76019184652279`, reconciliation `93.796992481203`, members
  `88.1118881118881`, and borrowings `67.0995670995671`.
- The single merged Task 2 policy evaluation exited `1` only for the exact `77`
  expected Task 6/7 findings: members `26` and borrowings `51`. The only three
  auth critical findings are the exact independently approved token, repair,
  and reconciliation equivalents; auth unapproved count is zero. Missing
  artifacts, timeout, scope/provenance drift, raw-score regression, and
  unapproved auth findings are all absent.
- Durable complete evidence is
  `reports/mutation/diagnostics/task5-complete-distributed-wsl-900k/`.
  Aggregate JSON SHA is
  `ce3730b1ce3d06967a23a77f4203ded43af7b62d481e7901fec65528ab067f01`;
  summary SHA is
  `8ef53c529e1ab01dfa3a0ce8f9b834071c92ac9b4faae5251852664488afc5c8`.

## Fix Round 1 reviewer remediation

- Initial independent Task 5 verdict was `CHANGES_REQUIRED`, Critical `0`,
  Important `3`, Minor `0`. I1 was the unfinished RED ledger, I2 was stale
  scope/amendment accounting, and I3 was private-only assertion quality.
- Public-path TDD is exact. The focused policy guard command shown under RED
  first failed `0/1` and then passed `1/1`. Token missing-family denial and UUID
  consumption now run through public `rotate`; reconciliation key availability,
  correlation, secret decoding, default lease, and retention are asserted via
  public `reconcileOnce` selectors/writes/results; repair manifest validation
  runs through public `dryRun`, `apply`, and `cancel`. The cited direct
  `(service as any).privateMethod` and private getter assertions are absent.
- Final Windows verification: focused auth `3/3` suites and `190/190` tests;
  all auth `18/18` suites and `334/334` tests; deterministic runner/policy
  `92` passed, `0` failed, one intentional POSIX skip; ESLint, Prettier,
  manifest `89`, protected-path identity, and `git diff --check` all exited
  `0`. Final same-snapshot WSL Node 22 verification passed deterministic
  runner/policy `93/93` with no skips, manifest `89`, and Prettier.
- First clean public-path smoke at temporary snapshot commit
  `58ed352675a5216f21638a386f60d22ec10ed7c1` was retained because exact repair
  fingerprint `646a86b2...b14967` survived. A public `dryRun` claimant-state
  assertion distinguished it. The final mutation snapshot commit is
  `4c4623512fc0895685aff396e7d77d0333f12150`.
- Final clean snapshot root:
  `/home/tisana/book-library-plan5-task5-fix-round1-20260816-1930/repo`;
  Node `v22.22.2`, npm `10.9.8`, fresh `npm ci`; runner SHA
  `f6352077e62e4ef37a050655ce58f33d5b6aa5b8e3a1c19e8a736518480796f9`;
  config SHA
  `3e960072b82654cf7ecf2e43ca43f7227719117bb332206101baf984b25c26e2`.
- Final smoke shards used exact `350000 ms`: token `135733.733258`, repair
  `104056.1518`, reconciliation `114038.735271`, members `196870.980403`, and
  borrowings `37127.026146 ms`. Merge exact `1366`, raw
  `94.14348462664715`, statuses `1283` Killed/`66` Survived/`3` Timeout/`14`
  NoCoverage, auth unapproved `0`, exact three approved equivalents, and exact
  `77` Task 6/7 violations. Durable JSON/summary hashes are
  `cb3e454dc510268da17021f9044b6c26616e8dea748cf8c7ebc46aa531446266`
  and
  `afbcf3bd2b3aa00d7c25b85f77fcdd51014b36bca12c9135cc071d57a1fd38e1`.
- Final full-source complete shards used independent exact `900000 ms` gates:
  token `261/102477.067983`, repair `417/66520.382847`, reconciliation
  `532/95562.910743`, members `286/274087.79486100003`, and borrowings
  `231/39642.82099199999 ms`. Each has JSON/HTML/log/duration/summary and
  artifact exit `0`. Canonical merge exact `1727`, raw
  `90.79328314997105`, statuses `1565` Killed/`132` Survived/`27`
  NoCoverage/`3` Timeout, auth unapproved `0`, exact three approved
  equivalents, and exact `77` Task 6/7 violations. Durable JSON/summary hashes
  are
  `51eb907615b659a2cacb2278e1e066c70e33edbdfb9f04600f8b7e0bbdf34a3a`
  and
  `c5a2c2d887c9dd52dd11fd8efcf3db5d03c70a97c4452679c7ee5339b5224533`.
- The final evidence trees are
  `reports/mutation/diagnostics/task5-fix-round1-final-smoke-wsl-350k/` and
  `reports/mutation/diagnostics/task5-fix-round1-final-complete-wsl-900k/`;
  the report-based public-path RED is separately preserved at
  `reports/mutation/diagnostics/task5-fix-round1-public-path-smoke-red-wsl/`.
  Missing artifacts, shard timeout, provenance/scope drift, raw-score
  regression, and unapproved auth findings are absent.

## Commit hash

`f539eda1c1f99622df59ca13181b9a71f96219a5` (`test: harden critical auth
mutations`). This exact immutable SHA was measured with `git rev-parse HEAD`
and is backfilled without amend in the required distinct evidence-only commit.

Fix Round 1 implementation is the separate immutable commit
`b90460231c8cbdb5ceeee3de6bde93c424f8ecc0` (`test: use public auth mutation
paths`). It contains only the three auth specs and the public-path quality
regression. This SHA was measured after commit and is backfilled here without
amend; Task 5 evidence remains a distinct evidence-only commit.

## Deferred findings

- Task 8 distributed reference wall-clock proof remains deferred, not waived.

## Reviewer decision

The token, repair, and reconciliation equivalents each received independent
`APPROVED_EQUIVALENT`. Initial Task 5 review nevertheless returned
`CHANGES_REQUIRED`, Critical `0`, Important `3`, Minor `0`, for evidence scope
and test-quality defects rather than equivalent disposition. Fix Round 1
addresses I1-I3 and is pending the same independent reviewer's re-review; no
approval is presumed. No Task 6, push, or Actions work is authorized or
started. Implementer self-review after mutation and deterministic verification
finds open Critical/Important/Minor `0/0/0` in Fix Round 1 scope.
