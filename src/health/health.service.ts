import {
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AuthIdentifierRepairKeyPolicyService } from '../auth/auth-identifier-repair-key-policy.service';

export type AuthReadinessFailureReason =
  | 'repair-key-required'
  | 'throttle-key-required'
  | 'migration-required'
  | 'auth-infrastructure-unavailable';

export interface AuthReadinessResult {
  ready: boolean;
  reason?: AuthReadinessFailureReason | 'ready';
}

export interface AuthReadinessKeyPolicy {
  evaluateReadiness(): AuthReadinessResult | Promise<AuthReadinessResult>;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadinessResponse {
  status: 'ok';
  checks: {
    database: 'ok';
    auth: 'ok';
  };
}

type CheckResult =
  | { ready: true }
  | {
      ready: false;
      reason: 'database-unavailable' | AuthReadinessFailureReason;
    };

const READINESS_TIMEOUT_MS = 4_000;
const allowedAuthReasons = new Set<AuthReadinessFailureReason>([
  'repair-key-required',
  'throttle-key-required',
  'migration-required',
  'auth-infrastructure-unavailable',
]);

function isAuthReadinessFailureReason(
  reason: unknown,
): reason is AuthReadinessFailureReason {
  return (
    typeof reason === 'string' &&
    allowedAuthReasons.has(reason as AuthReadinessFailureReason)
  );
}

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Optional()
    @Inject(AuthIdentifierRepairKeyPolicyService)
    private readonly authKeyPolicy?: AuthReadinessKeyPolicy,
  ) {}

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const [database, auth] = await Promise.all([
      this.checkDatabase(),
      this.checkAuthInfrastructure(),
    ]);

    if ('reason' in database) {
      throw new ServiceUnavailableException({
        status: 'error',
        reason: database.reason,
      });
    }
    if ('reason' in auth) {
      throw new ServiceUnavailableException({
        status: 'error',
        reason: auth.reason,
      });
    }

    return {
      status: 'ok',
      checks: {
        database: 'ok',
        auth: 'ok',
      },
    };
  }

  private async checkDatabase(): Promise<CheckResult> {
    if (this.connection.readyState !== 1 || !this.connection.db) {
      return { ready: false, reason: 'database-unavailable' };
    }

    try {
      await this.withTimeout(this.connection.db.admin().ping());
      return { ready: true };
    } catch {
      return { ready: false, reason: 'database-unavailable' };
    }
  }

  private async checkAuthInfrastructure(): Promise<CheckResult> {
    if (!this.authKeyPolicy) {
      return { ready: true };
    }

    try {
      const result = await this.withTimeout(
        Promise.resolve(this.authKeyPolicy.evaluateReadiness()),
      );
      if (result.ready) {
        return { ready: true };
      }

      return {
        ready: false,
        reason: isAuthReadinessFailureReason(result.reason)
          ? result.reason
          : 'auth-infrastructure-unavailable',
      };
    } catch {
      return { ready: false, reason: 'auth-infrastructure-unavailable' };
    }
  }

  private withTimeout<T>(operation: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('readiness-timeout')),
        READINESS_TIMEOUT_MS,
      );

      operation.then(
        (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(error instanceof Error ? error : new Error('check-failed'));
        },
      );
    });
  }
}
