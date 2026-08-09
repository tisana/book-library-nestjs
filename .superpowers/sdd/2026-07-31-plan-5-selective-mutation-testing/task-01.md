# Task 01 Evidence
## Task

Pin `@stryker-mutator/core` and `@stryker-mutator/jest-runner` exactly at `9.6.1` and prove compatibility without upgrading Jest or ts-jest.

## Implementer model and reasoning

Requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task1_implementer`; substitution none.

## Reviewer model and reasoning

Requested reviewer: fresh `gpt-5.6-sol`, high reasoning; identity pending controller dispatch; substitution none.

## Base SHA

`b678209e23ef7020c21ff565327de1b229c835f6`

## Files changed

- `package.json`
- `package-lock.json`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-01.md`
- `.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md`

No selected production service, Jest configuration, test source, mutation configuration, or Task 2+ artifact was changed.

## RED command and exit

```powershell
npm ls jest ts-jest --depth=0
# exit 0; 821 ms

npx --no-install stryker --version
# exit 1; 1288 ms
```

## RED evidence

Existing direct test-tool versions before installation:

```text
book-library@0.0.1 E:\dev\workspaces\nestjs\book-library-nestjs\.worktrees\wave-c-plan5-selective-mutation
+-- jest@30.2.0
`-- ts-jest@29.4.6
```

The required Stryker absence/not-9.6.1 check failed as expected:

```text
npm error npx canceled due to missing packages and no YES option: ["stryker@1.0.1"]
npm error A complete log of this run can be found in: C:\Users\tisan\AppData\Local\npm-cache\_logs\2026-08-09T09_54_47_935Z-debug-0.log
```

## GREEN command and exit

The prescribed install command was run exactly:

```powershell
npm install --save-dev @stryker-mutator/core@9.6.1 @stryker-mutator/jest-runner@9.6.1
# exit 0; 8696 ms
```

npm initially wrote caret ranges. They were corrected with `apply_patch` to exact `9.6.1` in `package.json` and the root package entry of `package-lock.json`. Lock consistency was then checked:

```powershell
npm install --package-lock-only --ignore-scripts
# exit 0; 1988 ms
```

Exact Task 1 GREEN sequence:

```powershell
npx --no-install stryker --version
# exit 0; 1592 ms

npm ls @stryker-mutator/core @stryker-mutator/jest-runner jest ts-jest --depth=0
# exit 0; 748 ms

git diff -- package.json package-lock.json
# exit 0; 61 ms

npx jest --runInBand auth/token-session.service.spec.ts
# exit 0; 5975 ms
```

Fresh post-correction verification immediately before commit repeated the same required checks: Stryker version exit `0` in `1460 ms`; installed-tree exit `0` in `736 ms`; exact package/lock diff exit `0` in `108 ms`; focused Jest exit `0` in `3586 ms`.

Installed-package schema audit:

```powershell
node -e '<read and print the installed core and Jest-runner package versions and selected JSON schema fields>'
# exit 0; 110 ms

rg -n "declareClassPlugin\(PluginKind\.Reporter, '(html|json)'|under breaking threshold|exitCode = 1" node_modules/@stryker-mutator/core/dist/src/reporters/index.js node_modules/@stryker-mutator/core/dist/src/reporters/mutation-test-report-helper.js
# exit 0

$lines=Get-Content -LiteralPath 'node_modules\@stryker-mutator\core\dist\src\reporters\mutation-test-report-helper.js'; 114..123 | ForEach-Object { '{0}: {1}' -f $_, $lines[$_-1] }
# exit 0
```

## GREEN evidence

Install output:

```text
added 83 packages, changed 13 packages, and audited 885 packages in 8s
161 packages are looking for funding
8 vulnerabilities (1 low, 3 moderate, 4 high)
__INSTALL_EXIT=0
__INSTALL_MS=8696
```

The exact version and direct installed tree after installation:

```text
9.6.1
book-library@0.0.1 E:\dev\workspaces\nestjs\book-library-nestjs\.worktrees\wave-c-plan5-selective-mutation
+-- @stryker-mutator/core@9.6.1
+-- @stryker-mutator/jest-runner@9.6.1
+-- jest@30.2.0
`-- ts-jest@29.4.6
```

The complete `git diff -- package.json package-lock.json` command exited `0`; its exact package/lock content is preserved by the implementation commit. The manifest diff adds only these direct dependency lines:

```diff
+    "@stryker-mutator/core": "9.6.1",
+    "@stryker-mutator/jest-runner": "9.6.1",
```

The clean direct-dependency and lock audit exited `0` with this exact output:

```json
{
  "manifest": {
    "strykerCore": "9.6.1",
    "strykerJestRunner": "9.6.1",
    "jestBefore": "^30.2.0",
    "jestAfter": "^30.2.0",
    "tsJestBefore": "^29.4.6",
    "tsJestAfter": "^29.4.6"
  },
  "lockRoot": {
    "strykerCore": "9.6.1",
    "strykerJestRunner": "9.6.1",
    "jestBefore": "^30.2.0",
    "jestAfter": "^30.2.0",
    "tsJestBefore": "^29.4.6",
    "tsJestAfter": "^29.4.6"
  },
  "lockNodes": {
    "strykerCore": "9.6.1",
    "strykerJestRunner": "9.6.1",
    "jest": "30.2.0",
    "tsJest": "29.4.6"
  }
}
__DIRECT_LOCK_AUDIT_EXIT=0
```

