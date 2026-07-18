import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthBrowserOriginGuard } from '../src/auth/auth-browser-origin.guard';
import { AuthController } from '../src/auth/auth.controller';
import { AuthEndpointThrottleGuard } from '../src/auth/auth-endpoint-throttle.guard';
import { AuthIdentifierService } from '../src/auth/auth-identifier.service';
import { AuthService } from '../src/auth/auth.service';
import { AuthThrottleService } from '../src/auth/auth-throttle.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { PermissionsService } from '../src/auth/permissions.service';
import {
  SecurityActivityActorType,
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from '../src/auth/schemas/security-activity-event.schema';
import { SecurityActivityService } from '../src/auth/security-activity.service';
import { AuthPermission } from '../src/common/enums/auth-permission.enum';

describe('security activity administrator endpoint (e2e)', () => {
  let app: INestApplication;
  let securityActivity: { list: jest.Mock; record: jest.Mock };

  const jwtGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<{
        headers: Record<string, string | undefined>;
        user?: unknown;
      }>();
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) throw new UnauthorizedException();
      const roleArea = token === 'member-token' ? 'member' : 'staff';
      const subjectId = `${roleArea}-1`;
      req.user = {
        id: subjectId,
        authContext: {
          subjectId,
          roleArea,
          roles: [token === 'admin-token' ? 'admin' : roleArea],
          permissions:
            token === 'admin-token'
              ? [AuthPermission.SecurityEventsRead]
              : roleArea === 'member'
                ? [AuthPermission.MemberSelfRead]
                : [],
          authVersion: 0,
        },
      };
      return true;
    },
  };

  beforeEach(async () => {
    const eventTypes = Object.values(SecurityActivityEventType);
    securityActivity = {
      list: jest.fn().mockResolvedValue({
        items: eventTypes.map((eventType, index) => ({
          id: `event-${index}`,
          eventType,
          actorType: SecurityActivityActorType.System,
          outcome: SecurityActivityOutcome.Success,
          reasonCategory: 'safe-category',
          createdAt: '2026-07-18T01:00:00.000Z',
        })),
        page: 1,
        limit: 50,
        total: eventTypes.length,
        totalPages: 1,
      }),
      record: jest.fn().mockResolvedValue(undefined),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        PermissionsGuard,
        PermissionsService,
        { provide: AuthService, useValue: {} },
        { provide: AuthThrottleService, useValue: {} },
        { provide: AuthIdentifierService, useValue: {} },
        { provide: SecurityActivityService, useValue: securityActivity },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuard)
      .overrideGuard(AuthBrowserOriginGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthEndpointThrottleGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => app.close());

  it('denies staff and members but returns the complete safe catalog to an admin', async () => {
    await request(app.getHttpServer())
      .get('/auth/security-activity')
      .set('Authorization', 'Bearer staff-token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/auth/security-activity')
      .set('Authorization', 'Bearer member-token')
      .expect(403);

    const response = await request(app.getHttpServer())
      .get('/auth/security-activity?eventType=authorization-denied&limit=50')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(response.body.items.map((event: { eventType: string }) => event.eventType)).toEqual(
      Object.values(SecurityActivityEventType),
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /reader@example|submittedIdentifier|normalizedIdentifier|password|raw-token/i,
    );
    expect(securityActivity.list).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityActivityEventType.AuthorizationDenied,
        limit: 50,
      }),
    );
    expect(securityActivity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityActivityEventType.AuthorizationDenied,
        actorType: SecurityActivityActorType.Member,
        outcome: SecurityActivityOutcome.Denied,
      }),
    );
  });
});
