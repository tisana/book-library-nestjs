# Task 01 Evidence
## Task

Pin `@stryker-mutator/core` and `@stryker-mutator/jest-runner` exactly at `9.6.1` and prove compatibility without upgrading Jest or ts-jest.

## Implementer model and reasoning

Requested and actual implementer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task1_implementer`; substitution none.

## Reviewer model and reasoning

The initial evidence recorded the requested fresh `gpt-5.6-sol`, high-reasoning reviewer with identity pending controller dispatch. The controller then dispatched the requested and actual fresh reviewer: `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task1_reviewer`; substitution none. Initial verdict: **Needs fixes** with three Important evidence findings, preserved under `## Reviewer decision`.

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
@'
const fs = require('fs');
const assert = require('assert');
const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const corePackage = readJson('node_modules/@stryker-mutator/core/package.json');
const jestPackage = readJson('node_modules/@stryker-mutator/jest-runner/package.json');
const coreSchema = readJson('node_modules/@stryker-mutator/core/schema/stryker-schema.json');
const jestSchema = readJson('node_modules/@stryker-mutator/jest-runner/dist/schema/jest-runner-options.json');
const mutationSyntax = ':startLine[:startColumn]-endLine[:endColumn]';
const mutationExample = 'src/index.js:1:3-1:5';
assert(coreSchema.properties.mutate.description.includes(mutationSyntax));
assert(coreSchema.properties.mutate.description.includes(mutationExample));
const evidence = {
  installedVersions: { core: corePackage.version, jestRunner: jestPackage.version },
  jestRunnerPeerDependencies: jestPackage.peerDependencies,
  coverageAnalysis: {
    default: coreSchema.properties.coverageAnalysis.default,
    enum: coreSchema.definitions.coverageAnalysis.enum,
  },
  jestRunner: {
    description: jestSchema.properties.jest.description,
    projectTypeDefault: jestSchema.properties.jest.properties.projectType.default,
    projectTypes: jestSchema.definitions.jestProjectType.enum,
    configFileType: jestSchema.properties.jest.properties.configFile.type,
    customConfigType: jestSchema.properties.jest.properties.config.type,
  },
  reporters: {
    default: coreSchema.properties.reporters.default,
    htmlReporterRef: coreSchema.properties.htmlReporter.$ref,
    jsonReporterRef: coreSchema.properties.jsonReporter.$ref,
  },
  mutationRanges: {
    type: coreSchema.properties.mutate.type,
    itemType: coreSchema.properties.mutate.items.type,
    documentedSyntax: mutationSyntax,
    documentedExample: mutationExample,
  },
  thresholdBreak: coreSchema.definitions.mutationScoreThresholds.properties.break,
};
console.log(JSON.stringify(evidence, null, 2));
assert.deepStrictEqual(evidence.installedVersions, { core: '9.6.1', jestRunner: '9.6.1' });
assert(evidence.coverageAnalysis.enum.includes('perTest'));
assert(evidence.jestRunner.projectTypes.includes('custom'));
assert.strictEqual(evidence.jestRunner.configFileType, 'string');
assert.strictEqual(evidence.jestRunner.customConfigType, 'object');
assert.strictEqual(evidence.reporters.htmlReporterRef, '#/definitions/htmlReporterOptions');
assert.strictEqual(evidence.reporters.jsonReporterRef, '#/definitions/jsonReporterOptions');
assert(evidence.thresholdBreak.oneOf.some((option) => option.$ref === '#/definitions/percentage'));
'@ | node -
$code=$LASTEXITCODE
Write-Output "SCHEMA_AUDIT_EXIT=$code"
exit $code
# exit 0

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

The preceding compact output was the initial selected-value record. Fix Round 1 reran the now-recorded exact command and produced this complete exact output:

