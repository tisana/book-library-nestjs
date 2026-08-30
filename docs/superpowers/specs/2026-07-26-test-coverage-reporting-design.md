# Test Coverage and Pass-Rate Reporting Design

**Date:** 2026-07-26
**Status:** Approved for implementation planning

## Purpose

Establish trustworthy, separately reported quality metrics for the NestJS
backend and React frontend, then use those measurements to improve coverage
without hiding weak areas behind one combined percentage.

The reporting system must answer three independent questions:

1. How thoroughly do backend unit tests exercise production backend code, and
   do backend e2e tests pass?
2. How thoroughly do frontend unit and component tests exercise production
   frontend code?
3. Do frontend Playwright e2e tests pass cleanly across the configured browser
   projects?

## Current Baseline

The existing backend `npm run test:cov` report only includes production files
loaded by unit tests. It reports 73.00% statements, 59.03% branches, 70.43%
functions, and 73.19% lines across 56 of 88 production TypeScript files.

An all-source measurement that includes every production backend TypeScript
file reports:

| Backend unit metric | Current value | Covered / total |
| --- | ---: | ---: |
| Statements | 59.24% | 2,128 / 3,592 |
| Branches | 55.95% | 1,545 / 2,761 |
| Functions | 59.66% | 355 / 595 |
| Lines | 59.58% | 2,043 / 3,429 |

The backend unit suite currently has 215 passing tests across 27 files. The
frontend unit suite currently has 42 passing tests across 16 files, but no
frontend coverage provider or percentage report is configured. The repository
also contains 27 backend e2e/performance test files and 18 frontend Playwright
files, but the current GitHub Actions workflow does not execute either e2e
layer.

These values establish context only. The implementation will freshly measure
and check in the authoritative baseline produced by the final reporting
configuration.

## Chosen Approach

Use repository-native reporters and a small, deterministic summary utility.
Jest, Vitest with the V8 coverage provider, and Playwright will generate
machine-readable reports. GitHub Actions will publish three independent job
summaries and upload the underlying artifacts.

This approach has no hosted-service dependency and keeps local and CI commands
identical. The JSON, LCOV, and HTML artifacts remain compatible with a future
Codecov or SonarQube integration.

Hosted coverage services are deferred because they add credentials and a
second configuration surface before the project has trustworthy source
denominators. A custom dashboard is rejected because it would duplicate
reporting and history features without improving the test suites.

## Reporting Architecture

### Shared report summarizer

A repository script will consume machine-readable Jest, Vitest, and Playwright
outputs and produce:

- concise console output for local development;
- GitHub-flavored Markdown for `$GITHUB_STEP_SUMMARY` in CI;
- a stable JSON summary for artifacts and future trend ingestion;
- a nonzero exit code when an enabled quality gate fails.

The script will not merge backend and frontend coverage. Every output field
will include its scope and source command so that percentages cannot be
mistaken for whole-application coverage.

Malformed, missing, or schema-incompatible input is a reporting failure rather
than an empty or zero-test success. All reports include the tool version,
timestamp, total tests, and relevant source-file denominator.

### Report 1: Backend coverage and backend e2e

Backend unit coverage will include every production `src/**/*.ts` file and
exclude only test files and generated coverage/build output. It will report:

- statements: percentage and covered/total counts;
- branches: percentage and covered/total counts;
- functions: percentage and covered/total counts;
- lines: percentage and covered/total counts;
- production files represented in the report;
- unit suites and tests passed, failed, and skipped.

Backend Jest e2e results will be a distinct subsection with suites and tests
passed, failed, skipped, and total. Its pass rate is:

`passed / (passed + failed) * 100`

Skipped tests are excluded from the rate but displayed prominently. A run with
zero executed tests fails reporting. Backend e2e is gated immediately: any
failed test or suite fails CI.

### Report 2: Frontend unit coverage

Add `@vitest/coverage-v8` at the version matching Vitest. Coverage will include
production `frontend/src/**/*.{ts,tsx}` and exclude:

- `*.test.*` and `*.spec.*`;
- test setup, mocks, fixtures, and test utilities;
- generated source files;
- declaration-only files;
- the pure application bootstrap entry when it contains no business behavior.

The checked-in Vitest configuration will list each exclusion explicitly.
Frontend coverage will report statements, branches, functions, and lines with
covered/total counts, plus unit test files and tests passed, failed, and
skipped. It will produce text-summary, JSON summary, LCOV, and HTML output.

Frontend coverage is never combined with backend coverage. The first
authoritative run of the final configuration establishes the checked-in
frontend baseline.

### Report 3: Frontend Playwright e2e

Playwright will retain the existing list and HTML reporters and add a
machine-readable JSON reporter. The summary will report:

- first-attempt passes;
- flaky tests that passed only after a retry;
- failures after retries;
- skipped tests;
- total expected tests;
- clean pass rate and eventual pass rate;
- results by desktop, tablet, and mobile Chromium project.

The clean pass rate is:

`first-attempt passed / (first-attempt passed + flaky + failed) * 100`

The eventual pass rate is:

`(first-attempt passed + flaky) / (first-attempt passed + flaky + failed) * 100`

