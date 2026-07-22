import { Document, Schema, Types } from 'mongoose';
import {
  AUTH_IDENTIFIER_SCHEMA_MAX_ASSIGNMENTS,
  AuthIdentifierOperationAssignment,
  AuthIdentifierOperationAssignmentSchema,
} from './auth-identifier-operation.schema';

export const AuthIdentifierRepairBatchModelName = 'AuthIdentifierRepairBatch';
export const AuthIdentifierRepairBatchCollectionName =
  'auth_identifier_repair_batches';

export enum AuthIdentifierRepairBatchStatus {
  Pending = 'pending',
  Prepared = 'prepared',
  Activated = 'activated',
  Compensated = 'compensated',
}

export interface AuthIdentifierRepairBatchDocument extends Document<Types.ObjectId> {
  _id: Types.ObjectId;
  parentOperationId: string;
  batchNumber: number;
  batchCount: number;
  status: AuthIdentifierRepairBatchStatus;
  assignments: AuthIdentifierOperationAssignment[];
  checkpointHash: string;
  manifestKeyVersion: number;
  preparedAt?: Date;
  activatedAt?: Date;
  compensatedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const AuthIdentifierRepairBatchSchema =
  new Schema<AuthIdentifierRepairBatchDocument>(
    {
      parentOperationId: { type: String, required: true, trim: true },
      batchNumber: { type: Number, required: true, min: 0 },
      batchCount: { type: Number, required: true, min: 1 },
      status: {
        type: String,
        enum: Object.values(AuthIdentifierRepairBatchStatus),
        required: true,
        default: AuthIdentifierRepairBatchStatus.Pending,
      },
      assignments: {
        type: [AuthIdentifierOperationAssignmentSchema],
        required: true,
        validate: {
          validator: (assignments: AuthIdentifierOperationAssignment[]) =>
            assignments.length > 0 &&
            assignments.length <= AUTH_IDENTIFIER_SCHEMA_MAX_ASSIGNMENTS,
          message: `Repair batch assignments must contain 1-${AUTH_IDENTIFIER_SCHEMA_MAX_ASSIGNMENTS} entries`,
        },
      },
      checkpointHash: { type: String, required: true },
      manifestKeyVersion: { type: Number, required: true, min: 1 },
      preparedAt: { type: Date },
      activatedAt: { type: Date },
      compensatedAt: { type: Date },
      expiresAt: { type: Date },
    },
    {
      timestamps: true,
      autoIndex: false,
      collection: AuthIdentifierRepairBatchCollectionName,
    },
  );

AuthIdentifierRepairBatchSchema.pre(
  'validate',
  function validateBatchCheckpoint() {
    if (this.batchNumber >= this.batchCount) {
      this.invalidate(
        'batchNumber',
        'Batch number must be less than the total batch count',
      );
    }
  },
);

AuthIdentifierRepairBatchSchema.index(
  { parentOperationId: 1, batchNumber: 1 },
  { unique: true, name: 'uq_auth_identifier_repair_batch_checkpoint' },
);
AuthIdentifierRepairBatchSchema.index(
  { parentOperationId: 1, status: 1 },
  { name: 'ix_auth_identifier_repair_batch_parent_status' },
);
AuthIdentifierRepairBatchSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'ttl_auth_identifier_repair_batch' },
);