```text
{
  "installedVersions": {
    "core": "9.6.1",
    "jestRunner": "9.6.1"
  },
  "jestRunnerPeerDependencies": {
    "@stryker-mutator/core": "9.6.1"
  },
  "coverageAnalysis": {
    "default": "perTest",
    "enum": [
      "off",
      "all",
      "perTest"
    ]
  },
  "jestRunner": {
    "description": "Configuration for @stryker-mutator/jest-runner",
    "projectTypeDefault": "custom",
    "projectTypes": [
      "create-react-app",
      "custom"
    ],
    "configFileType": "string",
    "customConfigType": "object"
  },
  "reporters": {
    "default": [
      "clear-text",
      "progress",
      "html"
    ],
    "htmlReporterRef": "#/definitions/htmlReporterOptions",
    "jsonReporterRef": "#/definitions/jsonReporterOptions"
  },
  "mutationRanges": {
    "type": "array",
    "itemType": "string",
    "documentedSyntax": ":startLine[:startColumn]-endLine[:endColumn]",
    "documentedExample": "src/index.js:1:3-1:5"
  },
  "thresholdBreak": {
    "oneOf": [
      {
        "type": "null"
      },
      {
        "$ref": "#/definitions/percentage"
      }
    ],
    "default": null
  }
}
SCHEMA_AUDIT_EXIT=0
```

Fix Round 1 deterministic base-to-current lock graph audit command:

