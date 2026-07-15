import { Document, Schema, Types } from 'mongoose';

export const RefreshTokenFamilyModelName = 'RefreshTokenFamily';
export const RefreshTokenFamilyCollectionName = 'refresh_token_families';

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
  currentTokenHash?: string;
  /** @deprecated Cleared by migration 003 and not persisted by this schema. */
  previousTokenHash?: string;
  lastRotationOperationId?: string;
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
    familyId: { type: String, required: true },
    clientId: { type: String, required: true, trim: true },
    subjectType: {
      type: String,
      enum: Object.values(AuthSubjectType),
      required: true,
    },
    subjectId: { type: String, required: true },
    scopes: { type: [String], required: true, default: [] },
    authVersion: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(RefreshTokenFamilyStatus),
      required: true,
      default: RefreshTokenFamilyStatus.Active,
    },
    currentTokenHash: {
      type: String,
      required: function requireActiveFamilyHash() {
        return this.status === RefreshTokenFamilyStatus.Active;
      },
    },
    lastRotationOperationId: { type: String, trim: true },
    issuedAt: { type: Date, required: true },
    lastRotatedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, trim: true },
  },
  {
    timestamps: true,
    autoIndex: false,
    collection: RefreshTokenFamilyCollectionName,
  },
);

RefreshTokenFamilySchema.index(
  { familyId: 1 },
  { unique: true, name: 'uq_refresh_token_family_id' },
);
RefreshTokenFamilySchema.index(
  { currentTokenHash: 1 },
  { unique: true, sparse: true, name: 'uq_refresh_token_family_current_hash' },
);
RefreshTokenFamilySchema.index(
  { subjectType: 1, subjectId: 1, status: 1 },
  { name: 'ix_refresh_token_family_subject_status' },
);
RefreshTokenFamilySchema.index(
  { lastRotationOperationId: 1 },
  { sparse: true, name: 'ix_refresh_token_family_last_rotation' },
);
RefreshTokenFamilySchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'ttl_refresh_token_family' },
);
