import { registerAs } from '@nestjs/config';
import { isIP } from 'node:net';

const developmentSecret = 'development-only-secret';
const developmentAuditSecret = Buffer.from(
  'development-only-audit-correlation-key',
).toString('base64url');
const localBrowserOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
] as const;

export const REFRESH_ROTATION_LEASE_SECONDS = 30;
export const REFRESH_ROTATION_RECONCILIATION_INTERVAL_SECONDS = 60;
export const REFRESH_ROTATION_RECONCILIATION_BATCH_SIZE = 100;

export interface AuditCorrelationKeyRing {
  currentVersion: number;
  keysByVersion: Readonly<Record<string, string>>;
}

export interface AuthConfiguration {
  issuer: string;
  audience: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  cookieSecret: string;
  auditCorrelationSecret: string;
  auditCorrelationKeyVersion: number;
  auditCorrelationPreviousKeys: Readonly<Record<string, string>>;
  auditCorrelationKeyRing: AuditCorrelationKeyRing;
  identifierLeaseSeconds: number;
  identifierReconciliationIntervalSeconds: number;
  identifierReconciliationBatchSize: number;
  identifierOperationRetentionDays: number;
  identifierMaxOperationAssignments: number;
  refreshRotationLeaseSeconds: number;
  refreshRotationReconciliationIntervalSeconds: number;
  refreshRotationReconciliationBatchSize: number;
  signInIdentifierFailureLimit: number;
  signInSourceLimit: number;
  signInWindowSeconds: number;
  refreshThrottleLimit: number;
  refreshThrottleWindowSeconds: number;
  trustedProxyCidrs: readonly string[];
  trustedBrowserOrigins: readonly string[];
}

function configurationError(name: string, reason: string): Error {
  return new Error(`Invalid authentication configuration: ${name} ${reason}`);
}

function integerFromEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum = 1,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const rawValue = env[name];

  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw configurationError(
      name,
      `must be an integer from ${minimum} to ${maximum}`,
    );
  }

  return parsed;
}

function requiredText(
  env: NodeJS.ProcessEnv,
  name: string,
  developmentFallback: string,
): string {
  const value = env[name]?.trim();

  if (!value && env.NODE_ENV === 'production') {
    throw configurationError(name, 'is required in production');
  }

  return value || developmentFallback;
}

function productionSecret(
  env: NodeJS.ProcessEnv,
  name: string,
  developmentFallback: string,
): string {
  const value = env[name];
  const isProduction = env.NODE_ENV === 'production';

  if (!value && isProduction) {
    throw configurationError(name, 'is required in production');
  }

  const resolved = value ?? developmentFallback;

  if (
    isProduction &&
    (resolved === developmentSecret || Buffer.byteLength(resolved) < 32)
  ) {
    throw configurationError(name, 'must contain at least 32 bytes');
  }

  return resolved;
}

function base64urlSecret(name: string, value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw configurationError(name, 'must be an unpadded base64url secret');
  }

  let decoded: Buffer;

  try {
    decoded = Buffer.from(value, 'base64url');
  } catch {
    throw configurationError(name, 'must be an unpadded base64url secret');
  }

  if (decoded.length < 32 || decoded.toString('base64url') !== value) {
    throw configurationError(name, 'must decode to at least 32 bytes');
  }

  return value;
}

function parseJson(name: string, rawValue: string): unknown {
  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    throw configurationError(name, 'must be valid JSON');
  }
}

function parsePreviousKeys(
  env: NodeJS.ProcessEnv,
  currentVersion: number,
): Readonly<Record<string, string>> {
  const name = 'AUTH_AUDIT_CORRELATION_PREVIOUS_KEYS';
  const rawValue = env[name] ?? '{}';
  const parsed = parseJson(name, rawValue);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.getPrototypeOf(parsed) !== Object.prototype
  ) {
    throw configurationError(name, 'must be a JSON object');
  }

  const serializedKeys = Array.from(
    rawValue.matchAll(/"([^"\\]+)"\s*:/g),
    (match) => match[1],
  );
  if (new Set(serializedKeys).size !== serializedKeys.length) {
    throw configurationError(name, 'must not contain duplicate versions');
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > 2) {
    throw configurationError(name, 'must contain at most two versions');
  }

  const previousKeys: Record<string, string> = {};
  for (const [version, secret] of entries) {
    if (!/^[1-9]\d*$/.test(version) || !Number.isSafeInteger(Number(version))) {
      throw configurationError(name, 'must use positive integer versions');
    }
    if (Number(version) === currentVersion) {
      throw configurationError(name, 'must not contain the current version');
    }
    if (typeof secret !== 'string') {
      throw configurationError(name, 'must map versions to secrets');
    }

    previousKeys[version] = base64urlSecret(name, secret);
  }

  return Object.freeze(previousKeys);
}

