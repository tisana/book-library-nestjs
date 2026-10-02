import { ChildProcess, spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export interface ProductionProcessOptions {
  entryPath: string;
  mongoUri: string;
  environment: NodeJS.ProcessEnv;
  staticDirectory?: string;
  startupTimeoutMs?: number;
  startupAttempts?: number;
}

export interface ProductionExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface ProductionProcess {
  baseUrl: string;
  exited: Promise<ProductionExit>;
  diagnostics(): string;
  stop(): Promise<ProductionExit>;
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function reservePort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = (reservation.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitForExit(
  exited: Promise<ProductionExit>,
): Promise<ProductionExit | null> {
  let timeout: NodeJS.Timeout;
  try {
    return await Promise.race([
      exited,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), 2_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function terminate(
  child: ChildProcess,
  exited: Promise<ProductionExit>,
): Promise<ProductionExit> {
  if (child.exitCode === null && child.signalCode === null)
    child.kill('SIGTERM');
  const graceful = await waitForExit(exited);
  if (graceful) return graceful;
  child.kill('SIGKILL');
  const forced = await waitForExit(exited);
  if (!forced) throw new Error('Production process did not exit after SIGKILL');
  return forced;
}

/** Launch the built bootstrap, never a TestingModule or reconstructed main.ts. */
export async function startProductionProcess(
  options: ProductionProcessOptions,
): Promise<ProductionProcess> {
  if (!isAbsolute(options.entryPath)) {
    throw new Error('Production entry path must be explicit and absolute');
  }
  await access(options.entryPath);
  const attempts = Math.min(Math.max(options.startupAttempts ?? 3, 1), 5);
  const timeout = Math.min(
    Math.max(options.startupTimeoutMs ?? 20_000, 100),
    30_000,
  );
  // Do not inherit application configuration, credentials, NODE_OPTIONS or .env.
  const environment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    TZ: 'UTC',
    ...options.environment,
    MONGODB_URI: options.mongoUri,
    FRONTEND_STATIC_DIR: options.staticDirectory ?? '',
  };
  const sensitiveValues = [
    options.mongoUri,
    ...Object.entries(environment)
      .filter(([name]) => /SECRET|PASSWORD|TOKEN|KEYS/.test(name))
      .map(([, value]) => value)
      .filter((value): value is string => Boolean(value)),
  ];
  const redact = (value: string) => {
    let result = value.replace(/\u001b\[[0-9;]*m/g, '');
    for (const secret of sensitiveValues)
      result = result.split(secret).join('[redacted]');
    return result
      .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[redacted-database]')
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(
        /(?:book_library_refresh|refresh_token|refreshToken)=[^;\s]+/g,
        'refreshToken=[redacted]',
      )
      .replace(/[\w.+-]+@[\w.-]+/g, '[redacted-account]')
      .replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        '[redacted-token]',
      );
  };

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const directory = await mkdtemp(join(tmpdir(), 'library-production-'));
    let child: ChildProcess | undefined;
    let exited: Promise<ProductionExit> | undefined;
    let output = '';
    try {
      const port = await reservePort();
      const baseUrl = `http://127.0.0.1:${port}`;
      child = spawn(process.execPath, [options.entryPath], {
        cwd: directory,
        env: { ...environment, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let closed = false;
      let spawnError = false;
      exited = new Promise<ProductionExit>((resolve) => {
        child.once('close', (code, signal) => {
          closed = true;
          resolve({ code, signal });
        });
      });
      child.once('error', () => {
        spawnError = true;
      });
      const capture = (chunk: Buffer) => {
        // Retain raw chunks only in memory so split secrets can be redacted together.
        output = (output + chunk.toString()).slice(-64_000);
      };
      child.stdout.on('data', capture);
      child.stderr.on('data', capture);
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline && !closed && !spawnError) {
        try {
          const response = await fetch(`${baseUrl}/health`, {
            signal: AbortSignal.timeout(500),
          });
          const body = (await response.json()) as { status?: string };
          if (response.ok && body.status === 'ok' && !closed) {
            const runningChild = child;
            const observedExit = exited;
            let shutdown: Promise<ProductionExit> | undefined;
            return {
              baseUrl,
              exited: observedExit,
              diagnostics: () => redact(output),
              stop: () =>
                (shutdown ??= (async () => {
                  try {
                    return await terminate(runningChild, observedExit);
                  } finally {
                    await rm(directory, { recursive: true, force: true });
                  }
                })()),
            };
          }
        } catch {
          /* Startup polling is bounded by deadline and request timeout. */
        }
        await delay(50);
      }
      throw new Error(
        `Compiled application did not become live (attempt ${attempt}):\n${redact(output)}`,
      );
    } catch (error) {
      try {
        if (child && exited) await terminate(child, exited);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
      // A reservation cannot eliminate the release/listen race; only address collisions retry.
      if (attempt < attempts && output.includes('EADDRINUSE')) continue;
      throw error;
    }
  }
  throw new Error('Production startup attempts exhausted');
}
