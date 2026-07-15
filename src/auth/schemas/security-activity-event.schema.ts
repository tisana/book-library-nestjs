import { Document, Schema, Types } from 'mongoose';

export const SecurityActivityEventModelName = 'SecurityActivityEvent';
export const SecurityActivityEventCollectionName = 'security_activity_events';

export enum SecurityActivityEventType {
  SignInSuccess = 'sign-in-success',
  SignInFailure = 'sign-in-failure',
  AuthorizationDenied = 'authorization-denied',
  RoleChanged = 'role-changed',
  AccountStatusChanged = 'account-status-changed',
  IdentifierConflictDetected = 'identifier-conflict-detected',
  IdentifierConflictResolved = 'identifier-conflict-resolved',
  IdentifierReservationRecovered = 'identifier-reservation-recovered',
  IdentifierRepairResumed = 'identifier-repair-resumed',
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
  eventId?: string;
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
  identifierCorrelationHash?: string;
  correlationKeyVersion?: number;
  operationId?: string;
  requestId?: string;
  ipHash?: string;
  userAgentHash?: string;
  context?: Record<string, unknown>;
  createdAt: Date;
}

export const SecurityActivityEventSchema =
  new Schema<SecurityActivityEventDocument>(
    {
      eventId: { type: String, trim: true },
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
      identifierCorrelationHash: { type: String },
      correlationKeyVersion: { type: Number, min: 1 },
      operationId: { type: String, trim: true },
      requestId: { type: String },
      ipHash: { type: String },
      userAgentHash: { type: String },
      context: { type: Schema.Types.Mixed },
      createdAt: { type: Date, required: true, default: Date.now },
    },
    {
      versionKey: false,
      autoIndex: false,
      collection: SecurityActivityEventCollectionName,
    },
  );

SecurityActivityEventSchema.pre(
  'validate',
  function validateIdentifierCorrelationMetadata() {
    const hasHash = Boolean(this.identifierCorrelationHash);
    const hasVersion = this.correlationKeyVersion !== undefined;
    if (hasHash !== hasVersion) {
      this.invalidate(
        'correlationKeyVersion',
        'Identifier correlation hash and key version must be stored together',
      );
    }
  },
);

SecurityActivityEventSchema.index(
  { eventId: 1 },
  { unique: true, sparse: true, name: 'uq_security_activity_event_id' },
);
SecurityActivityEventSchema.index(
  { createdAt: -1 },
  { name: 'ix_security_activity_created' },
);
SecurityActivityEventSchema.index(
  { eventType: 1, createdAt: -1 },
  { name: 'ix_security_activity_type_created' },
);
SecurityActivityEventSchema.index(
  { actorType: 1, actorId: 1, createdAt: -1 },
  { name: 'ix_security_activity_actor_created' },
);
SecurityActivityEventSchema.index(
  {
    subjectType: 1,
    subjectId: 1,
    createdAt: -1,
  },
  { name: 'ix_security_activity_subject_created' },
);
