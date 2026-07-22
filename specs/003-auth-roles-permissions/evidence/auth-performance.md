# Production-build Authentication Performance Evidence

Generated: 2026-07-18T02:57:51.457Z

## Runtime

| Item | Value |
| --- | ---: |
| Node.js | v24.15.0 |
| MongoDB | 8.2.6 |
| CPU | Intel(R) Core(TM) i7-9700K CPU @ 3.60GHz |
| Logical CPU count | 8 |
| Warm-ups per handler | 100 |
| Measured requests per handler | 500 |
| Concurrency | 10 |
| Seeded security events | 10000 |

The runner used a dedicated temporary MongoDB replica set, a separately compiled production-mode benchmark module, disabled Nest logging, equivalent response bodies, and nearest-rank percentiles. Authentication overhead samples are the non-negative protected duration minus the baseline duration at the same sample index.

## Results

| Measurement | p50 (ms) | p95 (ms) | max (ms) |
| --- | ---: | ---: | ---: |
| Unprotected baseline | 12.15 | 19.24 | 27.99 |
| Protected handler | 22.42 | 33.49 | 44.00 |
| Authentication boundary overhead | 9.93 | 21.46 | 32.71 |

First 50 security events from a 10,000-event dataset: 13.90 ms.

## Gates

| Gate | Result |
| --- | --- |
| Authentication boundary p95 <= 50 ms | PASS |
| First 50 of 10,000 security events <= 2,000 ms | PASS |
