import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BookDto } from './dto/book.dto';
import { Book } from './interfaces/book.interface';

describe('Books Controller', () => {
  let controller: BooksController;
  let service: BooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [BooksService],
    }).compile();

    controller = module.get<BooksController>(BooksController);
    service = module.get<BooksService>(BooksService);
  });

  describe('findAll', () => {
    it('should return an array of Books', async () => {
      const result: Book[] = [];

      let book = new BookDto();
      book.author = 'jj token';
      book.isbn = '1234-32134';
      book.title = 'lord of the ring';

      jest.spyOn(service, 'findAll').mockImplementation(() => result);

      expect(await controller.findAll(null)).toBe(result);
    });
  });
});
