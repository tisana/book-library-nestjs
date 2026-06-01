import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  BookCategoryModelName,
  BookCategorySchema,
} from '../book-categories/schemas/book-category.schema';
import { BookModelName, BookSchema } from '../books/schemas/book.schema';
import { MemberModelName, MemberSchema } from '../members/schemas/member.schema';
import {
  MembershipTypeModelName,
  MembershipTypeSchema,
} from '../membership-types/schemas/membership-type.schema';
import { BorrowingsController } from './borrowings.controller';
import { BorrowingsRulesService } from './borrowings-rules.service';
import { BorrowingsService } from './borrowings.service';
import { BorrowingModelName, BorrowingSchema } from './schemas/borrowing.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BorrowingModelName, schema: BorrowingSchema },
      { name: BookModelName, schema: BookSchema },
      { name: BookCategoryModelName, schema: BookCategorySchema },
      { name: MemberModelName, schema: MemberSchema },
      { name: MembershipTypeModelName, schema: MembershipTypeSchema },
    ]),
  ],
  controllers: [BorrowingsController],
  providers: [BorrowingsService, BorrowingsRulesService],
  exports: [BorrowingsService],
})
export class BorrowingsModule {}
