# Selective mutation summary

Commit: 63b2e80306d479f1280a74910007d9054410eee9
Node major: 24
Maximum shard duration: 290553.239848 ms / 350000 ms

Mutation policy: PASS
Profile: smoke
Raw combined score: 99.78%
Module scores:
- src/auth/token-session.service.ts: 99.53% (210 detected, 1 undetected, 0 ignored)
- src/auth/auth-identifier-repair.service.ts: 99.75% (400 detected, 1 undetected, 0 ignored)
- src/auth/auth-identifier-reconciliation.service.ts: 99.76% (414 detected, 1 undetected, 0 ignored)
- src/members/members.service.ts: 100.00% (204 detected, 0 undetected, 0 ignored)
- src/borrowings/borrowings.service.ts: 100.00% (135 detected, 0 undetected, 0 ignored)
Critical findings:
- token-interrupted-cas-finalization: Survived acb2e7754474bbff9585c981cd3e53270038e9b17efa24ccc29d8437ba536ebd (approved equivalent)
- repair-batch-identity-and-checkpoint: Survived c010a2ec5f4bb9177df61f0bc8326b2d04d2463a59bf5dd2337b840dedc2f36e (approved equivalent)
- reconciliation-secret-decoding: Survived aacb161042f6806a7975df97942a802eda877d311c32c32bd54df465b818c4b4 (approved equivalent)
Violations:
- none
