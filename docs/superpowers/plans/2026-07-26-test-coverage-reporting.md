# Test Coverage and Pass-Rate Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trustworthy, separately gated backend coverage/e2e, frontend unit coverage, and frontend Playwright e2e reports, then improve the highest-risk coverage gaps without combining backend and frontend percentages.

**Architecture:** Jest, Vitest/V8, and Playwright produce machine-readable JSON plus LCOV/HTML artifacts. Small TypeScript utilities under `scripts/quality/` parse those formats into three scoped reports, enforce checked-in non-regression baselines, and append Markdown to GitHub Actions job summaries. Coverage improvement proceeds in risk order, with independent backend and frontend ratchets.

**Tech Stack:** Node.js 22 in CI, TypeScript 5.9.x, Jest 30.2, ts-jest 29.4, Vitest 4.1.8, `@vitest/coverage-v8` 4.1.8, Playwright 1.60, GitHub Actions.

## Global Constraints

- Preserve three reporting streams: backend coverage plus backend Jest e2e, frontend Vitest unit coverage, and frontend Playwright e2e.
- Never calculate or display a combined backend/frontend coverage percentage.
- Backend coverage includes every production `src/**/*.ts` file and excludes `*.spec.ts`.
- Frontend coverage includes production `frontend/src/**/*.{ts,tsx}` and explicitly excludes tests, test support, declarations, generated files, and pure bootstrap code.
- Backend and frontend coverage each report statements, branches, functions, and lines with percentages and covered/total counts.
- Backend Jest e2e and frontend Playwright e2e fail CI on any final failure or a zero-test run.
- Playwright reports first-attempt passes, flaky passes, final failures, skipped tests, clean pass rate, and eventual pass rate.
- Missing or malformed machine-readable output is a reporting failure.
- The initial coverage gate prevents regression from the freshly confirmed baseline; baseline ratchets may increase but never decrease automatically.
- Long-term targets are at least 75% overall line and branch coverage, 80% line and branch coverage on changed code, and 85–90% branch coverage for security- and borrowing-critical logic.
- Generated reports and browser artifacts remain ignored by Git.
- Test additions must protect observable behavior, business rules, security boundaries, or stable interfaces; do not test private implementation details solely to increase a percentage.
- Read the approved design before implementation: `docs/superpowers/specs/2026-07-26-test-coverage-reporting-design.md`.

---

## File Structure

### New files

- `quality/coverage-baselines.json` — checked-in backend and frontend minimum percentages.
- `scripts/quality/coverage-report.ts` — coverage JSON validation, normalization, comparison, and ratcheting.
- `scripts/quality/test-result-report.ts` — Jest/Vitest and Playwright result normalization.
- `scripts/quality/render-quality-report.ts` — stable Markdown and JSON rendering for the three streams.
- `scripts/quality/report-quality.ts` — CLI that reads inputs, writes local artifacts, appends the GitHub job summary, and exits according to the gate.
- `test/jest-quality.json` — isolated Jest configuration for quality-tooling tests.
- `test/quality/coverage-report.spec.ts` — coverage parser and baseline tests.
- `test/quality/test-result-report.spec.ts` — Jest/Vitest and Playwright parser tests.
- `test/quality/report-quality.spec.ts` — CLI/report writing tests.
- `src/auth/permissions.service.spec.ts` — direct permission-context behavior coverage.
- `frontend/src/lib/api/client.test.ts` — shared request/response/authentication behavior.
- `frontend/src/lib/api/errors.test.ts` — normalized mutation-error branches.

### Modified files

- `package.json` — accurate backend coverage, backend e2e JSON, reporter, and quality-tooling scripts.
- `.gitignore` — ignore root test-result output.
- `frontend/package.json` and `frontend/package-lock.json` — V8 coverage dependency and unit coverage script.
- `frontend/vitest.config.ts` — all-source include/exclude rules and coverage/test JSON reporters.
- `frontend/playwright.config.ts` — JSON reporter and explicit artifact directories.
- `.github/workflows/ci.yml` — three independent quality jobs, summaries, artifacts, and build dependencies.
- Existing backend service specs — add risk-focused missing branches.
- Existing frontend tests — add authentication, routing, API, state, and accessibility branches.
- `README.md` — document local commands, metric definitions, and ratchet policy.

---

### Task 1: Build the coverage parser and non-regression baseline engine

**Files:**
- Create: `scripts/quality/coverage-report.ts`
- Create: `test/quality/coverage-report.spec.ts`
- Create: `test/jest-quality.json`
- Create: `quality/coverage-baselines.json`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `CoverageMetricName = 'statements' | 'branches' | 'functions' | 'lines'`
  - `CoverageScope = 'backend' | 'frontend'`
  - `CoverageMetric { total: number; covered: number; skipped: number; pct: number }`
  - `CoverageMinimums = Record<CoverageMetricName, number>`
  - `CoverageGate { passed: boolean; failures: Array<{ metric: CoverageMetricName; actual: number; required: number }> }`
  - `CoverageReport { scope: 'backend' | 'frontend'; files: number; metrics: Record<CoverageMetricName, CoverageMetric> }`
  - `CoverageBaselineFile { backend: CoverageMinimums; frontend?: CoverageMinimums }`
  - `parseCoverageSummary(raw: unknown, scope: CoverageScope): CoverageReport`
  - `evaluateCoverage(report: CoverageReport, minimums: CoverageMinimums): CoverageGate`
  - `ratchetCoverageBaseline(current: CoverageMinimums | undefined, measured: CoverageMinimums): CoverageMinimums`
- Consumes: Jest/Vitest `coverage-summary.json` objects containing a `total` property and per-file properties.

- [ ] **Step 1: Add failing parser, malformed-input, baseline, and ratchet tests**

Create `test/jest-quality.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/quality/.*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

Create `test/quality/coverage-report.spec.ts` with these cases:

```ts
import {
  evaluateCoverage,
  parseCoverageSummary,
  ratchetCoverageBaseline,
} from '../../scripts/quality/coverage-report';

