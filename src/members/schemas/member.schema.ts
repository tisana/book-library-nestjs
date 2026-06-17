import { Document, Schema, Types } from 'mongoose';
import { auditFieldsSchemaDefinition } from '../../common/audit/audit-fields.schema';
import {
  MemberAuthStatus,
  MemberStatus,
} from '../../common/enums/library-status.enum';

export const MemberModelName = 'Member';

export interface MemberDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  id: string;
  memberNumber: string;
  fullName: string;
  email?: string;
  phone?: string;
  membershipTypeId: Types.ObjectId | string;
  status: MemberStatus;
  activeLoanCount: number;
  loginIdentifier?: string;
  passwordHash?: string;
  passwordUpdatedAt?: Date;
  lastLoginAt?: Date;
  authStatus?: MemberAuthStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const MemberSchema: Schema<MemberDocument> = new Schema<MemberDocument>(
  {
    memberNumber: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    phone: { type: String, trim: true },
    membershipTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'MembershipType',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(MemberStatus),
      required: true,
      default: MemberStatus.Active,
      index: true,
    },
    activeLoanCount: { type: Number, required: true, min: 0, default: 0 },
    loginIdentifier: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      index: true,
    },
    passwordHash: { type: String, select: false },
    passwordUpdatedAt: { type: Date },
    lastLoginAt: { type: Date },
    authStatus: {
      type: String,
      enum: Object.values(MemberAuthStatus),
      default: MemberAuthStatus.Active,
      index: true,
    },
    ...auditFieldsSchemaDefinition,
  },
  { timestamps: true },
);

MemberSchema.index({ status: 1, membershipTypeId: 1 });
