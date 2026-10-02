# Production-build Authentication Performance Evidence

Generated: 2026-10-02T15:01:57.713Z

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
| Unprotected baseline | 5.78 | 11.35 | 16.37 |
| Protected handler | 13.75 | 19.95 | 26.58 |
| Authentication boundary overhead | 7.67 | 13.00 | 20.66 |

First 50 security events from a 10,000-event dataset: 12.07 ms.

## Gates

| Gate | Result |
| --- | --- |
| Authentication boundary p95 <= 50 ms | PASS |
| First 50 of 10,000 security events <= 2,000 ms | PASS |