function parseJsonStringArray(
  name: string,
  rawValue: string,
): readonly string[] {
  const parsed = parseJson(name, rawValue);
  if (
    !Array.isArray(parsed) ||
    parsed.some((value) => typeof value !== 'string')
  ) {
    throw configurationError(name, 'must be a JSON array of strings');
  }

  return parsed as string[];
}

function parseTrustedProxyCidrs(env: NodeJS.ProcessEnv): readonly string[] {
  const name = 'AUTH_TRUSTED_PROXY_CIDRS';
  const cidrs = parseJsonStringArray(name, env[name] ?? '[]');
  const seen = new Set<string>();

  for (const cidr of cidrs) {
    const separator = cidr.lastIndexOf('/');
    const address = separator > 0 ? cidr.slice(0, separator) : '';
    const prefixText = separator > 0 ? cidr.slice(separator + 1) : '';
    const family = isIP(address);
    const prefix = Number(prefixText);
    const maximumPrefix = family === 4 ? 32 : family === 6 ? 128 : -1;

    if (
      !family ||
      !/^\d+$/.test(prefixText) ||
      !Number.isInteger(prefix) ||
      prefix < 0 ||
      prefix > maximumPrefix
    ) {
      throw configurationError(name, 'contains an invalid IPv4 or IPv6 CIDR');
    }
    if (env.NODE_ENV === 'production' && prefix === 0) {
      throw configurationError(name, 'must not trust an all-address CIDR');
    }
    if (seen.has(cidr)) {
      throw configurationError(name, 'must not contain duplicate CIDRs');
    }

    seen.add(cidr);
  }

  return Object.freeze([...cidrs]);
}

function parseTrustedBrowserOrigins(env: NodeJS.ProcessEnv): readonly string[] {
  const name = 'AUTH_TRUSTED_BROWSER_ORIGINS';
  const configured = env[name];

  if (!configured && env.NODE_ENV === 'production') {
    throw configurationError(name, 'is required in production');
  }

  const origins = parseJsonStringArray(
    name,
    configured ?? JSON.stringify(localBrowserOrigins),
  );
  if (env.NODE_ENV === 'production' && origins.length === 0) {
    throw configurationError(name, 'must contain at least one origin');
  }

  const canonicalOrigins: string[] = [];
  const seen = new Set<string>();
  for (const candidate of origins) {
    if (
      candidate === 'null' ||
      candidate.includes('*') ||
      candidate.includes('?') ||
      candidate.includes('#')
    ) {
      throw configurationError(name, 'contains an unsafe origin');
    }

    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw configurationError(name, 'contains a malformed origin');
    }

    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/'
    ) {
      throw configurationError(name, 'must contain exact HTTP(S) origins');
    }
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      throw configurationError(name, 'must contain only HTTPS origins');
    }
    if (seen.has(url.origin)) {
      throw configurationError(name, 'must not contain duplicate origins');
    }

    seen.add(url.origin);
    canonicalOrigins.push(url.origin);
  }

  return Object.freeze(canonicalOrigins);
}