The installed `9.6.1` package/schema audit exited `0` and printed these exact capability-bearing values:

```text
"installedVersions": { "core": "9.6.1", "jestRunner": "9.6.1" }
"jestRunnerPeerDependencies": { "@stryker-mutator/core": "9.6.1" }
"coverageAnalysis": {
  "property": { "default": "perTest" },
  "definition": { "title": "CoverageAnalysis", "type": "string", "enum": ["off", "all", "perTest"] }
}
"jestRunner": {
  "property": {
    "description": "Configuration for @stryker-mutator/jest-runner",
    "properties": {
      "projectType": { "$ref": "#/definitions/jestProjectType", "default": "custom" },
      "configFile": { "description": "Path to your Jest config file. Please leave it empty if you want jest configuration to be loaded from package.json or a standard jest configuration file.", "type": "string" },
      "config": { "description": "A custom Jest configuration object. You could also use `require` to load it here.", "type": "object" }
    }
  },
  "projectType": { "enum": ["create-react-app", "custom"] }
}
"reporters": {
  "property": { "description": "With reporters, you can set the reporters for stryker to use.", "type": "array", "items": { "type": "string" }, "default": ["clear-text", "progress", "html"] },
  "htmlReporter": { "description": "The options for the html reporter", "$ref": "#/definitions/htmlReporterOptions", "default": {} },
  "jsonReporter": { "description": "The options for the json reporter", "$ref": "#/definitions/jsonReporterOptions", "default": {} }
}
"mutationRanges": {
  "description": "It is possible to specify exactly which code blocks to mutate by means of a _mutation range_. This can be done postfixing your file with `:startLine[:startColumn]-endLine[:endColumn]`. Example: src/index.js:1:3-1:5",
  "type": "array",
  "items": { "type": "string" }
}
"thresholds": {
  "property": { "description": "Specify the thresholds for mutation score.", "$ref": "#/definitions/mutationScoreThresholds", "default": {} },
  "definition": {
    "properties": {
      "break": { "oneOf": [{ "type": "null" }, { "$ref": "#/definitions/percentage" }], "default": null }
    }
  }
}
__SCHEMA_EXIT=0
__SCHEMA_MS=110
```

The installed runtime registration and threshold-breaking implementation printed exactly:

```text
node_modules/@stryker-mutator/core/dist/src/reporters/index.js:17:    declareClassPlugin(PluginKind.Reporter, 'html', HtmlReporter),
node_modules/@stryker-mutator/core/dist/src/reporters/index.js:18:    declareClassPlugin(PluginKind.Reporter, 'json', JsonReporter),
114:     determineExitCode(metrics) {
115:         const { mutationScore } = metrics.systemUnderTestMetrics.metrics;
116:         const breaking = this.options.thresholds.break;
117:         const formattedScore = mutationScore.toFixed(2);
118:         if (typeof breaking === 'number') {
119:             if (mutationScore < breaking) {
120:                 this.log.error(`Final mutation score ${formattedScore} under breaking threshold ${breaking}, setting exit code to 1 (failure).`);
121:                 this.log.info('(improve mutation score or set `thresholds.break = null` to prevent this error in the future)');
122:                 objectUtils.setExitCode(1);
123:             }
```

## Focused metrics

Focused Jest output:

```text
PASS src/auth/token-session.service.spec.ts
Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
Snapshots:   0 total
Time:        4.86 s, estimated 5 s
Ran all test suites matching auth/token-session.service.spec.ts.
```

Fresh pre-commit rerun: `1` suite passed, `25/25` tests passed, `0` snapshots, exit `0`, Jest-reported time `2.552 s`.

## Full-suite commands and exits

No full-suite command is required for Task 1. The prescribed focused Jest compatibility suite exited `0`; existing independent coverage, changed-line, frontend, E2E, runtime, and survivor gates were not replaced or weakened.

## Runtime evidence

- RED `npm ls jest ts-jest --depth=0`: `821 ms`.
- RED `npx --no-install stryker --version`: `1288 ms`.
- Exact pinned install: `8696 ms`.
- Initial GREEN version check: `1592 ms`.
- Initial GREEN installed-tree check: `748 ms`.
- Initial GREEN package/lock diff: `61 ms`.
- Initial GREEN focused Jest: `5975 ms`.
- Installed-schema audit: `110 ms`.
- Lockfile-only consistency check: `1988 ms`.
- Fresh post-correction version/tree/diff/Jest verification: `1460 ms`, `736 ms`, `108 ms`, and `3586 ms` respectively.

Every Task 1 command is below the `300000 ms` smoke ceiling. Mutation execution has not begun; the future complete-run ceiling remains `900000 ms` on Ubuntu 24.04/Node 22.

## Commit hash

Pending implementation commit.

## Deferred findings

- npm reports `8` audit findings (`1 low`, `3 moderate`, `4 high`) and four install scripts pending `allowScripts` review. Task 1 does not run `npm audit fix`, approve scripts, or change unrelated dependencies.
- No mutation score is produced in Task 1; the tracked raw baseline and survivor gates remain unchanged.

## Reviewer decision

Pending independent fresh reviewer dispatch by the controller. Implementer self-review confirms exact `9.6.1` direct specs and lock nodes, unchanged Jest/ts-jest direct specs and installed versions, only Task 1 package/lock/evidence scope, no selected production-service edits, and no Task 2+ work.
