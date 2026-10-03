# Selective mutation summary

Commit: 9812ea907ed18ffc513ffdef0effc0e1ddaaa0df
Node: v24.19.0
OS: linux 6.18.44 x64
Duration: 1010362.2447929999 ms / 350000 ms

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
- token-interrupted-cas-finalization: Survived 0108d029ef22842e4c8a00d900136b2dbc483f0013d796483b852f024a550cc5 (approved equivalent)
- repair-batch-identity-and-checkpoint: Survived c010a2ec5f4bb9177df61f0bc8326b2d04d2463a59bf5dd2337b840dedc2f36e (approved equivalent)
- reconciliation-secret-decoding: Survived b4a9385a539d4b16ca74d4f3f5c70adb2775a73e50a66a80aa1acf17e30bd51a (approved equivalent)
Violations:
- none
