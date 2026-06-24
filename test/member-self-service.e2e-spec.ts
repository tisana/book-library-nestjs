import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { MemberAuthGuard } from '../src/auth/member-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { BorrowingsService } from '../src/borrowings/borrowings.service';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';

describe('Member self-service ownership (e2e)', () => {
  let app: INestApplication;
  const membersService = {
    findSelfServiceProfile: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getPolicyStatus: jest.fn(),
  };
  const borrowingsService = {
    findByMember: jest.fn(),
    findOneForMember: jest.fn(),
  };
  const jwtGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const httpRequest = context.switchToHttp().getRequest<{
        headers: Record<string, string | undefined>;
        user?: unknown;
      }>();
      const token = httpRequest.headers.authorization?.replace('Bearer ', '');

      if (token !== 'member-token') {
        throw new UnauthorizedException();
      }

      httpRequest.user = {
        id: 'member-1',
        memberNumber: 'M-1001',
        roleArea: 'member',
      };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    membersService.findSelfServiceProfile.mockResolvedValue({
      id: 'member-1',
      memberNumber: 'M-1001',
    });
    membersService.getPolicyStatus.mockResolvedValue({
      memberId: 'member-1',
    });
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
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('derives profile, policy, and borrowing list ownership from the member token', async () => {
    await request(app.getHttpServer())
      .get('/members/me')
      .set('Authorization', 'Bearer member-token')
      .expect(200);
    await request(app.getHttpServer())
      .get('/members/me/policy-status')
      .set('Authorization', 'Bearer member-token')
      .expect(200);
    await request(app.getHttpServer())
      .get(
        '/members/me/borrowings?memberId=665f4d3b8f4c8a001f5f0a12&currentOnly=true',
      )
      .set('Authorization', 'Bearer member-token')
      .expect(200);

    expect(membersService.findSelfServiceProfile).toHaveBeenCalledWith(
      'member-1',
    );
    expect(membersService.getPolicyStatus).toHaveBeenCalledWith('member-1');
    expect(borrowingsService.findByMember).toHaveBeenCalledWith(
      'member-1',
      expect.objectContaining({
        memberId: '665f4d3b8f4c8a001f5f0a12',
        currentOnly: true,
      }),
    );
  });

  it('checks borrowing detail ownership through the authenticated member id', async () => {
    await request(app.getHttpServer())
      .get('/members/me/borrowings/borrowing-2')
      .set('Authorization', 'Bearer member-token')
      .expect(200);

    expect(borrowingsService.findOneForMember).toHaveBeenCalledWith(
      'borrowing-2',
      'member-1',
    );
  });
});
