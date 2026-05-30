import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET ?? 'development-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
}));
