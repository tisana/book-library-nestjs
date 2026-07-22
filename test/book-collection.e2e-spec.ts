import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { LibraryItemStatus } from '../src/common/enums/library-status.enum';
import { BookCategoriesController } from '../src/book-categories/book-categories.controller';
import { BookCategoriesService } from '../src/book-categories/book-categories.service';
import { BooksController } from '../src/books/books.controller';
import { BooksService } from '../src/books/books.service';

describe('Book collection endpoints (e2e)', () => {
  let app: INestApplication;
  const booksService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const bookCategoriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  };

  const createdCategory = {
    id: 'category-id',
    code: 'STANDARD',
    name: 'Standard Collection',
    loanPeriodDays: 14,
    status: LibraryItemStatus.Active,
  };
  const createdBook = {
    id: 'book-id',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    catalogIdentifier: 'BK-0001',
    categoryId: '64f000000000000000000001',
    totalQuantity: 3,
    availableQuantity: 3,
    status: LibraryItemStatus.Active,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    bookCategoriesService.create.mockResolvedValue(createdCategory);
    bookCategoriesService.findAll.mockResolvedValue([createdCategory]);
    bookCategoriesService.update.mockResolvedValue({
      ...createdCategory,
      status: LibraryItemStatus.Deactivated,
    });
    booksService.create.mockResolvedValue(createdBook);
    booksService.findAll.mockResolvedValue([createdBook]);
    booksService.findOne.mockResolvedValue(createdBook);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BookCategoriesController, BooksController],
      providers: [
        { provide: BookCategoriesService, useValue: bookCategoriesService },
        { provide: BooksService, useValue: booksService },
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

  it('creates a book catalog record with total and available quantities', async () => {
    await request(app.getHttpServer())
      .post('/book-categories')
      .send({
        code: 'STANDARD',
        name: 'Standard Collection',
        loanPeriodDays: 14,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'STANDARD',
          loanPeriodDays: 14,
          status: LibraryItemStatus.Active,
        });
      });

    await request(app.getHttpServer())
      .post('/books')
      .send({
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780132350884',
        catalogIdentifier: 'BK-0001',
        categoryId: '64f000000000000000000001',
        totalQuantity: 3,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          catalogIdentifier: 'BK-0001',
          totalQuantity: 3,
          availableQuantity: 3,
          status: LibraryItemStatus.Active,
        });
      });
  });

  it('lists and updates category policy data', async () => {
    await request(app.getHttpServer())
      .get('/book-categories?status=active')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            code: 'STANDARD',
            loanPeriodDays: 14,
          }),
        ]);
      });

    await request(app.getHttpServer())
      .patch('/book-categories/category-id')
      .send({ status: LibraryItemStatus.Deactivated })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: 'category-id',
          status: LibraryItemStatus.Deactivated,
        });
      });
  });

  it('shows zero-availability books as unavailable in collection views', async () => {
    booksService.findAll.mockResolvedValue([
      {
        ...createdBook,
        availableQuantity: 0,
      },
    ]);

    await request(app.getHttpServer())
      .get('/books')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: 'book-id',
            availableQuantity: 0,
            status: LibraryItemStatus.Active,
          }),
        ]);
      });
  });
});
