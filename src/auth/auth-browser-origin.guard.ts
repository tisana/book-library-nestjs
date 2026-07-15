import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type OriginDenialReason =
  | 'missing'
  | 'multiple'
  | 'opaque'
  | 'malformed'
  | 'untrusted';

type BrowserSessionRoute =
  | 'login'
  | 'member-login'
  | 'refresh'
  | 'logout'
  | 'logout-all'
  | 'browser-session';

interface WarningSample {
  lastEmittedAt: number;
  suppressedCount: number;
}

const warningIntervalMs = 60_000;
const genericDenialMessage = 'Browser session request denied';

@Injectable()
export class AuthBrowserOriginGuard implements CanActivate {
  private readonly logger = new Logger(AuthBrowserOriginGuard.name);
  private readonly trustedOrigins: ReadonlySet<string>;
  private readonly warningSamples = new Map<string, WarningSample>();

  constructor(configService: ConfigService) {
    this.trustedOrigins = new Set(
      configService.get<string[]>('auth.trustedBrowserOrigins') ?? [],
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      path?: string;
      route?: { path?: string };
    }>();
    const originHeader = request.headers?.origin;
    const reason = this.denialReason(originHeader);

    if (!reason) {
      return true;
    }

    this.sampleWarning(this.routeCategory(request), reason ?? 'untrusted');
    throw new ForbiddenException(genericDenialMessage);
  }

  private denialReason(
    originHeader: string | string[] | undefined,
  ): OriginDenialReason | undefined {
    if (originHeader === undefined || originHeader.length === 0) {
      return 'missing';
    }

    if (Array.isArray(originHeader) || originHeader.includes(',')) {
      return 'multiple';
    }

    if (originHeader === 'null') {
      return 'opaque';
    }

    try {
      const parsed = new URL(originHeader);
      if (
        (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash
      ) {
        return 'malformed';
      }

      return this.trustedOrigins.has(parsed.origin) ? undefined : 'untrusted';
    } catch {
      return 'malformed';
    }
  }

  private routeCategory(request: {
    path?: string;
    route?: { path?: string };
  }): BrowserSessionRoute {
    const path = request.route?.path ?? request.path ?? '';
    const segments = path.split('/').filter(Boolean);
    const finalSegment = segments[segments.length - 1];

    switch (finalSegment) {
      case 'login':
      case 'member-login':
      case 'refresh':
      case 'logout':
      case 'logout-all':
        return finalSegment;
      default:
        return 'browser-session';
    }
  }

  private sampleWarning(
    route: BrowserSessionRoute,
    reason: OriginDenialReason,
  ): void {
    const key = `${route}:${reason}`;
    const now = Date.now();
    const sample = this.warningSamples.get(key);

    if (sample && now - sample.lastEmittedAt < warningIntervalMs) {
      sample.suppressedCount += 1;
      return;
    }

    const suppressedCount = sample?.suppressedCount ?? 0;
    this.warningSamples.set(key, { lastEmittedAt: now, suppressedCount: 0 });
    this.logger.warn({
      event: 'browser-session-origin-denied',
      route,
      reason,
      suppressedCount,
    });
  }
}
