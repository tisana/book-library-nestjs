import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { PermissionsService } from '../src/auth/permissions.service';
import { RolesGuard } from '../src/auth/roles.guard';
import { AuthPermission } from '../src/common/enums/auth-permission.enum';
import { StaffRole } from '../src/common/enums/library-status.enum';
import { MembershipTypesController } from '../src/membership-types/membership-types.controller';
import { MembershipTypesService } from '../src/membership-types/membership-types.service';

describe('Membership type authorization (e2e)', () => {
  let app: INestApplication;

  const usersByToken = {
    'member-token': {
      id: 'member-id',
      roleArea: 'member',
      roles: ['member'],
      permissions: [AuthPermission.MemberSelfRead],
    },
    'staff-without-membership-permissions-token': {
      id: 'staff-id',
      roleArea: 'staff',
      roles: [StaffRole.Staff],
      permissions: [AuthPermission.CatalogRead],
    },
    'membership-reader-token': {
      id: 'staff-id',
      roleArea: 'staff',
      roles: [StaffRole.Staff],
      permissions: [AuthPermission.MembershipTypesRead],
    },
    'membership-manager-token': {
      id: 'staff-id',
      roleArea: 'staff',
      roles: [StaffRole.Staff],
      permissions: [
        AuthPermission.MembershipTypesRead,
        AuthPermission.MembershipTypesManage,
      ],
    },
  };

  const jwtGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const httpRequest = context.switchToHttp().getRequest<{
        headers: Record<string, string | undefined>;
        user?: unknown;
      }>();
      const token = httpRequest.headers.authorization?.replace('Bearer ', '');
      const user = token
        ? usersByToken[token as keyof typeof usersByToken]
        : undefined;

      if (!user) {
        throw new UnauthorizedException();
      }

      httpRequest.user = user;
      return true;
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MembershipTypesController],
      providers: [
        PermissionsGuard,
        PermissionsService,
        RolesGuard,
        {
          provide: MembershipTypesService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'membership-type-id' }),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ id: 'membership-type-id' }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('denies member tokens from membership-type staff routes', async () => {
    await request(app.getHttpServer())
      .get('/membership-types')
      .set('Authorization', 'Bearer member-token')
      .expect(403);
    await request(app.getHttpServer())
      .post('/membership-types')
      .set('Authorization', 'Bearer member-token')
      .send({})
      .expect(403);
  });

  it('denies staff tokens without membership-type permissions', async () => {
    await request(app.getHttpServer())
      .get('/membership-types')
      .set('Authorization', 'Bearer staff-without-membership-permissions-token')
      .expect(403);
    await request(app.getHttpServer())
      .post('/membership-types')
      .set('Authorization', 'Bearer staff-without-membership-permissions-token')
      .send({})
      .expect(403);
  });

  it('allows read permission to list but not manage membership types', async () => {
    await request(app.getHttpServer())
      .get('/membership-types')
      .set('Authorization', 'Bearer membership-reader-token')
      .expect(200);
    await request(app.getHttpServer())
      .post('/membership-types')
      .set('Authorization', 'Bearer membership-reader-token')
      .send({})
      .expect(403);
  });

  it('allows manage permission to create and update membership types', async () => {
    await request(app.getHttpServer())
      .post('/membership-types')
      .set('Authorization', 'Bearer membership-manager-token')
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .patch('/membership-types/membership-type-id')
      .set('Authorization', 'Bearer membership-manager-token')
      .send({})
      .expect(200);
  });
});
