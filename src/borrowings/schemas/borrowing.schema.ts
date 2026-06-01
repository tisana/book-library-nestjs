import { Document, Schema, Types } from 'mongoose';
import { LoanState } from '../../common/enums/library-status.enum';

export const BorrowingModelName = 'Borrowing';

export interface BorrowingDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  id: string;
  memberId: Types.ObjectId | string;
  bookId: Types.ObjectId | string;
  bookCategoryId: Types.ObjectId | string;
  borrowedAt: Date;
  dueAt: Date;
  returnedAt?: Date;
  status: LoanState;
  borrowedByStaffId: string;
  returnedByStaffId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const BorrowingSchema: Schema<BorrowingDocument> =
  new Schema<BorrowingDocument>(
    {
      memberId: {
        type: Schema.Types.ObjectId,
        ref: 'Member',
        required: true,
        index: true,
      },
      bookId: {
        type: Schema.Types.ObjectId,
        ref: 'Book',
        required: true,
        index: true,
      },
      bookCategoryId: {
        type: Schema.Types.ObjectId,
        ref: 'BookCategory',
        required: true,
      },
      borrowedAt: { type: Date, required: true },
      dueAt: { type: Date, required: true, index: true },
      returnedAt: { type: Date },
      status: {
        type: String,
        enum: Object.values(LoanState),
        required: true,
        default: LoanState.Active,
        index: true,
      },
      borrowedByStaffId: { type: String, required: true },
      returnedByStaffId: { type: String },
    },
    { timestamps: true },
  );

BorrowingSchema.index({ memberId: 1, status: 1 });
BorrowingSchema.index({ bookId: 1, status: 1 });
BorrowingSchema.index({ dueAt: 1, status: 1 });
