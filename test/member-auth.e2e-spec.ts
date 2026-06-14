import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { MemberAuthGuard } from '../src/auth/member-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { StaffRole } from '../src/common/enums/library-status.enum';
import { BorrowingsService } from '../src/borrowings/borrowings.service';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';

describe('Member self-service authorization (e2e)', () => {
  let app: INestApplication;
  const membersService = {
    findOne: jest.fn(),
    findSelfServiceProfile: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getPolicyStatus: jest.fn(),
  };
  const borrowingsService = {
    findByMember: jest.fn(),
    findOneForMember: jest.fn(),
  };
  const usersByToken = {
    'member-token': {
      id: 'member-1',
      memberNumber: 'M-1001',
      roleArea: 'member',
    },
    'staff-token': {
      id: 'staff-1',
      email: 'staff@example.test',
      displayName: 'Staff User',
      roles: [StaffRole.Staff],
      roleArea: 'staff',
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
    jest.clearAllMocks();
    membersService.findOne.mockResolvedValue({ id: 'member-1' });
    membersService.findSelfServiceProfile.mockResolvedValue({ id: 'member-1' });
    membersService.getPolicyStatus.mockResolvedValue({ memberId: 'member-1' });
    borrowingsService.findByMember.mockResolvedValue([
      { id: 'borrowing-1', memberId: 'member-1' },
    ]);
    borrowingsService.findOneForMember.mockResolvedValue({
      id: 'borrowing-1',
      memberId: 'member-1',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MembersController],
      providers: [
        MemberAuthGuard,
        RolesGuard,
        { provide: MembersService, useValue: membersService },
        { provide: BorrowingsService, useValue: borrowingsService },
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

  it('derives /members/me from the authenticated member token', async () => {
    await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', 'Bearer member-token')
      .expect(200);

    expect(membersService.findSelfServiceProfile).toHaveBeenCalledWith(
      'member-1',
    );
  });

  it('does not allow member tokens to access arbitrary staff member IDs', async () => {
    await request(app.getHttpServer())
      .get('/members/member-2')
      .set('Authorization', 'Bearer member-token')
      .expect(403);
  });

  it('does not allow staff tokens to access member self-service routes', async () => {
    await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', 'Bearer staff-token')
      .expect(403);
  });
});
