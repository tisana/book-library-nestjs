import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BookResponseDto } from '../src/books/dto/book.dto';
import { BooksService } from '../src/books/books.service';
import { Test } from '@nestjs/testing';

import { BooksController } from '../src/books/books.controller';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { LibraryItemStatus } from '../src/common/enums/library-status.enum';

describe('Books', () => {
  let app: INestApplication;
  const book: BookResponseDto = {
    id: 'book-id',
    title: 'lord of the ring',
    author: 'JJ Token',
    isbn: '1234',
    catalogIdentifier: 'BK-LEGACY',
    categoryId: '64f000000000000000000001',
    totalQuantity: 1,
    availableQuantity: 1,
    status: LibraryItemStatus.Active,
  };
  const booksService = { findAll: () => [book] };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        { provide: BooksService, useValue: booksService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('/GET books', () => {
    return request(app.getHttpServer())
      .get('/books')
      .expect(200)
      .expect(new Array(book));
  });
});
