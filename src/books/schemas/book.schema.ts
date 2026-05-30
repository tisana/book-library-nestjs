import { Document, Schema, Types } from 'mongoose';
import { auditFieldsSchemaDefinition } from '../../common/audit/audit-fields.schema';
import { LibraryItemStatus } from '../../common/enums/library-status.enum';

export const BookModelName = 'Book';

export interface BookDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  id: string;
  title: string;
  author?: string;
  isbn?: string;
  catalogIdentifier: string;
  categoryId: Types.ObjectId | string;
  totalQuantity: number;
  availableQuantity: number;
  status: LibraryItemStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const BookSchema: Schema<BookDocument> = new Schema<BookDocument>(
  {
    title: { type: String, required: true, trim: true, index: true },
    author: { type: String, trim: true, index: true },
    isbn: { type: String, trim: true, sparse: true, unique: true },
    catalogIdentifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'BookCategory',
      required: true,
      index: true,
    },
    totalQuantity: { type: Number, required: true, min: 0 },
    availableQuantity: { type: Number, required: true, min: 0 },
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

BookSchema.index({ title: 'text', author: 'text', catalogIdentifier: 'text' });
