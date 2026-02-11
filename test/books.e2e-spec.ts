import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BookDto } from '../src/books/dto/book.dto';
import { BooksModule } from '../src/books/books.module';
import { BooksService } from '../src/books/books.service';
import { Test } from '@nestjs/testing';

import { BooksController } from '../src/books/books.controller';
import { getModelToken } from '@nestjs/mongoose';

describe('Books', () => {
  let app: INestApplication;
  let book: BookDto;
  book = {
    title: 'lord of the ring',
    author: 'JJ Token',
    isbn: '1234',
    quantity: 1,
  };
  let booksService = { findAll: () => [book] };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        BooksService,
        {
          provide: getModelToken('Book'),
          useValue: {},
        },
      ],
    })
      .overrideProvider(BooksService)
      .useValue(booksService)
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
