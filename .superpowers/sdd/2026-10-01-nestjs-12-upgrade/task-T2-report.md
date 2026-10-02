# T2 implementer report: compiled Nest 11 production characterization

Status: **implementation complete; verified and self-reviewed; independent review pending.** T1's devcontainer prerequisite remains open; this report does not mark T1 complete or claim release/deployment readiness. Work performed on isolated managed checkout `/workspace/book-library-nestjs`, branch `upgrade/nestjs-12`, 2026-10-02.

Execution base: `08ee4cb96317dc08c286bb56fa4aca8f03990abf`. Implementation commit: `3051eb0ef7d300b1972cfe9cef956ee23a9098b8`. Review implementation range: `08ee4cb96317dc08c286bb56fa4aca8f03990abf..3051eb0ef7d300b1972cfe9cef956ee23a9098b8`. A following report commit includes this report and unchanged coordinator-owned progress/T1 review/T2 brief. Raw review-package scratch and later task briefs are excluded.

## Scope and files

- `test/support/production-process.ts:1-195`: explicit absolute compiled entry, disposable URI/environment/static-directory interface, URL/exit/shutdown observations, ephemeral-port reservation, bounded liveness startup and collision retries, bounded termination fallback, diagnostic redaction and directory cleanup.
- `test/production-bootstrap.e2e-spec.ts:1-878`: 47 actual HTTP production contracts, migrated Mongo fixtures, asset fixtures and real process lifecycle probes.
- `test/jest-production.json:1-10`: dedicated production matcher and 60-second per-test/setup bound.
- `test/jest-e2e.json:9`: explicit exclusion of the production file so the existing e2e regex never double-runs it. This necessary separation is the only file beyond the brief's enumerated create/modify list.
- `package.json:49`: `test:production` builds then executes the dedicated configuration serially with open-handle detection.
- `docs/upgrade/nestjs-12/baseline.md:76-106`: appended T2 behavior, environment/fixture/process methodology, exact readiness/filter discrepancy and verification scope.

No `src`, migration definitions, schemas, frontend, package-lock, coverage policy, mutation manifest/policy, workflow, Docker or devcontainer implementation changed. Retained Nest 11, TypeScript 5.9.3, Mongoose 9.8.1, Jest 30.2.0 and ts-jest 29.4.14.

## Harness and fixture interfaces

The suite's single entry-path constant is `dist/src/main.js`, explicitly verified by T0 for the full checkout. The API accepts an absolute path rather than guessing a build layout. T3 must change that constant to `dist/main.js` once it verifies normalized production output. CommonJS and the existing Docker command are untouched.

`startProductionProcess` returns `baseUrl`, an `exited` promise, redacted `diagnostics()` and idempotent `stop()`. It reserves/relinquishes an ephemeral loopback port before launching Node. The release/listen race is handled solely by bounded `EADDRINUSE` retries (default three, maximum five). Startup timeout defaults to 20 seconds, capped at 30; individual liveness polls timeout after 500 ms. Shutdown waits at most two seconds after SIGTERM and another two after SIGKILL. Early process exit/configuration errors do not waste retries. Tests demonstrate a genuine occupied-port failure followed by a working actual compiled bootstrap, a timed-out process that is dead with its directory removed, redaction across split stdout chunks, invalid-production-configuration exit, and repeated controlled shutdown/exit observation.

Each child runs from a dedicated empty temporary directory so production ConfigModule cannot consume the checkout's `.env`. Only PATH/TZ plus explicitly supplied test environment are inherited; process-external application configuration and NODE_OPTIONS are omitted. Production-mode signing/cookie/audit secrets and fixture passwords are generated in memory, never saved. The suite uses a separate temporary directory for minimal HTML/JS fixtures; the process harness also works without that optional directory.

Memory-server owns a disposable single-node replica set, and the suite connects through the existing `createMongoTestContext`. Synthetic staff/member/membership-type/book records and existing `loadMigrations`/`runPendingMigrations` provide real reserved identifiers and readiness indexes. No production URI, account, migration experiment, destructive reset, new migration or schema change occurs. Cleanup uses all-settled child/fixture teardown, with harness cleanup on startup failure and normal shutdown. A final process listing contained no production Node/Mongo child and `/tmp/library-production*` directory inspection returned no leftovers.

