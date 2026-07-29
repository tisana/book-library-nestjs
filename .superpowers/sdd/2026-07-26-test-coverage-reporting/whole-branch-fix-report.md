# Whole-Branch Coverage Reporting Fix Report

Date: 2026-07-29

Branch: `codex/test-coverage-reporting`

Implementation commit: `480bd87 fix(ci): close coverage reporting gate gaps`

## Scope and outcome

This final fix wave closes the remaining changed-line, producer-failure,
schema-validation, provenance, CI, and documentation gaps without lowering
either coverage baseline.

- Backend changed-line eligibility now matches backend executable coverage:
  production `src/**/*.ts`, excluding test/spec/declaration files and the
  authorized erased type-only
  `src/books/interfaces/book.interface.ts`.
- Frontend changed-line eligibility now matches `frontend/vitest.config.ts`:
  production `frontend/src/**/*.{ts,tsx}`, excluding test/spec files,
  `src/test/`, declarations, bootstrap, generated sources, and non-TypeScript
  assets.
- LCOV parsing receives an explicit backend/frontend scope. Backend `SF:src/...`
  remains `src/...`; frontend Vitest `SF:src/...` is rebased to
  `frontend/src/...`. Slash direction is normalized without changing case.
- Eligible production files wholly absent from LCOV still fail closed.
- Jest/Vitest reports strictly require and validate suite counts. Any failed
  suite fails the gate even when all reported tests passed.
- Playwright reports strictly require a top-level `errors` array. Nonempty
  global runner errors fail the gate and retain concise diagnostics in JSON and
  Markdown.
- Reports include represented source-file counts, Jest/Vitest suite counts,
  producer tool/version, and exact source commands without combining scopes.
- A repeatable, strictly validated `--producer-outcome name=outcome` input makes
  the final report gate fail on any preserved non-success producer outcome.
- CI now preserves backend unit/e2e, frontend lint/unit, and frontend
  Playwright step outcomes in both always-run publication and final always-run
  gates. Artifact names, always-run uploads, pull-request changed-line behavior,
  and push/non-PR behavior remain independent and unchanged.
- `frontend/public/` remained untracked and untouched. No progress ledger was
  edited.

## RED/GREEN evidence

### Changed-line scope and LCOV normalization

RED:

```text
npx jest --config ./test/jest-quality.json --runInBand test/quality/changed-line-coverage.spec.ts
FAIL TS2554: Expected 1 arguments, but got 2 (explicit frontend LCOV scope)
```

The report-level whole-repository simulation then reproduced the real false
failure:

```text
npx jest --config ./test/jest-quality.json --runInBand test/quality/report-quality.spec.ts -t "runs both changed-line gates"
FAIL frontend-unit: ... missing-lcov:frontend/src/view.tsx
```

GREEN:

```text
npx jest --config ./test/jest-quality.json --runInBand test/quality/changed-line-coverage.spec.ts
PASS, 14 tests

npx jest --config ./test/jest-quality.json --runInBand test/quality/report-quality.spec.ts -t "runs both changed-line gates"
PASS
```

The fixtures include backend/frontend production files, backend/frontend test
files, backend erased type-only source, frontend test support, declarations,
bootstrap, generated source, and CSS. They independently prove affected 80%,
excluded-only `not-applicable`, and eligible-missing-file fail-closed behavior.
The frontend fixture uses real Vitest-style `SF:src\view.tsx`.

### Suite and Playwright global failures

RED:

```text
npx jest --config ./test/jest-quality.json --runInBand test/quality/test-result-report.spec.ts
FAIL TS2339: Property 'globalErrors' does not exist on type 'TestRunSummary'
```

GREEN:

```text
npx jest --config ./test/jest-quality.json --runInBand test/quality/test-result-report.spec.ts
PASS, 19 tests
```

The focused cases prove:

- one passed test plus one failed Jest/Vitest suite fails with
  `failed-suites:1`;
- one passed Playwright test plus one top-level runner error fails with
  `global-errors:1`;
- missing or inconsistent Jest/Vitest suite counts fail schema validation;
- missing, non-array, or malformed Playwright top-level errors fail schema
  validation.

### Provenance, rendered diagnostics, and producer outcomes

RED:

```text
npx jest --config ./test/jest-quality.json --runInBand test/quality/report-quality.spec.ts -t "normalizes backend|failed-suite diagnostics|top-level error diagnostics"
FAIL TS2339: Property 'sources' does not exist on type 'QualityReport'

npx jest --config ./test/jest-quality.json --runInBand test/quality/report-quality.spec.ts -t "preserved producer outcome"
FAIL invalid-quality-report:--producer-outcome
```

GREEN:

