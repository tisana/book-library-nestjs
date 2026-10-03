// Execute the actual verifier body; substitute only external dependencies and
// expose its existing entry-point promise so success and failure both settle.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const root = resolve(new URL('../../../../../', import.meta.url).pathname);
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
const source = readFileSync(
  process.env.IMAGE_VERIFIER_PROBE_SOURCE ??
    resolve(root, 'scripts/quality/verify-production-image.ts'),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
assert.equal(compiled.split('void main().catch').length, 2);
const entry = compiled.replace(
  'void main().catch',
  'globalThis.verification = main().catch',
);
const named = (name) => Object.assign(Error('synthetic failure'), { name });

async function probe(options = {}) {
  const events = [];
  const errors = [];
  const logs = [];
  const secret = 'a'.repeat(48) + 'SYNTHETICTAIL1234';
  const fixture = {
    uri: 'mongodb://127.0.0.1:1234/synthetic',
    password: 'synthetic-password',
    environment: { JWT_SECRET: secret, AUTH_AUDIT_KEYS: 'synthetic-audit-key' },
    mongo: {
      stop: async () => {
        events.push('mongo-stop');
      },
    },
    stop: async () => {
      events.push('fixture-stop');
      if (options.stopFailure) throw named('FixtureCleanupFailure');
    },
  };
  let launched = 0;
  let dependencyLost = false;
  const docker = (_bin, args) => {
    assert.equal(args[0], '--host=unix:///var/run/docker.sock');
    const action = args[1];
    if (action === 'network') {
      if (options.redaction)
        throw Object.assign(named('SyntheticDockerFailure'), {
          stderr: Buffer.from(
            'earlier context;'.repeat(100) +
              secret +
              '\n' +
              '.'.repeat(1977) +
              'safe context',
          ),
          code: 'SYNTHETIC',
        });
      if (options.networkFailure) throw named('NetworkInspectionFailure');
      return JSON.stringify([
        { IPAM: { Config: [{ Gateway: '172.17.0.1' }] } },
      ]);
    }
    if (action === 'run') {
      events.push(`run-${++launched}`);
      return `container-${launched}`;
    }
    if (action === 'port') return '127.0.0.1:1234';
    if (action === 'exec') {
      if (args.at(-1) === '--version')
        return args.includes('node') ? 'v24.19.0' : '11.9.0';
      return JSON.stringify([
        { path: 'node_modules/brace-expansion', version: '1.1.21', dev: false },
      ]);
    }
    if (action === 'inspect') {
      const format = args[3];
      if (format === '{{.Config.User}}') return 'node';
      if (format === '{{.State.Running}}' || format === '{{.State.OOMKilled}}')
        return 'false';
      if (format === '{{.State.ExitCode}}') return '0';
    }
    if (action === 'wait') return '1';
    if (action === 'stop') {
      events.push('container-stop');
      return '';
    }
    if (action === 'rm') {
      events.push(`rm-${args[3]}`);
      if (options.dockerRemoveFailure && args[3] === 'container-1')
        throw named('DockerCleanupFailure');
      return '';
    }
    throw Error(`Unexpected Docker action ${action}`);
  };
  const sandbox = {
    exports: {},
    Buffer,
    Error,
    setTimeout,
    clearTimeout,
    AbortSignal,
    process: { env: {}, exitCode: 0 },
    require(name) {
      if (name === 'node:child_process') return { execFileSync: docker };
      if (name === 'node:fs/promises')
        return {
          mkdtemp: async () => {
            events.push('mkdtemp');
            if (options.directoryFailure)
              throw named('DirectoryAcquisitionFailure');
            return '/tmp/synthetic-unused';
          },
          writeFile: async (_path, contents, mode) => {
            events.push('env-write');
            assert.equal(mode.mode, 0o600);
            assert.ok(
              contents.includes(
                'MONGODB_URI=mongodb://172.17.0.1:1234/synthetic',
              ),
            );
            if (options.writeFailure) throw named('EnvironmentWriteFailure');
          },
          rm: async (path, flags) => {
            events.push('directory-remove');
            assert.equal(path, '/tmp/synthetic-unused');
            assert.equal(flags.recursive, true);
            assert.equal(flags.force, true);
            if (options.removeDirectoryFailure)
              throw named('DirectoryCleanupFailure');
          },
        };
      if (name === './disposable-artifact-fixture')
        return {
          createArtifactFixture: async (bridge) => {
            assert.equal(bridge, true);
            events.push('fixture-create');
            if (options.fixtureFailure)
              throw named('FixtureAcquisitionFailure');
            return fixture;
          },
        };
      return require(name);
    },
    fetch: async (url, init) => {
      const path = new URL(url).pathname;
      if (path === '/health/ready')
        return { status: dependencyLost ? 503 : 200 };
      if (options.httpFailure) throw named('OriginalHttpFailure');
      if (path === '/staff/books')
        return { status: 200, text: async () => '<div id="root">' };
      if (path === '/auth/login')
        return {
          status: 200,
          headers: {
            get: () =>
              'synthetic; HttpOnly; Secure; SameSite=Strict; Path=/auth',
          },
          json: async () => ({ accessToken: 'synthetic-access' }),
        };
      if (path === '/books')
        return { status: init?.headers?.authorization ? 200 : 401 };
      if (path === '/health') return { status: 200 };
      throw Error(`Unexpected HTTP path ${path}`);
    },
    console: {
      log: (value) => logs.push(value),
      error: (value) => errors.push(value),
    },
  };
  fixture.mongo.stop = async () => {
    events.push('mongo-stop');
    dependencyLost = true;
  };
  vm.runInNewContext(entry, sandbox, {
    filename: 'verify-production-image.js',
  });
  let timer;
  try {
    await Promise.race([
      sandbox.verification,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('probe did not settle')), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  return { events, errors, logs, exitCode: sandbox.process.exitCode, secret };
}
function failure(result, expected) {
  assert.equal(result.exitCode, 1);
  const last = JSON.parse(result.errors.at(-1));
  assert.equal(last.result, 'fail');
  assert.equal(last.error, expected);
}

test('redact full configured credentials before bounding Docker diagnostics', async () => {
  const result = await probe({ redaction: true });
  failure(result, 'Error');
  const output = result.errors.join('\n');
  assert.equal(
    output.includes(result.secret),
    false,
    'full synthetic credential must be absent',
  );
  assert.equal(
    output.includes(result.secret.slice(-10)),
    false,
    'synthetic credential suffix must be absent',
  );
  const diagnostic = JSON.parse(result.errors[0]);
  assert.equal(diagnostic.dockerCommand, 'network');
  assert.equal(diagnostic.code, 'SYNTHETIC');
  assert.equal(diagnostic.detail.length, 2000);
  assert.ok(diagnostic.detail.endsWith('safe context'));
});

for (const [option, error, events] of [
  ['fixtureFailure', 'FixtureAcquisitionFailure', ['fixture-create']],
  [
    'directoryFailure',
    'DirectoryAcquisitionFailure',
    ['fixture-create', 'mkdtemp', 'fixture-stop'],
  ],
  [
    'networkFailure',
    'Error',
    ['fixture-create', 'mkdtemp', 'fixture-stop', 'directory-remove'],
  ],
  [
    'writeFailure',
    'EnvironmentWriteFailure',
    [
      'fixture-create',
      'mkdtemp',
      'env-write',
      'fixture-stop',
      'directory-remove',
    ],
  ],
])
  test(`${option}: release only acquired resources`, async () => {
    const result = await probe({ [option]: true });
    failure(result, error);
    assert.deepEqual(result.events, events);
  });

for (const option of [
  'dockerRemoveFailure',
  'stopFailure',
  'removeDirectoryFailure',
]) {
  test(`${option}: preserve original verification failure and attempt all cleanup`, async () => {
    const result = await probe({ httpFailure: true, [option]: true });
    failure(result, 'OriginalHttpFailure');
    assert.deepEqual(result.events.slice(-3), [
      'rm-container-1',
      'fixture-stop',
      'directory-remove',
    ]);
    assert.ok(
      result.errors.some((value) =>
        String(value).includes('original failure retained'),
      ),
    );
  });
  test(`${option}: fail successful verification if cleanup fails; continue all four containers`, async () => {
    const result = await probe({ [option]: true });
    failure(
      result,
      option === 'dockerRemoveFailure'
        ? 'Error'
        : option === 'stopFailure'
          ? 'FixtureCleanupFailure'
          : 'DirectoryCleanupFailure',
    );
    assert.deepEqual(result.events.slice(-6), [
      'rm-container-1',
      'rm-container-2',
      'rm-container-3',
      'rm-container-4',
      'fixture-stop',
      'directory-remove',
    ]);
  });
}
test('combined cleanup failures retain the original HTTP failure', async () => {
  const result = await probe({
    httpFailure: true,
    dockerRemoveFailure: true,
    stopFailure: true,
    removeDirectoryFailure: true,
  });
  failure(result, 'OriginalHttpFailure');
  assert.deepEqual(result.events.slice(-3), [
    'rm-container-1',
    'fixture-stop',
    'directory-remove',
  ]);
});
test('normal verifier contract, thresholds and cleanup remain unchanged', async () => {
  const result = await probe();
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.events.slice(-6), [
    'rm-container-1',
    'rm-container-2',
    'rm-container-3',
    'rm-container-4',
    'fixture-stop',
    'directory-remove',
  ]);
  assert.ok(
    result.logs.includes('Unsafe/missing production settings: 3 rejected'),
  );
  assert.ok(
    result.logs.some((value) =>
      String(value).includes('"check":"dependency-loss","result":"pass"'),
    ),
  );
});
