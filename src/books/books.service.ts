import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditActor } from '../common/audit/audit-context';
import { LibraryItemStatus } from '../common/enums/library-status.enum';
import {
  BookQueryDto,
  BookResponseDto,
  CreateBookDto,
  UpdateBookDto,
} from './dto/book.dto';
import { BookDocument, BookModelName } from './schemas/book.schema';

@Injectable()
export class BooksService {
  constructor(
    @InjectModel(BookModelName) private readonly bookModel: Model<BookDocument>,
  ) {}

  async create(
    dto: CreateBookDto,
    actor?: AuditActor,
  ): Promise<BookResponseDto> {
    this.validateQuantity(dto.totalQuantity);

    const createdBook = await new this.bookModel({
      ...dto,
      availableQuantity: dto.totalQuantity,
      status: LibraryItemStatus.Active,
      createdBy: actor?.id,
      updatedBy: actor?.id,
    }).save();

    return this.toResponse(createdBook);
  }

  async findAll(query: BookQueryDto = new BookQueryDto()): Promise<BookResponseDto[]> {
    const filter: Record<string, unknown> = {};

    if (query.q) {
      filter.$or = [
        { title: new RegExp(query.q, 'i') },
        { author: new RegExp(query.q, 'i') },
        { catalogIdentifier: new RegExp(query.q, 'i') },
      ];
    }

    if (query.author) {
      filter.author = new RegExp(query.author, 'i');
    }

    if (query.categoryId) {
      filter.categoryId = query.categoryId;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.availableOnly) {
      filter.availableQuantity = { $gt: 0 };
      filter.status = LibraryItemStatus.Active;
    }

    const books = await this.bookModel
      .find(filter)
      .sort({ title: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .exec();

    return books.map((book) => this.toResponse(book));
  }

  async findOne(id: string): Promise<BookResponseDto> {
    return this.toResponse(await this.findDocumentById(id));
  }

  async update(
    id: string,
    dto: UpdateBookDto,
    actor?: AuditActor,
  ): Promise<BookResponseDto> {
    const book = await this.findDocumentById(id);

    if (dto.totalQuantity !== undefined) {
      this.validateQuantity(dto.totalQuantity);
      const activeLoans = book.totalQuantity - book.availableQuantity;

      if (dto.totalQuantity < activeLoans) {
        throw new ConflictException(
          'Total quantity cannot be lower than active loans',
        );
      }

      const quantityDelta = dto.totalQuantity - book.totalQuantity;
      book.totalQuantity = dto.totalQuantity;
      book.availableQuantity += quantityDelta;
    }

    if (dto.title !== undefined) {
      book.title = dto.title;
    }

    if (dto.author !== undefined) {
      book.author = dto.author;
    }

    if (dto.isbn !== undefined) {
      book.isbn = dto.isbn;
    }

    if (dto.catalogIdentifier !== undefined) {
      book.catalogIdentifier = dto.catalogIdentifier;
    }

    if (dto.categoryId !== undefined) {
      book.categoryId = dto.categoryId;
    }

    if (dto.status !== undefined) {
      book.status = dto.status;
    }

    book.updatedBy = actor?.id;

    return this.toResponse(await book.save());
  }

  private async findDocumentById(id: string): Promise<BookDocument> {
    const book = await this.bookModel.findById(id).exec();

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    return book;
  }

  private validateQuantity(totalQuantity: number): void {
    if (!Number.isInteger(totalQuantity) || totalQuantity < 0) {
      throw new BadRequestException('Book total quantity must be zero or greater');
    }
  }

  private toResponse(book: BookDocument): BookResponseDto {
    return {
      id: book.id ?? book._id.toString(),
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      catalogIdentifier: book.catalogIdentifier,
      categoryId: book.categoryId.toString(),
      totalQuantity: book.totalQuantity,
      availableQuantity: book.availableQuantity,
      status: book.status,
    };
  }
}
