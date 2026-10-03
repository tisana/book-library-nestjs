# Production-build Authentication Performance Evidence

Generated: 2026-10-03T07:38:38.556Z

## Runtime

| Item | Value |
| --- | ---: |
| Node.js | v24.19.0 |
| MongoDB | 8.2.12 |
| CPU | INTEL(R) XEON(R) PLATINUM 8573C |
| Logical CPU count | 3 |
| Warm-ups per handler | 100 |
| Measured requests per handler | 500 |
| Concurrency | 10 |
| Seeded security events | 10000 |

The runner used a dedicated temporary MongoDB replica set, a separately compiled production-mode benchmark module, disabled Nest logging, equivalent response bodies, and nearest-rank percentiles. Authentication overhead samples are the non-negative protected duration minus the baseline duration at the same sample index.

## Results

| Measurement | p50 (ms) | p95 (ms) | max (ms) |
| --- | ---: | ---: | ---: |
| Unprotected baseline | 8.19 | 11.91 | 23.50 |
| Protected handler | 19.61 | 33.50 | 40.63 |
| Authentication boundary overhead | 10.91 | 25.55 | 33.91 |

First 50 security events from a 10,000-event dataset: 17.52 ms.

## Gates

| Gate | Result |
| --- | --- |
| Authentication boundary p95 <= 50 ms | PASS |
| First 50 of 10,000 security events <= 2,000 ms | PASS |
