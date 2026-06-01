import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { BookCategoryDocument, BookCategoryModelName } from '../book-categories/schemas/book-category.schema';
import { BookDocument, BookModelName } from '../books/schemas/book.schema';
import { AuditActor } from '../common/audit/audit-context';
import { LoanState } from '../common/enums/library-status.enum';
import { MemberDocument, MemberModelName } from '../members/schemas/member.schema';
import {
  MembershipTypeDocument,
  MembershipTypeModelName,
} from '../membership-types/schemas/membership-type.schema';
import {
  BorrowingQueryDto,
  BorrowingResponseDto,
  CreateBorrowingDto,
  ReturnBorrowingDto,
} from './dto/borrowing.dto';
import { BorrowingsRulesService } from './borrowings-rules.service';
import {
  BorrowingDocument,
  BorrowingModelName,
} from './schemas/borrowing.schema';

@Injectable()
export class BorrowingsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(BorrowingModelName)
    private readonly borrowingModel: Model<BorrowingDocument>,
    @InjectModel(BookModelName) private readonly bookModel: Model<BookDocument>,
    @InjectModel(BookCategoryModelName)
    private readonly bookCategoryModel: Model<BookCategoryDocument>,
    @InjectModel(MemberModelName)
    private readonly memberModel: Model<MemberDocument>,
    @InjectModel(MembershipTypeModelName)
    private readonly membershipTypeModel: Model<MembershipTypeDocument>,
    private readonly rulesService: BorrowingsRulesService,
  ) {}

  async create(
    dto: CreateBorrowingDto,
    actor?: AuditActor,
  ): Promise<BorrowingResponseDto> {
    const auditActor = this.requireActor(actor);

    return this.runInTransaction(async (session) => {
      const borrowedAt = new Date();
      const member = await this.findMember(dto.memberId, session);
      const book = await this.findBook(dto.bookId, session);
      const category = await this.findCategory(
        book.categoryId.toString(),
        session,
      );
      const membershipType = await this.findMembershipType(
        member.membershipTypeId.toString(),
        session,
      );
      const hasOverdueLoans = await this.hasOverdueLoans(
        member._id.toString(),
        borrowedAt,
        session,
      );

      this.rulesService.assertCanBorrow({
        book,
        category,
        member,
        membershipType,
        hasOverdueLoans,
      });

      const borrowing = await new this.borrowingModel({
        memberId: member._id,
        bookId: book._id,
        bookCategoryId: category._id,
        borrowedAt,
        dueAt: this.calculateDueAt(borrowedAt, category.loanPeriodDays),
        status: LoanState.Active,
        borrowedByStaffId: auditActor.id,
      }).save({ session });

      book.availableQuantity -= 1;
      book.updatedBy = auditActor.id;
      member.activeLoanCount += 1;
      member.updatedBy = auditActor.id;

      await book.save({ session });
      await member.save({ session });

      return this.toResponse(borrowing, borrowedAt);
    });
  }

  async returnBorrowing(
    id: string,
    dto: ReturnBorrowingDto = {},
    actor?: AuditActor,
  ): Promise<BorrowingResponseDto> {
    const auditActor = this.requireActor(actor);

    return this.runInTransaction(async (session) => {
      const returnedAt = dto.returnedAt ? new Date(dto.returnedAt) : new Date();
      const borrowing = await this.findBorrowing(id, session);

      if (borrowing.returnedAt || borrowing.status === LoanState.Returned) {
        throw new ConflictException('Borrowing record has already been returned');
      }

      if (
        borrowing.status !== LoanState.Active &&
        borrowing.status !== LoanState.Overdue
      ) {
        throw new ConflictException('Borrowing record cannot be returned');
      }

      const book = await this.findBook(borrowing.bookId.toString(), session);
      const member = await this.findMember(
        borrowing.memberId.toString(),
        session,
      );

      borrowing.returnedAt = returnedAt;
      borrowing.returnedByStaffId = auditActor.id;
      borrowing.status = LoanState.Returned;
      book.availableQuantity += 1;
      book.updatedBy = auditActor.id;
      member.activeLoanCount = Math.max(member.activeLoanCount - 1, 0);
      member.updatedBy = auditActor.id;

      await borrowing.save({ session });
      await book.save({ session });
      await member.save({ session });

      return this.toResponse(borrowing, returnedAt);
    });
  }

  async findAll(
    query: BorrowingQueryDto = new BorrowingQueryDto(),
  ): Promise<BorrowingResponseDto[]> {
    const now = new Date();
    const filter = this.buildListFilter(query, now);
    const borrowings = await this.borrowingModel
      .find(filter)
      .sort({ dueAt: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .exec();

    return borrowings.map((borrowing) => this.toResponse(borrowing, now));
  }

  async findOne(id: string): Promise<BorrowingResponseDto> {
    const borrowing = await this.borrowingModel.findById(id).exec();

    if (!borrowing) {
      throw new NotFoundException('Borrowing record not found');
    }

    return this.toResponse(borrowing);
  }

  async findOverdue(
    query: BorrowingQueryDto = new BorrowingQueryDto(),
  ): Promise<BorrowingResponseDto[]> {
    return this.findAll({ ...query, overdueOnly: true });
  }

  async findByMember(
    memberId: string,
    query: BorrowingQueryDto = new BorrowingQueryDto(),
  ): Promise<BorrowingResponseDto[]> {
    return this.findAll({ ...query, memberId });
  }

  calculateDueAt(borrowedAt: Date, loanPeriodDays: number): Date {
    const dueAt = new Date(borrowedAt);
    dueAt.setUTCDate(dueAt.getUTCDate() + loanPeriodDays);
    return dueAt;
  }

  private buildListFilter(
    query: BorrowingQueryDto,
    now: Date,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (query.memberId) {
      filter.memberId = query.memberId;
    }

    if (query.bookId) {
      filter.bookId = query.bookId;
    }

    if (query.overdueOnly) {
      filter.returnedAt = { $exists: false };
      filter.status = { $in: [LoanState.Active, LoanState.Overdue] };
      filter.dueAt = { $lt: now };
      return filter;
    }

    if (query.status) {
      filter.status = query.status;
    }

    return filter;
  }

  private async hasOverdueLoans(
    memberId: string,
    now: Date,
    session: ClientSession,
  ): Promise<boolean> {
    const overdue = await this.borrowingModel
      .exists({
        memberId,
        returnedAt: { $exists: false },
        status: { $in: [LoanState.Active, LoanState.Overdue] },
        dueAt: { $lt: now },
      })
      .session(session);

    return Boolean(overdue);
  }

  private async findBorrowing(
    id: string,
    session: ClientSession,
  ): Promise<BorrowingDocument> {
    const borrowing = await this.borrowingModel
      .findById(id)
      .session(session)
      .exec();

    if (!borrowing) {
      throw new NotFoundException('Borrowing record not found');
    }

    return borrowing;
  }

  private async findBook(
    id: string,
    session: ClientSession,
  ): Promise<BookDocument> {
    const book = await this.bookModel.findById(id).session(session).exec();

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    return book;
  }

  private async findCategory(
    id: string,
    session: ClientSession,
  ): Promise<BookCategoryDocument> {
    const category = await this.bookCategoryModel
      .findById(id)
      .session(session)
      .exec();

    if (!category) {
      throw new NotFoundException('Book category not found');
    }

    return category;
  }

  private async findMember(
    id: string,
    session: ClientSession,
  ): Promise<MemberDocument> {
    const member = await this.memberModel.findById(id).session(session).exec();

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  private async findMembershipType(
    id: string,
    session: ClientSession,
  ): Promise<MembershipTypeDocument> {
    const membershipType = await this.membershipTypeModel
      .findById(id)
      .session(session)
      .exec();

    if (!membershipType) {
      throw new NotFoundException('Membership type not found');
    }

    return membershipType;
  }

  private async runInTransaction<T>(
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();

    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }

  private requireActor(actor?: AuditActor): AuditActor {
    if (!actor?.id) {
      throw new UnauthorizedException('Authenticated staff actor is required');
    }

    return actor;
  }

  private toResponse(
    borrowing: BorrowingDocument,
    now = new Date(),
  ): BorrowingResponseDto {
    const effectiveStatus =
      borrowing.status === LoanState.Active &&
      !borrowing.returnedAt &&
      borrowing.dueAt < now
        ? LoanState.Overdue
        : borrowing.status;

    return {
      id: borrowing.id ?? borrowing._id.toString(),
      memberId: borrowing.memberId.toString(),
      bookId: borrowing.bookId.toString(),
      bookCategoryId: borrowing.bookCategoryId.toString(),
      borrowedAt: borrowing.borrowedAt.toISOString(),
      dueAt: borrowing.dueAt.toISOString(),
      returnedAt: borrowing.returnedAt?.toISOString(),
      status: effectiveStatus,
      borrowedByStaffId: borrowing.borrowedByStaffId,
      returnedByStaffId: borrowing.returnedByStaffId,
    };
  }
}