```powershell
@'
const fs = require('fs');
const cp = require('child_process');
const baseSha = 'a61d4e80e2b9d96e1e63c9475efa8f64b74cad63';
const base = JSON.parse(cp.execFileSync('git', ['show', `${baseSha}:package-lock.json`], { encoding: 'utf8' }));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const roots = ['node_modules/@stryker-mutator/core', 'node_modules/@stryker-mutator/jest-runner'];
const resolve = (from, name) => {
  let at = from;
  for (;;) {
    const candidate = at ? `${at}/node_modules/${name}` : `node_modules/${name}`;
    if (lock.packages[candidate]) return candidate;
    if (!at) return null;
    const index = at.lastIndexOf('/node_modules/');
    at = index < 0 ? '' : at.slice(0, index);
  }
};
const predecessor = new Map(roots.map((root) => [root, null]));
const queue = [...roots];
while (queue.length) {
  const from = queue.shift();
  const pkg = lock.packages[from];
  const dependencies = { ...(pkg.dependencies || {}), ...(pkg.optionalDependencies || {}) };
  for (const name of Object.keys(dependencies).sort()) {
    const to = resolve(from, name);
    if (to && !predecessor.has(to)) {
      predecessor.set(to, from);
      queue.push(to);
    }
  }
}
const display = (node) => `${node.replace(/(^|\/)node_modules\//g, '$1')}@${lock.packages[node].version}`;
const pathFor = (node) => {
  if (!predecessor.has(node)) return null;
  const path = [];
  for (let current = node; current; current = predecessor.get(current)) path.push(display(current));
  return path.reverse().join(' -> ');
};
const packageNodes = Object.keys(lock.packages).filter(Boolean).sort();
const changedExisting = packageNodes
  .filter((node) => base.packages[node] && base.packages[node].version !== lock.packages[node].version)
  .map((node) => ({
    node,
    before: base.packages[node].version,
    after: lock.packages[node].version,
    strykerPath: pathFor(node),
  }));
const addedPackageNodes = packageNodes.filter((node) => !base.packages[node]);
const addedStrykerNodes = addedPackageNodes
  .filter((node) => /(^|\/)node_modules\/@stryker-mutator\/[^/]+$/.test(node))
  .map((node) => ({ node, version: lock.packages[node].version, strykerPath: pathFor(node) }));
const unexplainedChanged = changedExisting.filter((entry) => !entry.strykerPath);
const unexplainedAdded = addedPackageNodes.filter((node) => !pathFor(node));
console.log(JSON.stringify({ changedExisting, addedStrykerNodes }, null, 2));
console.log(`CHANGED_EXISTING_COUNT=${changedExisting.length}`);
console.log(`UNEXPLAINED_CHANGED_COUNT=${unexplainedChanged.length}`);
console.log(`ADDED_PACKAGE_NODE_COUNT=${addedPackageNodes.length}`);
console.log(`ADDED_STRYKER_NODE_COUNT=${addedStrykerNodes.length}`);
console.log(`UNEXPLAINED_ADDED_COUNT=${unexplainedAdded.length}`);
if (changedExisting.length !== 13 || unexplainedChanged.length || unexplainedAdded.length) process.exit(1);
'@ | node -
$code=$LASTEXITCODE
Write-Output "DEPENDENCY_GRAPH_AUDIT_EXIT=$code"
exit $code
```

Complete output:

```text
{
  "changedExisting": [
    {
      "node": "node_modules/@babel/code-frame",
      "before": "7.29.0",
      "after": "7.29.7",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/core@7.29.0 -> @babel/code-frame@7.29.7"
    },
    {
      "node": "node_modules/@babel/generator",
      "before": "7.29.1",
      "after": "7.29.8",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/generator@7.29.8"
    },
    {
      "node": "node_modules/@babel/helper-globals",
      "before": "7.28.0",
      "after": "7.29.7",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/core@7.29.0 -> @babel/traverse@7.29.8 -> @babel/helper-globals@7.29.7"
    },
    {
      "node": "node_modules/@babel/helper-module-imports",
      "before": "7.28.6",
      "after": "7.29.7",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/core@7.29.0 -> @babel/helper-module-transforms@7.29.7 -> @babel/helper-module-imports@7.29.7"
    },
    {
      "node": "node_modules/@babel/helper-module-transforms",
      "before": "7.28.6",
      "after": "7.29.7",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/core@7.29.0 -> @babel/helper-module-transforms@7.29.7"
    },
    {
      "node": "node_modules/@babel/helper-plugin-utils",
      "before": "7.28.6",
      "after": "7.29.7",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/plugin-proposal-decorators@7.29.7 -> @babel/helper-plugin-utils@7.29.7"
    },
    {
      "node": "node_modules/@babel/helper-string-parser",
      "before": "7.27.1",
      "after": "7.29.7",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/core@7.29.0 -> @babel/types@7.29.8 -> @babel/helper-string-parser@7.29.7"
    },
    {
      "node": "node_modules/@babel/helper-validator-identifier",
      "before": "7.28.5",
      "after": "7.29.7",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/core@7.29.0 -> @babel/code-frame@7.29.7 -> @babel/helper-validator-identifier@7.29.7"
    },
    {
      "node": "node_modules/@babel/parser",
      "before": "7.29.0",
      "after": "7.29.8",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/parser@7.29.8"
    },
    {
      "node": "node_modules/@babel/plugin-syntax-typescript",
      "before": "7.28.6",
      "after": "7.29.7",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/preset-typescript@7.28.5 -> @babel/plugin-transform-typescript@7.29.7 -> @babel/plugin-syntax-typescript@7.29.7"
    },
    {
      "node": "node_modules/@babel/template",
      "before": "7.28.6",
      "after": "7.29.7",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/core@7.29.0 -> @babel/template@7.29.7"
    },
    {
      "node": "node_modules/@babel/traverse",
      "before": "7.29.0",
      "after": "7.29.8",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/core@7.29.0 -> @babel/traverse@7.29.8"
    },
    {
      "node": "node_modules/@babel/types",
      "before": "7.29.0",
      "after": "7.29.8",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1 -> @babel/core@7.29.0 -> @babel/types@7.29.8"
    }
  ],
  "addedStrykerNodes": [
    {
      "node": "node_modules/@stryker-mutator/api",
      "version": "9.6.1",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/api@9.6.1"
    },
    {
      "node": "node_modules/@stryker-mutator/core",
      "version": "9.6.1",
      "strykerPath": "@stryker-mutator/core@9.6.1"
    },
    {
      "node": "node_modules/@stryker-mutator/instrumenter",
      "version": "9.6.1",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/instrumenter@9.6.1"
    },
    {
      "node": "node_modules/@stryker-mutator/jest-runner",
      "version": "9.6.1",
      "strykerPath": "@stryker-mutator/jest-runner@9.6.1"
    },
    {
      "node": "node_modules/@stryker-mutator/util",
      "version": "9.6.1",
      "strykerPath": "@stryker-mutator/core@9.6.1 -> @stryker-mutator/util@9.6.1"
    }
  ]
}
CHANGED_EXISTING_COUNT=13
UNEXPLAINED_CHANGED_COUNT=0
ADDED_PACKAGE_NODE_COUNT=83
ADDED_STRYKER_NODE_COUNT=5
UNEXPLAINED_ADDED_COUNT=0
DEPENDENCY_GRAPH_AUDIT_EXIT=0
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

`cbd19a9f7567fe654d1dd1b6178dda5fd6d7ba3a` (`build: pin selective mutation tooling`). The distinct evidence-only commit is intentionally not recorded here.

## Deferred findings

- npm reports `8` audit findings (`1 low`, `3 moderate`, `4 high`) and four install scripts pending `allowScripts` review. Task 1 does not run `npm audit fix`, approve scripts, or change unrelated dependencies.
- No mutation score is produced in Task 1; the tracked raw baseline and survivor gates remain unchanged.

## Reviewer decision

The initial evidence recorded reviewer dispatch as pending and the implementer self-review as clean. The controller subsequently dispatched the requested and actual fresh reviewer `gpt-5.6-sol`, high reasoning, identity `/root/plan5_task1_reviewer`; substitution none. Initial verdict: **Needs fixes** with these three Important findings:

1. The installed-schema audit does not record the exact command. It substitutes `node -e '<read and print ...>'`, contrary to the requirement to record commands and exact outputs.
2. Add a deterministic audit enumerating all 13 changed packages, their before/after versions, and Stryker dependency paths. The existing audit verifies only direct manifest/root and four installed nodes, so it does not establish “requested packages and transitives only.”
3. The report and progress ledger leave actual reviewer identity and decision pending; backfill this review outcome before Task 1 can satisfy evidence headings.

### Fix Round 1 report (2026-08-09)

All three Important findings are addressed for fresh re-review without changing `package.json`, `package-lock.json`, production code, tests, or Task 2+ artifacts.

- Finding 1: the placeholder was replaced above by the complete PowerShell here-string/Node installed-schema command actually rerun. It exited `0`; its complete exact JSON output is preserved above and ends `SCHEMA_AUDIT_EXIT=0`.
- Finding 2: the complete deterministic base-to-current lock graph command and output are preserved above. It compares `a61d4e80e2b9d96e1e63c9475efa8f64b74cad63:package-lock.json` to the current lock, resolves Node package paths deterministically, enumerates all 13 pre-existing before/after changes and their Stryker paths, enumerates all five new `@stryker-mutator/*` nodes, traverses every one of the 83 added package nodes, and exits `0` with `CHANGED_EXISTING_COUNT=13`, `UNEXPLAINED_CHANGED_COUNT=0`, `ADDED_PACKAGE_NODE_COUNT=83`, `ADDED_STRYKER_NODE_COUNT=5`, `UNEXPLAINED_ADDED_COUNT=0`, and `DEPENDENCY_GRAPH_AUDIT_EXIT=0`. No unrelated churn required restoration.
- Finding 3: `## Reviewer model and reasoning`, this decision chronology, and the append-only progress ledger now identify requested/actual fresh reviewer `gpt-5.6-sol`, high reasoning, `/root/plan5_task1_reviewer`, substitution none, with the initial Needs fixes verdict and all findings.

Covering exact pin/lock command:

```powershell
@'
const fs = require('fs');
const cp = require('child_process');
const assert = require('assert');
const base = JSON.parse(cp.execFileSync('git', ['show', 'a61d4e80e2b9d96e1e63c9475efa8f64b74cad63:package-lock.json'], { encoding: 'utf8' }));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const evidence = {
  manifest: {
    core: pkg.devDependencies['@stryker-mutator/core'],
    jestRunner: pkg.devDependencies['@stryker-mutator/jest-runner'],
  },
  lockRoot: {
    core: lock.packages[''].devDependencies['@stryker-mutator/core'],
    jestRunner: lock.packages[''].devDependencies['@stryker-mutator/jest-runner'],
  },
  lockNodes: {
    core: lock.packages['node_modules/@stryker-mutator/core'].version,
    jestRunner: lock.packages['node_modules/@stryker-mutator/jest-runner'].version,
    jest: lock.packages['node_modules/jest'].version,
    tsJest: lock.packages['node_modules/ts-jest'].version,
  },
  unchangedTestSpecs: {
    jest: `${base.packages[''].devDependencies.jest} -> ${lock.packages[''].devDependencies.jest}`,
    tsJest: `${base.packages[''].devDependencies['ts-jest']} -> ${lock.packages[''].devDependencies['ts-jest']}`,
  },
};
console.log(JSON.stringify(evidence, null, 2));
assert.deepStrictEqual(Object.values(evidence.manifest), ['9.6.1', '9.6.1']);
assert.deepStrictEqual(Object.values(evidence.lockRoot), ['9.6.1', '9.6.1']);
assert.deepStrictEqual([evidence.lockNodes.core, evidence.lockNodes.jestRunner], ['9.6.1', '9.6.1']);
assert.strictEqual(lock.packages[''].devDependencies.jest, base.packages[''].devDependencies.jest);
assert.strictEqual(lock.packages[''].devDependencies['ts-jest'], base.packages[''].devDependencies['ts-jest']);
'@ | node -
$pin=$LASTEXITCODE
Write-Output "PIN_LOCK_AUDIT_EXIT=$pin"
npx --no-install stryker --version
$version=$LASTEXITCODE
Write-Output "STRYKER_VERSION_EXIT=$version"
npm ls @stryker-mutator/core @stryker-mutator/jest-runner jest ts-jest --depth=0
$tree=$LASTEXITCODE
Write-Output "INSTALLED_TREE_EXIT=$tree"
if ($pin -ne 0 -or $version -ne 0 -or $tree -ne 0) { exit 1 }
exit 0
```

Covering output and exits:

```text
{
  "manifest": { "core": "9.6.1", "jestRunner": "9.6.1" },
  "lockRoot": { "core": "9.6.1", "jestRunner": "9.6.1" },
  "lockNodes": { "core": "9.6.1", "jestRunner": "9.6.1", "jest": "30.2.0", "tsJest": "29.4.6" },
  "unchangedTestSpecs": { "jest": "^30.2.0 -> ^30.2.0", "tsJest": "^29.4.6 -> ^29.4.6" }
}
PIN_LOCK_AUDIT_EXIT=0
9.6.1
STRYKER_VERSION_EXIT=0
book-library@0.0.1 E:\dev\workspaces\nestjs\book-library-nestjs\.worktrees\wave-c-plan5-selective-mutation
+-- @stryker-mutator/core@9.6.1
+-- @stryker-mutator/jest-runner@9.6.1
+-- jest@30.2.0
`-- ts-jest@29.4.6
INSTALLED_TREE_EXIT=0
```

Ownership command and output:

```powershell
$changed=@(git diff --name-only); $changed | ForEach-Object { $_ }; $allowed=@('.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md','.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-01.md'); $unexpected=@($changed | Where-Object { $_ -notin $allowed }); Write-Output "CHANGED_FILE_COUNT=$($changed.Count)"; Write-Output "UNEXPECTED_FILE_COUNT=$($unexpected.Count)"; git diff --check; $check=$LASTEXITCODE; Write-Output "DIFF_CHECK_EXIT=$check"; if ($unexpected.Count -or $check -ne 0) { exit 1 }; exit 0
```

```text
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/progress.md
.superpowers/sdd/2026-07-31-plan-5-selective-mutation-testing/task-01.md
CHANGED_FILE_COUNT=2
UNEXPECTED_FILE_COUNT=0
DIFF_CHECK_EXIT=0
```

Fix Round 1 implementer result: all three findings addressed; fresh reviewer decision pending.