const summary = {
  total: {
    lines: { total: 100, covered: 76, skipped: 0, pct: 76 },
    statements: { total: 110, covered: 82, skipped: 0, pct: 74.54 },
    functions: { total: 20, covered: 15, skipped: 0, pct: 75 },
    branches: { total: 40, covered: 28, skipped: 0, pct: 70 },
  },
  'C:/repo/src/example.ts': {
    lines: { total: 100, covered: 76, skipped: 0, pct: 76 },
    statements: { total: 110, covered: 82, skipped: 0, pct: 74.54 },
    functions: { total: 20, covered: 15, skipped: 0, pct: 75 },
    branches: { total: 40, covered: 28, skipped: 0, pct: 70 },
  },
};

describe('coverage report', () => {
  it('normalizes totals and counts represented production files', () => {
    expect(parseCoverageSummary(summary, 'backend')).toEqual({
      scope: 'backend',
      files: 1,
      metrics: summary.total,
    });
  });

  it.each([undefined, null, {}, { total: {} }])(
    'rejects missing or malformed totals: %p',
    (raw) => {
      expect(() => parseCoverageSummary(raw, 'backend')).toThrow(
        'invalid-coverage-summary',
      );
    },
  );

  it('reports every dimension below its baseline', () => {
    const report = parseCoverageSummary(summary, 'backend');
    expect(
      evaluateCoverage(report, {
        statements: 75,
        branches: 71,
        functions: 75,
        lines: 77,
      }),
    ).toMatchObject({
      passed: false,
      failures: [
        { metric: 'statements', actual: 74.54, required: 75 },
        { metric: 'branches', actual: 70, required: 71 },
        { metric: 'lines', actual: 76, required: 77 },
      ],
    });
  });

  it('ratchets upward without lowering an existing dimension', () => {
    expect(
      ratchetCoverageBaseline(
        { statements: 70, branches: 65, functions: 72, lines: 71 },
        { statements: 69, branches: 67, functions: 80, lines: 70 },
      ),
    ).toEqual({
      statements: 70,
      branches: 67,
      functions: 80,
      lines: 71,
    });
  });
});
```

- [ ] **Step 2: Run the isolated tests and verify the missing-module failure**

Run:

```powershell
npx jest --config ./test/jest-quality.json --runInBand test/quality/coverage-report.spec.ts
```

Expected: FAIL because `scripts/quality/coverage-report.ts` does not exist.

- [ ] **Step 3: Implement strict coverage normalization and comparison**

Create `scripts/quality/coverage-report.ts` with the exact public types above.
Validate finite, non-negative `total`, `covered`, `skipped`, and `pct` numbers
for all four dimensions. Count every property except `total` as a represented
file. Return failures in `statements`, `branches`, `functions`, `lines` order.
Implement ratcheting with `Math.max(existing ?? 0, measured)`.

Start the baseline file with the freshly measured backend values:

```json
{
  "backend": {
    "statements": 59.24,
    "branches": 55.95,
    "functions": 59.66,
    "lines": 59.58
  }
}
```

Add:

```json
"test:quality-reporting": "jest --config ./test/jest-quality.json --runInBand"
```

to root `package.json`.

- [ ] **Step 4: Run the focused and complete quality-tooling suites**

Run:

```powershell
npm run test:quality-reporting
```

Expected: PASS with four coverage-report tests.

- [ ] **Step 5: Commit the coverage baseline engine**

```powershell
git add package.json quality/coverage-baselines.json scripts/quality/coverage-report.ts test/jest-quality.json test/quality/coverage-report.spec.ts
git commit -m "test: add coverage baseline engine"
```

---

### Task 2: Normalize Jest/Vitest and Playwright test results

**Files:**
- Create: `scripts/quality/test-result-report.ts`
- Create: `test/quality/test-result-report.spec.ts`

**Interfaces:**
- Produces:
  - `TestRunSummary { passed: number; failed: number; skipped: number; flaky: number; total: number; cleanPassRate: number; eventualPassRate: number; projects?: Record<string, TestRunSummary> }`
  - `parseJestStyleResults(raw: unknown): TestRunSummary`
  - `parsePlaywrightResults(raw: unknown): TestRunSummary`
  - `evaluateTestRun(summary: TestRunSummary): { passed: boolean; reasons: string[] }`
- Consumes:
  - Jest/Vitest JSON fields `numPassedTests`, `numFailedTests`, `numPendingTests`, and `numTotalTests`.
  - Playwright JSON nested `suites[].specs[].tests[]`, each with `projectName`, `expectedStatus`, and `results[].status`.

- [ ] **Step 1: Add failing Jest/Vitest normalization and zero-test tests**

Create `test/quality/test-result-report.spec.ts`:

```ts
import {
  evaluateTestRun,
  parseJestStyleResults,
  parsePlaywrightResults,
} from '../../scripts/quality/test-result-report';