Diagnostics replace explicit configured secrets, Mongo connection strings, bearer/JWT credentials, refresh-cookie values and account email addresses. Session/state assertions compare SHA-256 digests of complete sorted documents instead of rendering credentials, cookie/session values or synthetic account records on an equality failure. Cookie assertions check flags/maximum lifetime as booleans; token presence and changes are also boolean checks. No credentials, raw cookies, tokens or personal data are in this saved report.

## Contracts verified

- Real compiled `main.ts` bootstrap, without a TestingModule or copied bootstrap settings.
- Two exact HTTPS credentialed CORS origins; suffix/different-port negative preflights, matched origin/credentials/Vary/requested headers.
- All six browser-session routes deny missing, opaque, malformed, duplicate, suffix and different-port origins with exact generic 403, no Set-Cookie and unchanged complete authentication/throttle/security/account state. Valid existing credentials/session cookies accompany denied requests; invalid DTO fields prove the origin boundary precedes validation. Malformed percent-encoded refresh cookies remain unparsed after denial.
- Production host-only HttpOnly/Secure/SameSite=Strict `/auth` cookies, bounded Max-Age and clear parity; access credentials in the response body with existing 900-second lifetime and no refresh credential body field.
- Two refresh rotations, earlier-generation replay rejection and latest successor denial after revocation.
- Real source throttle partitions for an untrusted loopback peer and configured loopback/private proxy chain. Changing spoofed addresses to the left of the first untrusted hop does not split the source bucket; distinct first-untrusted hops do. Malformed chains and unsupported Forwarded/X-Real-IP values resolve to the direct peer. These are observable HTTP/persistent-state contracts; no private Express request-IP echo route is introduced.
- DTO whitelist/type checks, numeric query transformation, out-of-range validation, parser failure, missing/invalid bearer authorization, staff without administrator rights, member denial at staff boundaries, token-derived member borrowing ownership, domain missing-record and conflict errors with unchanged book quantities.
- Public Swagger UI/generated OpenAPI, liveness/readiness, key-required readiness, database-loss readiness under five seconds with public liveness, explicit static assets, login/unauthorized/staff/member deep links, JSON API/non-frontend errors with HTML Accept headers, and absence of benchmark endpoints.
- Only error timestamps are normalized. Status codes, request paths, ordered validation messages and filter error labels are fixed to observed baseline behavior.

## Existing security/API discrepancy (unchanged)

HealthService throws `{status: "error", reason: "throttle-key-required"}` or `{status: "error", reason: "database-unavailable"}` for the induced readiness failures. Actual global-filter HTTP output is status **503**:

```json
{
  "statusCode": 503,
  "path": "/health/ready",
  "timestamp": "<ISO timestamp>",
  "message": "Service Unavailable Exception",
  "error": "ServiceUnavailableException"
}
```

The filter discards the service's status/reason. This differs from unfiltered health TestingModule examples and is an existing Nest 11 contract discrepancy, not a Nest 12 regression. It is explicitly frozen/documented, never silently repaired. The production missing/invalid bearer envelope uses `error: "UnauthorizedException"`; explicit refresh denials instead use `error: "Unauthorized"` and `message: "Invalid refresh session"`. Tests retain these exact distinctions.

## Commands and results

Runtime: local Node **24.19.0**, npm **11.9.0**. Mongo commands use:

```sh
MONGOMS_SYSTEM_BINARY=/tmp/nestjs-t0-mongo/mongod
MONGOMS_VERSION=8.2.12
MONGOMS_DOWNLOAD_DIR=/tmp/nestjs-t0-mongo
```

