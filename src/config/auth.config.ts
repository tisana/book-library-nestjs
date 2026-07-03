import { registerAs } from '@nestjs/config';

const developmentJwtSecret = 'development-only-secret';

function numberFromEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function requireProductionSecret(
  name: string,
  value: string | undefined,
): string {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!value && isProduction) {
    throw new Error(`${name} is required in production`);
  }

  if (isProduction && value === developmentJwtSecret) {
    throw new Error(
      `${name} must not use the development default in production`,
    );
  }

  return value ?? developmentJwtSecret;
}

export default registerAs('auth', () => {
  const accessTokenTtlSeconds = numberFromEnv('ACCESS_TOKEN_TTL_SECONDS', 900);
  const refreshTokenTtlSeconds = numberFromEnv(
    'REFRESH_TOKEN_TTL_SECONDS',
    60 * 60 * 24 * 30,
  );

  return {
    issuer: process.env.JWT_ISSUER ?? 'book-library-local',
    audience: process.env.JWT_AUDIENCE ?? 'book-library-api',
    jwtSecret: requireProductionSecret('JWT_SECRET', process.env.JWT_SECRET),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? `${accessTokenTtlSeconds}s`,
    accessTokenTtlSeconds,
    refreshTokenTtlSeconds,
    cookieSecret: requireProductionSecret(
      'AUTH_COOKIE_SECRET',
      process.env.AUTH_COOKIE_SECRET,
    ),
  };
});
