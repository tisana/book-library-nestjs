import { ConflictException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { LoanState } from '../src/common/enums/library-status.enum';
import { BorrowingsController } from '../src/borrowings/borrowings.controller';
import { BorrowingsService } from '../src/borrowings/borrowings.service';

describe('Borrowing overdue endpoints (e2e)', () => {
  let app: INestApplication;

  const borrowingsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOverdue: jest.fn(),
    returnBorrowing: jest.fn(),
  };

  const overdueBorrowing = {
    id: 'overdue-borrowing-id',
    memberId: 'overdue-member-id',
    bookId: 'book-id',
    bookCategoryId: 'category-id',
    borrowedAt: '2026-05-01T00:00:00.000Z',
    dueAt: '2026-05-15T00:00:00.000Z',
    returnedAt: null,
    status: LoanState.Overdue,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    borrowingsService.findAll.mockResolvedValue([overdueBorrowing]);
    borrowingsService.findOverdue.mockResolvedValue([overdueBorrowing]);
    borrowingsService.returnBorrowing.mockResolvedValue({
      ...overdueBorrowing,
      returnedAt: '2026-06-01T00:00:00.000Z',
      status: LoanState.Returned,
    });
    borrowingsService.create.mockImplementation(({ memberId }) => {
      if (memberId === 'overdue-member-id') {
        throw new ConflictException('Member has overdue loans');
      }

      return {
        id: 'borrowing-id',
        memberId,
        bookId: 'book-id',
        status: LoanState.Active,
      };
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BorrowingsController],
      providers: [{ provide: BorrowingsService, useValue: borrowingsService }],
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

  it('lists active loans whose due date has passed', async () => {
    await request(app.getHttpServer())
      .get('/borrowings/overdue')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: 'overdue-borrowing-id',
            memberId: 'overdue-member-id',
            dueAt: '2026-05-15T00:00:00.000Z',
            status: LoanState.Overdue,
          }),
        ]);
      });

    expect(borrowingsService.findOverdue).toHaveBeenCalled();
  });

  it('supports overdue filtering on the borrowing list endpoint', async () => {
    await request(app.getHttpServer())
      .get('/borrowings?overdueOnly=true')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: 'overdue-borrowing-id',
            status: LoanState.Overdue,
          }),
        ]);
      });

    expect(borrowingsService.findAll.mock.calls[0][0]).toMatchObject({
      overdueOnly: 'true',
    });
  });

  it('blocks new borrowing when a member has overdue loans', async () => {
    await request(app.getHttpServer())
      .post('/borrowings')
      .send({
        memberId: 'overdue-member-id',
        bookId: 'book-id',
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.message).toBe('Member has overdue loans');
      });
  });
});