| Command / attempt | Exit | Result |
| --- | ---: | --- |
| `npm run test:production` first | 1 | Build succeeds; ts-jest TS2769 on duplicate Origin header overload; 0 tests run |
| `npm run test:production` second | 1 | Build/bootstrap/migrations/staff login succeed; 45 tests fail from beforeAll member login 404 caused by missing synthetic membership type; one test-only losing shutdown timer reported as open handle |
| `npm run test:production` third | 1 | 42/45 pass; three assertions assumed `Unauthorized` label but actual Passport/global-filter label is `UnauthorizedException`; no open-handle warning |
| `npm run test:production` fourth/final code | 0 | Build succeeds; 1 suite, **47/47 pass**, 0 skips, no open handles; 36.496 seconds |
| `npm test -- --runInBand` | 0 | **35 suites, 560/560 pass**, 0 skips; 36.504 seconds |
| `npm run test:e2e` initial verification | 0 | **29 suites, 243/243 pass**, 0 skips; 77.048 seconds; initially overlapped unit/production work |
| `npm run test:e2e` isolated verification | 0 | **29 suites, 243/243 pass**, 0 skips; 49.208 seconds; no competing production/unit/benchmark work |
| `npx jest --config test/jest-e2e.json --listTests --runInBand` | 0 | 29 existing files; production file absent |
| `npx jest --config test/jest-production.json --listTests --runInBand` | 0 | One production file; zero overlap with existing e2e matcher |
| `npx eslint test/production-bootstrap.e2e-spec.ts test/support/production-process.ts` | 0 | Focused ESLint clean (first and final checks) |
| `npx prettier --check test/production-bootstrap.e2e-spec.ts test/support/production-process.ts test/jest-production.json test/jest-e2e.json package.json` | 0 | All selected files formatted |
| Implementation `git diff --check` / staged check | 0 | No implementation whitespace errors |
| Final metadata staged `git diff --cached --check` | 2 | Existing unchanged T2 brief has Markdown hard-break trailing spaces at line 3 and blank EOF at line 51; preserved byte-for-byte as instructed |
| Source/lock/policy/container diff and fixture/process inspection | 0 | Unchanged application/policies; no production fixture leftovers |

First-run failures were newly authored test compilation/fixture/expected-label assumptions. Corrections changed test inputs/harness timer/asserted observed baseline labels only; they do not represent a fixed production regression. Passing existing counts equal T0/T1: **560 unit, 243 e2e**. The new separate 47 tests do not inflate the existing producer's counts. Test passes on unchanged production code are the intended characterization result; no artificial red production change was introduced.

Transient full logs (not committed) are `/tmp/nestjs-t2-production-first.log`, `...-second.log`, `...-third.log`, `...-fourth.log`, `/tmp/nestjs-t2-unit.log`, `/tmp/nestjs-t2-e2e.log`, `/tmp/nestjs-t2-e2e-isolated.log`, and `/tmp/nestjs-t2-{e2e,production}-matcher.txt`. Their exact outcomes/counts are retained above. Intentional negative-path warnings in existing suites are not hidden or described as application regressions.

## Self-review, limits and handoff

Reviewed the full implementation diff and each brief acceptance item. Focused lint/format, build, final dedicated production suite, complete unit suite, complete existing e2e suite and matcher/no-leak checks passed. No final test failure is outstanding. The final metadata whitespace check reports the coordinator-owned unchanged brief formatting noted above; it is not hidden or reformatted. No skipped/quarantined test, lowered threshold, equivalent mutation waiver or forced dependency resolution was introduced. No new benchmark/performance measurement is claimed from test-suite wall times.

Coverage/reporting/mutation producers and full mutation smoke were not rerun: T2 alters test harness/config/docs only; no application source/runtime/policy changed since T1's verified producers. This is explicit scope, not a claim of fresh coverage/mutation evidence. T3 consumes the new contracts and explicit compiled-entry interface; T4 owns new lifecycle behavior; T5 owns final container/quality integration acceptance.

T1 actual devcontainer build remains blocked on MCR CDN access. The coordinator's existing progress ruling permits unaffected T2 on proven local Node24/Nest11/runtime-transformer interfaces while preserving that blocker. This report neither attempts the devcontainer nor weakens its acceptance. No deployment occurred. No worker/reviewer was spawned. Independent T2 review remains the coordinator's next step.
