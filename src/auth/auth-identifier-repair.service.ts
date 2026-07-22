import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac } from 'node:crypto';
import { ClientSession, Model } from 'mongoose';
import { MemberDocument, MemberModelName } from '../members/schemas/member.schema';
import {
  StaffUserDocument,
  StaffUserModelName,
} from '../staff-users/schemas/staff-user.schema';
import { AuthIdentifierRepairAuthorizationService } from './auth-identifier-repair-authorization.service';
import { AuthIdentifierRepairKeyPolicyService } from './auth-identifier-repair-key-policy.service';
import {
  AuthIdentifierRepairManifest,
  deriveRepairManifestKey,
  hashRepairManifest,
  normalizeRepairManifest,
  verifyRepairManifest,
} from './auth-identifier-repair-manifest';
import {
  AuthIdentifierAssignmentAction,
  AuthIdentifierAssignmentStatus,
  AuthIdentifierOperationAssignment,
  AuthIdentifierOperationCleanupStatus,
  AuthIdentifierOperationDocument,
  AuthIdentifierOperationModelName,
  AuthIdentifierOperationResultOutcome,
  AuthIdentifierOperationStatus,
  AuthIdentifierOperationType,
} from './schemas/auth-identifier-operation.schema';
import {
  AuthIdentifierRepairBatchDocument,
  AuthIdentifierRepairBatchModelName,
  AuthIdentifierRepairBatchStatus,
} from './schemas/auth-identifier-repair-batch.schema';
import {
  AuthIdentifierConflictResolutionStatus,
  AuthIdentifierDocument,
  AuthIdentifierModelName,
  AuthIdentifierPendingAction,
  AuthIdentifierStatus,
  AuthIdentifierSubjectReference,
  AuthIdentifierSubjectType,
  AuthIdentifierType,
} from './schemas/auth-identifier.schema';
import {
  SecurityActivityActorType,
  SecurityActivityOutcome,
} from './schemas/security-activity-event.schema';
import { SecurityActivityService } from './security-activity.service';

export interface OfflineRepairRequest {
  token: string;
  operationId: string;
  manifest: AuthIdentifierRepairManifest;
  resumeId?: string;
}

export interface OfflineRepairResult {
  operationId: string;
  status: AuthIdentifierOperationStatus;
  assignmentCount: number;
  batchCount: number;
  replayed: boolean;
  reasonCategory: string;
}

@Injectable()
export class AuthIdentifierRepairService {
  constructor(
    @InjectModel(AuthIdentifierOperationModelName)
    private readonly operationModel: Model<AuthIdentifierOperationDocument>,
    @InjectModel(AuthIdentifierRepairBatchModelName)
    private readonly repairBatchModel: Model<AuthIdentifierRepairBatchDocument>,
    @InjectModel(AuthIdentifierModelName)
    private readonly identifierModel: Model<AuthIdentifierDocument>,
    @InjectModel(StaffUserModelName)
    private readonly staffUserModel: Model<StaffUserDocument>,
    @InjectModel(MemberModelName)
    private readonly memberModel: Model<MemberDocument>,
    private readonly authorization: AuthIdentifierRepairAuthorizationService,
    private readonly keyPolicy: AuthIdentifierRepairKeyPolicyService,
    private readonly securityActivity: SecurityActivityService,
    private readonly configService: ConfigService,
  ) {}

  async dryRun(input: OfflineRepairRequest): Promise<OfflineRepairResult> {
    const actor = await this.authorization.authorizeDryRun(input.token);
    const manifest = normalizeRepairManifest(input.manifest);
    const conflict = await this.loadConflict(manifest.conflictId);
    this.validateManifestSubjects(conflict, manifest);
    const version = this.currentKeyVersion;
    const keyMaterial = this.requireKey(version);
    const hashed = hashRepairManifest(manifest, keyMaterial, version);
    const existing = await this.operationModel
      .findOne({ operationId: input.operationId })
      .lean()
      .exec();
    if (existing) {
      if (
        existing.operationType !== AuthIdentifierOperationType.OfflineRepair ||
        existing.manifestKeyVersion !== version ||
        existing.manifestHash !== hashed.manifestHash
      ) {
        throw new ConflictException('Repair operation id is already in use');
      }
      return this.result(existing, manifest.reassignments.length, true);
    }

    await this.operationModel.create({
      operationId: input.operationId,
      operationType: AuthIdentifierOperationType.OfflineRepair,
      status: AuthIdentifierOperationStatus.Pending,
      assignments: [],
      manifestHash: hashed.manifestHash,
      manifestKeyVersion: version,
      retainedSubject: manifest.retainedSubject,
      requestedBy: {
        subjectType: AuthIdentifierSubjectType.Staff,
        subjectId: actor.subjectId,
      },
      cleanupStatus: AuthIdentifierOperationCleanupStatus.NotRequired,
    });
    const created = await this.requireOperation(input.operationId);
    return this.result(created, manifest.reassignments.length, false);
  }

