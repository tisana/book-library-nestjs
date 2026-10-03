// Independent review RED probes: execute the real verifier with harmless mocks.
// Run from /workspace/book-library-nestjs. No Docker/Mongo/filesystem mutation.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const repositoryRequire = createRequire(resolve('package.json'));
const ts = repositoryRequire('typescript');
const source = fs.readFileSync('scripts/quality/verify-production-image.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

async function probe(kind) {
  const state = {
    fixtureCreated: false, fixtureStopped: false,
    directoryCreated: false, directoryRemoved: false,
    envWritten: false, containerCreated: false,
    containerRemoveAttempted: false,
  };
  const secret = 'a'.repeat(48) + 'SYNTHETICTAIL1234';
  const logs = [];
  let finish;
  const completed = new Promise((r) => { finish = r; });
  const fixture = {
    uri: 'mongodb://127.0.0.1:1234/synthetic',
    password: 'synthetic-password',
    environment: { JWT_SECRET: secret },
    stop: async () => {
      state.fixtureStopped = true;
      if (kind === 'fixture-stop') throw Error('synthetic stop failure');
    },
  };
  const docker = (_bin, args) => {
    const action = args[1];
    if (action === 'network') {
      if (kind === 'redaction') throw Object.assign(Error('synthetic Docker failure'), {
        stderr: Buffer.from(secret + '\n' + 'x'.repeat(1989)),
      });
      return JSON.stringify([{ IPAM: { Config: [{ Gateway: '172.17.0.1' }] } }]);
    }
    if (action === 'run') { state.containerCreated = true; return 'synthetic-container-id'; }
    if (action === 'port') return '127.0.0.1:1234';
    if (action === 'rm') {
      state.containerRemoveAttempted = true;
      if (kind === 'docker-remove') throw Object.assign(Error('synthetic removal failure'), {
        stderr: Buffer.from('synthetic removal failure'),
      });
      return '';
    }
    throw Error('Unexpected Docker action ' + action);
  };
  let fetches = 0;
  const sandbox = {
    exports: {},
    require(name) {
      if (name === 'node:child_process') return { execFileSync: docker };
      if (name === 'node:fs/promises') return {
        mkdtemp: async () => {
          if (kind === 'mkdtemp') throw Error('synthetic directory failure');
          state.directoryCreated = true;
          return '/tmp/synthetic-unused';
        },
        rm: async () => { state.directoryRemoved = true; },
        writeFile: async () => { state.envWritten = true; },
      };
      if (name === './disposable-artifact-fixture') return {
        createArtifactFixture: async () => { state.fixtureCreated = true; return fixture; },
      };
      return repositoryRequire(name);
    },
    process: { env: {}, exitCode: 0 }, Buffer, setTimeout, clearTimeout, AbortSignal,
    fetch: async () => {
      if (++fetches === 1) return { status: 200 };
      throw Error('synthetic HTTP failure');
    },
    console: {
      log: () => {},
      error(value) {
        logs.push(value);
        if (typeof value === 'string' && value.includes('"result":"fail"')) finish();
      },
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: 'verify-production-image.js' });
  let timer;
  try {
    await Promise.race([completed, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('probe failed to settle')), 1000);
    })]);
  } finally { clearTimeout(timer); }
  await Promise.resolve();
  return {
    kind, ...state, exitCode: sandbox.process.exitCode,
    ...(kind === 'redaction' ? {
      configuredFullSecretPrinted: logs.join('\n').includes(secret),
      configuredTenCharacterSuffixPrinted: logs.join('\n').includes(secret.slice(-10)),
    } : {}),
  };
}

(async () => {
  const results = [];
  for (const kind of ['redaction', 'mkdtemp', 'docker-remove', 'fixture-stop']) {
    results.push(await probe(kind));
  }
  assert.equal(results[0].configuredFullSecretPrinted, false);
  assert.equal(results[0].configuredTenCharacterSuffixPrinted, true);
  assert.equal(results[1].fixtureStopped, false);
  assert.equal(results[2].fixtureStopped, false);
  assert.equal(results[2].directoryRemoved, false);
  assert.equal(results[3].directoryRemoved, false);
  console.log(JSON.stringify({ purpose: 'confirmed RED review findings; not acceptance evidence', results }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
