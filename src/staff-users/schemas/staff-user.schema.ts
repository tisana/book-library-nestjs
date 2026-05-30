import { Document, Schema, Types } from 'mongoose';
import { auditFieldsSchemaDefinition } from '../../common/audit/audit-fields.schema';
import {
  StaffRole,
  StaffUserStatus,
} from '../../common/enums/library-status.enum';

export const StaffUserModelName = 'StaffUser';

export interface StaffUserDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  roles: StaffRole[];
  status: StaffUserStatus;
  lastLoginAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const StaffUserSchema = new Schema<StaffUserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    displayName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    roles: {
      type: [String],
      enum: Object.values(StaffRole),
      required: true,
      default: [StaffRole.Staff],
    },
    status: {
      type: String,
      enum: Object.values(StaffUserStatus),
      required: true,
      default: StaffUserStatus.Active,
      index: true,
    },
    lastLoginAt: { type: Date },
    ...auditFieldsSchemaDefinition,
  },
  { timestamps: true },
);

StaffUserSchema.index({ status: 1, roles: 1 });
