// Run from repository root with ts-node --transpile-only. Synthetic data only.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { createArtifactFixture } from '../../../../../scripts/quality/disposable-artifact-fixture';
const env = { ...process.env };
for (const key of [
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'DOCKER_TLS',
  'DOCKER_TLS_VERIFY',
  'DOCKER_CERT_PATH',
])
  delete env[key];
function docker(args: string[]) {
  return execFileSync(
    'docker',
    ['--host=unix:///var/run/docker.sock', ...args],
    {
      env,
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).trim();
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(check: () => Promise<boolean>, budget = 75000) {
  const start = performance.now();
  while (performance.now() - start < budget) {
    if (await check()) return Math.round(performance.now() - start);
    await sleep(200);
  }
  throw new Error('Bounded rehearsal check failed');
}
async function main() {
  const fixture = await createArtifactFixture(true); // migration helper logs are outside machine JSON
  const directory = await mkdtemp(join(tmpdir(), 'nestjs-t6-'));
  const containers: string[] = [];
  const origin = 'https://artifact.example.test';
  const gateway = JSON.parse(docker(['network', 'inspect', 'bridge']))[0].IPAM
    .Config[0].Gateway;
  const envFile = join(directory, 'app.env');
  await writeFile(
    envFile,
    Object.entries({
      ...fixture.environment,
      MONGODB_URI: fixture.uri.replace('127.0.0.1', gateway),
    })
      .map(([k, v]) => `${k}=${v}`)
      .join('\n'),
    { mode: 0o600 },
  );
  const families = fixture.connection.collection('refresh_token_families');
  const markers = fixture.connection.collection('refresh_token_replay_markers');
  const operations = fixture.connection.collection(
    'auth_identifier_operations',
  );
  let live: string | undefined;
  let base = '';
  let cookie = '';
  let access = '';
  let originalCookie = '';
  const checkpoints: unknown[] = [];
  async function http(path: string, body?: unknown, session = cookie) {
    return fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        ...(body === undefined
          ? { Authorization: `Bearer ${access}` }
          : { 'content-type': 'application/json' }),
        ...(session ? { Cookie: session } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(5000),
    });
  }
  async function rotate() {
    const before = cookie;
    const result = await http('/auth/refresh', {});
    assert.equal(result.status, 200);
    cookie = (result.headers.get('set-cookie') ?? '').split(';')[0];
    assert.ok(cookie && cookie !== before);
    access = ((await result.json()) as any).accessToken;
    assert.ok(access);
  }
  async function stop() {
    assert.ok(live);
    const started = performance.now();
    docker(['stop', '--time', '10', live!]);
    const elapsedMs = Math.round(performance.now() - started);
    const state = JSON.parse(
      docker(['inspect', '-f', '{{json .State}}', live!]),
    );
    console.error(
      JSON.stringify({
        check: 'signal exit observation',
        elapsedMs,
        exitCode: state.ExitCode,
        oomKilled: state.OOMKilled,
      }),
    );
    assert.equal(state.Running, false);
    assert.equal(state.OOMKilled, false);
    assert.ok([0, 143].includes(state.ExitCode));
    assert.ok(elapsedMs < 8000);
    checkpoints.push({
      check: 'SIGTERM non-overlap',
      elapsedMs,
      exitCode: state.ExitCode,
      oomKilled: false,
    });
    live = undefined;
  }
  async function seedRecovery(label: string) {
    const reservationId = new Types.ObjectId();
    await fixture.connection.collection('auth_identifiers').insertOne({
      _id: reservationId,
      normalizedIdentifier: `${label}@example.test`,
      subjectType: 'staff',
      subjectId: 'synthetic-staff',
      identifierType: 'email',
      status: 'active',
      lastOperationId: label,
      createdBy: 'synthetic-staff',
      updatedBy: 'synthetic-staff',
    });
    await operations.insertOne({
      operationId: label,
      operationType: 'claim',
      status: 'finalizing',
      assignments: [
        {
          assignmentId: `${label}-assignment`,
          subjectType: 'staff',
          subjectId: 'synthetic-staff',
          action: 'claim',
          status: 'applied',
          targetReservationId: reservationId,
        },
      ],
      cleanupStatus: 'not-required',
      requestedBy: { subjectType: 'staff', subjectId: 'synthetic-staff' },
      leaseOwner: 'terminated-synthetic-instance',
      leaseExpiresAt: new Date(Date.now() + 2000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const familyId = `${label}-orphan`,
      tokenHash = randomBytes(32).toString('hex'),
      rotationOperationId = `${label}-rotation`;
    await families.insertOne({
      familyId,
      clientId: 'synthetic',
      subjectType: 'staff',
      subjectId: 'synthetic-staff',
      scopes: [],
      authVersion: 0,
      status: 'active',
      currentTokenHash: randomBytes(32).toString('hex'),
      lastRotationOperationId: rotationOperationId,
      issuedAt: new Date(),
      lastRotatedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    });
    await markers.insertOne({
      tokenHash,
      familyId,
      status: 'pending',
      rotationOperationId,
      leaseExpiresAt: new Date(Date.now() + 2000),
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { label, familyId, tokenHash };
  }
  async function verifyRecovery(
    checkpoint: Awaited<ReturnType<typeof seedRecovery>>,
  ) {
    const elapsedMs = await until(async () => {
      const op = await operations.findOne({ operationId: checkpoint.label });
      const marker = await markers.findOne({ tokenHash: checkpoint.tokenHash });
      const family = await families.findOne({ familyId: checkpoint.familyId });
      return (
        op?.status === 'completed' &&
        marker?.status === 'committed' &&
        family?.status === 'revoked'
      );
    });
    assert.equal(
      await fixture.connection
        .collection('security_activity_events')
        .countDocuments({ operationId: checkpoint.label }),
      1,
    );
    const family = await families.findOne({ familyId: checkpoint.familyId });
    assert.equal(family!.revokedReason, 'refresh-rotation-orphaned');
    assert.equal(family!.currentTokenHash, undefined);
    checkpoints.push({
      check: 'durable identifier lease and orphan refresh marker recovery',
      label: checkpoint.label,
      elapsedMs,
      terminalAuditEvents: 1,
    });
  }
  try {
    let recovery: Awaited<ReturnType<typeof seedRecovery>> | undefined;
    for (const [index, image] of [
      'book-library-upgrade:rollback-old',
      'book-library-upgrade:verification',
      'book-library-upgrade:rollback-old',
    ].entries()) {
      assert.equal(live, undefined);
      live = docker([
        'run',
        '--init',
        '-d',
        '--env-file',
        envFile,
        '-p',
        '127.0.0.1::3000',
        image,
      ]);
      containers.push(live);
      base = 'http://' + docker(['port', live, '3000/tcp']).split('\n')[0];
      const readyMs = await until(async () => {
        try {
          return (
            (
              await fetch(base + '/health/ready', {
                signal: AbortSignal.timeout(5000),
              })
            ).status === 200
          );
        } catch {
          return false;
        }
      }, 30000);
      const versions = JSON.parse(
        docker([
          'exec',
          live,
          'node',
          '-e',
          'console.log(JSON.stringify({node:process.version,nest:JSON.parse(require("fs").readFileSync("node_modules/@nestjs/core/package.json","utf8")).version,mongoose:require("mongoose/package.json").version,entry:require("fs").existsSync("dist/main.js")}))',
        ]),
      );
      if (index === 0) {
        const login = await http(
          '/auth/login',
          {
            identifier: 'staff@artifact.example.test',
            password: fixture.password,
          },
          '',
        );
        assert.equal(login.status, 200);
        cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
        originalCookie = cookie;
        access = ((await login.json()) as any).accessToken;
      }
      assert.equal((await http('/books')).status, 200); // prior-version access token survives
      await rotate();
      assert.equal((await http('/books')).status, 200);
      assert.equal(
        await families.countDocuments({
          status: 'active',
          subjectId: { $ne: 'synthetic-staff' },
        }),
        1,
      );
      if (recovery) await verifyRecovery(recovery);
      checkpoints.push({
        phase: index,
        image,
        imageId: docker(['inspect', '-f', '{{.Image}}', live]),
        npm: docker(['exec', live, 'npm', '--version']),
        versions,
        readyMs,
        accessContinuity: true,
        cookieRotation: true,
      });
      if (index === 2) {
        assert.equal(
          (await http('/auth/refresh', {}, originalCookie)).status,
          401,
        );
        assert.equal((await http('/auth/refresh', {})).status, 401);
        const session = await families.findOne({
          subjectId: { $ne: 'synthetic-staff' },
        });
        assert.equal(session!.status, 'replayed');
        assert.equal(session!.currentTokenHash, undefined);
        checkpoints.push({
          check: 'old cookie replay across both transitions revokes family',
          status: 401,
          persistedStatus: 'replayed',
          hashCleared: true,
        });
      }
      await stop();
      if (index < 2) recovery = await seedRecovery(`transition-${index + 1}`);
    }
    console.log(
      JSON.stringify(
        {
          result: 'PASS',
          sequence: 'old/new/old',
          concurrentInstances: false,
          database: 'disposable MongoMemoryReplSet 8.2.12',
          workerIntervalSeconds: 60,
          leaseFixture:
            '2s future persisted lease; real expiry/skew/cadence; default300s not elapsed',
          checkpoints,
        },
        null,
        2,
      ),
    );
  } finally {
    for (const id of containers) {
      try {
        docker(['rm', '-f', id]);
      } catch {}
    }
    await fixture.stop();
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(
    error?.name,
    String(error?.stack)
      .split('\n')
      .filter((line) => line.trim().startsWith('at '))
      .slice(0, 3)
      .join('\n'),
  );
  console.error('Rollback rehearsal failed; sensitive diagnostics suppressed');
  process.exitCode = 1;
});
