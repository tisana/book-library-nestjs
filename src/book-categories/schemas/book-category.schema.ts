import { Document, Schema, Types } from 'mongoose';
import { auditFieldsSchemaDefinition } from '../../common/audit/audit-fields.schema';
import { LibraryItemStatus } from '../../common/enums/library-status.enum';

export const BookCategoryModelName = 'BookCategory';

export interface BookCategoryDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  id: string;
  code: string;
  name: string;
  loanPeriodDays: number;
  status: LibraryItemStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const BookCategorySchema: Schema<BookCategoryDocument> =
  new Schema<BookCategoryDocument>(
    {
      code: { type: String, required: true, unique: true, trim: true },
      name: { type: String, required: true, trim: true },
      loanPeriodDays: { type: Number, required: true, min: 1 },
      status: {
        type: String,
        enum: Object.values(LibraryItemStatus),
        required: true,
        default: LibraryItemStatus.Active,
        index: true,
      },
      ...auditFieldsSchemaDefinition,
    },
    { timestamps: true },
  );
