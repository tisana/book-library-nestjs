# T6 rollback rehearsal and release evidence

Status: DONE_WITH_CONCERNS (implementation complete; independent review pending). Final disposable old/new/old rehearsal exits0 with all checks passing under the approved init configuration. Production rollout remains BLOCKED. T6 does not close reviewed T5 `DONE_WITH_CONCERNS` or T1's actual devcontainer gap.

## Scope and provenance

Implementation branch `upgrade/nestjs-12`, evidence base `5eb44651a4b6315ce95f1e0a78263d1459d82b7f`. Old source is execution base `9812ea907ed18ffc513ffdef0effc0e1ddaaa0df`, extracted with `git archive` into `/tmp/nestjs-t6-old`, without checking out or modifying the current branch. Its original Docker stages and Node 22-alpine base are retained. The temporary Dockerfile adds only the BuildKit syntax directive, required read-only public proxy CA mounts and `npm ci --strict-ssl=true` on the three networked installation steps. No dependency resolution flags, application code or lock bytes changed. The exact Dockerfile/lock hashes and old/new collection-schema byte comparisons are in `docs/upgrade/nestjs-12/evidence/t6/provenance.json`.

The old source archive uses its historical mutable `node:22-alpine` reference, resolved today to actual Node 22.23.3/npm10.9.9; it is a reconstructed execution-base artifact, not a claim about an unknown historical production digest. Production must retain and verify its actual old immutable artifact.

Old runtime image: `sha256:b9510bcd54efbd3d1d116b4608e65e29fcc7c416ae3619f20fc48586e86c0cbc`, local tag `book-library-upgrade:rollback-old`. New T5 image: `sha256:a872334e275dc405302381a7d839950ba0ddf238be20e909352788176823a622`, local tag `book-library-upgrade:verification`. Local IDs are immutable evidence, not production registry digests. New image inputs predate reporting/test-only final T5 review fixes; those do not change runtime source/production dependencies. Both actually run `node dist/main.js`, CommonJS application output, nonroot user `node`, Mongoose 9.8.1 and production-only installed packages. Exact executed runtime versions are recorded in the result; no reused Node 24 image is presented as the old Node 22/Nest11 artifact.

Managed runtime status on2026-10-03: connected/current observations, policy enforced, restricted `package_managers`, custom hosts empty, revision17; no configured credentials or VPN. Managed local Docker socket server28.4.0 verified. Inherited Docker config/registry credentials/proxy preserved; `BUILDX_CONFIG=/tmp/nestjs-t6-buildx` handles readonly default buildx storage. Public CA mounted only for installation, no TLS disablement or network-policy bypass. Initial build attempt failed before running a build because `/home/agent/.docker/buildx` is readonly; the separate buildx state path fixes local storage without replacing `DOCKER_CONFIG`.

## Commands and verification

```sh
mkdir -p /tmp/nestjs-t6-old
git archive 9812ea907ed18ffc513ffdef0effc0e1ddaaa0df | tar -x -C /tmp/nestjs-t6-old
# Apply documented temporary CA mounts to the archived Dockerfile only.
BUILDX_CONFIG=/tmp/nestjs-t6-buildx DOCKER_BUILDKIT=1 \
  docker --host=unix:///var/run/docker.sock build \
  --secret id=proxy_ca,src="$CODEX_PROXY_CERT" \
  -t book-library-upgrade:rollback-old /tmp/nestjs-t6-old
MONGOMS_SYSTEM_BINARY=/tmp/nestjs-t0-mongo/mongod MONGOMS_VERSION=8.2.12 \
  MONGOMS_DOWNLOAD_DIR=/tmp/nestjs-t0-mongo \
  node_modules/.bin/ts-node --transpile-only \
  docs/upgrade/nestjs-12/evidence/t6/rollback-rehearsal.ts
```

MongoMemoryReplSet owns a new disposable MongoDB 8.2.12 replica-set database; current existing migrations initialize that fixture only. Synthetic staff/member/book data and random keys are confined to this database; no external URI is accepted by its fixture. Mode0600 environment file carries shared configuration/keys between versions and is removed during cleanup. Cookies/access tokens remain only in process memory. All containers, Mongo process and temporary env directory are owned/cleaned in `finally`; no production state, accounts or keys are used.

An init-enabled attempt also exposed a harness-only metadata probe failure: Nest 12 blocks deep `require("@nestjs/core/package.json")` through its exports map. The diagnostic now reads the installed package file with `fs.readFileSync`; new readiness had passed before that probe. This does not change application behavior, dependency metadata or acceptance. Failed diagnostic retained in `metadata-probe-failure.txt`.