Skipped tests are excluded from both rates but reported. A run with zero
executed expected tests fails reporting. Any final failure fails CI. Flaky
tests are visible as a separate non-clean result; the initial rollout warns on
flakiness without failing solely because a retry passed.

The HTML report, traces, screenshots, and videos will be uploaded when
generated so failures remain diagnosable.

## CI Layout

GitHub Actions will expose three independently readable jobs:

1. **Backend coverage and e2e**
   - install backend dependencies;
   - run all-source backend unit coverage;
   - run backend e2e tests with machine-readable output;
   - enforce the backend baseline and zero e2e failures;
   - publish the backend summary and artifacts.
2. **Frontend unit coverage**
   - install frontend dependencies;
   - run Vitest with V8 coverage;
   - enforce the frontend baseline;
   - publish the frontend unit summary and artifacts.
3. **Frontend Playwright e2e**
   - install frontend dependencies and the required Chromium runtime;
   - run all configured Playwright projects;
   - enforce zero final failures;
   - publish pass-rate summaries and diagnostic artifacts.

The existing build job will depend on the three quality jobs so an application
artifact is not published after a quality-gate failure. CodeQL remains
independent.

Coverage artifacts use separate backend and frontend paths. E2e artifacts use
separate backend Jest and frontend Playwright paths. Artifact names must not
collide, and reports must remain useful when a test command fails. CI will use
`if: always()` for summary and artifact steps after test execution.

## Quality Gates and Ratcheting

### Phase 1 gates

- Backend coverage cannot fall below the freshly confirmed all-source baseline
  for statements, branches, functions, or lines.
- Frontend coverage cannot fall below its freshly measured all-source baseline
  for statements, branches, functions, or lines.
- Backend e2e requires zero failures.
- Frontend Playwright requires zero final failures.
- Missing reports, invalid reports, and zero-test runs fail their reporting
  jobs.

### Coverage improvement targets

- Raise overall backend and frontend line and branch coverage toward at least
  75%.
- Introduce an 80% line and branch target for new or changed code after stable
  baseline reporting is established.
- Target 85–90% branch coverage for authentication, authorization, token
  rotation, throttling, ownership checks, and borrowing rules.
- Ratchet checked-in baselines upward when a merged change increases coverage;
  never automatically lower a baseline.

Differential coverage is a later gate and must not be approximated by a merged
backend/frontend percentage. Its implementation will compare changed
executable lines against the appropriate backend or frontend LCOV report.

## Coverage Improvement Order

Backend work is ordered by risk and observed gaps:

1. authentication identifier repair and reconciliation paths;
2. permissions mapping and authorization decisions;
3. refresh-session rotation, replay, expiry, and revocation behavior;
4. member ownership and account lifecycle decisions;
5. borrowing state transitions, conflicts, and overdue rules;
6. controllers, DTO validation, health/readiness, and bootstrap wiring.

Frontend work is ordered by user and security impact:

1. authentication API, in-memory session, refresh, and sign-out failure paths;
2. route guards and permission-driven routing;
3. administrator role and identifier-conflict workflows;
4. member privacy, reminders, and borrowing state rendering;
5. shared form validation, loading, empty, forbidden, and error states;
6. accessibility-sensitive keyboard and focus behavior.

Coverage-only tests that assert implementation details are not a goal. New
tests must protect observable behavior, business rules, security boundaries,
or stable public interfaces.

## Local Developer Experience

Root package scripts will provide memorable commands for:

- backend coverage;
- backend e2e with reporting;
- frontend unit coverage;
- frontend Playwright e2e with reporting;
- all quality reports.

Each CI command must be runnable locally without GitHub-specific environment
variables. When `$GITHUB_STEP_SUMMARY` is absent, Markdown is written to the
corresponding local report directory instead.

Generated reports, coverage output, and Playwright artifacts remain ignored by
Git. Only configuration, summarizer code, tests, and baseline policy files are
tracked.

## Error Handling

- Test command failures must not prevent result summarization or artifact
  upload.
- Summarization must preserve the original test command's failure status.
- A test failure, malformed report, missing report, or zero-test run produces
  a concise actionable error naming the affected reporting stream.
- Coverage comparison errors display the current and required values for each
  failed dimension.
- Report generation must not require secrets or network access after
  dependencies and Playwright browsers are installed.

## Verification

Implementation is complete only when:

- backend all-source coverage includes the expected production file count;
- frontend all-source coverage includes every non-excluded production source
  file;
- each reporting stream has parser tests for passing, failing, skipped, flaky,
  missing, malformed, and zero-test inputs where applicable;
- local commands produce separate summaries and artifacts;
- a deliberately failing fixture makes the appropriate gate fail;
- a missing report makes the appropriate gate fail;
- GitHub Actions syntax is valid and the three quality jobs are independent;
- no report displays a combined backend/frontend coverage percentage.

## Out of Scope

- A hosted coverage service or custom dashboard;
- merging backend and frontend coverage;
- browser JavaScript coverage collected from Playwright;
- enforcing 75% overall coverage immediately;
- failing solely on a Playwright test that passes on retry during the initial
  rollout;
- unrelated production refactoring.
