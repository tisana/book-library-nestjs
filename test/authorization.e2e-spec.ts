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
import { LoanState } from '../src/common/enums/library-status.enum';
import { BorrowingsController } from '../src/borrowings/borrowings.controller';
import { BorrowingsService } from '../src/borrowings/borrowings.service';

describe('Borrowing authorization (e2e)', () => {
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
      controllers: [BorrowingsController],
      providers: [
        {
          provide: BorrowingsService,
          useValue: {
            create: jest.fn().mockResolvedValue({
              id: 'borrowing-id',
              memberId: 'member-id',
              bookId: 'book-id',
              status: LoanState.Active,
            }),
            findAll: jest.fn().mockResolvedValue([]),
            findOverdue: jest.fn().mockResolvedValue([]),
            returnBorrowing: jest.fn().mockResolvedValue({
              id: 'borrowing-id',
              status: LoanState.Returned,
            }),
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

  it('rejects unauthenticated borrowing state changes', async () => {
    await request(app.getHttpServer())
      .post('/borrowings')
      .send({ memberId: 'member-id', bookId: 'book-id' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/borrowings/borrowing-id/return')
      .send({})
      .expect(401);
  });

  it('rejects authenticated users without a required staff/admin role', async () => {
    authenticated = true;

    await request(app.getHttpServer())
      .post('/borrowings')
      .send({ memberId: 'member-id', bookId: 'book-id' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/borrowings/borrowing-id/return')
      .send({})
      .expect(403);
  });

  it('allows authenticated staff/admin borrowing state changes', async () => {
    authenticated = true;
    authorized = true;

    await request(app.getHttpServer())
      .post('/borrowings')
      .send({ memberId: 'member-id', bookId: 'book-id' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/borrowings/borrowing-id/return')
      .send({})
      .expect(200);
  });
});