The first strict rehearsal exposed the exact old PID1 behavior: `docker stop --time10` took10210ms, exit137, OOMfalse. This fails the shutdown acceptance and is retained in `initial-shutdown-failure.txt`. Old main lacks shutdown signal registration. Coordinator ruling permits Docker `--init` on both artifacts and requires `init:true` in deployed Compose: init forwards SIGTERM to the old ordinary child process. Old exit143 is **not a graceful Nest drain**; new exit0/143 must terminate within8s, and neither may exit137. Repo Compose and operator override now specify `init:true`. A subsequent harness-only strict new-exit0 assertion failed after successful new worker recovery: init-enabled new image returned143 in179ms. Coordinator approved normal0/143 with actual SIGTERM, elapsed<8s, OOMfalse and never137/SIGKILL, consistent with T5; init child signal semantics differ from PID1. Retained `init-exit-assertion-failure.txt`. Cost if wrong: investigate actual forced termination and repeat; no timeout relaxation or forced-kill acceptance. T4 independently verifies new worker drain; T6 requires current recovery completed before stopping.

Actual deployed grace and init configuration still require owner verification before release. Cost if wrong: production init configuration differs; keep rollout blocked and repeat rehearsal.

The harness verifies non-overlap (replacement starts only after predecessor exits), readiness200 on all three actual containers, existing bearer access continuity, retained cookie rotation on each version, and a single real persistent active session family. Final old version rejects the original old cookie as replay and rejects the current cookie thereafter, with persistent `replayed` family and cleared recoverable hash. No automatic frontend reload restoration is assumed.

Across both replacements, synthetic durable interrupted identifier checkpoints with a future2s lease and synthetic orphan pending refresh markers are persisted directly in the disposable database. Real application startup/scheduled workers process these at default60s cadence through Mongo lease/skew predicates. Identifier operations must finish once with exactly one terminal audit event; marker must commit and orphan family revoke as `refresh-rotation-orphaned`, clearing its hash. These are seeded durable interruption states, **not claims that a real old in-flight worker was gracefully drained**. T4 separately proves a real interrupted query/lease restart. This shortened fixture does not wait the production default300s lease; the runbook requires at least365s eligibility/cadence observation and staged15-minute windows. No production lease is shortened or edited.

## Actual final outcomes

| Phase | Node / npm / Nest core | Readiness200 | SIGTERM exit / elapsed | Session |
| --- | --- | ---: | --- | --- |
| old |22.23.3 /10.9.9 /11.1.18 |1504ms |143 /154ms | access accepted, cookie rotated |
| new |24.19.0 /11.9.0 /12.1.1 |1644ms |143 /152ms | prior access accepted, cookie rotated |
| old restored |22.23.3 /10.9.9 /11.1.18 |1248ms |143 /157ms | prior access accepted, cookie rotated |

Both scheduled recovery directions pass: new59821ms, restored old59920ms, each with completed identifier operation/exactly one terminal audit event and committed orphan marker/revoked orphan family/hash cleared. Cross-transition original cookie replay returns401, revokes real persistent family to `replayed` and clears its hash; latest cookie then also returns401. All three normal exits have OOMfalse and elapsed<8s. No old/new overlap or SIGKILL occurs in the final rehearsal. Final command exits0 after owned container/database/env cleanup. Independent post-command Docker ancestor queries show zero remaining containers for both rehearsal artifacts. All15 collection-schema source files compare byte-identical to execution base; migrations have no git diff against execution base.

Additional fresh checks: `docker compose config --quiet` exits0 with `init:true`; `git diff --check` exits0; Prettier check on the executable evidence script passes; final result JSON parses and asserts exact3 phase versions and2 recovery directions; new runbook/report relative links resolve. Saved output is only non-sensitive statuses/counts/timings/image IDs and synthetic labels. No ordinary test suite is rerun for these operator/docs changes; the actual three-artifact rehearsal directly verifies the runtime configuration addition.

## Documentation and release blockers

The runbook defines non-overlapping maintenance rollout, traffic stages10%/50%/100%, minimum sample windows, ingress/stop/verify/start/rollback commands, restoration of protected image/configuration references with init enabled, security/data-integrity immediate rollback, worker recovery and session follow-up checks. It explicitly preserves database/schema/keys and irreversible migration003 revocation. It labels proposed5xx>1% and p95>120% baseline over two5-minute/1000-request windows as recommendations pending adoption, with low-traffic handling. Owner and adopted SLOs are undefined; production remains blocked.

T1 actual devcontainer build/runtime remains blocked on `westus.data.mcr.microsoft.com`, `www.mongodb.org`, `repo.mongodb.org`, absent from current custom-host policy. T5 mutation acceptance remains blocked: actual350132ms smoke violates350000ms budget, absent accepted current five-shard1744 complete baseline and1366 smoke acceptance; historical baseline preserved,89 manifest rules passing is insufficient. No further long mutation retry, budget relaxation, selection reduction, production deployment, push or merge occurs in T6.

Deferred documentation nits fixed: mkdir before baseline Mongo docker-cp extraction; escaped Node-engine `||` in dependency-matrix table cells. README now distinguishes configured runtime pin from unverified actual devcontainer and links release status. Original/scoped T5 reviews and T6 brief are included as durable metadata; scratch review packages are excluded.