  async apply(input: OfflineRepairRequest): Promise<OfflineRepairResult> {
    if (!input.resumeId?.trim()) {
      throw new UnprocessableEntityException('A stable resume id is required');
    }
    const actor = await this.authorization.authorizeMutation(input.token);
    const manifest = normalizeRepairManifest(input.manifest);
    let operation = await this.requireOperation(input.operationId);
    this.verifyPersistedManifest(operation, manifest);
    if (this.isTerminal(operation.status)) {
      return this.result(operation, manifest.reassignments.length, true);
    }
    const conflict = await this.loadConflict(manifest.conflictId);
    this.validateManifestSubjects(conflict, manifest);
    await this.recordResume(operation, actor.subjectId, input.resumeId);

    if (
      operation.status === AuthIdentifierOperationStatus.Pending ||
      operation.status === AuthIdentifierOperationStatus.FailedRetryable
    ) {
      await this.operationModel.updateOne(
        { operationId: input.operationId, status: operation.status },
        {
          $set: {
            status: AuthIdentifierOperationStatus.Applying,
            lastResumedBy: {
              subjectType: AuthIdentifierSubjectType.Staff,
              subjectId: actor.subjectId,
            },
            lastResumedAt: new Date(),
          },
        },
      );
    }

    const batches = this.partition(manifest);
    try {
      for (let index = 0; index < batches.length; index += 1) {
        await this.authorization.authorizeMutation(input.token);
        await this.prepareBatch(operation, conflict, batches[index], index, batches.length);
      }
      for (let index = 0; index < batches.length; index += 1) {
        await this.authorization.authorizeMutation(input.token);
        await this.activateBatch(input.operationId, index);
      }
      await this.authorization.authorizeMutation(input.token);
      await this.operationModel.updateOne(
        {
          operationId: input.operationId,
          status: AuthIdentifierOperationStatus.Applying,
        },
        { $set: { status: AuthIdentifierOperationStatus.Finalizing } },
      );
      await this.completeParent(input, manifest, actor.subjectId);
    } catch (error) {
      await this.operationModel.updateOne(
        {
          operationId: input.operationId,
          status: AuthIdentifierOperationStatus.Applying,
        },
        { $set: { status: AuthIdentifierOperationStatus.FailedRetryable } },
      );
      throw error;
    }

    operation = await this.requireOperation(input.operationId);
    return this.result(operation, manifest.reassignments.length, false);
  }

  async cancel(input: OfflineRepairRequest): Promise<OfflineRepairResult> {
    const actor = await this.authorization.authorizeMutation(input.token);
    const manifest = normalizeRepairManifest(input.manifest);
    let operation = await this.requireOperation(input.operationId);
    this.verifyPersistedManifest(operation, manifest);
    if (this.isTerminal(operation.status)) {
      return this.result(operation, manifest.reassignments.length, true);
    }
    await this.operationModel.updateOne(
      {
        operationId: input.operationId,
        status: {
          $in: [
            AuthIdentifierOperationStatus.Applying,
            AuthIdentifierOperationStatus.FailedRetryable,
            AuthIdentifierOperationStatus.Pending,
          ],
        },
      },
      { $set: { status: AuthIdentifierOperationStatus.Compensating } },
    );
    const batches = await this.repairBatchModel
      .find({ parentOperationId: input.operationId })
      .sort({ batchNumber: -1 })
      .exec();
    for (const batch of batches) {
      await this.authorization.authorizeMutation(input.token);
      await this.compensateBatch(batch, manifest);
    }
    await this.identifierModel.updateOne(
      { _id: manifest.conflictId },
      {
        $set: {
          status: AuthIdentifierStatus.Conflict,
          conflictResolutionStatus:
            AuthIdentifierConflictResolutionStatus.ManualRepairRequired,
        },
      },
    );
    await this.operationModel.updateOne(
      {
        operationId: input.operationId,
        status: AuthIdentifierOperationStatus.Compensating,
      },
      { $set: { status: AuthIdentifierOperationStatus.Finalizing } },
    );
    await this.finishFailedParent(input.operationId, actor.subjectId);
    operation = await this.requireOperation(input.operationId);
    return this.result(operation, manifest.reassignments.length, false);
  }

