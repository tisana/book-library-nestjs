import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, mock, test } from 'node:test';

const require = createRequire(import.meta.url);
const DefaultRunner = require('jest-runner').default;
const RUNNER_PATH = join(
  process.cwd(),
  'scripts/quality/mutation-jest-runner.cjs',
);
const Runner = existsSync(RUNNER_PATH) ? require(RUNNER_PATH) : DefaultRunner;
const roots = [];
after(() =>
  roots.forEach((root) => rmSync(root, { recursive: true, force: true })),
);

function fixture(owned = true, shard = 'token-session', profile = 'smoke') {
  const root = mkdtempSync(join(tmpdir(), 'mutation-jest-runner-'));
  roots.push(root);
  const sandbox = owned
    ? join(
        root,
        `reports/mutation/${profile}/shards/${shard}/.stryker-tmp/sandbox-proof`,
      )
    : root;
  const rootDir = join(sandbox, 'src');
  mkdirSync(join(rootDir, 'auth'), { recursive: true });
  const sourcePath = join(
    rootDir,
    shard === 'members'
      ? 'members/members.service.ts'
      : 'auth/token-session.service.ts',
  );
  mkdirSync(dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, 'export class Service {}');
  const config = {
    rootDir,
    testRegex: '.spec.ts$',
    testLocationInResults: true,
  };
  const tests = [shard, 'caller'].map((name) => {
    const path = join(rootDir, 'auth', `${name}.spec.ts`);
    writeFileSync(path, `// ${name} test declaration`);
    return { path, context: { config } };
  });
  return {
    root,
    rootDir,
    sandbox,
    tests,
    inventory: join(sandbox, `.${shard}-test-inventory.json`),
  };
}

async function harness(work) {
  const original = process.env.__STRYKER_ACTIVE_MUTANT__;
  const listeners = new WeakMap();
  const dispatches = [];
  mock.method(DefaultRunner.prototype, 'on', function (event, callback) {
    const handlers = listeners.get(this) ?? new Map();
    handlers.set(event, callback);
    listeners.set(this, handlers);
    return () => {};
  });
  mock.method(DefaultRunner.prototype, 'runTests', async function (tests) {
    dispatches.push(tests.map((test) => test.path));
    if (this.failure) throw this.failure;
    for (const [index, entry] of tests.entries()) {
      if (this.partial && index) continue;
      listeners.get(this)?.get('test-file-success')?.([
        entry,
        {
          testResults: [
            {
              fullName: entry.path.includes('caller')
                ? 'Caller shared behavior'
                : entry.path.endsWith('/members.spec.ts')
                  ? 'MembersService behavior'
                  : 'TokenSessionService behavior',
              status: this.status ?? 'passed',
            },
          ],
        },
      ]);
    }
  });
  try {
    delete process.env.__STRYKER_ACTIVE_MUTANT__;
    await work({
      dispatches,
      async run(f, pattern, options = {}) {
        const runner = new Runner({ testNamePattern: pattern });
        Object.assign(runner, options);
        await runner.runTests(f.tests, {}, { serial: true });
        return dispatches.at(-1);
      },
    });
  } finally {
    mock.restoreAll();
    if (original === undefined) delete process.env.__STRYKER_ACTIVE_MUTANT__;
    else process.env.__STRYKER_ACTIVE_MUTANT__ = original;
  }
}

// Would fail if either cold worker reloads a pending-only caller suite.
test('both cold runners dispatch exactly matching baseline test IDs', async () => {
  assert.ok(
    existsSync(RUNNER_PATH),
    'supported mutation runner must be implemented',
  );
  await harness(async ({ run }) => {
    const f = fixture();
    assert.deepEqual(
      await run(f),
      f.tests.map((test) => test.path),
    );
    assert.ok(existsSync(f.inventory));
    f.tests[0].context.config.testLocationInResults = false;
    process.env.__STRYKER_ACTIVE_MUTANT__ = '1';
    assert.deepEqual(await run(f, 'TokenSessionService behavior'), [
      f.tests[0].path,
    ]);
    assert.deepEqual(await run(f, 'caller SHARED behavior'), [f.tests[1].path]);
    assert.deepEqual(
      await run(f, 'TokenSessionService behavior|Caller shared behavior'),
      f.tests.map((test) => test.path),
    );
  });
});

test('static, unknown and invalid patterns retain every original suite', async () => {
  await harness(async ({ run }) => {
    const f = fixture();
    await run(f);
    process.env.__STRYKER_ACTIVE_MUTANT__ = '1';
    for (const pattern of [undefined, '', 'unknown test name', '['])
      assert.deepEqual(
        await run(f, pattern),
        f.tests.map((test) => test.path),
      );
  });
});

