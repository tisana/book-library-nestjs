import { Document, Schema, Types } from 'mongoose';

export const RefreshTokenFamilyModelName = 'RefreshTokenFamily';

export enum RefreshTokenFamilyStatus {
  Active = 'active',
  Revoked = 'revoked',
  Replayed = 'replayed',
}

export enum AuthSubjectType {
  Staff = 'staff',
  Member = 'member',
}

export interface RefreshTokenFamilyDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  familyId: string;
  clientId: string;
  subjectType: AuthSubjectType;
  subjectId: string;
  scopes: string[];
  authVersion: number;
  status: RefreshTokenFamilyStatus;
  currentTokenHash: string;
  previousTokenHash?: string;
  issuedAt: Date;
  lastRotatedAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const RefreshTokenFamilySchema = new Schema<RefreshTokenFamilyDocument>(
  {
    familyId: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, trim: true, index: true },
    subjectType: {
      type: String,
      enum: Object.values(AuthSubjectType),
      required: true,
    },
    subjectId: { type: String, required: true, index: true },
    scopes: { type: [String], required: true, default: [] },
    authVersion: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(RefreshTokenFamilyStatus),
      required: true,
      default: RefreshTokenFamilyStatus.Active,
      index: true,
    },
    currentTokenHash: { type: String, required: true, unique: true },
    previousTokenHash: { type: String },
    issuedAt: { type: Date, required: true },
    lastRotatedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, trim: true },
  },
  { timestamps: true },
);

RefreshTokenFamilySchema.index({ subjectType: 1, subjectId: 1, status: 1 });
RefreshTokenFamilySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