describe('test result normalization', () => {
  it('normalizes Jest and Vitest counts without treating skips as passes', () => {
    expect(
      parseJestStyleResults({
        numPassedTests: 8,
        numFailedTests: 1,
        numPendingTests: 2,
        numTotalTests: 11,
      }),
    ).toEqual({
      passed: 8,
      failed: 1,
      skipped: 2,
      flaky: 0,
      total: 11,
      cleanPassRate: 88.89,
      eventualPassRate: 88.89,
    });
  });

  it('fails a zero-test run even when the producer reports success', () => {
    const summary = parseJestStyleResults({
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      numTotalTests: 0,
    });
    expect(evaluateTestRun(summary)).toEqual({
      passed: false,
      reasons: ['zero-tests'],
    });
  });
});
```

- [ ] **Step 2: Add failing Playwright first-pass, flaky, failure, skip, and project tests**

Add a compact Playwright fixture with four tests:

```ts
const playwrightResult = {
  suites: [
    {
      suites: [],
      specs: [
        {
          tests: [
            {
              projectName: 'desktop-chromium',
              expectedStatus: 'passed',
              results: [{ status: 'passed' }],
            },
            {
              projectName: 'desktop-chromium',
              expectedStatus: 'passed',
              results: [{ status: 'failed' }, { status: 'passed' }],
            },
            {
              projectName: 'mobile-chromium',
              expectedStatus: 'passed',
              results: [{ status: 'failed' }, { status: 'failed' }],
            },
            {
              projectName: 'mobile-chromium',
              expectedStatus: 'skipped',
              results: [{ status: 'skipped' }],
            },
          ],
        },
      ],
    },
  ],
};
```

Assert totals of one first-pass pass, one flaky pass, one failure, one skip;
`cleanPassRate: 33.33`; `eventualPassRate: 66.67`; and separate desktop/mobile
project summaries. Assert `evaluateTestRun` returns `final-failures:1`.

- [ ] **Step 3: Run the focused test and verify the missing-module failure**

Run:

```powershell
npx jest --config ./test/jest-quality.json --runInBand test/quality/test-result-report.spec.ts
```

Expected: FAIL because `scripts/quality/test-result-report.ts` does not exist.

- [ ] **Step 4: Implement deterministic classification and rates**

Create `scripts/quality/test-result-report.ts`. Recursively visit every
Playwright suite. Classify `expectedStatus === 'skipped'` or final
`status === 'skipped'` as skipped. Classify a final `passed` result with more
than one attempt as flaky. Classify a one-attempt final `passed` result as a
clean pass. Treat `failed`, `timedOut`, and `interrupted` final statuses as
failures. Round rates to two decimals with:

```ts
function percentage(numerator: number, denominator: number): number {
  return denominator === 0
    ? 0
    : Math.round((numerator / denominator) * 10_000) / 100;
}
```

Use `passed + flaky + failed` as the denominator. `evaluateTestRun` fails for
zero executed tests or any final failure; flaky passes remain a reported
warning rather than an initial rollout failure.

- [ ] **Step 5: Run all quality-tooling tests**

Run:

```powershell
npm run test:quality-reporting
```

Expected: PASS for coverage and test-result normalization.

- [ ] **Step 6: Commit test-result normalization**

```powershell
git add scripts/quality/test-result-report.ts test/quality/test-result-report.spec.ts
git commit -m "test: normalize quality test results"
```

---

### Task 3: Render and gate the three scoped quality reports

**Files:**
- Create: `scripts/quality/render-quality-report.ts`
- Create: `scripts/quality/report-quality.ts`
- Create: `test/quality/report-quality.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `QualityStream = 'backend' | 'frontend-unit' | 'frontend-e2e'`
  - `QualityReport { stream: QualityStream; generatedAt: string; toolVersions: { node: string }; coverage?: CoverageReport; unitTests?: TestRunSummary; e2eTests?: TestRunSummary; gate: { passed: boolean; reasons: string[] } }`
  - `renderQualityMarkdown(report: QualityReport): string`
  - CLI flags:
    - `--stream`
    - `--coverage`
    - `--unit-tests`
    - `--e2e-tests`
    - `--baselines`
    - `--markdown`
    - `--json`
    - `--write-baseline`
    - `--check-only`
- Consumes: Task 1 coverage interfaces and Task 2 result interfaces.

- [ ] **Step 1: Add failing Markdown separation and gate tests**

Create `test/quality/report-quality.spec.ts`. Use a temporary directory and
fixture JSON files. Assert:

```ts
expect(renderQualityMarkdown(backendReport)).toContain(
  '# Backend coverage and e2e',
);
expect(renderQualityMarkdown(frontendUnitReport)).toContain(
  '# Frontend unit coverage',
);
expect(renderQualityMarkdown(frontendE2eReport)).toContain(
  '# Frontend Playwright e2e',
);
expect(renderQualityMarkdown(frontendE2eReport)).toContain(
  '| Clean pass rate | 100.00% |',
);
expect(
  [
    renderQualityMarkdown(backendReport),
    renderQualityMarkdown(frontendUnitReport),
    renderQualityMarkdown(frontendE2eReport),
  ].some((markdown) => markdown.includes('Combined coverage')),
).toBe(false);
```

Also assert missing input, malformed JSON, absent frontend baseline without
`--write-baseline`, and zero tests return a rejected promise containing the
affected stream name.

- [ ] **Step 2: Run the focused test and verify missing modules fail**

Run:

```powershell
npx jest --config ./test/jest-quality.json --runInBand test/quality/report-quality.spec.ts
```

Expected: FAIL because the render and CLI modules do not exist.

- [ ] **Step 3: Implement stable Markdown and JSON rendering**

Backend Markdown contains separate `## Unit coverage`, `## Unit tests`, and
`## Backend e2e` tables. Frontend unit Markdown contains coverage and unit-test
tables. Frontend e2e Markdown contains overall and per-project tables with
clean/eventual pass rates.

Every report includes:

```ts
{
  stream,
  generatedAt: new Date().toISOString(),
  toolVersions: {
    node: process.version,
  },
  coverage,
  tests,
  gate,
}
```

Do not render an aggregate across streams.

- [ ] **Step 4: Implement the CLI and GitHub summary behavior**

Read JSON with `readFile`, validate it through Tasks 1 and 2, write Markdown
and JSON with `mkdir(..., { recursive: true })`, and append Markdown to
`process.env.GITHUB_STEP_SUMMARY` when defined. `--write-baseline` updates only
the named stream with the ratchet function. `--check-only` performs no writes.
Set `process.exitCode = 1` for a failed quality gate or invalid input.
Require coverage plus unit and e2e input for `backend`, coverage plus unit input
for `frontend-unit`, and e2e input for `frontend-e2e`; reject extra or missing
stream inputs so one report cannot accidentally consume another stream.

Add scripts:

```json
"quality:report:backend": "ts-node --transpile-only scripts/quality/report-quality.ts --stream backend --coverage coverage/backend-unit/coverage-summary.json --unit-tests test-results/backend-unit.json --e2e-tests test-results/backend-e2e.json --baselines quality/coverage-baselines.json --markdown test-results/backend-summary.md --json test-results/backend-summary.json",
"quality:report:frontend-unit": "ts-node --transpile-only scripts/quality/report-quality.ts --stream frontend-unit --coverage frontend/coverage/coverage-summary.json --unit-tests frontend/test-results/vitest-results.json --baselines quality/coverage-baselines.json --markdown frontend/test-results/unit-summary.md --json frontend/test-results/unit-summary.json",
"quality:report:frontend-e2e": "ts-node --transpile-only scripts/quality/report-quality.ts --stream frontend-e2e --e2e-tests frontend/test-results/playwright-results.json --baselines quality/coverage-baselines.json --markdown frontend/test-results/e2e-summary.md --json frontend/test-results/e2e-summary.json"
```

- [ ] **Step 5: Verify passing, failing, malformed, missing, and zero-test fixtures**

Run:

```powershell
npm run test:quality-reporting
```

Expected: PASS for all parser, renderer, and CLI cases.

- [ ] **Step 6: Commit the report CLI**