for (const change of [
  'missing',
  'corrupt',
  'incomplete',
  'invalid names',
  'extra path',
  'test content',
  'source content',
  'project config',
  'unknown suite',
]) {
  test(`${change} inventory falls back to all original suites`, async () => {
    await harness(async ({ run }) => {
      const f = fixture();
      await run(f);
      if (change === 'missing') rmSync(f.inventory);
      else if (change === 'corrupt') writeFileSync(f.inventory, '{');
      else if (['incomplete', 'invalid names', 'extra path'].includes(change)) {
        const inventory = JSON.parse(readFileSync(f.inventory));
        if (change === 'incomplete') delete inventory.names[f.tests[1].path];
        if (change === 'invalid names') inventory.names[f.tests[1].path] = [7];
        if (change === 'extra path')
          inventory.names[join(f.root, 'escape.spec.ts')] = ['unsafe'];
        writeFileSync(f.inventory, JSON.stringify(inventory));
      } else if (change === 'test content')
        writeFileSync(f.tests[1].path, '// changed declaration');
      else if (change === 'source content')
        writeFileSync(
          join(f.rootDir, 'auth/token-session.service.ts'),
          '// changed module',
        );
      else if (change === 'project config')
        f.tests[0].context.config.testRegex = 'other';
      else if (change === 'unknown suite') {
        const path = join(f.rootDir, 'auth/new.spec.ts');
        writeFileSync(path, '// new suite');
        f.tests.push({ path, context: f.tests[0].context });
      }
      process.env.__STRYKER_ACTIVE_MUTANT__ = '1';
      assert.deepEqual(
        await run(f, 'TokenSessionService behavior'),
        f.tests.map((test) => test.path),
      );
    });
  });
}

for (const condition of [
  'active',
  'pending',
  'failed',
  'partial',
  'patterned',
  'unowned',
]) {
  test(`${condition} baseline cannot publish inventory`, async () => {
    await harness(async ({ run }) => {
      const f = fixture(condition !== 'unowned');
      if (condition === 'active') process.env.__STRYKER_ACTIVE_MUTANT__ = '1';
      await run(
        f,
        condition === 'patterned' ? 'TokenSessionService' : undefined,
        {
          status:
            condition === 'pending'
              ? 'pending'
              : condition === 'failed'
                ? 'failed'
                : 'passed',
          partial: condition === 'partial',
        },
      );
      assert.equal(existsSync(f.inventory), false);
    });
  });
}

test('inventory publication errors preserve all-suite execution and original errors', async () => {
  await harness(async ({ run }) => {
    const f = fixture();
    mkdirSync(f.inventory);
    assert.deepEqual(
      await run(f),
      f.tests.map((test) => test.path),
    );
    const failure = new Error('original module initialization failure');
    await assert.rejects(
      run(f, undefined, { failure }),
      (error) => error === failure,
    );
    process.env.__STRYKER_ACTIVE_MUTANT__ = '1';
    assert.deepEqual(
      await run(f, 'TokenSessionService behavior'),
      f.tests.map((test) => test.path),
    );
  });
});

test('escaping test paths cannot publish or prune original execution', async () => {
  await harness(async ({ run }) => {
    const f = fixture();
    const escaped = join(f.root, 'outside.spec.ts');
    writeFileSync(escaped, '// outside');
    f.tests.push({ path: escaped, context: f.tests[0].context });
    assert.deepEqual(
      await run(f),
      f.tests.map((test) => test.path),
    );
    assert.equal(existsSync(f.inventory), false);
  });
});

