import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { BorrowingsController } from '../src/borrowings/borrowings.controller';
import { BorrowingsService } from '../src/borrowings/borrowings.service';
import { LoanState } from '../src/common/enums/library-status.enum';

describe('Borrowing display fields (e2e)', () => {
  let app: INestApplication;

  const borrowing = {
    id: 'borrowing-id',
    memberId: 'member-id',
    memberDisplayName: 'Olivia Overdue',
    memberNumber: 'M-1004',
    bookId: 'book-id',
    bookTitle: 'Refactoring',
    bookCatalogIdentifier: 'BK-1003',
    bookCategoryId: 'category-id',
    borrowedAt: '2026-06-01T00:00:00.000Z',
    dueAt: '2026-06-15T00:00:00.000Z',
    status: LoanState.Overdue,
    borrowedByStaffId: 'staff-1',
  };

  const borrowingsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOverdue: jest.fn(),
    returnBorrowing: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    borrowingsService.findAll.mockResolvedValue([borrowing]);
    borrowingsService.findOverdue.mockResolvedValue([borrowing]);
    borrowingsService.findOne.mockResolvedValue(borrowing);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BorrowingsController],
      providers: [{ provide: BorrowingsService, useValue: borrowingsService }],
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

  it('returns human-readable member and book fields on staff borrowing reads', async () => {
    const expectedDisplayFields = {
      memberDisplayName: 'Olivia Overdue',
      memberNumber: 'M-1004',
      bookTitle: 'Refactoring',
      bookCatalogIdentifier: 'BK-1003',
    };

    await request(app.getHttpServer())
      .get('/borrowings')
      .expect(200)
      .expect(({ body }) => {
        expect(body[0]).toMatchObject(expectedDisplayFields);
      });

    await request(app.getHttpServer())
      .get('/borrowings/overdue')
      .expect(200)
      .expect(({ body }) => {
        expect(body[0]).toMatchObject(expectedDisplayFields);
      });

    await request(app.getHttpServer())
      .get('/borrowings/borrowing-id')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject(expectedDisplayFields);
      });
  });
});
