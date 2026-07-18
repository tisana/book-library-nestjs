import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  UnprocessableEntityException,
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
import { AuthPermission } from '../src/common/enums/auth-permission.enum';

describe('identifier conflict administrator endpoints (e2e)', () => {
  let app: INestApplication;
  let identifierService: {
    listConflicts: jest.Mock;
    resolveConflict: jest.Mock;
    getOperationStatus: jest.Mock;
  };
  const seenOperations = new Set<string>();
  const jwtGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<{
        headers: Record<string, string | undefined>;
        user?: unknown;
      }>();
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) throw new UnauthorizedException();
      const admin = token === 'admin-token';
      req.user = {
        id: admin ? 'admin-1' : 'staff-1',
        authContext: {
          subjectId: admin ? 'admin-1' : 'staff-1',
          roleArea: 'staff',
          roles: [admin ? 'admin' : 'staff'],
          permissions: admin
            ? [
                AuthPermission.AuthIdentifiersRead,
                AuthPermission.AuthIdentifiersManage,
              ]
            : [],
          authVersion: 0,
        },
      };
      return true;
    },
  };

  beforeEach(async () => {
    seenOperations.clear();
    identifierService = {
      listConflicts: jest.fn().mockResolvedValue([
        {
          id: 'conflict-1',
          normalizedIdentifier: 'shared@example.test',
          resolutionStatus: 'reviewable',
          subjects: [
            {
              subjectType: 'staff',
              subjectId: 'staff-1',
              displayLabel: 'Staff account: Li*** A***',
            },
            {
              subjectType: 'member',
              subjectId: 'member-1',
              displayLabel: 'Member account: M-1***',
            },
          ],
        },
      ]),
      resolveConflict: jest.fn(async (_id, dto) => {
        if (dto.reassignments.length > 20) {
          throw new UnprocessableEntityException(
            'Identifier operation supports at most 20 assignments',
          );
        }
        const replayed = seenOperations.has(dto.operationId);
        seenOperations.add(dto.operationId);
        const failed = dto.operationId === 'failed-operation';
        return {
          operationId: dto.operationId,
          status: failed ? 'failed-terminal' : 'completed',
          httpStatus: failed ? 409 : 200,
          replayed,
          result: {
            outcome: failed ? 'failure' : 'success',
            reasonCategory: failed
              ? 'identifier-conflict-resolution-failed'
              : 'identifier-conflict-resolved',
            httpStatus: failed ? 409 : 200,
          },
        };
      }),
      getOperationStatus: jest.fn().mockResolvedValue({
        operationId: 'operation-1',
        status: 'completed',
        subjects: [
          { subjectType: 'staff', subjectId: 'staff-1' },
          { subjectType: 'member', subjectId: 'member-1' },
        ],
        currentStep: 'completed',
        outcome: 'success',
        reasonCategory: 'identifier-conflict-resolved',
        httpStatus: 200,
      }),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        PermissionsGuard,
        PermissionsService,
        { provide: AuthService, useValue: {} },
        { provide: AuthThrottleService, useValue: {} },
        { provide: AuthIdentifierService, useValue: identifierService },
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
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('denies regular staff and returns only safe conflict labels to an administrator', async () => {
    await request(app.getHttpServer())
      .get('/auth/identifier-conflicts')
      .set('Authorization', 'Bearer staff-token')
      .expect(403);

    const response = await request(app.getHttpServer())
      .get('/auth/identifier-conflicts')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
    expect(response.body[0].subjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayLabel: 'Staff account: Li*** A***' }),
      ]),
    );
    expect(JSON.stringify(response.body)).not.toMatch(/password|token|hash/i);
  });

  it('supports retained and no-retained mappings and replays the original status', async () => {
    const retainedBody = {
      operationId: 'operation-1',
      retainedSubject: { subjectType: 'staff', subjectId: 'staff-1' },
      reassignments: [
        {
          subjectType: 'member',
          subjectId: 'member-1',
          newIdentifier: 'member.one@example.test',
        },
      ],
    };
    await request(app.getHttpServer())
      .post('/auth/identifier-conflicts/conflict-1/resolve')
      .set('Authorization', 'Bearer admin-token')
      .send(retainedBody)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ replayed: false }));
    await request(app.getHttpServer())
      .post('/auth/identifier-conflicts/conflict-1/resolve')
      .set('Authorization', 'Bearer admin-token')
      .send(retainedBody)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ replayed: true }));
    await request(app.getHttpServer())
      .post('/auth/identifier-conflicts/conflict-1/resolve')
      .set('Authorization', 'Bearer admin-token')
      .send({
        operationId: 'failed-operation',
        reassignments: [
          {
            subjectType: 'staff',
            subjectId: 'staff-1',
            newIdentifier: 'staff.new@example.test',
          },
          {
            subjectType: 'member',
            subjectId: 'member-1',
            newIdentifier: 'member.new@example.test',
          },
        ],
      })
      .expect(409)
      .expect(({ body }) =>
        expect(body).toMatchObject({ status: 'failed-terminal', outcome: 'failure' }),
      );
  });

  it('returns 422 above the online assignment limit and exposes redacted operation status', async () => {
    const assignments = Array.from({ length: 21 }, (_, index) => ({
      subjectType: 'member',
      subjectId: `member-${index}`,
      newIdentifier: `member-${index}@example.test`,
    }));
    await request(app.getHttpServer())
      .post('/auth/identifier-conflicts/conflict-1/resolve')
      .set('Authorization', 'Bearer admin-token')
      .send({ operationId: 'oversized-operation', reassignments: assignments })
      .expect(422);

    const response = await request(app.getHttpServer())
      .get('/auth/identifier-operations/operation-1')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
    expect(response.body).toMatchObject({
      operationId: 'operation-1',
      status: 'completed',
      currentStep: 'completed',
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /shared@example|member\.one@example|password|token|hash/i,
    );
  });
});
