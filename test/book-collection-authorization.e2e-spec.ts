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
import { BookCategoriesController } from '../src/book-categories/book-categories.controller';
import { BookCategoriesService } from '../src/book-categories/book-categories.service';
import { BooksController } from '../src/books/books.controller';
import { BooksService } from '../src/books/books.service';

describe('Book collection authorization (e2e)', () => {
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
      controllers: [BookCategoriesController, BooksController],
      providers: [
        {
          provide: BookCategoriesService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'category-id' }),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ id: 'category-id' }),
          },
        },
        {
          provide: BooksService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'book-id' }),
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue({ id: 'book-id' }),
            update: jest.fn().mockResolvedValue({ id: 'book-id' }),
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

  it('rejects unauthenticated book management requests', async () => {
    await request(app.getHttpServer()).get('/books').expect(401);
    await request(app.getHttpServer()).get('/book-categories').expect(401);
  });

  it('rejects authenticated users without a required staff/admin role', async () => {
    authenticated = true;

    await request(app.getHttpServer()).post('/books').send({}).expect(403);
    await request(app.getHttpServer())
      .post('/book-categories')
      .send({})
      .expect(403);
  });

  it('allows authenticated staff/admin book management requests', async () => {
    authenticated = true;
    authorized = true;

    await request(app.getHttpServer()).get('/books').expect(200);
    await request(app.getHttpServer()).get('/book-categories').expect(200);
  });
});