```text
npx jest --config ./test/jest-quality.json --runInBand test/quality/report-quality.spec.ts -t "normalizes backend|failed-suite diagnostics|top-level error diagnostics"
PASS, 3 focused tests

npx jest --config ./test/jest-quality.json --runInBand test/quality/report-quality.spec.ts -t "preserved producer outcome"
PASS
```

The report fixtures verify installed package-derived Jest, Vitest, and
Playwright versions; exact source commands; represented file count; suite
tables; global error text; JSON/Markdown failure output; and a clean parsed
report that still fails when an original producer outcome is `failure`.

## Full verification evidence

All successful commands below were run fresh in
`E:\dev\workspaces\nestjs\book-library-nestjs\.worktrees\test-coverage-reporting`.

| Command                                                        | Result                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| `npm run test:quality-reporting`                               | PASS: 4 suites, 66 tests                                              |
| `npm run test:cov`                                             | PASS: 28 suites, 293 tests; 87 represented backend files              |
| `npm run test:e2e:report`                                      | PASS: 29 suites, 242 tests                                            |
| `npm run quality:report:backend`                               | PASS; no gate reasons/warnings                                        |
| `npm run frontend:test:coverage`                               | PASS: 21 Vitest files, 89 tests; 65 represented frontend files        |
| `npm run quality:report:frontend-unit`                         | PASS; no gate reasons/warnings                                        |
| `npm run frontend:test:e2e:report`                             | PASS: 86 passed, 1 expected skipped, 0 failed across 87 project tests |
| `npm run quality:report:frontend-e2e`                          | PASS; 0 global errors, no gate reasons/warnings                       |
| `npm run lint`                                                 | PASS                                                                  |
| `npm run frontend:lint`                                        | PASS                                                                  |
| `npx eslint scripts/quality/*.ts test/quality/*.ts`            | PASS                                                                  |
| `npm run build`                                                | PASS                                                                  |
| `npm run frontend:build`                                       | PASS; TypeScript and Vite production build                            |
| pinned Prettier YAML parse                                     | PASS: `workflow-yaml-ok`                                              |
| `npx prettier --check ...` on all changed implementation files | PASS                                                                  |
| `git diff --check` and `git diff --cached --check`             | PASS                                                                  |

Fresh overall coverage remained at the checked-in baselines or higher:

| Scope    | Statements | Branches | Functions |  Lines |
| -------- | ---------: | -------: | --------: | -----: |
| Backend  |     68.24% |   65.64% |    70.57% | 68.82% |
| Frontend |     47.00% |   44.03% |    41.08% | 48.27% |

No baseline value changed.

### Actual full-feature changed-line simulation

The complete branch plus working-tree diff against `master` was generated and
checked against the fresh real LCOV files:

```text
git diff --unified=0 master --output=test-results/full-feature.diff
npm run quality:report:backend -- --check-only --changed-line-diff test-results/full-feature.diff --changed-line-lcov coverage/backend-unit/lcov.info
npm run quality:report:frontend-unit -- --check-only --changed-line-diff test-results/full-feature.diff --changed-line-lcov frontend/coverage/lcov.info
```

Exact independent results:

| Scope    | Covered / total | Coverage | Missing eligible files | Gate |
| -------- | --------------: | -------: | ---------------------: | ---- |
| Backend  |         68 / 82 |   82.92% |                      0 | PASS |
| Frontend |         47 / 50 |   94.00% |                      0 | PASS |

This is the requested proof that the actual feature diff no longer false-fails
because of excluded test files or frontend LCOV path roots.

## Files in implementation commit

- `.github/workflows/ci.yml`
- `README.md`
- `scripts/quality/changed-line-coverage.ts`
- `scripts/quality/render-quality-report.ts`
- `scripts/quality/report-quality.ts`
- `scripts/quality/test-result-report.ts`
- `test/quality/changed-line-coverage.spec.ts`
- `test/quality/report-quality.spec.ts`
- `test/quality/test-result-report.spec.ts`

This report is added in a follow-up evidence-only commit so it can cite the
immutable implementation commit hash exactly.

## Concerns and tooling notes

- Playwright intentionally skipped the mobile Chromium instance of the
  staff-list performance smoke test; the other 86 project tests passed, with
  zero failures, flakes, or top-level errors.
- The optional standalone Node `yaml` package was not installed, so one
  attempted ad hoc `require('yaml')` validation failed before parsing. The
  workflow was then successfully parsed with the repository's installed pinned
  Prettier YAML parser, and the full Prettier check passed.
- Git emitted only the repository's existing LF-to-CRLF checkout warnings.
  Both whitespace checks passed.
- Generated coverage, test-result, Playwright, and build outputs are ignored
  and were not staged.
