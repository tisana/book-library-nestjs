import { randomBytes, createHash } from 'node:crypto';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Types } from 'mongoose';
import * as request from 'supertest';
import {
  loadMigrations,
  MigrationConnection,
  runPendingMigrations,
} from '../migrations/migrate';
import {
  createMongoTestContext,
  MongoTestContext,
} from './utils/mongo-test-setup';
import {
  ProductionProcess,
  startProductionProcess,
} from './support/production-process';

// T0 verified the full-checkout Nest 11 artifact. T3 changes this explicit path.
const entryPath = resolve(__dirname, '../dist/src/main.js');
const origins = ['https://library.example.test', 'https://staff.example.test'];
const password = randomBytes(32).toString('base64url');
const staffIdentifier = 'production-staff@example.test';
const memberIdentifier = 'production-member@example.test';
const memberId = new Types.ObjectId('507f1f77bcf86cd799439023');
const otherMemberId = new Types.ObjectId('507f1f77bcf86cd799439024');
const bookId = new Types.ObjectId('507f1f77bcf86cd799439025');
const categoryId = new Types.ObjectId('507f1f77bcf86cd799439026');
const indexHtml =
  '<!doctype html><html><body>production-contract-frontend</body></html>';
const asset = 'console.log("production-contract-asset");';
const environment: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  JWT_ISSUER: 'production-contract-test',
  JWT_AUDIENCE: 'book-library-api',
  JWT_SECRET: randomBytes(48).toString('base64url'),
  AUTH_COOKIE_SECRET: randomBytes(48).toString('base64url'),
  AUTH_AUDIT_CORRELATION_SECRET: randomBytes(32).toString('base64url'),
  AUTH_AUDIT_CORRELATION_KEY_VERSION: '1',
  AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS: '{}',
  AUTH_TRUSTED_BROWSER_ORIGINS: JSON.stringify(origins),
  AUTH_TRUSTED_PROXY_CIDRS: '[]',
};

/** Only the timestamp is normalized; status, path, message and error stay exact. */
function errorBody(response: request.Response): Record<string, unknown> {
  expect(response.headers['content-type']).toMatch(/application\/json/);
  const { timestamp, ...body } = response.body;
  expect(timestamp).toEqual(expect.any(String));
  expect(new Date(timestamp).toISOString()).toBe(timestamp);
  return body;
}

function expectError(
  response: request.Response,
  statusCode: number,
  path: string,
  message: string | string[],
  error: string,
): void {
  expect(response.status).toBe(statusCode);
  expect(errorBody(response)).toEqual({ statusCode, path, message, error });
}

function refreshCookie(response: request.Response): string {
  const cookies = response.headers['set-cookie'] as unknown as string[];
  // Boolean checks avoid rendering cookie/token values in failed assertions.
  expect(Array.isArray(cookies)).toBe(true);
  expect(cookies.length).toBe(1);
  const cookie = cookies[0];
  for (const attribute of [
    'Path=/auth',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ]) {
    expect(cookie.includes(attribute)).toBe(true);
  }
  expect(cookie.includes('Domain=')).toBe(false);
  const maxAge = /Max-Age=(\d+)/.exec(cookie);
  expect(Boolean(maxAge)).toBe(true);
  expect(Number(maxAge[1])).toBeGreaterThan(0);
  expect(Number(maxAge[1])).toBeLessThanOrEqual(2_592_000);
  return cookie.split(';')[0];
}

