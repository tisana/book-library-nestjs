import { loadAuthConfig } from './auth.config';

const secret = (fill: number) => Buffer.alloc(32, fill).toString('base64url');

function productionEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    JWT_ISSUER: 'https://identity.example.test',
    JWT_AUDIENCE: 'book-library-api',
    JWT_SECRET: 'j'.repeat(32),
    AUTH_COOKIE_SECRET: 'c'.repeat(32),
    AUTH_AUDIT_CORRELATION_SECRET: secret(1),
    AUTH_AUDIT_CORRELATION_KEY_VERSION: '3',
    AUTH_TRUSTED_BROWSER_ORIGINS: '["https://library.example.test"]',
    ...overrides,
  };
}

describe('auth configuration', () => {
  it('loads bounded local defaults and fixed refresh rotation settings', () => {
    const config = loadAuthConfig({ NODE_ENV: 'test' });

    expect(config).toMatchObject({
      issuer: 'book-library-local',
      audience: 'book-library-api',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 2_592_000,
      identifierLeaseSeconds: 300,
      identifierReconciliationIntervalSeconds: 60,
      identifierReconciliationBatchSize: 100,
      identifierOperationRetentionDays: 90,
      identifierMaxOperationAssignments: 20,
      refreshRotationLeaseSeconds: 30,
      refreshRotationReconciliationIntervalSeconds: 60,
      refreshRotationReconciliationBatchSize: 100,
      signInIdentifierFailureLimit: 5,
      signInSourceLimit: 20,
      signInWindowSeconds: 900,
      refreshThrottleLimit: 30,
      refreshThrottleWindowSeconds: 300,
      trustedProxyCidrs: [],
      trustedBrowserOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    });
    expect(config.jwtExpiresIn).toBe('900s');
  });

  it('exposes current and previous audit keys by version', () => {
    const current = secret(7);
    const previous = secret(6);
    const config = loadAuthConfig({
      NODE_ENV: 'test',
      AUTH_AUDIT_CORRELATION_SECRET: current,
      AUTH_AUDIT_CORRELATION_KEY_VERSION: '7',
      AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS: JSON.stringify({ 6: previous }),
    });

    expect(config.auditCorrelationKeyRing).toEqual({
      currentVersion: 7,
      keysByVersion: { 6: previous, 7: current },
    });
  });

  it.each([
    ['[]', 'JSON object'],
    ['{"1":"value","1":"value"}', 'duplicate'],
    [JSON.stringify({ 0: secret(1) }), 'positive integer'],
    [JSON.stringify({ 3: secret(1) }), 'current version'],
    [
      JSON.stringify({ 1: secret(1), 2: secret(2), 4: secret(4) }),
      'at most two',
    ],
    [JSON.stringify({ 1: 'short' }), 'at least 32 bytes'],
  ])('rejects invalid previous-key JSON %s', (value, message) => {
    expect(() =>
      loadAuthConfig({
        NODE_ENV: 'test',
        AUTH_AUDIT_CORRELATION_KEY_VERSION: '3',
        AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS: value,
      }),
    ).toThrow(message);
  });

  it.each([
    ['ACCESS_TOKEN_TTL_SECONDS', '0'],
    ['ACCESS_TOKEN_TTL_SECONDS', '901'],
    ['REFRESH_TOKEN_TTL_SECONDS', '2592001'],
    ['AUTH_IDENTIFIER_LEASE_SECONDS', '29'],
    ['AUTH_IDENTIFIER_LEASE_SECONDS', '3601'],
    ['AUTH_IDENTIFIER_OPERATION_RETENTION_DAYS', '6'],
    ['AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS', '101'],
    ['AUTH_SIGNIN_SOURCE_LIMIT', '0'],
    ['AUTH_REFRESH_THROTTLE_WINDOW_SECONDS', '-1'],
  ])('rejects out-of-range %s', (name, value) => {
    expect(() => loadAuthConfig({ NODE_ENV: 'test', [name]: value })).toThrow(
      name,
    );
  });

  it('requires refresh lifetime to exceed the access lifetime', () => {
    expect(() =>
      loadAuthConfig({
        NODE_ENV: 'test',
        ACCESS_TOKEN_TTL_SECONDS: '300',
        REFRESH_TOKEN_TTL_SECONDS: '300',
      }),
    ).toThrow('must exceed ACCESS_TOKEN_TTL_SECONDS');
  });

  it('loads positive throttle and identifier overrides', () => {
    const config = loadAuthConfig({
      NODE_ENV: 'test',
      AUTH_IDENTIFIER_RECONCILIATION_INTERVAL_SECONDS: '15',
      AUTH_IDENTIFIER_RECONCILIATION_BATCH_SIZE: '25',
      AUTH_SIGNIN_IDENTIFIER_FAILURE_LIMIT: '7',
      AUTH_SIGNIN_SOURCE_LIMIT: '40',
      AUTH_SIGNIN_WINDOW_SECONDS: '600',
      AUTH_REFRESH_THROTTLE_LIMIT: '12',
      AUTH_REFRESH_THROTTLE_WINDOW_SECONDS: '120',
    });

    expect(config).toMatchObject({
      identifierReconciliationIntervalSeconds: 15,
      identifierReconciliationBatchSize: 25,
      signInIdentifierFailureLimit: 7,
      signInSourceLimit: 40,
      signInWindowSeconds: 600,
      refreshThrottleLimit: 12,
      refreshThrottleWindowSeconds: 120,
    });
  });

  it('loads IPv4 and IPv6 trusted proxy CIDRs', () => {
    expect(
      loadAuthConfig({
        NODE_ENV: 'test',
        AUTH_TRUSTED_PROXY_CIDRS: '["10.0.0.0/8","2001:db8::/32"]',
      }).trustedProxyCidrs,
    ).toEqual(['10.0.0.0/8', '2001:db8::/32']);
  });

  it.each(['not-json', '["10.0.0.1"]', '["10.0.0.0/33"]'])(
    'rejects malformed trusted proxy configuration %s',
    (value) => {
      expect(() =>
        loadAuthConfig({
          NODE_ENV: 'test',
          AUTH_TRUSTED_PROXY_CIDRS: value,
        }),
      ).toThrow('AUTH_TRUSTED_PROXY_CIDRS');
    },
  );

  it.each(['["0.0.0.0/0"]', '["::/0"]'])(
    'rejects production all-address proxy trust %s',
    (value) => {
      expect(() =>
        loadAuthConfig(productionEnv({ AUTH_TRUSTED_PROXY_CIDRS: value })),
      ).toThrow('all-address');
    },
  );

  it('canonicalizes exact origins including root paths and default ports', () => {
    const config = loadAuthConfig({
      NODE_ENV: 'test',
      AUTH_TRUSTED_BROWSER_ORIGINS:
        '["https://example.test/","http://localhost:80"]',
    });

    expect(config.trustedBrowserOrigins).toEqual([
      'https://example.test',
      'http://localhost',
    ]);
  });

  it.each([
    '["null"]',
    '["https://*.example.test"]',
    '["https://user@example.test"]',
    '["https://example.test/path"]',
    '["https://example.test?query=1"]',
    '["https://example.test#fragment"]',
    '["https://example.test","https://example.test:443"]',
  ])('rejects unsafe browser origins %s', (value) => {
    expect(() =>
      loadAuthConfig({
        NODE_ENV: 'test',
        AUTH_TRUSTED_BROWSER_ORIGINS: value,
      }),
    ).toThrow('AUTH_TRUSTED_BROWSER_ORIGINS');
  });

  it('requires non-empty HTTPS browser origins in production', () => {
    expect(() =>
      loadAuthConfig(productionEnv({ AUTH_TRUSTED_BROWSER_ORIGINS: '[]' })),
    ).toThrow('at least one');
    expect(() =>
      loadAuthConfig(
        productionEnv({
          AUTH_TRUSTED_BROWSER_ORIGINS: '["http://library.example.test"]',
        }),
      ),
    ).toThrow('HTTPS');
  });

  it.each([
    ['JWT_ISSUER', undefined],
    ['JWT_AUDIENCE', undefined],
    ['JWT_SECRET', 'short'],
    ['AUTH_COOKIE_SECRET', 'short'],
    ['AUTH_AUDIT_CORRELATION_SECRET', 'sensitive-raw-value'],
  ])(
    'rejects unsafe production %s without reflecting its value',
    (name, value) => {
      const env = productionEnv({ [name]: value });

      try {
        loadAuthConfig(env);
        throw new Error('Expected configuration to be rejected');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain(name);
        if (value) {
          expect(message).not.toContain(value);
        }
        expect(message).not.toContain('library.example.test');
      }
    },
  );
});
