import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(new URL('../../../../../', import.meta.url).pathname);
function runProbe(kind) {
  const directory = mkdtempSync(join(tmpdir(), 'rehearsal-fault-'));
  const log = join(directory, 'events.jsonl');
  const hook = join(directory, 'hook.cjs');
  const entry = join(directory, 'helper.cjs');
  writeFileSync(
    hook,
    `
const fs=require('node:fs');
const record=(event)=>fs.appendFileSync(process.env.PROBE_LOG,JSON.stringify(event)+'\\n');
const named=(name)=>Object.assign(new Error('synthetic failure'),{name});
const fixturePath=process.env.PROBE_ROOT+'/scripts/quality/disposable-artifact-fixture.ts';
if(process.env.PROBE_KIND.startsWith('outer')) {
  const fixtures=require(fixturePath);
  fixtures.createArtifactFixture=async()=>({uri:'mongodb://127.0.0.1/synthetic',environment:{},connection:{collection:()=>({})},stop:async()=>{record({event:'fixture-stop'});if(process.env.PROBE_KIND==='outer-late')throw named('CleanupFailure');}});
  const promises=require('node:fs/promises');
  const make=promises.mkdtemp; promises.mkdtemp=async(...args)=>{const path=await make(...args);record({event:'directory-created',path});return path;};
  const remove=promises.rm; promises.rm=async(...args)=>{record({event:'directory-remove',path:args[0]});return remove(...args);};
  require('node:child_process').execFileSync=(_cmd,args)=>{
    if(args.includes('inspect')&&args.includes('network')) {
      if(process.env.PROBE_KIND==='outer-initial')throw named('InitialDockerInspectionFailure');
      return JSON.stringify([{IPAM:{Config:[{Gateway:'127.0.0.1'}]}}]);
    }
    if(args.includes('run'))throw named('ContainerLaunchFailure');
    throw named('UnexpectedDockerInvocation');
  };
} else {
  const mongoose=require(process.env.PROBE_ROOT+'/node_modules/mongoose');
  mongoose.createConnection=()=>({asPromise:async()=>{},collection:()=>({insertMany:async()=>{},insertOne:async()=>{}}),close:async()=>{record({event:'connection-close'});if(process.env.PROBE_KIND==='helper-close-error')throw named('ConnectionCloseFailure');}});
  require(process.env.PROBE_ROOT+'/node_modules/mongodb-memory-server').MongoMemoryReplSet.create=async()=>({getUri:()=> 'mongodb://127.0.0.1/synthetic',stop:async()=>{record({event:'mongo-stop'});}});
  const migration=require(process.env.PROBE_ROOT+'/migrations/migrate.ts');migration.loadMigrations=async()=>[];migration.runPendingMigrations=async()=>{};
}
`,
  );
  writeFileSync(
    entry,
    `const {createArtifactFixture}=require(process.env.PROBE_ROOT+'/scripts/quality/disposable-artifact-fixture.ts');createArtifactFixture().then(f=>f.stop()).catch(e=>{console.error(e.name);process.exitCode=1;});`,
  );
  const target = kind.startsWith('outer')
    ? join(root, 'docs/upgrade/nestjs-12/evidence/t6/rollback-rehearsal.ts')
    : entry;
  const result = spawnSync(
    process.execPath,
    [
      '-r',
      join(root, 'node_modules/ts-node/register/transpile-only'),
      '-r',
      hook,
      target,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PROBE_ROOT: root,
        PROBE_LOG: log,
        PROBE_KIND: kind,
      },
      timeout: 15000,
    },
  );
  const events = existsSync(log)
    ? readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse)
    : [];
  return { directory, result, events };
}
for (const [kind, original] of [
  ['outer-initial', 'InitialDockerInspectionFailure'],
  ['outer-late', 'ContainerLaunchFailure'],
]) {
  test(`${kind}: release resources and retain original error`, () => {
    const probe = runProbe(kind);
    try {
      assert.equal(probe.result.error, undefined);
      assert.notEqual(probe.result.status, 0);
      assert.match(probe.result.stderr, new RegExp(original));
      assert.ok(
        probe.events.some((e) => e.event === 'fixture-stop'),
        'fixture cleanup required',
      );
      const created = probe.events.find((e) => e.event === 'directory-created');
      assert.ok(created);
      assert.ok(
        probe.events.some((e) => e.event === 'directory-remove'),
        'directory cleanup required even after other cleanup error',
      );
      assert.equal(existsSync(created.path), false);
    } finally {
      for (const e of probe.events.filter(
        (e) => e.event === 'directory-created',
      ))
        rmSync(e.path, { recursive: true, force: true });
      rmSync(probe.directory, { recursive: true, force: true });
    }
  });
}
for (const kind of ['helper-close-error', 'helper-normal']) {
  test(`${kind}: independently stop connection and Mongo`, () => {
    const probe = runProbe(kind);
    try {
      assert.equal(probe.result.error, undefined);
      assert.deepEqual(
        probe.events.map((e) => e.event),
        ['connection-close', 'mongo-stop'],
      );
      if (kind === 'helper-close-error') {
        assert.notEqual(probe.result.status, 0);
        assert.match(probe.result.stderr, /ConnectionCloseFailure/);
      } else assert.equal(probe.result.status, 0, probe.result.stderr);
    } finally {
      rmSync(probe.directory, { recursive: true, force: true });
    }
  });
}
