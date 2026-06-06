import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditActor } from '../common/audit/audit-context';
import { LibraryItemStatus } from '../common/enums/library-status.enum';
import { equals, toMongoObjectId } from '../common/mongo/mongo-query.helpers';
import {
  BookCategoryQueryDto,
  BookCategoryResponseDto,
  CreateBookCategoryDto,
  UpdateBookCategoryDto,
} from './dto/book-category.dto';
import {
  BookCategoryDocument,
  BookCategoryModelName,
} from './schemas/book-category.schema';

@Injectable()
export class BookCategoriesService {
  constructor(
    @InjectModel(BookCategoryModelName)
    private readonly bookCategoryModel: Model<BookCategoryDocument>,
  ) {}

  async create(
    dto: CreateBookCategoryDto,
    actor?: AuditActor,
  ): Promise<BookCategoryResponseDto> {
    const code = this.normalizeCode(dto.code);
    const modelWithExists = this.bookCategoryModel as Model<BookCategoryDocument> & {
      exists?: (filter: Record<string, unknown>) => Promise<unknown>;
    };

    if (
      modelWithExists.exists &&
      (await modelWithExists.exists({ code: equals(code) }))
    ) {
      throw new ConflictException('Book category code already exists');
    }

    const created = await new this.bookCategoryModel({
      code,
      name: dto.name,
      loanPeriodDays: dto.loanPeriodDays,
      status: LibraryItemStatus.Active,
      createdBy: actor?.id,
      updatedBy: actor?.id,
    }).save();

    return this.toResponse(created);
  }

  async findAll(
    query: BookCategoryQueryDto = new BookCategoryQueryDto(),
  ): Promise<BookCategoryResponseDto[]> {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = equals(query.status);
    }

    const categories = await this.bookCategoryModel
      .find(filter)
      .sort({ code: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .exec();

    return categories.map((category) => this.toResponse(category));
  }

  async findOne(id: string): Promise<BookCategoryResponseDto> {
    return this.toResponse(await this.findDocumentById(id));
  }

  async update(
    id: string,
    dto: UpdateBookCategoryDto,
    actor?: AuditActor,
  ): Promise<BookCategoryResponseDto> {
    const category = await this.findDocumentById(id);

    if (dto.name !== undefined) {
      category.name = dto.name;
    }

    if (dto.loanPeriodDays !== undefined) {
      category.loanPeriodDays = dto.loanPeriodDays;
    }

    if (dto.status !== undefined) {
      category.status = dto.status;
    }

    category.updatedBy = actor?.id;

    return this.toResponse(await category.save());
  }

  async validateActiveLoanPeriod(id: string): Promise<BookCategoryResponseDto> {
    const category = await this.findDocumentById(id);

    if (
      category.status !== LibraryItemStatus.Active ||
      category.loanPeriodDays < 1
    ) {
      throw new ConflictException('Book category has no active loan period');
    }

    return this.toResponse(category);
  }

  private async findDocumentById(id: string): Promise<BookCategoryDocument> {
    const category = await this.bookCategoryModel
      .findOne({ _id: equals(toMongoObjectId(id)) })
      .exec();

    if (!category) {
      throw new NotFoundException('Book category not found');
    }

    return category;
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private toResponse(category: BookCategoryDocument): BookCategoryResponseDto {
    return {
      id: category.id ?? category._id.toString(),
      code: category.code,
      name: category.name,
      loanPeriodDays: category.loanPeriodDays,
      status: category.status,
    };
  }
}
