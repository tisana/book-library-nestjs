import { Document, Schema, Types } from 'mongoose';

export const AuthIdentifierModelName = 'AuthIdentifier';
export const AuthIdentifierCollectionName = 'auth_identifiers';

export enum AuthIdentifierType {
  Email = 'email',
  MemberNumber = 'member-number',
  LoginIdentifier = 'login-identifier',
}

export enum AuthIdentifierSubjectType {
  Staff = 'staff',
  Member = 'member',
}

export enum AuthIdentifierStatus {
  Pending = 'pending',
  Active = 'active',
  Released = 'released',
  Conflict = 'conflict',
}

export enum AuthIdentifierConflictResolutionStatus {
  Reviewable = 'reviewable',
  ManualRepairRequired = 'manual-repair-required',
}

export enum AuthIdentifierPendingAction {
  Claim = 'claim',
  Replace = 'replace',
  Release = 'release',
  ResolveConflict = 'resolve-conflict',
}

export interface AuthIdentifierSubjectReference {
  subjectType: AuthIdentifierSubjectType;
  subjectId: string;
}

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

export interface AuthIdentifierDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  normalizedIdentifier: string;
  identifierType: AuthIdentifierType;
  subjectType?: AuthIdentifierSubjectType;
  subjectId?: string;
  status: AuthIdentifierStatus;
  conflictingSubjects?: AuthIdentifierSubjectReference[];
  conflictResolutionStatus?: AuthIdentifierConflictResolutionStatus;
  pendingOperationId?: string;
  activationGateOperationId?: string;
  lastOperationId?: string;
  pendingAction?: AuthIdentifierPendingAction;
  releasedAt?: Date;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const AuthIdentifierSchema = new Schema<AuthIdentifierDocument>(
  {
    normalizedIdentifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    identifierType: {
      type: String,
      enum: Object.values(AuthIdentifierType),
      required: true,
    },
    subjectType: {
      type: String,
      enum: Object.values(AuthIdentifierSubjectType),
    },
    subjectId: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(AuthIdentifierStatus),
      required: true,
    },
    conflictingSubjects: {
      type: [AuthIdentifierSubjectReferenceSchema],
      default: undefined,
    },
    conflictResolutionStatus: {
      type: String,
      enum: Object.values(AuthIdentifierConflictResolutionStatus),
    },
    pendingOperationId: { type: String, trim: true },
    activationGateOperationId: { type: String, trim: true },
    lastOperationId: { type: String, trim: true },
    pendingAction: {
      type: String,
      enum: Object.values(AuthIdentifierPendingAction),
    },
    releasedAt: { type: Date },
    createdBy: { type: String, required: true, trim: true },
    updatedBy: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    autoIndex: false,
    collection: AuthIdentifierCollectionName,
  },
);

AuthIdentifierSchema.pre('validate', function validateIdentifierState() {
  const isConflict = this.status === AuthIdentifierStatus.Conflict;

  if (isConflict) {
    if (!this.conflictingSubjects || this.conflictingSubjects.length < 2) {
      this.invalidate(
        'conflictingSubjects',
        'Conflict identifiers require at least two subject references',
      );
    }
    if (!this.conflictResolutionStatus) {
      this.invalidate(
        'conflictResolutionStatus',
        'Conflict identifiers require a resolution status',
      );
    }
  } else if (!this.subjectType || !this.subjectId) {
    this.invalidate(
      'subjectId',
      'Non-conflict identifiers require one owning subject',
    );
  }

  if (
    this.status === AuthIdentifierStatus.Pending &&
    (!this.pendingOperationId || !this.pendingAction)
  ) {
    this.invalidate(
      'pendingOperationId',
      'Pending identifiers require an operation and pending action',
    );
  }

  if (
    this.activationGateOperationId &&
    this.status !== AuthIdentifierStatus.Active
  ) {
    this.invalidate(
      'activationGateOperationId',
      'Only active identifiers may be activation gated',
    );
  }
});

AuthIdentifierSchema.index(
  { normalizedIdentifier: 1 },
  { unique: true, name: 'uq_auth_identifier_normalized' },
);
AuthIdentifierSchema.index(
  { subjectType: 1, subjectId: 1, status: 1 },
  { name: 'ix_auth_identifier_subject_status' },
);
AuthIdentifierSchema.index(
  { status: 1, updatedAt: -1 },
  { name: 'ix_auth_identifier_status_updated' },
);
AuthIdentifierSchema.index(
  { pendingOperationId: 1, status: 1 },
  { sparse: true, name: 'ix_auth_identifier_pending_operation' },
);
AuthIdentifierSchema.index(
  { activationGateOperationId: 1, status: 1 },
  { sparse: true, name: 'ix_auth_identifier_activation_gate' },
);
AuthIdentifierSchema.index(
  { lastOperationId: 1 },
  { sparse: true, name: 'ix_auth_identifier_last_operation' },
);
