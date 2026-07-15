import { Document, Schema, Types } from 'mongoose';

export const RefreshTokenReplayMarkerModelName = 'RefreshTokenReplayMarker';
export const RefreshTokenReplayMarkerCollectionName =
  'refresh_token_replay_markers';

export enum RefreshTokenReplayMarkerStatus {
  Pending = 'pending',
  Committed = 'committed',
}

export interface RefreshTokenReplayMarkerDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  status: RefreshTokenReplayMarkerStatus;
  rotationOperationId: string;
  leaseExpiresAt?: Date;
  committedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const RefreshTokenReplayMarkerSchema =
  new Schema<RefreshTokenReplayMarkerDocument>(
    {
      tokenHash: { type: String, required: true },
      familyId: { type: String, required: true, trim: true },
      status: {
        type: String,
        enum: Object.values(RefreshTokenReplayMarkerStatus),
        required: true,
        default: RefreshTokenReplayMarkerStatus.Pending,
      },
      rotationOperationId: { type: String, required: true, trim: true },
      leaseExpiresAt: { type: Date },
      committedAt: { type: Date },
      expiresAt: { type: Date, required: true },
    },
    {
      timestamps: true,
      autoIndex: false,
      collection: RefreshTokenReplayMarkerCollectionName,
    },
  );

RefreshTokenReplayMarkerSchema.pre(
  'validate',
  function validateReplayMarkerState() {
    if (
      this.status === RefreshTokenReplayMarkerStatus.Pending &&
      !this.leaseExpiresAt
    ) {
      this.invalidate(
        'leaseExpiresAt',
        'Pending replay markers require an ownership lease',
      );
    }

    if (
      this.status === RefreshTokenReplayMarkerStatus.Committed &&
      (!this.committedAt || this.leaseExpiresAt)
    ) {
      this.invalidate(
        'committedAt',
        'Committed replay markers require committedAt and no active lease',
      );
    }
  },
);

RefreshTokenReplayMarkerSchema.index(
  { tokenHash: 1 },
  { unique: true, name: 'uq_refresh_replay_marker_token_hash' },
);
RefreshTokenReplayMarkerSchema.index(
  { rotationOperationId: 1 },
  { unique: true, name: 'uq_refresh_replay_marker_rotation_operation' },
);
RefreshTokenReplayMarkerSchema.index(
  { familyId: 1, expiresAt: 1 },
  { name: 'ix_refresh_replay_marker_family_expiry' },
);
RefreshTokenReplayMarkerSchema.index(
  { status: 1, leaseExpiresAt: 1 },
  { name: 'ix_refresh_replay_marker_status_lease' },
);
RefreshTokenReplayMarkerSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'ttl_refresh_replay_marker' },
);
