import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createArtifactFixture } from './disposable-artifact-fixture';

async function main() {
  const fixture = await createArtifactFixture();
  const child = spawn(process.execPath, [resolve('dist/main.js')], {
    cwd: '/tmp',
    detached: true,
    env: {
      PATH: process.env.PATH,
      ...fixture.environment,
      NODE_ENV: 'test',
      PORT: '3000',
      MONGODB_URI: fixture.uri,
      FRONTEND_STATIC_DIR: resolve('frontend/dist'),
      AUTH_TRUSTED_BROWSER_ORIGINS: '["http://127.0.0.1:3000"]',
    },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  let spawnFailed = false;
  child.once('error', () => {
    spawnFailed = true;
  });
  const exited = new Promise<void>((r) => child.once('close', () => r()));
  let stopping: Promise<void> | undefined;
  function stop(): Promise<void> {
    stopping ??= (async () => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGTERM');
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        process.exitCode = 1;
      }, 8000);
      await exited;
      clearTimeout(timer);
      await fixture.stop();
    })();
    return stopping;
  }
  const onSignal = () => {
    void stop().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  try {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (spawnFailed || child.exitCode !== null || child.signalCode !== null)
        throw new Error('Built live application exited before readiness');
      try {
        if ((await fetch('http://127.0.0.1:3000/health/ready')).ok) break;
      } catch {
        /* wait for actual listener */
      }
      if (attempt === 199)
        throw new Error('Built live application readiness timeout');
      await new Promise((r) => setTimeout(r, 100));
    }
    console.log('Disposable built application ready; no application API mocks');
    await exited;
    if (!stopping)
      throw new Error('Built live application exited unexpectedly');
  } finally {
    await stop();
  }
}
void main().catch(() => {
  console.error('Disposable live artifact setup or process failed');
  process.exitCode = 1;
});
