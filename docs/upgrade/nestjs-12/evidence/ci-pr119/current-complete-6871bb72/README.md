# Current complete mutation acceptance

Producer commit: `6871bb72035229e3a262b020a8c82e1ca25efa65`. Configuration: `17196a829ccf2cecdd793ab64fca18029d5b3392c89af5bd7e784cdc8bfd8d12`. Actual Node 24.19.0. All five reports retain their original producer metadata. After the workspace resumed, the first three settled reports were validated rather than rerun or rebound; the remaining two ran on the same committed inputs.

The existing complete merge accepts exactly **1744 mutants**, score **95.35550458715596%**, no violations, and only the three unchanged approved critical equivalents. The historical **95.2518818760857%** floor was retained throughout validation and increased by the genuine baseline recorder.

| Shard | Mutants | Duration ms | Killed | Timeout | Survived | NoCoverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| members | 286 | 561416 | 276 | 2 | 5 | 3 |
| token-session | 272 | 288186 | 254 | 1 | 9 | 8 |
| identifier-repair | 417 | 474936 | 410 | 6 | 1 | 0 |
| identifier-reconciliation | 538 | 414453 | 508 | 0 | 30 | 0 |
| borrowings | 231 | 182068 | 206 | 0 | 25 | 0 |

Each actual shard exits 0 below its unchanged **900000 ms** deadline. No RuntimeError occurred. The reconciliation log retains Stryker's automatic worker restart following a memory-limit event; the final report is complete and successful. Mutant-level Timeout statuses remain measured outcomes under existing policy, distinct from process-budget failure.

Historical bytes stayed unchanged during all producers. Only after all five genuine artifacts existed, the previously reviewed temporary hash carrier retained the exact historical floor for synchronous existing `complete-merge` and `record-baseline` commands. The carrier was never committed; the recorder wrote the actual producer/date/current source hashes and increased score. Historical and recorded bytes, operation logs, resume script, collection proof, raw reports and SHA256 map are retained here.

This closes the complete-baseline source-hash gap. Coherent current five-shard smoke acceptance remains pending GitHub verification. This does not close the actual devcontainer or production approval prerequisites.
