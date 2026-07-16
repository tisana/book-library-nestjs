import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { refreshCookieName } from './auth.service';
import { AuthSourceIdentityService } from './auth-source-identity.service';
import {
  AuthThrottleDecision,
  AuthThrottleService,
} from './auth-throttle.service';
import { TokenSessionService } from './token-session.service';

export interface AuthThrottleRequestContext {
  sourceIdentity: string;
  normalizedIdentifier?: string;
}

export type RequestWithAuthThrottle = Request & {
  authThrottle?: AuthThrottleRequestContext;
};

export function assertAuthThrottleAllowed(
  decision: AuthThrottleDecision,
  response: Response,
): void {
  if (decision.allowed) {
    return;
  }

  if (decision.retryAfterSeconds) {
    response.setHeader('Retry-After', String(decision.retryAfterSeconds));
  }

  throw new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Authentication temporarily unavailable',
      error: 'Too Many Requests',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

@Injectable()
export class AuthEndpointThrottleGuard implements CanActivate {
  constructor(
    private readonly throttleService: AuthThrottleService,
    private readonly sourceIdentityService: AuthSourceIdentityService,
    private readonly tokenSessionService: TokenSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithAuthThrottle>();
    const response = http.getResponse<Response>();
    const sourceIdentity = this.sourceIdentityService.resolve(request);
    const route = this.routeCategory(request);

    if (route === 'login' || route === 'member-login') {
      const normalizedIdentifier = this.normalizedIdentifier(request.body);
      const missingCredential = this.hasMissingCredential(request.body);
      const decision = await this.throttleService
        .consumeSignInAttempt({
          sourceIdentity,
          normalizedIdentifier,
          failureCategory:
            normalizedIdentifier && missingCredential
              ? 'missing-credential'
              : undefined,
        })
        .catch(() => ({ allowed: false }) as AuthThrottleDecision);

      request.authThrottle = { sourceIdentity, normalizedIdentifier };
      assertAuthThrottleAllowed(decision, response);
    } else if (route === 'refresh') {
      const refreshToken = this.refreshCookie(request);
      const familyId =
        await this.tokenSessionService.resolveFamilyId(refreshToken);
      const decision = await this.throttleService
        .consumeRefreshAttempt({ sourceIdentity, familyId })
        .catch(() => ({ allowed: false }) as AuthThrottleDecision);
      request.authThrottle = { sourceIdentity };
      assertAuthThrottleAllowed(decision, response);
    }

    return true;
  }

  private routeCategory(
    request: Request,
  ): 'login' | 'member-login' | 'refresh' | 'other' {
    const path = request.route?.path ?? request.path ?? '';

    if (path.endsWith('/member-login') || path === 'member-login') {
      return 'member-login';
    }
    if (path.endsWith('/login') || path === 'login') {
      return 'login';
    }
    if (path.endsWith('/refresh') || path === 'refresh') {
      return 'refresh';
    }
    return 'other';
  }

  private normalizedIdentifier(body: unknown): string | undefined {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return undefined;
    }

    const value =
      (body as { identifier?: unknown }).identifier ??
      (body as { email?: unknown }).email ??
      (body as { loginIdentifier?: unknown }).loginIdentifier;

    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();
    return normalized || undefined;
  }

  private hasMissingCredential(body: unknown): boolean {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return true;
    }

    const payload = body as Record<string, unknown>;
    const identifier =
      payload.identifier ?? payload.email ?? payload.loginIdentifier;
    return (
      typeof identifier !== 'string' ||
      identifier.trim().length === 0 ||
      typeof payload.password !== 'string' ||
      payload.password.length === 0
    );
  }

  private refreshCookie(request: Request): string | undefined {
    const cookieHeader = request.headers.cookie ?? '';
    const cookie = cookieHeader
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${refreshCookieName}=`));
    const value = cookie?.split('=').slice(1).join('=');

    return value ? decodeURIComponent(value) : undefined;
  }
}