```powershell
git add package.json scripts/quality/render-quality-report.ts scripts/quality/report-quality.ts test/quality/report-quality.spec.ts
git commit -m "test: add scoped quality report CLI"
```

---

### Task 4: Make backend coverage complete and report backend e2e results

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `quality/coverage-baselines.json`

**Interfaces:**
- Produces:
  - `coverage/backend-unit/coverage-summary.json`
  - `coverage/backend-unit/lcov.info`
  - `coverage/backend-unit/index.html`
  - `test-results/backend-unit.json`
  - `test-results/backend-e2e.json`
  - `test-results/backend-summary.{md,json}`
- Consumes: Task 3 `quality:report:backend`.

- [ ] **Step 1: Add an all-source denominator assertion to the quality tests**

Add a CLI fixture test that passes an expected backend file count of 88 and
fails with `backend-source-denominator-mismatch` when the coverage summary has
87 represented files. Extend CLI options with `--expected-files`.

- [ ] **Step 2: Run the assertion and verify it fails before implementation**

Run:

```powershell
npx jest --config ./test/jest-quality.json --runInBand test/quality/report-quality.spec.ts
```

Expected: FAIL because `--expected-files` is not implemented.

- [ ] **Step 3: Configure accurate backend unit coverage**

Update root Jest configuration:

```json
"collectCoverageFrom": [
  "**/*.ts",
  "!**/*.spec.ts"
],
"coverageDirectory": "../coverage/backend-unit",
"coverageReporters": [
  "text-summary",
  "json-summary",
  "lcov",
  "html"
]
```

Update scripts:

```json
"test:cov": "jest --coverage --runInBand --json --outputFile=test-results/backend-unit.json",
"test:e2e:report": "jest --config ./test/jest-e2e.json --runInBand --detectOpenHandles --json --outputFile=./test-results/backend-e2e.json",
"quality:report:backend": "ts-node --transpile-only scripts/quality/report-quality.ts --stream backend --coverage coverage/backend-unit/coverage-summary.json --unit-tests test-results/backend-unit.json --e2e-tests test-results/backend-e2e.json --baselines quality/coverage-baselines.json --expected-files 88 --markdown test-results/backend-summary.md --json test-results/backend-summary.json"
```

Add `/test-results` to `.gitignore`.

- [ ] **Step 4: Run backend coverage and confirm the denominator**

Run:

```powershell
npm run test:cov
```

Expected: 27 passing suites, 215 or more passing tests, and 88 represented
production files. If production files were added after the design baseline,
replace `88` in `--expected-files` with the actual `rg --files src -g '*.ts'
-g '!*.spec.ts'` count in the same commit.

- [ ] **Step 5: Run backend e2e and generate the scoped report**

Run:

```powershell
npm run test:e2e:report
npm run quality:report:backend
```

Expected: all backend e2e tests pass, the backend summary reports unit
coverage and e2e pass rate in separate subsections, and the gate passes.

- [ ] **Step 6: Reconfirm and ratchet the backend baseline**

Run the CLI with `--write-baseline`, then inspect the diff. The stored values
must equal or exceed 59.24 statements, 55.95 branches, 59.66 functions, and
59.58 lines. Run `npm run quality:report:backend -- --check-only` and expect
exit code 0.

- [ ] **Step 7: Commit backend measurement**

```powershell
git add .gitignore package.json quality/coverage-baselines.json scripts/quality/report-quality.ts test/quality/report-quality.spec.ts
git commit -m "test: report complete backend quality metrics"
```

---

