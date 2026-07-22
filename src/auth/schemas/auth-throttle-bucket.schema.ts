import { Document, Schema, Types } from 'mongoose';

export const AuthThrottleBucketModelName = 'AuthThrottleBucket';
export const AuthThrottleBucketCollectionName = 'auth_throttle_buckets';

export enum AuthThrottleDimension {
  SignInIdentifierFailure = 'sign-in-identifier-failure',
  SignInSource = 'sign-in-source',
  RefreshFamily = 'refresh-family',
  RefreshSource = 'refresh-source',
}

export interface AuthThrottleBucketDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  dimension: AuthThrottleDimension;
  keyVersion: number;
  bucketKey: string;
  count: number;
  windowStartedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const AuthThrottleBucketSchema = new Schema<AuthThrottleBucketDocument>(
  {
    dimension: {
      type: String,
      enum: Object.values(AuthThrottleDimension),
      required: true,
    },
    keyVersion: { type: Number, required: true, min: 1 },
    bucketKey: { type: String, required: true },
    count: { type: Number, required: true, min: 0 },
    windowStartedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    autoIndex: false,
    collection: AuthThrottleBucketCollectionName,
  },
);

AuthThrottleBucketSchema.index(
  { dimension: 1, keyVersion: 1, bucketKey: 1 },
  { unique: true, name: 'uq_auth_throttle_bucket_dimension_key' },
);
AuthThrottleBucketSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'ttl_auth_throttle_bucket' },
);
AuthThrottleBucketSchema.index(
  { dimension: 1, expiresAt: 1 },
  { name: 'ix_auth_throttle_bucket_dimension_expiry' },
);
AuthThrottleBucketSchema.index(
  { keyVersion: 1, expiresAt: 1 },
  { name: 'ix_auth_throttle_bucket_key_version_expiry' },
);