export function loadAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthConfiguration {
  const accessTokenTtlSeconds = integerFromEnv(
    env,
    'ACCESS_TOKEN_TTL_SECONDS',
    900,
    1,
    900,
  );
  const refreshTokenTtlSeconds = integerFromEnv(
    env,
    'REFRESH_TOKEN_TTL_SECONDS',
    60 * 60 * 24 * 30,
    1,
    2_592_000,
  );
  if (refreshTokenTtlSeconds <= accessTokenTtlSeconds) {
    throw configurationError(
      'REFRESH_TOKEN_TTL_SECONDS',
      'must exceed ACCESS_TOKEN_TTL_SECONDS',
    );
  }

  const auditCorrelationKeyVersion = integerFromEnv(
    env,
    'AUTH_AUDIT_CORRELATION_KEY_VERSION',
    1,
  );
  const auditCorrelationSecret = base64urlSecret(
    'AUTH_AUDIT_CORRELATION_SECRET',
    env.AUTH_AUDIT_CORRELATION_SECRET ?? developmentAuditSecret,
  );
  if (env.NODE_ENV === 'production' && !env.AUTH_AUDIT_CORRELATION_SECRET) {
    throw configurationError(
      'AUTH_AUDIT_CORRELATION_SECRET',
      'is required in production',
    );
  }
  const auditCorrelationPreviousKeys = parsePreviousKeys(
    env,
    auditCorrelationKeyVersion,
  );
  const keysByVersion = Object.freeze({
    ...auditCorrelationPreviousKeys,
    [auditCorrelationKeyVersion]: auditCorrelationSecret,
  });

  return {
    issuer: requiredText(env, 'JWT_ISSUER', 'book-library-local'),
    audience: requiredText(env, 'JWT_AUDIENCE', 'book-library-api'),
    jwtSecret: productionSecret(env, 'JWT_SECRET', developmentSecret),
    jwtExpiresIn: `${accessTokenTtlSeconds}s`,
    accessTokenTtlSeconds,
    refreshTokenTtlSeconds,
    cookieSecret: productionSecret(
      env,
      'AUTH_COOKIE_SECRET',
      developmentSecret,
    ),
    auditCorrelationSecret,
    auditCorrelationKeyVersion,
    auditCorrelationPreviousKeys,
    auditCorrelationKeyRing: {
      currentVersion: auditCorrelationKeyVersion,
      keysByVersion,
    },
    identifierLeaseSeconds: integerFromEnv(
      env,
      'AUTH_IDENTIFIER_LEASE_SECONDS',
      300,
      30,
      3_600,
    ),
    identifierReconciliationIntervalSeconds: integerFromEnv(
      env,
      'AUTH_IDENTIFIER_RECONCILIATION_INTERVAL_SECONDS',
      60,
    ),
    identifierReconciliationBatchSize: integerFromEnv(
      env,
      'AUTH_IDENTIFIER_RECONCILIATION_BATCH_SIZE',
      100,
    ),
    identifierOperationRetentionDays: integerFromEnv(
      env,
      'AUTH_IDENTIFIER_OPERATION_RETENTION_DAYS',
      90,
      7,
      365,
    ),
    identifierMaxOperationAssignments: integerFromEnv(
      env,
      'AUTH_IDENTIFIER_MAX_OPERATION_ASSIGNMENTS',
      20,
      2,
      100,
    ),
    refreshRotationLeaseSeconds: REFRESH_ROTATION_LEASE_SECONDS,
    refreshRotationReconciliationIntervalSeconds:
      REFRESH_ROTATION_RECONCILIATION_INTERVAL_SECONDS,
    refreshRotationReconciliationBatchSize:
      REFRESH_ROTATION_RECONCILIATION_BATCH_SIZE,
    signInIdentifierFailureLimit: integerFromEnv(
      env,
      'AUTH_SIGNIN_IDENTIFIER_FAILURE_LIMIT',
      5,
    ),
    signInSourceLimit: integerFromEnv(env, 'AUTH_SIGNIN_SOURCE_LIMIT', 20),
    signInWindowSeconds: integerFromEnv(env, 'AUTH_SIGNIN_WINDOW_SECONDS', 900),
    refreshThrottleLimit: integerFromEnv(
      env,
      'AUTH_REFRESH_THROTTLE_LIMIT',
      30,
    ),
    refreshThrottleWindowSeconds: integerFromEnv(
      env,
      'AUTH_REFRESH_THROTTLE_WINDOW_SECONDS',
      300,
    ),
    trustedProxyCidrs: parseTrustedProxyCidrs(env),
    trustedBrowserOrigins: parseTrustedBrowserOrigins(env),
  };
}

export default registerAs('auth', loadAuthConfig);
