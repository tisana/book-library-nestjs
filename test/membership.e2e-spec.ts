import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { BorrowingsService } from '../src/borrowings/borrowings.service';
import {
  LibraryItemStatus,
  MemberStatus,
} from '../src/common/enums/library-status.enum';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';
import { MembershipTypesController } from '../src/membership-types/membership-types.controller';
import { MembershipTypesService } from '../src/membership-types/membership-types.service';

describe('Membership endpoints (e2e)', () => {
  let app: INestApplication;
  const membershipTypesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  };
  const membersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    getPolicyStatus: jest.fn(),
  };
  const borrowingsService = {
    findByMember: jest.fn(),
  };

  const membershipType = {
    id: 'membership-type-id',
    code: 'STANDARD',
    name: 'Standard Member',
    maxActiveLoans: 3,
    status: LibraryItemStatus.Active,
  };
  const member = {
    id: 'member-id',
    memberNumber: 'MEM-0001',
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '123456789',
    membershipTypeId: '64f000000000000000000001',
    status: MemberStatus.Active,
    activeLoanCount: 1,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    membershipTypesService.create.mockResolvedValue(membershipType);
    membershipTypesService.findAll.mockResolvedValue([membershipType]);
    membershipTypesService.update.mockResolvedValue({
      ...membershipType,
      status: LibraryItemStatus.Deactivated,
    });
    membersService.create.mockResolvedValue(member);
    membersService.findAll.mockResolvedValue([member]);
    membersService.findOne.mockResolvedValue(member);
    membersService.getPolicyStatus.mockResolvedValue({
      memberId: 'member-id',
      status: MemberStatus.Active,
      membershipTypeId: '64f000000000000000000001',
      maxActiveLoans: 3,
      activeLoanCount: 1,
      remainingAllowance: 2,
      eligibleByStatus: true,
      withinLimit: true,
      limitReached: false,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MembershipTypesController, MembersController],
      providers: [
        { provide: MembershipTypesService, useValue: membershipTypesService },
        { provide: MembersService, useValue: membersService },
        { provide: BorrowingsService, useValue: borrowingsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates membership types and active members assigned to them', async () => {
    await request(app.getHttpServer())
      .post('/membership-types')
      .send({
        code: 'STANDARD',
        name: 'Standard Member',
        maxActiveLoans: 3,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'STANDARD',
          maxActiveLoans: 3,
          status: LibraryItemStatus.Active,
        });
      });

    await request(app.getHttpServer())
      .post('/members')
      .send({
        memberNumber: 'MEM-0001',
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '123456789',
        membershipTypeId: '64f000000000000000000001',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          memberNumber: 'MEM-0001',
          membershipTypeId: '64f000000000000000000001',
          status: MemberStatus.Active,
          activeLoanCount: 1,
        });
      });
  });

  it('lists membership policy data and member records', async () => {
    await request(app.getHttpServer())
      .get('/membership-types?status=active')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            code: 'STANDARD',
            maxActiveLoans: 3,
          }),
        ]);
      });

    await request(app.getHttpServer())
      .get('/members?status=active')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            memberNumber: 'MEM-0001',
            activeLoanCount: 1,
          }),
        ]);
      });
  });

  it('shows member borrowing eligibility and remaining allowance', async () => {
    await request(app.getHttpServer())
      .get('/members/member-id/policy-status')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          memberId: 'member-id',
          remainingAllowance: 2,
          eligibleByStatus: true,
          withinLimit: true,
          limitReached: false,
        });
      });
  });
});