// Executes the real public Jest API: matching IDs stay equal and static import
// failures are reported in both suites even after successful inventory reuse.
for (const [shard, profile, ownName] of [
  ['token-session', 'smoke', 'TokenSessionService behavior'],
  ['members', 'complete', 'MembersService behavior'],
])
  test(`real Jest ${shard} preserves selected IDs, caller coverage and static initializer errors`, () => {
    const f = fixture(true, shard, profile);
    const source =
      shard === 'members'
        ? 'members/members.service.ts'
        : 'auth/token-session.service.ts';
    writeFileSync(
      join(f.rootDir, source),
      "if(process.env.__STRYKER_ACTIVE_MUTANT__!==undefined)throw new Error('static-initializer-control');exports.value=1;",
    );
    for (const [index, entry] of f.tests.entries())
      writeFileSync(
        entry.path,
        `const source=require(${JSON.stringify(join(f.rootDir, source))});test('${index ? 'Caller shared behavior' : ownName}',()=>expect(source.value).toBe(1));`,
      );
    const script = join(f.root, 'real-jest-proof.cjs');
    writeFileSync(
      script,
      `
const assert=require('node:assert/strict');
const jest=require(${JSON.stringify(require.resolve('jest'))});
const config={rootDir:${JSON.stringify(f.rootDir)},moduleFileExtensions:['js','json','ts'],testRegex:'.spec.ts$',transform:{},testEnvironment:'node',silent:true,reporters:[]};
async function run(runner,pattern){const {results}=await jest.runCLI({$0:'runner-regression',_:[],runInBand:true,silent:true,testNamePattern:pattern,config:JSON.stringify({...config,...(runner?{runner}: {})})},[config.rootDir]);return {suites:results.testResults.map(s=>s.testFilePath).sort(),executed:results.testResults.flatMap(s=>s.testResults.filter(t=>['passed','failed'].includes(t.status)).map(t=>[s.testFilePath,t.fullName,t.status])).sort(),errors:results.numRuntimeErrorTestSuites};}
(async()=>{
const runner=${JSON.stringify(RUNNER_PATH)};
const baseline=await run(runner);assert.equal(baseline.executed.length,2);
for(const pattern of [${JSON.stringify(ownName)},'Caller shared behavior']){const control=await run(null,pattern),candidate=await run(runner,pattern);assert.deepEqual(candidate.executed,control.executed);assert.equal(candidate.executed.length,1);assert.equal(candidate.suites.length,1);assert.equal(control.suites.length,2);}
const unknown=await run(runner,'unknown test');assert.equal(unknown.suites.length,2);
process.env.__STRYKER_ACTIVE_MUTANT__='1';const control=await run(null),candidate=await run(runner);assert.equal(control.errors,2);assert.equal(candidate.errors,2);assert.deepEqual(candidate.suites,control.suites);
process.stdout.write(JSON.stringify({baseline:2,matchingPatterns:2,staticErrors:2}));
})().catch(error=>{console.error(error);process.exitCode=1});
`,
    );
    const proof = spawnSync(
      process.execPath,
      ['--experimental-vm-modules', script],
      { encoding: 'utf8', timeout: 20000 },
    );
    assert.equal(proof.status, 0, proof.stderr);
    assert.match(proof.stdout, /"staticErrors":2/);
  });

test('symlinked inventory cannot import test names from outside the owned sandbox', async () => {
  await harness(async ({ run }) => {
    const f = fixture();
    await run(f);
    const outside = join(f.root, 'foreign-inventory.json');
    writeFileSync(outside, readFileSync(f.inventory));
    rmSync(f.inventory);
    symlinkSync(outside, f.inventory);
    process.env.__STRYKER_ACTIVE_MUTANT__ = '1';
    assert.deepEqual(
      await run(f, 'TokenSessionService behavior'),
      f.tests.map((test) => test.path),
    );
    assert.deepEqual(readFileSync(outside), readFileSync(f.inventory));
  });
});

// Would fail if the supported runner refuses members complete, or trusts a
// different source or profile instead of the exact two-shard allow map.
test('trusted members complete reuses baseline and binds its exact source', async () => {
  await harness(async ({ run }) => {
    const f = fixture(true, 'members', 'complete');
    await run(f);
    assert.ok(
      existsSync(f.inventory),
      'members complete baseline must publish',
    );
    process.env.__STRYKER_ACTIVE_MUTANT__ = '1';
    assert.deepEqual(await run(f, 'MembersService behavior'), [
      f.tests[0].path,
    ]);
    assert.deepEqual(await run(f, 'Caller shared behavior'), [f.tests[1].path]);
    writeFileSync(
      join(f.rootDir, 'members/members.service.ts'),
      '// source drift',
    );
    assert.deepEqual(
      await run(f, 'MembersService behavior'),
      f.tests.map((t) => t.path),
    );
  });
});

test('members smoke and unknown shards cannot publish or prune inventory', async () => {
  await harness(async ({ run }) => {
    for (const [shard, profile] of [
      ['members', 'smoke'],
      ['borrowings', 'complete'],
    ]) {
      const f = fixture(true, shard, profile);
      await run(f);
      assert.equal(existsSync(f.inventory), false);
      assert.deepEqual(
        await run(f, 'Caller shared behavior'),
        f.tests.map((t) => t.path),
      );
    }
  });
});