describe('Compiled production bootstrap (Nest 11 characterization)', () => {
  let mongo: MongoMemoryReplSet | undefined;
  let context: MongoTestContext | undefined;
  let staticDirectory: string | undefined;
  let app: ProductionProcess | undefined;
  const children = new Set<ProductionProcess>();
  let staffAccess: string;
  let memberAccess: string;
  let staffCookie: string;

  async function launch(proxyCidrs: string[] = []): Promise<ProductionProcess> {
    const child = await startProductionProcess({
      entryPath,
      mongoUri: context.uri,
      environment: {
        ...environment,
        AUTH_TRUSTED_PROXY_CIDRS: JSON.stringify(proxyCidrs),
      },
      staticDirectory,
    });
    children.add(child);
    return child;
  }

  async function stop(child: ProductionProcess): Promise<void> {
    await child.stop();
    children.delete(child);
  }

  async function login(identifier: string): Promise<request.Response> {
    const response = await request(app.baseUrl)
      .post('/auth/login')
      .set('Origin', origins[0])
      .send({ identifier, password });
    // Never dump successful auth response bodies in an assertion diagnostic.
    expect(response.status).toBe(200);
    expect(typeof response.body.accessToken === 'string').toBe(true);
    return response;
  }

  async function stateDigest(): Promise<string> {
    const collections = [
      'staffusers',
      'members',
      'auth_identifiers',
      'auth_identifier_operations',
      'auth_identifier_repair_batches',
      'refresh_token_families',
      'refresh_token_replay_markers',
      'auth_throttle_buckets',
      'security_activity_events',
    ];
    const state = await Promise.all(
      collections.map(async (name) => [
        name,
        await context.connection
          .collection(name)
          .find({})
          .sort({ _id: 1 })
          .toArray(),
      ]),
    );
    // State equality includes every field, but failures expose only digests.
    return createHash('sha256').update(JSON.stringify(state)).digest('hex');
  }

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    context = await createMongoTestContext(
      mongo.getUri('production-contracts'),
    );
    staticDirectory = await mkdtemp(
      join(tmpdir(), 'library-production-static-'),
    );
    await writeFile(join(staticDirectory, 'index.html'), indexHtml);
    await writeFile(join(staticDirectory, 'app.js'), asset);
    const passwordHash = await bcrypt.hash(password, 10);
    await context.connection.collection('staffusers').insertOne({
      email: staffIdentifier,
      displayName: 'Synthetic Staff',
      passwordHash,
      roles: ['staff'],
      status: 'active',
      authVersion: 0,
    });
    await context.connection.collection('membershiptypes').insertOne({
      _id: categoryId,
      code: 'PROD-STANDARD',
      name: 'Synthetic Standard',
      maxActiveLoans: 3,
      status: 'active',
    });
    await context.connection.collection('members').insertMany([
      {
        _id: memberId,
        memberNumber: 'PROD-001',
        fullName: 'Synthetic Member',
        loginIdentifier: memberIdentifier,
        passwordHash,
        membershipTypeId: categoryId,
        status: 'active',
        authStatus: 'active',
        authVersion: 0,
        activeLoanCount: 0,
      },
      {
        _id: otherMemberId,
        memberNumber: 'PROD-002',
        fullName: 'Other Synthetic Member',
        membershipTypeId: categoryId,
        status: 'active',
        authStatus: 'active',
        authVersion: 0,
        activeLoanCount: 0,
      },
    ]);
    await runPendingMigrations(
      context.connection as unknown as MigrationConnection,
      await loadMigrations(),
    );
    await context.connection.collection('books').insertOne({
      _id: bookId,
      title: 'Production Fixture',
      catalogIdentifier: 'PROD-BOOK-001',
      categoryId,
      totalQuantity: 3,
      availableQuantity: 1,
      status: 'active',
    });
    app = await launch();
    const staff = await login(staffIdentifier);
    staffAccess = staff.body.accessToken;
    staffCookie = refreshCookie(staff);
    const member = await login(memberIdentifier);
    memberAccess = member.body.accessToken;
  });

  afterAll(async () => {
    // allSettled prevents one failed cleanup from leaking the remaining children/fixtures.
    const exits = await Promise.allSettled(
      [...children].map((child) => child.stop()),
    );
    const fixtures = await Promise.allSettled([
      context?.disconnect(),
      mongo?.stop(),
      staticDirectory
        ? rm(staticDirectory, { recursive: true, force: true })
        : Promise.resolve(),
    ]);
    const failed = [...exits, ...fixtures].filter(
      (result) => result.status === 'rejected',
    );
    expect(failed.length).toBe(0);
  });

  it.each(origins)('allows exact credentialed CORS for %s', async (origin) => {
    const response = await request(app.baseUrl)
      .options('/auth/login')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toBe(
      'content-type',
    );
    expect(response.headers.vary).toContain('Origin');
  });

  it('does not grant CORS to a suffix lookalike or a different port', async () => {
    for (const origin of [
      'https://library.example.test.evil.test',
      'https://library.example.test:444',
    ]) {
      const response = await request(app.baseUrl)
        .options('/auth/login')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST');
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(
        response.headers['access-control-allow-credentials'],
      ).toBeUndefined();
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });

  it.each([
    'login',
    'staff-login',
    'member-login',
    'refresh',
    'logout',
    'logout-all',
  ])(
    'rejects untrusted origins before state/cookie writes on /auth/%s',
    async (route) => {
      const before = await stateDigest();
      const invalidOrigins: (string | string[] | undefined)[] = [
        undefined,
        'null',
        'not-an-origin',
        'https://library.example.test.evil.test',
        'https://library.example.test:444',
        [origins[0], origins[0]],
      ];
      for (const origin of invalidOrigins) {
        const operation = request(app.baseUrl)
          .post(`/auth/${route}`)
          .set('Authorization', `Bearer ${staffAccess}`)
          .set('Cookie', staffCookie)
          .send({
            identifier: staffIdentifier,
            email: staffIdentifier,
            loginIdentifier: memberIdentifier,
            password,
            unexpected: true,
          });
        if (origin !== undefined) operation.set({ Origin: origin });
        const response = await operation;
        expectError(
          response,
          403,
          `/auth/${route}`,
          'Browser session request denied',
          'Forbidden',
        );
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
        expect(await stateDigest()).toBe(before);
      }
      // Bad percent-encoding would throw if downstream cookie parsing were reached.
      const malformedCookie = await request(app.baseUrl)
        .post(`/auth/${route}`)
        .set('Origin', 'null')
        .set('Cookie', 'book_library_refresh=%E0%A4%A')
        .send({});
      expectError(
        malformedCookie,
        403,
        `/auth/${route}`,
        'Browser session request denied',
        'Forbidden',
      );
      expect(malformedCookie.headers['set-cookie']).toBeUndefined();
      expect(await stateDigest()).toBe(before);
    },
  );

  it('issues a production cookie and an access credential only in the body', async () => {
    const response = await login(staffIdentifier);
    refreshCookie(response);
    expect(response.body.roleArea).toBe('staff');
    expect(response.body.tokenType).toBe('Bearer');
    expect(response.body.expiresIn).toBe(900);
    expect('refreshToken' in response.body).toBe(false);
    expect(response.headers['access-control-allow-origin']).toBe(origins[0]);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rotates refresh credentials and rejects an earlier replay', async () => {
    const session = await login(staffIdentifier);
    const initial = refreshCookie(session);
    const rotate = async (cookie: string) =>
      request(app.baseUrl)
        .post('/auth/refresh')
        .set('Origin', origins[0])
        .set('Cookie', cookie)
        .send({});
    const first = await rotate(initial);
    expect(first.status).toBe(200);
    const successor = refreshCookie(first);
    const second = await rotate(successor);
    expect(second.status).toBe(200);
    const latest = refreshCookie(second);
    expect(initial === successor).toBe(false);
    expect(successor === latest).toBe(false);
    const replay = await rotate(initial);
    expectError(
      replay,
      401,
      '/auth/refresh',
      'Invalid refresh session',
      'Unauthorized',
    );
    expect(replay.headers['set-cookie']).toBeUndefined();
    const revoked = await rotate(latest);
    expectError(
      revoked,
      401,
      '/auth/refresh',
      'Invalid refresh session',
      'Unauthorized',
    );
  });

  it('clears a production cookie with the same scope on trusted logout', async () => {
    const response = await request(app.baseUrl)
      .post('/auth/logout')
      .set('Origin', origins[1])
      .send({});
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0];
    for (const attribute of [
      'Path=/auth',
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Max-Age=0',
    ]) {
      expect(cookie.includes(attribute)).toBe(true);
    }
    expect(cookie.includes('Domain=')).toBe(false);
  });

  it('enforces whitelist and type validation using the bootstrap pipe', async () => {
    const response = await request(app.baseUrl)
      .post('/auth/login')
      .set('Origin', origins[0])
      .send({ identifier: 42, password: false, unexpected: true });
    expectError(
      response,
      400,
      '/auth/login',
      [
        'property unexpected should not exist',
        'identifier must be a string',
        'password must be a string',
      ],
      'Bad Request',
    );
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('transforms numeric query values and rejects out-of-range values', async () => {
    const valid = await request(app.baseUrl)
      .get('/books?page=1&limit=1')
      .set('Authorization', `Bearer ${staffAccess}`);
    expect(valid.status).toBe(200);
    expect(valid.body.map((book: { id: string }) => book.id)).toEqual([
      bookId.toString(),
    ]);
    const invalid = await request(app.baseUrl)
      .get('/books?limit=101')
      .set('Authorization', `Bearer ${staffAccess}`);
    expectError(
      invalid,
      400,
      '/books?limit=101',
      ['limit must not be greater than 100'],
      'Bad Request',
    );
  });

  it('returns the actual filtered malformed JSON response', async () => {
    const response = await request(app.baseUrl)
      .post('/auth/login')
      .set('Origin', origins[0])
      .set('Content-Type', 'application/json')
      .send('{"identifier":');
    expectError(
      response,
      400,
      '/auth/login',
      'Unexpected end of JSON input',
      'Bad Request',
    );
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it.each([undefined, 'Bearer invalid-access-credential'])(
    'rejects missing or invalid access authorization (%s)',
    async (authorization) => {
      const operation = request(app.baseUrl)
        .get('/books')
        .set('Accept', 'text/html');
      if (authorization) operation.set('Authorization', authorization);
      expectError(
        await operation,
        401,
        '/books',
        'Unauthorized',
        'UnauthorizedException',
      );
    },
  );

  it('rejects staff without administrator permissions', async () => {
    const response = await request(app.baseUrl)
      .get('/auth/roles')
      .set('Authorization', `Bearer ${staffAccess}`);
    expectError(
      response,
      403,
      '/auth/roles',
      'Required permission is missing',
      'Forbidden',
    );
  });

  it('rejects member identities at the staff catalog boundary', async () => {
    const response = await request(app.baseUrl)
      .get('/books')
      .set('Authorization', `Bearer ${memberAccess}`);
    expectError(
      response,
      403,
      '/books',
      'Staff permission is required',
      'Forbidden',
    );
  });

  it('derives member borrowing ownership from the access token', async () => {
    const own = await request(app.baseUrl)
      .get('/members/me/borrowings')
      .set('Authorization', `Bearer ${memberAccess}`);
    expect(own.status).toBe(200);
    expect(own.body).toEqual([]);
    const path = `/members/me/borrowings?memberId=${otherMemberId}`;
    const other = await request(app.baseUrl)
      .get(path)
      .set('Authorization', `Bearer ${memberAccess}`);
    expectError(
      other,
      403,
      path,
      'Member id must come from the token',
      'Forbidden',
    );
  });

  it('keeps domain missing-record errors as JSON despite frontend assets', async () => {
    const path = '/books/507f1f77bcf86cd799439099';
    const response = await request(app.baseUrl)
      .get(path)
      .set('Accept', 'text/html')
      .set('Authorization', `Bearer ${staffAccess}`);
    expectError(response, 404, path, 'Book not found', 'Not Found');
  });

  it('keeps domain conflicts and their unchanged quantity state', async () => {
    const response = await request(app.baseUrl)
      .patch(`/books/${bookId}`)
      .set('Authorization', `Bearer ${staffAccess}`)
      .send({ totalQuantity: 1 });
    expectError(
      response,
      409,
      `/books/${bookId}`,
      'Total quantity cannot be lower than active loans',
      'Conflict',
    );
    const stored = await context.connection
      .collection('books')
      .findOne({ _id: bookId });
    expect(stored.totalQuantity).toBe(3);
    expect(stored.availableQuantity).toBe(1);
  });

  it('serves public Swagger UI and the generated OpenAPI document', async () => {
    const ui = await request(app.baseUrl).get('/docs');
    expect(ui.status).toBe(200);
    expect(ui.headers['content-type']).toMatch(/text\/html/);
    expect(ui.text).toContain('swagger-ui');
    const json = await request(app.baseUrl).get('/docs-json');
    expect(json.status).toBe(200);
    expect(json.body.info).toEqual({
      title: 'Book Library API',
      description: 'Staff-facing API for book borrowing workflows',
      version: '1.0',
      contact: {},
    });
    for (const path of ['/auth/login', '/books', '/health', '/health/ready']) {
      expect(Boolean(json.body.paths[path])).toBe(true);
    }
    expect(
      Object.keys(json.body.paths).some((path) => path.startsWith('/__test')),
    ).toBe(false);
    expect(json.body.components.securitySchemes.bearer.type).toBe('http');
  });

  it('serves public liveness and migrated database readiness', async () => {
    const live = await request(app.baseUrl).get('/health');
    expect(live.status).toBe(200);
    expect(Object.keys(live.body).sort()).toEqual([
      'status',
      'timestamp',
      'uptimeSeconds',
    ]);
    expect(live.body.status).toBe('ok');
    expect(new Date(live.body.timestamp).toISOString()).toBe(
      live.body.timestamp,
    );
    expect(live.body.uptimeSeconds).toEqual(expect.any(Number));
    const ready = await request(app.baseUrl).get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({
      status: 'ok',
      checks: { database: 'ok', auth: 'ok' },
    });
  });

  it('records the actual global-filter readiness failure when an audit key is unavailable', async () => {
    const fixture = await context.connection
      .collection('auth_throttle_buckets')
      .insertOne({
        dimension: 'sign-in-source',
        keyVersion: 99,
        bucketKey: 'readiness-only-fixture',
        count: 1,
        windowStartedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
    try {
      const response = await request(app.baseUrl).get('/health/ready');
      expectError(
        response,
        503,
        '/health/ready',
        'Service Unavailable Exception',
        'ServiceUnavailableException',
      );
    } finally {
      await context.connection
        .collection('auth_throttle_buckets')
        .deleteOne({ _id: fixture.insertedId });
    }
    expect((await request(app.baseUrl).get('/health/ready')).status).toBe(200);
  });

  it('serves the explicit static asset directory', async () => {
    const response = await request(app.baseUrl).get('/app.js');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(
      /(?:application|text)\/javascript/,
    );
    expect(response.text).toBe(asset);
  });

  it.each([
    '/',
    '/login',
    '/unauthorized',
    '/staff',
    '/staff/catalog/books/fixture',
    '/member',
    '/member/borrowings/fixture',
  ])('serves frontend deep link %s', async (path) => {
    const response = await request(app.baseUrl).get(path);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toBe(indexHtml);
  });

  it.each([
    '/api/does-not-exist',
    '/auth/does-not-exist',
    '/books/does-not-exist',
    '/login/extra',
    '/staffish',
    '/memberish',
    '/__test/auth-benchmark/unprotected',
  ])(
    'keeps unknown API/non-frontend path %s out of the HTML fallback',
    async (path) => {
      const response = await request(app.baseUrl)
        .get(path)
        .set('Accept', 'text/html');
      const protectedBook = path.startsWith('/books/');
      expectError(
        response,
        protectedBook ? 401 : 404,
        path,
        protectedBook ? 'Unauthorized' : `Cannot GET ${path}`,
        protectedBook ? 'UnauthorizedException' : 'Not Found',
      );
    },
  );

  it.each([
    {
      name: 'untrusted direct peer',
      cidrs: [],
      chains: ['198.51.100.1', '198.51.100.2, 10.0.0.2', 'malformed-address'],
      counts: [4],
    },
    {
      name: 'trusted right-to-left chain',
      cidrs: ['127.0.0.0/8', '10.0.0.0/8'],
      chains: [
        '203.0.113.1, 198.51.100.5, 10.0.0.2',
        '203.0.113.2, 198.51.100.5, 10.0.0.3',
        '198.51.100.6, 10.0.0.2',
        'malformed-address',
      ],
      counts: [1, 2, 2],
    },
  ])(
    'resolves source throttling for $name without spoofed forwarding bypass',
    async ({ cidrs, chains, counts }) => {
      const child = await launch(cidrs);
      try {
        await context.connection
          .collection('auth_throttle_buckets')
          .deleteMany({});
        for (const chain of chains) {
          const response = await request(child.baseUrl)
            .post('/auth/login')
            .set('Origin', origins[0])
            .set('X-Forwarded-For', chain)
            .set('X-Real-IP', '192.0.2.123')
            .set('Forwarded', 'for=192.0.2.124')
            .send({ identifier: 42 });
          expectError(
            response,
            400,
            '/auth/login',
            ['identifier must be a string'],
            'Bad Request',
          );
        }
        // Forwarded/X-Real-IP alone never replace the direct peer.
        await request(child.baseUrl)
          .post('/auth/login')
          .set('Origin', origins[0])
          .set('X-Real-IP', '192.0.2.125')
          .set('Forwarded', 'for=192.0.2.126')
          .send({ identifier: 42 })
          .expect(400);
        const buckets = await context.connection
          .collection('auth_throttle_buckets')
          .find({}, { projection: { _id: 0, dimension: 1, count: 1 } })
          .toArray();
        expect(
          buckets.every((bucket) => bucket.dimension === 'sign-in-source'),
        ).toBe(true);
        expect(
          buckets.map((bucket) => bucket.count).sort((a, b) => a - b),
        ).toEqual(counts);
      } finally {
        await stop(child);
      }
    },
  );

  it('cleans up a timed-out child and redacts diagnostics across output chunks', async () => {
    const probe = join(staticDirectory, 'timeout-probe.cjs');
    const observation = join(staticDirectory, 'timeout-observation.json');
    await writeFile(
      probe,
      `
      require('node:fs').writeFileSync(process.env.PROBE_OBSERVATION,
        JSON.stringify({ pid: process.pid, directory: process.cwd() }));
      const secret = process.env.AUTH_COOKIE_SECRET;
      process.stdout.write(secret.slice(0, 12));
      setTimeout(() => process.stdout.write(secret.slice(12) + ' ' + process.env.MONGODB_URI), 5);
      setInterval(() => {}, 1000);
    `,
    );
    let failure: Error | undefined;
    try {
      const child = await startProductionProcess({
        entryPath: probe,
        mongoUri: context.uri,
        environment: { ...environment, PROBE_OBSERVATION: observation },
        startupTimeoutMs: 500,
      });
      children.add(child);
      await stop(child);
    } catch (error) {
      failure = error as Error;
    }
    expect(Boolean(failure)).toBe(true);
    expect(failure.message).toContain('did not become live (attempt 1)');
    expect(failure.message.includes(environment.AUTH_COOKIE_SECRET)).toBe(
      false,
    );
    expect(failure.message.includes(context.uri)).toBe(false);
    expect(failure.message).toContain('[redacted]');
    const observed = JSON.parse(await readFile(observation, 'utf8')) as {
      pid: number;
      directory: string;
    };
    expect(() => process.kill(observed.pid, 0)).toThrow();
    expect(
      await access(observed.directory).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
  });

  it('retries an actual address collision before launching the compiled bootstrap', async () => {
    const wrapper = join(staticDirectory, 'collision-probe.cjs');
    const observation = join(staticDirectory, 'collision-attempts.txt');
    await writeFile(
      wrapper,
      `
      const fs = require('node:fs');
      const file = process.env.PROBE_OBSERVATION;
      const count = fs.existsSync(file) ? Number(fs.readFileSync(file, 'utf8')) + 1 : 1;
      fs.writeFileSync(file, String(count));
      if (count === 1) {
        require('node:net').createServer().listen(Number(process.env.PORT), '127.0.0.1',
          () => require(process.env.PROBE_COMPILED_ENTRY));
      } else require(process.env.PROBE_COMPILED_ENTRY);
    `,
    );
    const child = await startProductionProcess({
      entryPath: wrapper,
      mongoUri: context.uri,
      environment: {
        ...environment,
        PROBE_OBSERVATION: observation,
        PROBE_COMPILED_ENTRY: entryPath,
      },
      startupAttempts: 2,
    });
    children.add(child);
    try {
      expect(await readFile(observation, 'utf8')).toBe('2');
      expect((await request(child.baseUrl).get('/health/ready')).status).toBe(
        200,
      );
    } finally {
      await stop(child);
    }
  });

  it('rejects invalid production configuration and redacts startup diagnostics', async () => {
    let failure: Error | undefined;
    try {
      const child = await startProductionProcess({
        entryPath,
        mongoUri: context.uri,
        environment: {
          ...environment,
          AUTH_TRUSTED_BROWSER_ORIGINS: '["http://unsafe.example.test"]',
        },
        startupTimeoutMs: 5_000,
      });
      children.add(child);
      await stop(child);
    } catch (error) {
      failure = error as Error;
    }
    expect(Boolean(failure)).toBe(true);
    expect(failure.message).toContain('must contain only HTTPS origins');
    for (const value of [
      context.uri,
      environment.JWT_SECRET,
      environment.AUTH_COOKIE_SECRET,
      environment.AUTH_AUDIT_CORRELATION_SECRET,
    ]) {
      expect(failure.message.includes(value)).toBe(false);
    }
  });

  it('fails readiness within five seconds after database loss while liveness remains public', async () => {
    await mongo.stop();
    const started = Date.now();
    const response = await request(app.baseUrl)
      .get('/health/ready')
      .timeout(5_000);
    expectError(
      response,
      503,
      '/health/ready',
      'Service Unavailable Exception',
      'ServiceUnavailableException',
    );
    expect(Date.now() - started).toBeLessThan(5_000);
    expect((await request(app.baseUrl).get('/health')).status).toBe(200);
  });

  it('observes exit and makes controlled shutdown idempotent', async () => {
    const first = await app.stop();
    expect(await app.exited).toEqual(first);
    expect(await app.stop()).toEqual(first);
    expect(first).toEqual({ code: null, signal: 'SIGTERM' });
    children.delete(app);
    expect(app.diagnostics().includes(environment.JWT_SECRET)).toBe(false);
    expect(app.diagnostics().includes(context.uri)).toBe(false);
  });
});
