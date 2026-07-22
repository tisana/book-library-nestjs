import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BookResponseDto } from './dto/book.dto';

import { getModelToken } from '@nestjs/mongoose';
import { PermissionsService } from '../auth/permissions.service';
import { LibraryItemStatus } from '../common/enums/library-status.enum';
import { BookModelName } from './schemas/book.schema';

describe('Books Controller', () => {
  let controller: BooksController;
  let service: BooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        BooksService,
        PermissionsService,
        {
          provide: getModelToken(BookModelName),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<BooksController>(BooksController);
    service = module.get<BooksService>(BooksService);
  });

  describe('findAll', () => {
    it('should return an array of Books', async () => {
      const result: BookResponseDto[] = [
        {
          id: 'book-id',
          title: 'Clean Code',
          author: 'Robert C. Martin',
          isbn: '9780132350884',
          catalogIdentifier: 'BK-0001',
          categoryId: '64f000000000000000000001',
          totalQuantity: 3,
          availableQuantity: 3,
          status: LibraryItemStatus.Active,
        },
      ];

      jest.spyOn(service, 'findAll').mockImplementation(async () => result);

      expect(await controller.findAll({ page: 1, limit: 25 })).toBe(result);
    });
  });
});
