import { Document, Schema, Types } from 'mongoose';
import {
  AuthIdentifierSubjectReference,
  AuthIdentifierSubjectType,
} from './auth-identifier.schema';

export const AuthIdentifierOperationModelName = 'AuthIdentifierOperation';
export const AuthIdentifierOperationCollectionName =
  'auth_identifier_operations';
export const AUTH_IDENTIFIER_SCHEMA_MAX_ASSIGNMENTS = 100;

export enum AuthIdentifierOperationType {
  Claim = 'claim',
  Replace = 'replace',
  Release = 'release',
  ResolveConflict = 'resolve-conflict',
  OfflineRepair = 'offline-repair',
}

export enum AuthIdentifierOperationStatus {
  Pending = 'pending',
  Applying = 'applying',
  Compensating = 'compensating',
  Finalizing = 'finalizing',
  FailedRetryable = 'failed-retryable',
  Completed = 'completed',
  FailedTerminal = 'failed-terminal',
}

export enum AuthIdentifierOperationCleanupStatus {
  NotRequired = 'not-required',
  Pending = 'pending',
  Completed = 'completed',
}

export enum AuthIdentifierAssignmentAction {
  Retain = 'retain',
  Claim = 'claim',
  Replace = 'replace',
  Release = 'release',
}

export enum AuthIdentifierAssignmentStatus {
  Pending = 'pending',
  Applied = 'applied',
  Compensated = 'compensated',
}

export interface AuthIdentifierOperationAssignment {
  assignmentId: string;
  subjectType: AuthIdentifierSubjectType;
  subjectId: string;
  action: AuthIdentifierAssignmentAction;
  sourceReservationId?: Types.ObjectId;
  targetReservationId?: Types.ObjectId;
  identifierCorrelationHash?: string;
  correlationKeyVersion?: number;
  status: AuthIdentifierAssignmentStatus;
  appliedAt?: Date;
}

export const AuthIdentifierOperationAssignmentSchema =
  new Schema<AuthIdentifierOperationAssignment>(
    {
      assignmentId: { type: String, required: true, trim: true },
      subjectType: {
        type: String,
        enum: Object.values(AuthIdentifierSubjectType),
        required: true,
      },
      subjectId: { type: String, required: true, trim: true },
      action: {
        type: String,
        enum: Object.values(AuthIdentifierAssignmentAction),
        required: true,
      },
      sourceReservationId: { type: Schema.Types.ObjectId },
      targetReservationId: { type: Schema.Types.ObjectId },
      identifierCorrelationHash: { type: String },
      correlationKeyVersion: { type: Number, min: 1 },
      status: {
        type: String,
        enum: Object.values(AuthIdentifierAssignmentStatus),
        required: true,
        default: AuthIdentifierAssignmentStatus.Pending,
      },
      appliedAt: { type: Date },
    },
    { _id: false },
  );