  private async prepareBatch(
    operation: AuthIdentifierOperationDocument,
    conflict: AuthIdentifierDocument,
    reassignments: AuthIdentifierRepairManifest['reassignments'],
    batchNumber: number,
    batchCount: number,
  ): Promise<void> {
    const existing = await this.repairBatchModel.findOne({
      parentOperationId: operation.operationId,
      batchNumber,
    });
    if (
      existing &&
      existing.status !== AuthIdentifierRepairBatchStatus.Pending
    ) {
      return;
    }
    const key = this.requireKey(operation.manifestKeyVersion!);
    const derived = deriveRepairManifestKey(key, operation.manifestKeyVersion!);
    const assignments: AuthIdentifierOperationAssignment[] = reassignments.map(
      (item) => ({
        assignmentId: `${operation.operationId}:${item.subjectType}:${item.subjectId}`,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        action: AuthIdentifierAssignmentAction.Replace,
        sourceReservationId: conflict._id,
        identifierCorrelationHash: createHmac('sha256', derived)
          .update(item.newIdentifier, 'utf8')
          .digest('base64url'),
        correlationKeyVersion: operation.manifestKeyVersion,
        status: AuthIdentifierAssignmentStatus.Pending,
      }),
    );
    const checkpointHash = createHmac('sha256', derived)
      .update(
        `${operation.operationId}:${batchNumber}:${assignments
          .map((item) => item.assignmentId)
          .join('|')}`,
      )
      .digest('base64url');
    const session = await this.requireTransactionSession();
    try {
      await session.withTransaction(async () => {
        let batch = existing;
        if (!batch) {
          const created = await this.repairBatchModel.create(
            [
              {
                parentOperationId: operation.operationId,
                batchNumber,
                batchCount,
                status: AuthIdentifierRepairBatchStatus.Pending,
                assignments,
                checkpointHash,
                manifestKeyVersion: operation.manifestKeyVersion,
              },
            ],
            { session },
          );
          batch = created[0];
        } else if (batch.checkpointHash !== checkpointHash) {
          throw new ConflictException('Repair batch checkpoint does not match');
        }

        for (let index = 0; index < reassignments.length; index += 1) {
          const item = reassignments[index];
          const reservation = await this.reserveReplacement(
            operation,
            item,
            session,
          );
          await this.applyAggregateIdentifier(item, session);
          await this.repairBatchModel.updateOne(
            {
              parentOperationId: operation.operationId,
              batchNumber,
              'assignments.assignmentId': assignments[index].assignmentId,
            },
            {
              $set: {
                'assignments.$.targetReservationId': reservation._id,
                'assignments.$.status': AuthIdentifierAssignmentStatus.Applied,
                'assignments.$.appliedAt': new Date(),
              },
            },
            { session },
          );
        }
        await this.repairBatchModel.updateOne(
          { parentOperationId: operation.operationId, batchNumber },
          {
            $set: {
              status: AuthIdentifierRepairBatchStatus.Prepared,
              preparedAt: new Date(),
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  private async activateBatch(operationId: string, batchNumber: number) {
    const batch = await this.repairBatchModel.findOne({
      parentOperationId: operationId,
      batchNumber,
    });
    if (!batch || batch.status === AuthIdentifierRepairBatchStatus.Activated) {
      return;
    }
    if (batch.status !== AuthIdentifierRepairBatchStatus.Prepared) {
      throw new ConflictException('Repair batch is not prepared');
    }
    const targetIds = batch.assignments
      .map((item) => item.targetReservationId)
      .filter(Boolean);
    const session = await this.requireTransactionSession();
    try {
      await session.withTransaction(async () => {
        await this.identifierModel.updateMany(
          {
            _id: { $in: targetIds },
            pendingOperationId: operationId,
          },
          {
            $set: {
              status: AuthIdentifierStatus.Active,
              activationGateOperationId: operationId,
              lastOperationId: operationId,
            },
            $unset: { pendingOperationId: '', pendingAction: '' },
          },
          { session },
        );
        await this.repairBatchModel.updateOne(
          { parentOperationId: operationId, batchNumber },
          {
            $set: {
              status: AuthIdentifierRepairBatchStatus.Activated,
              activatedAt: new Date(),
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  private async completeParent(
    input: OfflineRepairRequest,
    manifest: AuthIdentifierRepairManifest,
    actorId: string,
  ): Promise<void> {
    const session = await this.requireTransactionSession();
    try {
      await session.withTransaction(async () => {
        const originalUpdate = manifest.retainedSubject
          ? {
              $set: {
                status: AuthIdentifierStatus.Active,
                subjectType: manifest.retainedSubject.subjectType,
                subjectId: manifest.retainedSubject.subjectId,
                lastOperationId: input.operationId,
              },
              $unset: {
                conflictingSubjects: '',
                conflictResolutionStatus: '',
                pendingOperationId: '',
                pendingAction: '',
                releasedAt: '',
              },
            }
          : {
              $set: {
                status: AuthIdentifierStatus.Released,
                subjectType: manifest.reassignments[0].subjectType,
                subjectId: manifest.reassignments[0].subjectId,
                releasedAt: new Date(),
                lastOperationId: input.operationId,
              },
              $unset: {
                conflictingSubjects: '',
                conflictResolutionStatus: '',
                pendingOperationId: '',
                pendingAction: '',
              },
            };
        await this.identifierModel.updateOne(
          { _id: manifest.conflictId, status: AuthIdentifierStatus.Conflict },
          originalUpdate,
          { session },
        );
        const eventId =
          await this.securityActivity.recordIdentifierOperationTerminal(
            {
              operationId: input.operationId,
              operationType: AuthIdentifierOperationType.OfflineRepair,
              terminalStatus: 'completed',
              actor: {
                actorType: SecurityActivityActorType.Staff,
                actorId,
              },
              outcome: SecurityActivityOutcome.Success,
              reasonCategory: 'identifier-offline-repair-completed',
            },
            session,
          );
        await this.operationModel.updateOne(
          {
            operationId: input.operationId,
            status: AuthIdentifierOperationStatus.Finalizing,
          },
          {
            $set: {
              status: AuthIdentifierOperationStatus.Completed,
              result: {
                outcome: AuthIdentifierOperationResultOutcome.Success,
                reasonCategory: 'identifier-offline-repair-completed',
                httpStatus: 200,
              },
              terminalEventId: eventId,
              terminalEventRecordedAt: new Date(),
              completedAt: new Date(),
              cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  private async compensateBatch(
    batch: AuthIdentifierRepairBatchDocument,
    manifest: AuthIdentifierRepairManifest,
  ): Promise<void> {
    if (batch.status === AuthIdentifierRepairBatchStatus.Compensated) return;
    const originalIdentifier = (await this.loadConflict(manifest.conflictId))
      .normalizedIdentifier;
    const bySubject = new Map(
      manifest.reassignments.map((item) => [
        `${item.subjectType}:${item.subjectId}`,
        item,
      ]),
    );
    const session = await this.requireTransactionSession();
    try {
      await session.withTransaction(async () => {
        for (const assignment of [...batch.assignments].reverse()) {
          const item = bySubject.get(
            `${assignment.subjectType}:${assignment.subjectId}`,
          );
          if (!item) continue;
          await this.setAggregateIdentifier(
            item.subjectType,
            item.subjectId,
            originalIdentifier,
            session,
          );
          if (assignment.targetReservationId) {
            await this.identifierModel.updateOne(
              { _id: assignment.targetReservationId },
              {
                $set: {
                  status: AuthIdentifierStatus.Released,
                  releasedAt: new Date(),
                },
                $unset: {
                  activationGateOperationId: '',
                  pendingOperationId: '',
                  pendingAction: '',
                },
              },
              { session },
            );
          }
        }
        await this.repairBatchModel.updateOne(
          { _id: batch._id },
          {
            $set: {
              status: AuthIdentifierRepairBatchStatus.Compensated,
              compensatedAt: new Date(),
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  private async finishFailedParent(operationId: string, actorId: string) {
    const session = await this.requireTransactionSession();
    try {
      await session.withTransaction(async () => {
        const eventId =
          await this.securityActivity.recordIdentifierOperationTerminal(
            {
              operationId,
              operationType: AuthIdentifierOperationType.OfflineRepair,
              terminalStatus: 'failed-terminal',
              actor: {
                actorType: SecurityActivityActorType.Staff,
                actorId,
              },
              outcome: SecurityActivityOutcome.Failure,
              reasonCategory: 'identifier-offline-repair-cancelled',
            },
            session,
          );
        await this.operationModel.updateOne(
          {
            operationId,
            status: AuthIdentifierOperationStatus.Finalizing,
          },
          {
            $set: {
              status: AuthIdentifierOperationStatus.FailedTerminal,
              result: {
                outcome: AuthIdentifierOperationResultOutcome.Failure,
                reasonCategory: 'identifier-offline-repair-cancelled',
                httpStatus: 409,
              },
              terminalEventId: eventId,
              terminalEventRecordedAt: new Date(),
              completedAt: new Date(),
              cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  private async reserveReplacement(
    operation: AuthIdentifierOperationDocument,
    item: AuthIdentifierRepairManifest['reassignments'][number],
    session: ClientSession,
  ): Promise<AuthIdentifierDocument> {
    try {
      const reservation = await this.identifierModel.findOneAndUpdate(
        {
          normalizedIdentifier: item.newIdentifier,
          $or: [
            { pendingOperationId: operation.operationId },
            { status: AuthIdentifierStatus.Released },
          ],
        },
        {
          $set: {
            normalizedIdentifier: item.newIdentifier,
            identifierType:
              item.subjectType === AuthIdentifierSubjectType.Staff
                ? AuthIdentifierType.Email
                : AuthIdentifierType.LoginIdentifier,
            subjectType: item.subjectType,
            subjectId: item.subjectId,
            status: AuthIdentifierStatus.Pending,
            pendingAction: AuthIdentifierPendingAction.Replace,
            pendingOperationId: operation.operationId,
            updatedBy: operation.requestedBy.subjectId,
          },
          $setOnInsert: { createdBy: operation.requestedBy.subjectId },
        },
        { upsert: true, returnDocument: 'after', session },
      );
      if (!reservation) throw new ConflictException('Replacement unavailable');
      return reservation;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new ConflictException('Replacement identifier is already reserved');
      }
      throw error;
    }
  }

  private async applyAggregateIdentifier(
    item: AuthIdentifierRepairManifest['reassignments'][number],
    session: ClientSession,
  ): Promise<void> {
    const model = (
      item.subjectType === AuthIdentifierSubjectType.Staff
        ? this.staffUserModel
        : this.memberModel
    ) as unknown as Model<Record<string, unknown>>;
    const field =
      item.subjectType === AuthIdentifierSubjectType.Staff
        ? 'email'
        : 'loginIdentifier';
    const current = await model
      .findById(item.subjectId)
      .session(session)
      .lean()
      .exec();
    if (!current) throw new NotFoundException('Repair subject not found');
    if (current[field] === item.newIdentifier) return;
    await model.updateOne(
      { _id: item.subjectId },
      { $set: { [field]: item.newIdentifier }, $inc: { authVersion: 1 } },
      { session },
    );
  }

  private async setAggregateIdentifier(
    subjectType: AuthIdentifierSubjectType,
    subjectId: string,
    identifier: string,
    session: ClientSession,
  ): Promise<void> {
    const model = (
      subjectType === AuthIdentifierSubjectType.Staff
        ? this.staffUserModel
        : this.memberModel
    ) as unknown as Model<Record<string, unknown>>;
    const field =
      subjectType === AuthIdentifierSubjectType.Staff
        ? 'email'
        : 'loginIdentifier';
    await model.updateOne(
      { _id: subjectId },
      { $set: { [field]: identifier }, $inc: { authVersion: 1 } },
      { session },
    );
  }

  private async loadConflict(conflictId: string): Promise<AuthIdentifierDocument> {
    const conflict = await this.identifierModel.findById(conflictId);
    if (!conflict || conflict.status !== AuthIdentifierStatus.Conflict) {
      throw new NotFoundException('Identifier conflict not found');
    }
    return conflict;
  }

  private validateManifestSubjects(
    conflict: AuthIdentifierDocument,
    manifest: AuthIdentifierRepairManifest,
  ): void {
    const claimantKeys = new Set(
      (conflict.conflictingSubjects ?? []).map((subject) =>
        this.subjectKey(subject),
      ),
    );
    const mapped = [
      ...(manifest.retainedSubject ? [manifest.retainedSubject] : []),
      ...manifest.reassignments,
    ];
    const mappedKeys = mapped.map((subject) => this.subjectKey(subject));
    if (
      new Set(mappedKeys).size !== claimantKeys.size ||
      mappedKeys.some((key) => !claimantKeys.has(key))
    ) {
      throw new UnprocessableEntityException(
        'Repair manifest must account for every conflict claimant',
      );
    }
  }

  private verifyPersistedManifest(
    operation: AuthIdentifierOperationDocument,
    manifest: AuthIdentifierRepairManifest,
  ): void {
    if (
      operation.operationType !== AuthIdentifierOperationType.OfflineRepair ||
      !operation.manifestHash ||
      !operation.manifestKeyVersion
    ) {
      throw new ConflictException('Repair operation is invalid');
    }
    const key = this.requireKey(operation.manifestKeyVersion);
    if (
      !verifyRepairManifest(
        manifest,
        operation.manifestHash,
        key,
        operation.manifestKeyVersion,
      )
    ) {
      throw new ConflictException('Repair manifest does not match dry run');
    }
  }

  private requireKey(version: number): string | Buffer {
    const decision = this.keyPolicy.repairWorkerDecision(version);
    const key = this.keyPolicy.getKeyMaterial(version);
    if (!decision.allowed || !key) {
      throw new ServiceUnavailableException('repair-key-required');
    }
    return key;
  }

  private async requireOperation(
    operationId: string,
  ): Promise<AuthIdentifierOperationDocument> {
    const operation = await this.operationModel.findOne({ operationId });
    if (!operation) throw new NotFoundException('Repair operation not found');
    return operation;
  }

  private async requireTransactionSession(): Promise<ClientSession> {
    const session = await this.operationModel.db.startSession();
    if (typeof session.withTransaction !== 'function') {
      await session.endSession();
      throw new ConflictException('Offline repair requires transaction support');
    }
    return session;
  }

  private async recordResume(
    operation: AuthIdentifierOperationDocument,
    actorId: string,
    resumeId: string,
  ): Promise<void> {
    await this.securityActivity.recordIdentifierRepairResumed({
      operationId: operation.operationId,
      resumeId,
      originalActor: {
        actorType: SecurityActivityActorType.Staff,
        actorId: operation.requestedBy.subjectId,
      },
      resumingActor: {
        actorType: SecurityActivityActorType.Staff,
        actorId,
      },
    });
  }

  private partition(
    manifest: AuthIdentifierRepairManifest,
  ): AuthIdentifierRepairManifest['reassignments'][] {
    const result: AuthIdentifierRepairManifest['reassignments'][] = [];
    for (
      let offset = 0;
      offset < manifest.reassignments.length;
      offset += this.maxAssignments
    ) {
      result.push(
        manifest.reassignments.slice(offset, offset + this.maxAssignments),
      );
    }
    return result;
  }

  private result(
    operation: Pick<
      AuthIdentifierOperationDocument,
      'operationId' | 'status' | 'result'
    >,
    assignmentCount: number,
    replayed: boolean,
  ): OfflineRepairResult {
    return {
      operationId: operation.operationId,
      status: operation.status,
      assignmentCount,
      batchCount: Math.ceil(assignmentCount / this.maxAssignments),
      replayed,
      reasonCategory:
        operation.result?.reasonCategory ?? 'identifier-offline-repair-pending',
    };
  }

  private subjectKey(subject: AuthIdentifierSubjectReference): string {
    return `${subject.subjectType}:${subject.subjectId}`;
  }

  private isTerminal(status: AuthIdentifierOperationStatus): boolean {
    return (
      status === AuthIdentifierOperationStatus.Completed ||
      status === AuthIdentifierOperationStatus.FailedTerminal
    );
  }

  private get currentKeyVersion(): number {
    const version = this.configService.get<number>(
      'auth.auditCorrelationKeyVersion',
    );
    if (!version) throw new ServiceUnavailableException('repair-key-required');
    return version;
  }

  private get maxAssignments(): number {
    return (
      this.configService.get<number>(
        'auth.identifierMaxOperationAssignments',
      ) ?? 20
    );
  }
}
