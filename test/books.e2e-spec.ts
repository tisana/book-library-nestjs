import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BookDto } from '../src/books/dto/book.dto';
import { BooksModule } from '../src/books/books.module';
import { BooksService } from '../src/books/books.service';
import { Test } from '@nestjs/testing';

describe('Books', () => {
  let app: INestApplication;
  let book: BookDto;
  book = {
    title: 'lord of the ring',
    author: 'JJ Token',
    isbn: '1234',
  };
  let booksService = { findAll: () => [book] };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BooksModule],
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
