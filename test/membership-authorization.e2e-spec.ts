import {
  CanActivate,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { BorrowingsService } from '../src/borrowings/borrowings.service';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';
import { MembershipTypesController } from '../src/membership-types/membership-types.controller';
import { MembershipTypesService } from '../src/membership-types/membership-types.service';

describe('Membership authorization (e2e)', () => {
  let app: INestApplication;
  let authenticated = false;
  let authorized = false;

  class TestJwtGuard implements CanActivate {
    canActivate(): boolean {
      if (!authenticated) {
        throw new UnauthorizedException();
      }

      return true;
    }
  }

  class TestRolesGuard implements CanActivate {
    canActivate(): boolean {
      if (!authorized) {
        throw new ForbiddenException();
      }

      return true;
    }
  }

  beforeEach(async () => {
    authenticated = false;
    authorized = false;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MembershipTypesController, MembersController],
      providers: [
        {
          provide: MembershipTypesService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'membership-type-id' }),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ id: 'membership-type-id' }),
          },
        },
        {
          provide: MembersService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'member-id' }),
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue({ id: 'member-id' }),
            update: jest.fn().mockResolvedValue({ id: 'member-id' }),
            getPolicyStatus: jest.fn().mockResolvedValue({ id: 'member-id' }),
          },
        },
        {
          provide: BorrowingsService,
          useValue: {
            findByMember: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtGuard)
      .overrideGuard(RolesGuard)
      .useClass(TestRolesGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated membership management requests', async () => {
    await request(app.getHttpServer()).get('/membership-types').expect(401);
    await request(app.getHttpServer()).get('/members').expect(401);
  });

  it('rejects authenticated users without a required staff/admin role', async () => {
    authenticated = true;

    await request(app.getHttpServer())
      .post('/membership-types')
      .send({})
      .expect(403);
    await request(app.getHttpServer()).post('/members').send({}).expect(403);
  });

  it('allows authenticated staff/admin membership management requests', async () => {
    authenticated = true;
    authorized = true;

    await request(app.getHttpServer()).get('/membership-types').expect(200);
    await request(app.getHttpServer()).get('/members').expect(200);
  });
});
