import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { LoanState } from '../src/common/enums/library-status.enum';
import { MembersController } from '../src/members/members.controller';
import { MembersService } from '../src/members/members.service';
import { BorrowingsController } from '../src/borrowings/borrowings.controller';
import { BorrowingsService } from '../src/borrowings/borrowings.service';

describe('Borrowing lifecycle endpoints (e2e)', () => {
  let app: INestApplication;

  const borrowingsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOverdue: jest.fn(),
    findByMember: jest.fn(),
    returnBorrowing: jest.fn(),
  };
  const membersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    getPolicyStatus: jest.fn(),
  };

  const activeBorrowing = {
    id: 'borrowing-id',
    memberId: 'member-id',
    bookId: 'book-id',
    bookCategoryId: 'category-id',
    borrowedAt: '2026-06-01T00:00:00.000Z',
    dueAt: '2026-06-15T00:00:00.000Z',
    returnedAt: null,
    status: LoanState.Active,
  };

  const returnedBorrowing = {
    ...activeBorrowing,
    returnedAt: '2026-06-05T00:00:00.000Z',
    status: LoanState.Returned,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    borrowingsService.create.mockResolvedValue(activeBorrowing);
    borrowingsService.returnBorrowing.mockResolvedValue(returnedBorrowing);
    borrowingsService.findAll.mockResolvedValue([activeBorrowing]);
    borrowingsService.findByMember.mockResolvedValue([
      activeBorrowing,
      returnedBorrowing,
    ]);
    borrowingsService.findOverdue.mockResolvedValue([]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BorrowingsController, MembersController],
      providers: [
        { provide: BorrowingsService, useValue: borrowingsService },
        { provide: MembersService, useValue: membersService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
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

  it('creates a borrowing record with calculated due date', async () => {
    await request(app.getHttpServer())
      .post('/borrowings')
      .send({
        memberId: 'member-id',
        bookId: 'book-id',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: 'borrowing-id',
          memberId: 'member-id',
          bookId: 'book-id',
          dueAt: '2026-06-15T00:00:00.000Z',
          status: LoanState.Active,
        });
      });

    expect(borrowingsService.create.mock.calls[0][0]).toMatchObject({
      memberId: 'member-id',
      bookId: 'book-id',
    });
  });

  it('returns a borrowed book exactly once at the API boundary', async () => {
    await request(app.getHttpServer())
      .post('/borrowings/borrowing-id/return')
      .send({})
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: 'borrowing-id',
          returnedAt: '2026-06-05T00:00:00.000Z',
          status: LoanState.Returned,
        });
      });

    expect(borrowingsService.returnBorrowing.mock.calls[0][0]).toBe(
      'borrowing-id',
    );
  });

  it('lists borrowing records and member borrowing history', async () => {
    await request(app.getHttpServer())
      .get('/borrowings?memberId=member-id&status=active')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: 'borrowing-id',
            memberId: 'member-id',
            status: LoanState.Active,
          }),
        ]);
      });

    await request(app.getHttpServer())
      .get('/members/member-id/borrowings')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: 'borrowing-id',
            status: LoanState.Active,
          }),
          expect.objectContaining({
            id: 'borrowing-id',
            status: LoanState.Returned,
          }),
        ]);
      });

    expect(borrowingsService.findByMember.mock.calls[0][0]).toBe('member-id');
  });
});
