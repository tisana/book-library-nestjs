import { Document, Schema, Types } from 'mongoose';
import { auditFieldsSchemaDefinition } from '../../common/audit/audit-fields.schema';
import { LibraryItemStatus } from '../../common/enums/library-status.enum';

export const MembershipTypeModelName = 'MembershipType';

export interface MembershipTypeDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  id: string;
  code: string;
  name: string;
  maxActiveLoans: number;
  status: LibraryItemStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const MembershipTypeSchema: Schema<MembershipTypeDocument> =
  new Schema<MembershipTypeDocument>(
    {
      code: { type: String, required: true, unique: true, trim: true },
      name: { type: String, required: true, trim: true },
      maxActiveLoans: { type: Number, required: true, min: 0 },
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
