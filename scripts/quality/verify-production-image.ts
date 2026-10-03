import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArtifactFixture } from './disposable-artifact-fixture';

let phase = 'initialization';
const image =
  process.env.PRODUCTION_IMAGE ?? 'book-library-upgrade:verification';
if (!/^[a-zA-Z0-9][a-zA-Z0-9._/:-]+$/.test(image))
  throw new Error('Invalid verification image');
const dockerEnvironment = { ...process.env };
for (const name of [
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'DOCKER_TLS',
  'DOCKER_TLS_VERIFY',
  'DOCKER_CERT_PATH',
])
  delete dockerEnvironment[name];
function docker(args: string[]): string {
  try {
    return execFileSync(
      'docker',
      ['--host=unix:///var/run/docker.sock', ...args],
      {
        env: dockerEnvironment,
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ).trim();
  } catch {
    throw new Error('Production verification Docker command failed');
  }
}
async function main() {
  phase = 'disposable-fixture';
  const fixture = await createArtifactFixture(true);
  const directory = await mkdtemp(join(tmpdir(), 'library-image-check-'));
  const children = new Set<string>();
  try {
    phase = 'bridge-inspection';
    const bridge = JSON.parse(docker(['network', 'inspect', 'bridge'])) as {
      IPAM: { Config: { Gateway: string }[] };
    }[];
    const gateway = bridge[0].IPAM.Config[0].Gateway;
    const uri = fixture.uri.replace('127.0.0.1', gateway);
    async function launch(environment: NodeJS.ProcessEnv) {
      const path = join(directory, `env-${children.size}`);
      await writeFile(
        path,
        Object.entries({ ...environment, MONGODB_URI: uri })
          .map(([k, v]) => `${k}=${v}`)
          .join('\n'),
        { mode: 0o600 },
      );
      const id = docker([
        'run',
        '-d',
        '--env-file',
        path,
        '-p',
        '127.0.0.1::3000',
        image,
      ]);
      children.add(id);
      const address = docker(['port', id, '3000/tcp']).split('\n')[0];
      return { id, baseUrl: `http://${address}` };
    }
    phase = 'container-launch';
    const app = await launch(fixture.environment);
    phase = 'container-readiness';
    for (let i = 0; i < 200; i++) {
      try {
        if ((await fetch(`${app.baseUrl}/health/ready`)).status === 200) break;
      } catch {
        /* actual container starting */
      }
      if (i === 199) throw new Error('Production image readiness timeout');
      await new Promise((r) => setTimeout(r, 100));
    }
    phase = 'http-contracts';
    assert.equal((await fetch(`${app.baseUrl}/staff/books`)).status, 200);
    assert.match(
      await (await fetch(`${app.baseUrl}/staff/books`)).text(),
      /<div id="root">/,
    );
    assert.equal((await fetch(`${app.baseUrl}/books`)).status, 401);
    const login = await fetch(`${app.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        Origin: 'https://artifact.example.test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        identifier: 'staff@artifact.example.test',
        password: fixture.password,
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie') ?? '';
    assert.ok(
      cookie.includes('HttpOnly') &&
        cookie.includes('Secure') &&
        cookie.includes('SameSite=Strict') &&
        cookie.includes('Path=/auth'),
    );
    const { accessToken } = (await login.json()) as { accessToken: string };
    assert.equal(
      (
        await fetch(`${app.baseUrl}/books`, {
          headers: { authorization: `Bearer ${accessToken}` },
        })
      ).status,
      200,
    );
    phase = 'installed-runtime-packages';
    const installed = JSON.parse(
      docker([
        'exec',
        '--user',
        '0',
        app.id,
        'node',
        '-e',
        'const fs=require("fs");const l=require("./package-lock.json");console.log(JSON.stringify(Object.entries(l.packages).filter(([p])=>p).filter(([p])=>fs.existsSync(p+"/package.json")).map(([p,v])=>({path:p,version:v.version,dev:!!v.dev}))))',
      ]),
    ) as { path: string; version: string; dev: boolean }[];
    assert.ok(installed.length > 0);
    assert.ok(
      !installed.some(
        (p) =>
          p.dev || /\/(?:braces|micromatch|typed-rest-client)$/.test(p.path),
      ),
    );
    assert.equal(
      installed.find((p) => p.path === 'node_modules/brace-expansion')?.version,
      '1.1.21',
    );
    assert.equal(docker(['exec', app.id, 'node', '--version']), 'v24.19.0');
    assert.equal(docker(['exec', app.id, 'npm', '--version']), '11.9.0');
    console.log(
      JSON.stringify({
        node: '24.19.0',
        npm: '11.9.0',
        check: 'production-image',
        result: 'pass',
        installedPackages: installed.length,
        entry: 'dist/main.js',
        user: docker(['inspect', '-f', '{{.Config.User}}', app.id]),
      }),
    );
    phase = 'unsafe-settings';
    for (const [name, value] of [
      ['AUTH_TRUSTED_BROWSER_ORIGINS', ''],
      ['AUTH_TRUSTED_BROWSER_ORIGINS', '["http://unsafe.example.test"]'],
      ['JWT_SECRET', 'short'],
    ] as const) {
      const unsafe = await launch({ ...fixture.environment, [name]: value });
      const exit = Number(docker(['wait', unsafe.id]));
      assert.notEqual(
        exit,
        0,
        `Unsafe production configuration ${name} must fail`,
      );
      assert.equal(
        docker(['inspect', '-f', '{{.State.Running}}', unsafe.id]),
        'false',
      );
    }
    console.log('Unsafe/missing production settings: 3 rejected');
    phase = 'dependency-loss';
    await fixture.mongo.stop();
    const started = Date.now();
    assert.equal(
      (
        await fetch(`${app.baseUrl}/health/ready`, {
          signal: AbortSignal.timeout(5000),
        })
      ).status,
      503,
    );
    const readinessFailureMs = Date.now() - started;
    assert.ok(readinessFailureMs < 5000);
    assert.equal((await fetch(`${app.baseUrl}/health`)).status, 200);
    const stopStarted = Date.now();
    docker(['stop', '-t', '8', app.id]);
    const shutdownMs = Date.now() - stopStarted;
    const exit = Number(
      docker(['inspect', '-f', '{{.State.ExitCode}}', app.id]),
    );
    console.log(
      JSON.stringify({
        check: 'shutdown-observation',
        readinessFailureMs,
        exit,
      }),
    );
    assert.ok(
      [0, 143].includes(exit),
      'Production container must exit normally after SIGTERM, never SIGKILL',
    );
    assert.ok(
      shutdownMs < 8000,
      'Container shutdown must finish within the eight-second budget',
    );
    assert.equal(
      docker(['inspect', '-f', '{{.State.OOMKilled}}', app.id]),
      'false',
    );
    console.log(
      JSON.stringify({
        check: 'dependency-loss',
        result: 'pass',
        readinessFailureMs,
        shutdownExit: exit,
        shutdownMs,
      }),
    );
  } finally {
    for (const id of children) docker(['rm', '-f', id]);
    await fixture.stop();
    await rm(directory, { recursive: true, force: true });
  }
}
void main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : 'unknown';
  const frame =
    error instanceof Error
      ? error.stack
          ?.split('\n')
          .find((line) => line.includes('verify-production-image.ts:'))
          ?.trim()
      : undefined;
  console.error(JSON.stringify({ result: 'fail', phase, error: name, frame }));
  process.exitCode = 1;
});
