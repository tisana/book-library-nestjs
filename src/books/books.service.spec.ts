import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';

import { getModelToken } from '@nestjs/mongoose';
import { ConflictException } from '@nestjs/common';
import { LibraryItemStatus } from '../common/enums/library-status.enum';
import { BookDocument, BookModelName } from './schemas/book.schema';

describe('BooksService', () => {
  const validBookId = '665f4d3b8f4c8a001f5f0a13';
  let service: BooksService;
  let model: jest.Mock & {
    find: jest.Mock;
    findOne: jest.Mock;
  };

  type MockBookDocument = Omit<Partial<BookDocument>, 'save'> & {
    save: jest.Mock;
  };

  function createBookDocument(
    overrides: Partial<MockBookDocument> = {},
  ): MockBookDocument {
    return {
      _id: { toString: () => 'book-id' } as BookDocument['_id'],
      id: 'book-id',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '9780132350884',
      coverImageUrl:
        'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg',
      catalogIdentifier: 'BK-0001',
      categoryId: '64f000000000000000000001',
      totalQuantity: 3,
      availableQuantity: 3,
      status: LibraryItemStatus.Active,
      save: jest.fn(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    model = jest.fn().mockImplementation((document) => ({
      ...createBookDocument(document),
      save: jest.fn().mockResolvedValue(createBookDocument(document)),
    })) as typeof model;
    model.find = jest.fn();
    model.findOne = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        {
          provide: getModelToken(BookModelName),
          useValue: model,
        },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates aggregate book records with available quantity matching total quantity', async () => {
    await expect(
      service.create({
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '9780132350884',
        coverImageUrl:
          'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg',
        catalogIdentifier: 'BK-0001',
        categoryId: '64f000000000000000000001',
        totalQuantity: 3,
      }),
    ).resolves.toMatchObject({
      catalogIdentifier: 'BK-0001',
      totalQuantity: 3,
      availableQuantity: 3,
      status: LibraryItemStatus.Active,
    });

    expect(model).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImageUrl:
          'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg',
        totalQuantity: 3,
        availableQuantity: 3,
        status: LibraryItemStatus.Active,
      }),
    );
  });

  it('shows zero-availability books as unavailable in list responses', async () => {
    const unavailableBook = createBookDocument({
      availableQuantity: 0,
    });
    model.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([unavailableBook]),
    });

    await expect(service.findAll()).resolves.toEqual([
      expect.objectContaining({
        id: 'book-id',
        availableQuantity: 0,
        status: LibraryItemStatus.Active,
      }),
    ]);
  });

  it('builds literal case-insensitive search filters', async () => {
    model.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });

    await service.findAll({
      q: 'Clean.*',
      author: 'Martin?',
      categoryId: '64f000000000000000000001',
      status: LibraryItemStatus.Active,
      page: 1,
      limit: 20,
    });

    const filter = model.find.mock.calls[0][0];
    expect(filter.$or[0].title).toEqual(/Clean\.\*/i);
    expect(filter.author).toEqual(/Martin\?/i);
    expect(filter.categoryId.$eq.toString()).toBe('64f000000000000000000001');
    expect(filter.status).toEqual({ $eq: LibraryItemStatus.Active });
  });

  it('prevents reducing total quantity below active loans', async () => {
    const existingBook = createBookDocument({
      totalQuantity: 5,
      availableQuantity: 2,
    });
    model.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(existingBook),
    });

    await expect(
      service.update(validBookId, { totalQuantity: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates available quantity by the total quantity delta', async () => {
    const existingBook = createBookDocument({
      totalQuantity: 5,
      availableQuantity: 2,
    });
    existingBook.save.mockResolvedValue(existingBook);
    model.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(existingBook),
    });

    await expect(
      service.update(validBookId, { totalQuantity: 7 }),
    ).resolves.toMatchObject({
      totalQuantity: 7,
      availableQuantity: 4,
    });
  });
});