### Task 5: Add all-source frontend Vitest coverage and its baseline

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/vitest.config.ts`
- Modify: `quality/coverage-baselines.json`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `frontend/coverage/coverage-summary.json`
  - `frontend/coverage/lcov.info`
  - `frontend/coverage/index.html`
  - `frontend/test-results/vitest-results.json`
  - `frontend/test-results/unit-summary.{md,json}`
- Consumes: Task 3 `quality:report:frontend-unit`.

- [ ] **Step 1: Install the matching V8 provider**

Run:

```powershell
npm install --save-dev --prefix frontend @vitest/coverage-v8@4.1.8
```

Expected: `frontend/package.json` and lockfile record version 4.1.8.

- [ ] **Step 2: Configure explicit all-source frontend coverage**

Replace the coverage block in `frontend/vitest.config.ts` with:

```ts
coverage: {
  provider: 'v8',
  include: ['src/**/*.{ts,tsx}'],
  exclude: [
    'src/**/*.test.{ts,tsx}',
    'src/**/*.spec.{ts,tsx}',
    'src/test/**',
    'src/**/*.d.ts',
    'src/main.tsx',
    'src/**/__generated__/**',
  ],
  reporter: ['text-summary', 'json-summary', 'lcov', 'html'],
  reportsDirectory: './coverage',
},
reporters: [
  'default',
  ['json', { outputFile: './test-results/vitest-results.json' }],
],
```

The exclusion list is deliberately narrow: routes, API clients, components,
providers, and router configuration remain in the denominator.

- [ ] **Step 3: Add frontend coverage scripts**

Add to `frontend/package.json`:

```json
"test:coverage": "vitest run --coverage"
```

Add to root `package.json`:

```json
"frontend:test:coverage": "npm run test:coverage --prefix frontend"
```

- [ ] **Step 4: Run coverage and verify every eligible frontend source file is represented**

Run:

```powershell
npm run frontend:test:coverage
```

Expected: 16 or more passing test files, 42 or more passing tests, and JSON,
LCOV, and HTML coverage output. Compare represented report paths with:

```powershell
rg --files frontend/src -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.test.tsx' -g '!*.spec.ts' -g '!*.spec.tsx' -g '!*.d.ts' -g '!main.tsx' -g '!test/**'
```

Resolve any mismatch by correcting the explicit include/exclude rules, not by
removing legitimate production files from the denominator.

- [ ] **Step 5: Establish and verify the frontend baseline**

Run:

```powershell
npm run quality:report:frontend-unit -- --write-baseline
npm run quality:report:frontend-unit -- --check-only
```

Expected: `quality/coverage-baselines.json` gains exact frontend statements,
branches, functions, and lines from the authoritative all-source run, and the
check passes. Review the summary to ensure it contains no backend percentage.

- [ ] **Step 6: Commit frontend unit measurement**

```powershell
git add package.json frontend/package.json frontend/package-lock.json frontend/vitest.config.ts quality/coverage-baselines.json
git commit -m "test: report frontend unit coverage"
```

---

### Task 6: Add Playwright pass-rate and flakiness reporting

**Files:**
- Modify: `frontend/playwright.config.ts`
- Modify: `frontend/package.json`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `frontend/test-results/playwright-results.json`
  - `frontend/playwright-report/index.html`
  - traces, screenshots, and videos under `frontend/test-results/playwright-artifacts`
  - `frontend/test-results/e2e-summary.{md,json}`
- Consumes: Task 3 `quality:report:frontend-e2e`.

- [ ] **Step 1: Add a failing nested-suite/project parser regression test**

Extend `test/quality/test-result-report.spec.ts` with nested suites containing
desktop, tablet, and mobile tests. Assert each project total and the overall
total equal the sum, so a Playwright schema traversal regression cannot
silently drop a project.

- [ ] **Step 2: Run the parser regression test**

Run:

```powershell
npx jest --config ./test/jest-quality.json --runInBand test/quality/test-result-report.spec.ts
```

Expected: FAIL if the Task 2 traversal does not aggregate nested projects;
otherwise confirm the regression is already protected and proceed.

- [ ] **Step 3: Configure Playwright JSON and diagnostic paths**

Update `frontend/playwright.config.ts`:

```ts
reporter: [
  ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ['list'],
  ['json', { outputFile: 'test-results/playwright-results.json' }],
],
outputDir: 'test-results/playwright-artifacts',
```

Keep the three existing Chromium projects, `trace: 'on-first-retry'`,
`screenshot: 'only-on-failure'`, and `video: 'retain-on-failure'`.

- [ ] **Step 4: Add report scripts**

Add to `frontend/package.json`:

```json
"test:e2e:report": "playwright test"
```

Add to root `package.json`:

```json
"frontend:test:e2e:report": "npm run test:e2e:report --prefix frontend"
```

- [ ] **Step 5: Run Playwright and generate its independent report**

Run:

```powershell
npm run frontend:test:e2e:report
npm run quality:report:frontend-e2e
```

Expected: zero final failures; desktop, tablet, and mobile project rows; a
clean pass rate; an eventual pass rate; explicit skipped/flaky counts; and no
unit coverage percentage.

- [ ] **Step 6: Commit frontend e2e reporting**

```powershell
git add package.json frontend/package.json frontend/playwright.config.ts test/quality/test-result-report.spec.ts
git commit -m "test: report frontend e2e pass rates"
```

---

### Task 7: Split GitHub Actions into three quality jobs

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes all report commands from Tasks 4–6.
- Produces GitHub job summaries and uniquely named artifacts:
  - `backend-quality-reports`
  - `frontend-unit-quality-reports`
  - `frontend-playwright-quality-reports`

- [ ] **Step 1: Replace the existing unit-test job with three independent jobs**

Create:

```yaml
backend-quality:
  name: Backend coverage & e2e

frontend-unit-quality:
  name: Frontend unit coverage

frontend-e2e-quality:
  name: Frontend Playwright e2e
```

Each job checks out the repository, uses Node.js 22 with the appropriate npm
cache, and installs only the dependencies it needs.

- [ ] **Step 2: Make backend test execution reportable even on failure**

Use separate backend unit and e2e steps with `continue-on-error: true`. Add an
`if: always()` report step invoking `npm run quality:report:backend`, followed
by `actions/upload-artifact@v4` with `if: always()` for:

```yaml
path: |
  coverage/backend-unit/
  test-results/backend-*.json
  test-results/backend-summary.md
```

Finish with an `if: always()` check-only report step. Missing JSON or any test
failure must make this final step nonzero.

- [ ] **Step 3: Add frontend unit coverage summary and artifact steps**

Run `npm run frontend:test:coverage` with `continue-on-error: true`, report
with `npm run quality:report:frontend-unit`, upload:

```yaml
path: |
  frontend/coverage/
  frontend/test-results/vitest-results.json
  frontend/test-results/unit-summary.*
```

Then run the check-only form as the final gate.

- [ ] **Step 4: Add Playwright runtime, summary, and artifacts**

Install Chromium with:

```yaml
- run: npx playwright install --with-deps chromium
  working-directory: frontend
```

Run the Playwright reporting command with `continue-on-error: true`, run the
quality reporter with `if: always()`, then upload:

```yaml
path: |
  frontend/playwright-report/
  frontend/test-results/playwright-results.json
  frontend/test-results/playwright-artifacts/
  frontend/test-results/e2e-summary.*
```

Finish with the check-only report gate.

- [ ] **Step 5: Make the build depend on all three quality jobs**

Set:

```yaml
needs:
  - backend-quality
  - frontend-unit-quality
  - frontend-e2e-quality
```

Keep CodeQL independent.

- [ ] **Step 6: Validate workflow syntax and all local equivalents**

Run:

```powershell
npm run test:quality-reporting
npm run test:cov
npm run test:e2e:report
npm run quality:report:backend
npm run frontend:test:coverage
npm run quality:report:frontend-unit
npm run frontend:test:e2e:report
npm run quality:report:frontend-e2e
npm run build
npm run frontend:build
```

Expected: every command exits 0 and each report remains scoped. Inspect the
workflow with a YAML parser available in the repository environment; otherwise
GitHub Actions is the authoritative syntax check on the branch.

- [ ] **Step 7: Commit CI quality gates**

```powershell
git add .github/workflows/ci.yml
git commit -m "ci: publish independent quality metrics"
```

---

### Task 8: Raise direct permission and token-session branch coverage

**Files:**
- Create: `src/auth/permissions.service.spec.ts`
- Modify: `src/auth/token-session.service.spec.ts`
- Modify: `quality/coverage-baselines.json`

**Interfaces:**
- Consumes public methods on `PermissionsService` and `TokenSessionService`.
- Produces behavior tests for permission parsing/context normalization and
  refresh-family denial/revocation/cookie boundaries.

- [ ] **Step 1: Add direct permission-context tests**

Cover:

```ts
it.each([undefined, '', '   '])('returns no permissions for empty scope %p', (scope) => {
  expect(service.permissionsFromScope(scope)).toEqual([]);
});

it('filters unknown permissions from scope and payload arrays', () => {
  expect(
    service.permissionsFromScope('catalog:read unknown members:read'),
  ).toEqual([AuthPermission.CatalogRead, AuthPermission.MembersRead]);
});

it('prefers embedded authContext and rejects incomplete request users', () => {
  expect(service.normalizeRequestContext()).toBeUndefined();
  expect(service.normalizeRequestContext({ id: 'staff-1' })).toBeUndefined();
  expect(service.normalizeRequestContext({ authContext })).toBe(authContext);
});

it('requires a context and at least one required permission', () => {
  expect(service.hasEveryPermission(undefined, [AuthPermission.CatalogRead])).toBe(false);
  expect(service.hasEveryPermission(authContext, [])).toBe(false);
});
```

Also cover staff default roles, member permissions, payload permission
precedence, `auth_version`, audience arrays, and role-review output.

- [ ] **Step 2: Run the permission tests and inspect focused coverage**

Run:

```powershell
npx jest --runInBand auth/permissions.service.spec.ts --coverage --collectCoverageFrom=auth/permissions.service.ts --coverageReporters=text
```

Expected: PASS and at least 85% branch coverage for
`permissions.service.ts`.

- [ ] **Step 3: Add token-session edge tests**

Extend existing fixtures to cover:

- malformed refresh credentials rejected before database mutation;
- missing/expired/revoked families return the same generic denial;
- inactive subject and stale `authVersion` revoke the family;
- `resolveFamilyId` returns no raw hash or token;
- `revokeFamily` and `revokeSubject` are idempotent;
- cookie `Max-Age` clamps at zero and development `Secure` differs from
  production while scope attributes remain identical;
- reconciliation query failure is contained by the scheduled callback and the
  next interval remains available.

- [ ] **Step 4: Run focused token-session tests and coverage**

Run:

```powershell
npx jest --runInBand auth/token-session.service.spec.ts --coverage --collectCoverageFrom=auth/token-session.service.ts --coverageReporters=text
```

Expected: PASS and branch coverage rises from 65.04% to at least 80%.

- [ ] **Step 5: Run all backend unit coverage and ratchet**

Run:

```powershell
npm run test:cov
npm run quality:report:backend -- --write-baseline
```

Expected: all backend unit tests pass and no baseline dimension decreases.

- [ ] **Step 6: Commit the permission/session coverage wave**

```powershell
git add src/auth/permissions.service.spec.ts src/auth/token-session.service.spec.ts quality/coverage-baselines.json
git commit -m "test: cover permission and session branches"
```

---

### Task 9: Raise identifier repair and reconciliation branch coverage

**Files:**
- Modify: `src/auth/auth-identifier-repair.service.spec.ts`
- Modify: `src/auth/auth-identifier-reconciliation.service.spec.ts`
- Modify: `quality/coverage-baselines.json`

**Interfaces:**
- Consumes `dryRun`, `apply`, `cancel`, `onApplicationBootstrap`,
  `onApplicationShutdown`, `reconcileOnce`, and `renewLease`.
- Produces tests for authorization boundaries, idempotency, terminal states,
  leasing, and bounded failure recovery.

- [ ] **Step 1: Add repair dry-run and idempotency tests**

Add cases proving:

- `dryRun` authorizes without mutating operation, batch, identifier, staff, or
  member models;
- a manifest-key-policy denial fails before operation lookup;
- applying an already completed operation returns its redacted stored result
  without preparing or activating batches;
- a resume with a different manifest hash fails closed;
- cancellation of an already terminal operation is idempotent;
- compensation stops and leaves a retryable state when authorization expires
  between batches.

Use the existing `createFixture()` and spies; assert both returned status and
absence/presence of every mutation boundary.

- [ ] **Step 2: Run focused repair coverage**

Run:

```powershell
npx jest --runInBand auth/auth-identifier-repair.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-repair.service.ts --coverageReporters=text
```

Expected: PASS and branch coverage rises from 20.90% to at least 60% in this
wave.

- [ ] **Step 3: Add lifecycle and recovery tests for reconciliation**

Cover:

- bootstrap skips work until required migrations are ready;
- bootstrap starts one bounded interval after readiness;
- shutdown clears the interval exactly once;
- concurrent `reconcileOnce` calls share one in-flight promise;
- lease renewal returns false after ownership loss;
- unknown/invalid operation transitions fail terminally with a redacted event;
- an individual operation failure does not prevent the remaining bounded batch
  from being attempted;
- a missing audit key makes no data changes.

- [ ] **Step 4: Run focused reconciliation coverage**

Run:

```powershell
npx jest --runInBand auth/auth-identifier-reconciliation.service.spec.ts --coverage --collectCoverageFrom=auth/auth-identifier-reconciliation.service.ts --coverageReporters=text
```

Expected: PASS and branch coverage rises from 45.63% to at least 70%.

- [ ] **Step 5: Run backend unit/e2e regression and ratchet**

Run:

```powershell
npm run test:cov
npm run test:e2e:report
npm run quality:report:backend -- --write-baseline
```

Expected: all tests pass, backend e2e remains at 100% eventual pass rate, and
the baseline only increases.

- [ ] **Step 6: Commit identifier coverage**

```powershell
git add src/auth/auth-identifier-repair.service.spec.ts src/auth/auth-identifier-reconciliation.service.spec.ts quality/coverage-baselines.json
git commit -m "test: cover identifier recovery branches"
```

---

### Task 10: Raise member and borrowing business-rule coverage

**Files:**
- Modify: `src/members/members.service.spec.ts`
- Modify: `src/borrowings/borrowings.service.spec.ts`
- Modify: `quality/coverage-baselines.json`

**Interfaces:**
- Consumes public `MembersService` and `BorrowingsService` methods.
- Produces observable tests for credentials, member lifecycle, borrowing
  creation/return, ownership, lookup, and overdue queries.

- [ ] **Step 1: Add missing member lifecycle and credential tests**

Cover:

- `findByLoginIdentifierWithPassword` normalizes member number/email and
  selects password/auth fields;
- `findActiveById` rejects inactive and missing accounts identically to its
  public contract;
- `touchLastLogin` uses an atomic timestamp update;
- `setMemberCredentials` normalizes the login identifier, writes only the
  password hash, bumps `authVersion`, and records the actor;
- credential conflicts do not partially update the member;
- `bumpAuthVersion` handles missing members and increments exactly once;
- updating without membership/status changes skips unnecessary policy
  validation.

- [ ] **Step 2: Run focused member coverage**

Run:

```powershell
npx jest --runInBand members/members.service.spec.ts --coverage --collectCoverageFrom=members/members.service.ts --coverageReporters=text
```

Expected: PASS and branches rise from 33.87% to at least 70%.

- [ ] **Step 3: Add borrowing creation, return, and lookup tests**

Extend `createService` so each dependency can be injected. Cover:

- successful create validates member policy, active book/category, and
  availability before saving and incrementing loan count;
- a failed save does not increment loan count or mark a book unavailable;
- successful return marks returned timestamp/state and decrements loan count
  once;
- duplicate return is rejected without a second decrement;
- `findOne`, `findOneForMember`, `findOverdue`, and `findByMember` apply exact
  ownership/state filters;
- malformed/missing borrowing IDs follow the service's not-found contract;
- pagination uses the requested skip/limit values.

- [ ] **Step 4: Run focused borrowing coverage**

Run:

```powershell
npx jest --runInBand borrowings/borrowings.service.spec.ts --coverage --collectCoverageFrom=borrowings/borrowings.service.ts --coverageReporters=text
```

Expected: PASS and lines rise from 40.57% to at least 75%, with branch coverage
at least 75%.

- [ ] **Step 5: Run complete backend quality and ratchet**

Run:

```powershell
npm run test:cov
npm run test:e2e:report
npm run quality:report:backend -- --write-baseline
```

Expected: backend overall line and branch coverage move toward or exceed 75%,
all backend e2e tests pass, and no baseline decreases.

- [ ] **Step 6: Commit member/borrowing coverage**

```powershell
git add src/members/members.service.spec.ts src/borrowings/borrowings.service.spec.ts quality/coverage-baselines.json
git commit -m "test: cover member and borrowing rules"
```

---

### Task 11: Raise frontend API, session, routing, and error coverage

**Files:**
- Create: `frontend/src/lib/api/client.test.ts`
- Create: `frontend/src/lib/api/errors.test.ts`
- Modify: `frontend/src/lib/auth/session.test.ts`
- Modify: `frontend/src/lib/auth/route-guards.test.ts`
- Modify: `frontend/src/lib/api/auth.test.ts`
- Modify: `quality/coverage-baselines.json`

**Interfaces:**
- Consumes `apiRequest`, `apiClient`, `ApiClientError`, `toMutationError`,
  `authSession`, and route guards.
- Produces tests for every shared request/response/error/authentication branch.

- [ ] **Step 1: Add API client request and response tests**

Mock `fetch` and cover:

```ts
it('adds JSON and bearer headers while keeping credentialed cookies', async () => {
  authSession.set(authenticatedSession);
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ id: 'book-1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );

  await apiClient.post('/books', { title: 'Refactoring' });

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/books'),
    expect.objectContaining({
      credentials: 'include',
      method: 'POST',
      body: JSON.stringify({ title: 'Refactoring' }),
      headers: expect.any(Headers),
    }),
  );
});
```

Also cover `auth: false`, caller-provided content type, 204 responses, text
responses, array validation messages, fallback status text, 401 session
clearing, non-401 preservation, and GET/PATCH/DELETE wrappers.

- [ ] **Step 2: Add error-view branch tests**

Create table-driven tests for `ApiClientError` statuses 400, 401, 403, 409,
500, plus an unknown error. For 400, assert array messages map to field names
and malformed single-word messages do not create a field entry.

- [ ] **Step 3: Extend session, auth API, and route-guard branches**

Cover:

- refresh replaces all token metadata but preserves no previous token;
- concurrent refresh callers share the intended session outcome;
- logout-all clears all query keys even after a server error;
- route guards reject absent role area, missing permission, and cross-area
  sessions;
- generic login failures never expose server-provided identifier details;
- `auth/me` and refresh 401 responses clear session exactly once.

- [ ] **Step 4: Run focused frontend tests**

Run:

```powershell
npm run test --prefix frontend -- src/lib/api/client.test.ts src/lib/api/errors.test.ts src/lib/auth/session.test.ts src/lib/auth/route-guards.test.ts src/lib/api/auth.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 5: Run all-source frontend coverage and ratchet**

Run:

```powershell
npm run frontend:test:coverage
npm run quality:report:frontend-unit -- --write-baseline
```

Expected: the frontend baseline only increases and the report remains separate
from backend metrics.

- [ ] **Step 6: Commit frontend behavior coverage**

```powershell
git add frontend/src/lib/api/client.test.ts frontend/src/lib/api/errors.test.ts frontend/src/lib/auth/session.test.ts frontend/src/lib/auth/route-guards.test.ts frontend/src/lib/api/auth.test.ts quality/coverage-baselines.json
git commit -m "test: cover frontend API and auth branches"
```

---

### Task 12: Cover frontend user states and accessibility-sensitive behavior

**Files:**
- Modify: `frontend/src/features/auth/shared-login.test.tsx`
- Modify: `frontend/src/features/auth/staff-role-management.test.tsx`
- Modify: `frontend/src/features/auth/identifier-conflicts.test.tsx`
- Modify: `frontend/src/features/member-home/member-home.test.tsx`
- Modify: `frontend/src/components/data-table/data-table.test.tsx`
- Modify: `frontend/tests/e2e/accessibility.spec.ts`
- Modify: `frontend/tests/e2e/shared-sign-in.spec.ts`
- Modify: `frontend/tests/e2e/staff-role-management.spec.ts`
- Modify: `quality/coverage-baselines.json`

**Interfaces:**
- Consumes existing public components and Playwright user flows.
- Produces component and browser tests for loading, retry, forbidden, conflict,
  focus, keyboard, and responsive state boundaries.

- [ ] **Step 1: Add component tests for uncovered state transitions**

Add behavior tests for:

- shared login retry after generic failure, invalid form focus, pending-button
  semantics, and returned role-area mismatch;
- role-management loading, empty, API failure, conflict, successful refresh,
  and forbidden controls;
- identifier-conflict loading, retryable failure, stale conflict response,
  successful completion, and manual-repair-only state;
- member home API failure/retry, inactive/suspended status, zero allowance,
  overdue priority, and returned-item exclusion;
- data-table page boundaries, disabled navigation, safe error copy, and
  keyboard-operable row actions.

Use MSW handlers and user-visible role/name assertions; do not inspect
component internals.

- [ ] **Step 2: Run the focused component tests**

Run:

```powershell
npm run test --prefix frontend -- src/features/auth/shared-login.test.tsx src/features/auth/staff-role-management.test.tsx src/features/auth/identifier-conflicts.test.tsx src/features/member-home/member-home.test.tsx src/components/data-table/data-table.test.tsx
```

Expected: all focused tests pass with no unhandled MSW request.

- [ ] **Step 3: Strengthen Playwright critical-path assertions**

Add browser assertions for:

- keyboard-only shared sign-in and focus on the announced generic error;
- member/staff/admin role-area routing from the server response;
- forbidden role-management navigation and absence of mutation controls;
- successful role assignment reflected after refresh;
- no access or refresh token in local/session storage after sign-in/sign-out;
- desktop, tablet, and mobile project execution remains enabled.

- [ ] **Step 4: Run all frontend unit and Playwright quality streams**

Run:

```powershell
npm run frontend:test:coverage
npm run quality:report:frontend-unit -- --write-baseline
npm run frontend:test:e2e:report
npm run quality:report:frontend-e2e
```

Expected: frontend unit coverage increases, Playwright has zero final failures,
and flaky/skipped tests are explicit.

- [ ] **Step 5: Commit frontend user-state coverage**

```powershell
git add frontend/src/features/auth/shared-login.test.tsx frontend/src/features/auth/staff-role-management.test.tsx frontend/src/features/auth/identifier-conflicts.test.tsx frontend/src/features/member-home/member-home.test.tsx frontend/src/components/data-table/data-table.test.tsx frontend/tests/e2e/accessibility.spec.ts frontend/tests/e2e/shared-sign-in.spec.ts frontend/tests/e2e/staff-role-management.spec.ts quality/coverage-baselines.json
git commit -m "test: cover frontend user state transitions"
```

---

### Task 13: Add changed-line coverage and document the ratchet workflow

**Files:**
- Create: `scripts/quality/changed-line-coverage.ts`
- Create: `test/quality/changed-line-coverage.spec.ts`
- Modify: `scripts/quality/report-quality.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Produces:
  - `parseChangedLines(unifiedDiff: string): Map<string, Set<number>>`
  - `parseLcov(raw: string): Map<string, Map<number, number>>`
  - `evaluateChangedLineCoverage(changed, lcov, minimum = 80): ChangedCoverageGate`
- Consumes separate backend and frontend LCOV files and the pull-request diff
  against the target branch.

- [ ] **Step 1: Add failing unified-diff and LCOV tests**

Create fixtures containing added executable lines, deleted lines, renamed
files, untested changed lines, and a file absent from LCOV. Assert only added
line numbers are evaluated and absent executable coverage fails closed.

```ts
expect(
  evaluateChangedLineCoverage(
    new Map([['src/example.ts', new Set([10, 11, 12, 13, 14])]]),
    new Map([
      ['src/example.ts', new Map([[10, 1], [11, 1], [12, 1], [13, 1], [14, 0]])],
    ]),
    80,
  ),
).toMatchObject({ passed: true, pct: 80, covered: 4, total: 5 });
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```powershell
npx jest --config ./test/jest-quality.json --runInBand test/quality/changed-line-coverage.spec.ts
```

Expected: FAIL because the changed-line module does not exist.

- [ ] **Step 3: Implement path-normalized changed-line coverage**

Normalize slash direction and strip repository prefixes without lowercasing
case-sensitive paths. Evaluate backend changes only against backend LCOV and
frontend changes only against frontend LCOV. Exclude non-executable changed
lines absent from LCOV only when their file is represented and LCOV contains no
line record; fail when a changed production file is wholly absent from its
expected report.

- [ ] **Step 4: Add pull-request-only 80% gates**

Fetch sufficient target-branch history in CI, generate:

```powershell
git diff --unified=0 "$env:GITHUB_BASE_SHA...$env:GITHUB_SHA"
```

or its Ubuntu-shell equivalent into a report input. Run changed-line
evaluation separately in backend and frontend unit jobs only for pull
requests. Require at least 80% changed-line coverage for each affected scope;
an unaffected scope reports `not-applicable` and passes.

- [ ] **Step 5: Document commands and metric semantics**

In `README.md`, document:

- the three reporting streams;
- exact local commands;
- coverage denominator/exclusions;
- e2e pass-rate formulas and skipped/flaky semantics;
- baseline ratcheting rules;
- 75% overall, 80% changed-line, and 85–90% critical-branch targets;
- artifact locations;
- the rule that baselines are never lowered to make CI green.

- [ ] **Step 6: Run final verification**

Run:

```powershell
npm run test:quality-reporting
npm run test:cov
npm run test:e2e:report
npm run quality:report:backend
npm run frontend:test:coverage
npm run quality:report:frontend-unit
npm run frontend:test:e2e:report
npm run quality:report:frontend-e2e
npm run lint
npm run frontend:lint
npm run build
npm run frontend:build
git diff --check
```

Expected: all commands exit 0, all e2e streams have zero final failures, all
coverage dimensions meet their ratcheted baselines, changed backend/frontend
fixtures meet their independent 80% gate, and no summary combines scopes.

- [ ] **Step 7: Commit changed-line gates and documentation**

```powershell
git add scripts/quality/changed-line-coverage.ts test/quality/changed-line-coverage.spec.ts scripts/quality/report-quality.ts .github/workflows/ci.yml README.md
git commit -m "ci: gate changed-line test coverage"
```

---

## Completion Criteria

- Three independent CI summaries exist and are readable without downloading
  artifacts.
- Backend and frontend coverage percentages have independent denominators and
  checked-in baselines.
- Backend Jest e2e and frontend Playwright e2e expose pass/fail/skip counts;
  Playwright additionally exposes flaky counts and clean/eventual pass rates.
- JSON, LCOV, HTML, trace, screenshot, and video artifacts are retained in
  their appropriate jobs.
- Missing, malformed, and zero-test outputs fail their stream.
- Backend and frontend baseline values cannot be automatically lowered.
- Backend permission/token-session critical branches reach at least 80–85%;
  repair/reconciliation reach the staged targets; member/borrowing branches
  reach at least 70–75%.
- Frontend API/auth and user-state coverage increases the checked-in baseline.
- Pull requests enforce at least 80% changed-line coverage independently for
  affected backend and frontend code.
- All test, lint, build, report, and workflow checks pass.
