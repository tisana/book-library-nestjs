import { Document, Schema, Types } from 'mongoose';

export const SecurityActivityEventModelName = 'SecurityActivityEvent';

export enum SecurityActivityEventType {
  SignInSuccess = 'sign-in-success',
  SignInFailure = 'sign-in-failure',
  AuthorizationDenied = 'authorization-denied',
  RoleChanged = 'role-changed',
  AccountStatusChanged = 'account-status-changed',
  TokenRefreshed = 'token-refreshed',
  RefreshReplayDetected = 'refresh-replay-detected',
  TokenRevoked = 'token-revoked',
  SignOut = 'sign-out',
}

export enum SecurityActivityActorType {
  Staff = 'staff',
  Member = 'member',
  System = 'system',
  Unknown = 'unknown',
}

export enum SecurityActivityOutcome {
  Success = 'success',
  Failure = 'failure',
  Denied = 'denied',
}

export interface SecurityActivityEventDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  eventType: SecurityActivityEventType;
  actorType: SecurityActivityActorType;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  clientId?: string;
  subjectType?: string;
  subjectId?: string;
  outcome: SecurityActivityOutcome;
  reasonCategory?: string;
  requestId?: string;
  ipHash?: string;
  userAgentHash?: string;
  context?: Record<string, unknown>;
  createdAt: Date;
}

export const SecurityActivityEventSchema =
  new Schema<SecurityActivityEventDocument>(
    {
      eventType: {
        type: String,
        enum: Object.values(SecurityActivityEventType),
        required: true,
        index: true,
      },
      actorType: {
        type: String,
        enum: Object.values(SecurityActivityActorType),
        required: true,
        default: SecurityActivityActorType.Unknown,
        index: true,
      },
      actorId: { type: String, index: true },
      targetType: { type: String },
      targetId: { type: String },
      clientId: { type: String },
      subjectType: { type: String, index: true },
      subjectId: { type: String, index: true },
      outcome: {
        type: String,
        enum: Object.values(SecurityActivityOutcome),
        required: true,
      },
      reasonCategory: { type: String },
      requestId: { type: String },
      ipHash: { type: String },
      userAgentHash: { type: String },
      context: { type: Schema.Types.Mixed },
      createdAt: { type: Date, required: true, default: Date.now },
    },
    { versionKey: false },
  );

SecurityActivityEventSchema.index({ createdAt: -1 });
SecurityActivityEventSchema.index({ eventType: 1, createdAt: -1 });
SecurityActivityEventSchema.index({ actorType: 1, actorId: 1, createdAt: -1 });
SecurityActivityEventSchema.index({
  subjectType: 1,
  subjectId: 1,
  createdAt: -1,
});