AuthIdentifierOperationAssignmentSchema.pre(
  'validate',
  function validateCorrelationMetadata() {
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

const AuthIdentifierSubjectReferenceSchema =
  new Schema<AuthIdentifierSubjectReference>(
    {
      subjectType: {
        type: String,
        enum: Object.values(AuthIdentifierSubjectType),
        required: true,
      },
      subjectId: { type: String, required: true, trim: true },
    },
    { _id: false },
  );

export enum AuthIdentifierOperationResultOutcome {
  Success = 'success',
  Failure = 'failure',
}

export interface AuthIdentifierOperationResult {
  outcome: AuthIdentifierOperationResultOutcome;
  reasonCategory?: string;
  httpStatus: number;
}

const AuthIdentifierOperationResultSchema =
  new Schema<AuthIdentifierOperationResult>(
    {
      outcome: {
        type: String,
        enum: Object.values(AuthIdentifierOperationResultOutcome),
        required: true,
      },
      reasonCategory: { type: String, trim: true },
      httpStatus: { type: Number, required: true, min: 100, max: 599 },
    },
    { _id: false },
  );

export interface AuthIdentifierOperationDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  operationId: string;
  operationType: AuthIdentifierOperationType;
  status: AuthIdentifierOperationStatus;
  assignments: AuthIdentifierOperationAssignment[];
  manifestHash?: string;
  manifestKeyVersion?: number;
  retainedSubject?: AuthIdentifierSubjectReference;
  result?: AuthIdentifierOperationResult;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  terminalEventId?: string;
  terminalEventRecordedAt?: Date;
  cleanupStatus: AuthIdentifierOperationCleanupStatus;
  expiresAt?: Date;
  requestedBy: AuthIdentifierSubjectReference;
  lastResumedBy?: AuthIdentifierSubjectReference;
  lastResumedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const AuthIdentifierOperationSchema =
  new Schema<AuthIdentifierOperationDocument>(
    {
      operationId: { type: String, required: true, trim: true },
      operationType: {
        type: String,
        enum: Object.values(AuthIdentifierOperationType),
        required: true,
      },
      status: {
        type: String,
        enum: Object.values(AuthIdentifierOperationStatus),
        required: true,
        default: AuthIdentifierOperationStatus.Pending,
      },
      assignments: {
        type: [AuthIdentifierOperationAssignmentSchema],
        required: true,
        default: [],
        validate: {
          validator: (assignments: AuthIdentifierOperationAssignment[]) =>
            assignments.length <= AUTH_IDENTIFIER_SCHEMA_MAX_ASSIGNMENTS,
          message: `Assignments cannot exceed ${AUTH_IDENTIFIER_SCHEMA_MAX_ASSIGNMENTS}`,
        },
      },
      manifestHash: { type: String },
      manifestKeyVersion: { type: Number, min: 1 },
      retainedSubject: { type: AuthIdentifierSubjectReferenceSchema },
      result: { type: AuthIdentifierOperationResultSchema },
      leaseOwner: { type: String, trim: true },
      leaseExpiresAt: { type: Date },
      terminalEventId: { type: String, trim: true },
      terminalEventRecordedAt: { type: Date },
      cleanupStatus: {
        type: String,
        enum: Object.values(AuthIdentifierOperationCleanupStatus),
        required: true,
        default: AuthIdentifierOperationCleanupStatus.NotRequired,
      },
      expiresAt: { type: Date },
      requestedBy: {
        type: AuthIdentifierSubjectReferenceSchema,
        required: true,
      },
      lastResumedBy: { type: AuthIdentifierSubjectReferenceSchema },
      lastResumedAt: { type: Date },
      completedAt: { type: Date },
    },
    {
      timestamps: true,
      autoIndex: false,
      collection: AuthIdentifierOperationCollectionName,
    },
  );

AuthIdentifierOperationSchema.pre(
  'validate',
  function validateOperationLifecycle() {
    const hasManifestHash = Boolean(this.manifestHash);
    const hasManifestVersion = this.manifestKeyVersion !== undefined;
    if (hasManifestHash !== hasManifestVersion) {
      this.invalidate(
        'manifestKeyVersion',
        'Manifest hash and key version must be stored together',
      );
    }

    const terminal =
      this.status === AuthIdentifierOperationStatus.Completed ||
      this.status === AuthIdentifierOperationStatus.FailedTerminal;

    if (terminal && (!this.terminalEventId || !this.terminalEventRecordedAt)) {
      this.invalidate(
        'terminalEventId',
        'Terminal operations require a durable terminal security event',
      );
    }

    if (
      this.expiresAt &&
      (!terminal ||
        !this.terminalEventRecordedAt ||
        this.cleanupStatus === AuthIdentifierOperationCleanupStatus.Pending)
    ) {
      this.invalidate(
        'expiresAt',
        'Operation expiry requires terminal audit persistence and completed cleanup',
      );
    }
  },
);

AuthIdentifierOperationSchema.index(
  { operationId: 1 },
  { unique: true, name: 'uq_auth_identifier_operation_id' },
);
AuthIdentifierOperationSchema.index(
  { terminalEventId: 1 },
  {
    unique: true,
    sparse: true,
    name: 'uq_auth_identifier_operation_terminal_event',
  },
);
AuthIdentifierOperationSchema.index(
  {
    operationType: 1,
    status: 1,
    cleanupStatus: 1,
    manifestKeyVersion: 1,
  },
  {
    name: 'ix_auth_identifier_operation_repair_key_policy',
    partialFilterExpression: {
      operationType: AuthIdentifierOperationType.OfflineRepair,
      manifestKeyVersion: { $exists: true },
    },
  },
);
AuthIdentifierOperationSchema.index(
  { status: 1, leaseExpiresAt: 1 },
  { name: 'ix_auth_identifier_operation_status_lease' },
);
AuthIdentifierOperationSchema.index(
  { leaseOwner: 1, leaseExpiresAt: 1 },
  { name: 'ix_auth_identifier_operation_owner_lease' },
);
AuthIdentifierOperationSchema.index(
  { createdAt: -1 },
  { name: 'ix_auth_identifier_operation_created' },
);
AuthIdentifierOperationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'ttl_auth_identifier_operation' },
);
