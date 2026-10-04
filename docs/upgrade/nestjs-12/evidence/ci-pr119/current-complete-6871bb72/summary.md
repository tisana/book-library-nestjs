# Selective mutation summary

Commit: 6871bb72035229e3a262b020a8c82e1ca25efa65
Node major: 24
Maximum shard duration: 561416.397984 ms / 900000 ms

Mutation policy: PASS
Profile: complete
Raw combined score: 95.36%
Module scores:
- src/auth/token-session.service.ts: 93.75% (255 detected, 17 undetected, 0 ignored)
- src/auth/auth-identifier-repair.service.ts: 99.76% (416 detected, 1 undetected, 0 ignored)
- src/auth/auth-identifier-reconciliation.service.ts: 94.42% (508 detected, 30 undetected, 0 ignored)
- src/members/members.service.ts: 97.20% (278 detected, 8 undetected, 0 ignored)
- src/borrowings/borrowings.service.ts: 89.18% (206 detected, 25 undetected, 0 ignored)
Critical findings:
- token-interrupted-cas-finalization: Survived acb2e7754474bbff9585c981cd3e53270038e9b17efa24ccc29d8437ba536ebd (approved equivalent)
- repair-batch-identity-and-checkpoint: Survived c010a2ec5f4bb9177df61f0bc8326b2d04d2463a59bf5dd2337b840dedc2f36e (approved equivalent)
- reconciliation-secret-decoding: Survived aacb161042f6806a7975df97942a802eda877d311c32c32bd54df465b818c4b4 (approved equivalent)
Violations:
- none
