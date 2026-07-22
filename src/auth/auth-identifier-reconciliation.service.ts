import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { createHmac, randomUUID } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { AuthIdentifierRepairKeyPolicyService } from './auth-identifier-repair-key-policy.service';
import {
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
} from './schemas/auth-identifier-repair-batch.schema';
import {
  AuthIdentifierDocument,
  AuthIdentifierModelName,
  AuthIdentifierPendingAction,
  AuthIdentifierStatus,
} from './schemas/auth-identifier.schema';
import {
  SecurityActivityActorType,
  SecurityActivityOutcome,
} from './schemas/security-activity-event.schema';
import { SecurityActivityService } from './security-activity.service';

const SCHEDULE_NAME = 'auth-identifier-reconciliation';
const CLOCK_SKEW_SECONDS = 5;
const DEFAULT_LEASE_SECONDS = 300;
const DEFAULT_INTERVAL_SECONDS = 60;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_MAX_ASSIGNMENTS = 20;

const RECONCILABLE_STATUSES = [
  AuthIdentifierOperationStatus.Pending,
  AuthIdentifierOperationStatus.Applying,
  AuthIdentifierOperationStatus.Compensating,
  AuthIdentifierOperationStatus.Finalizing,
  AuthIdentifierOperationStatus.FailedRetryable,
] as const;

const TERMINAL_STATUSES = [
  AuthIdentifierOperationStatus.Completed,
  AuthIdentifierOperationStatus.FailedTerminal,
] as const;

export interface AuthIdentifierReconciliationResult {
  examined: number;
  claimed: number;
  processed: number;
  skippedMissingKey: number;
}

@Injectable()
export class AuthIdentifierReconciliationService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(
    AuthIdentifierReconciliationService.name,
  );
  private readonly instanceId = randomUUID();
  private activeRun?: Promise<AuthIdentifierReconciliationResult>;
  private scheduled = false;

  constructor(
    @InjectModel(AuthIdentifierOperationModelName)
    private readonly operationModel: Model<AuthIdentifierOperationDocument>,
    @InjectModel(AuthIdentifierModelName)
    private readonly identifierModel: Model<AuthIdentifierDocument>,
    @InjectModel(AuthIdentifierRepairBatchModelName)
    private readonly repairBatchModel: Model<AuthIdentifierRepairBatchDocument>,
    private readonly keyPolicy: AuthIdentifierRepairKeyPolicyService,
    private readonly securityActivityService: SecurityActivityService,
    private readonly configService: ConfigService,
    @Optional() private readonly schedulerRegistry?: SchedulerRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.registerSchedule();
    try {
      await this.reconcileOnce();
    } catch {
      this.logger.warn('Auth identifier reconciliation startup pass failed');
    }
  }

  onApplicationShutdown(): void {
    if (
      this.scheduled &&
      this.schedulerRegistry?.doesExist('interval', SCHEDULE_NAME)
    ) {
      this.schedulerRegistry.deleteInterval(SCHEDULE_NAME);
    }
    this.scheduled = false;
  }

  reconcileOnce(): Promise<AuthIdentifierReconciliationResult> {
    if (!this.activeRun) {
      this.activeRun = this.runBoundedPass().finally(() => {
        this.activeRun = undefined;
      });
    }
    return this.activeRun;
  }

  async renewLease(operationId: string): Promise<boolean> {
    const updated = await this.operationModel.findOneAndUpdate(
      {
        operationId,
        leaseOwner: this.instanceId,
        $expr: { $gt: ['$leaseExpiresAt', '$$NOW'] },
      },
      [
        {
          $set: {
            leaseExpiresAt: {
              $dateAdd: {
                startDate: '$$NOW',
                unit: 'second',
                amount: this.leaseSeconds,
              },
            },
            updatedAt: '$$NOW',
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    );
    return Boolean(updated);
  }

  private registerSchedule(): void {
    if (!this.schedulerRegistry || this.scheduled) {
      return;
    }

    const interval = setInterval(() => {
      void this.reconcileOnce().catch(() => {
        this.logger.warn(
          'Scheduled auth identifier reconciliation pass failed',
        );
      });
    }, this.intervalSeconds * 1000);
    interval.unref();
    this.schedulerRegistry.addInterval(SCHEDULE_NAME, interval);
    this.scheduled = true;
  }

  private async runBoundedPass(): Promise<AuthIdentifierReconciliationResult> {
    const candidates = await this.operationModel
      .find(
        this.candidateFilter(new Date(Date.now() - CLOCK_SKEW_SECONDS * 1000)),
      )
      .sort({ updatedAt: 1, _id: 1 })
      .limit(this.batchSize * 2)
      .lean()
      .exec();
    const result: AuthIdentifierReconciliationResult = {
      examined: candidates.length,
      claimed: 0,
      processed: 0,
      skippedMissingKey: 0,
    };

    for (const candidate of candidates) {
      if (result.claimed >= this.batchSize) {
        break;
      }

      if (!this.repairKeyAvailable(candidate)) {
        result.skippedMissingKey += 1;
        continue;
      }

      const operation = await this.claim(candidate._id);
      if (!operation) {
        continue;
      }

      result.claimed += 1;
      try {
        await this.process(operation);
        result.processed += 1;
      } finally {
        await this.releaseLease(operation.operationId);
      }
    }

    return result;
  }

  private candidateFilter(clientCutoff: Date): Record<string, unknown> {
    return {
      $and: [
        {
          $or: [
            { status: { $in: RECONCILABLE_STATUSES } },
            {
              status: { $in: TERMINAL_STATUSES },
              cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
            },
          ],
        },
        {
          $or: [
            { leaseExpiresAt: { $exists: false } },
            { leaseExpiresAt: { $lte: clientCutoff } },
          ],
        },
      ],
    };
  }

  private repairKeyAvailable(
    operation: Pick<
      AuthIdentifierOperationDocument,
      'operationType' | 'manifestKeyVersion'
    >,
  ): boolean {
    if (operation.operationType !== AuthIdentifierOperationType.OfflineRepair) {
      return true;
    }
    return this.keyPolicy.repairWorkerDecision(operation.manifestKeyVersion)
      .allowed;
  }

  private async claim(
    operationId: Types.ObjectId,
  ): Promise<AuthIdentifierOperationDocument | null> {
    return this.operationModel.findOneAndUpdate(
      {
        _id: operationId,
        $and: [
          {
            $or: [
              { status: { $in: RECONCILABLE_STATUSES } },
              {
                status: { $in: TERMINAL_STATUSES },
                cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
              },
            ],
          },
          {
            $or: [
              { leaseExpiresAt: { $exists: false } },
              {
                $expr: {
                  $lte: [
                    '$leaseExpiresAt',
                    {
                      $dateSubtract: {
                        startDate: '$$NOW',
                        unit: 'second',
                        amount: CLOCK_SKEW_SECONDS,
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      [
        {
          $set: {
            leaseOwner: this.instanceId,
            leaseExpiresAt: {
              $dateAdd: {
                startDate: '$$NOW',
                unit: 'second',
                amount: this.leaseSeconds,
              },
            },
            updatedAt: '$$NOW',
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    );
  }

  private async process(
    operation: AuthIdentifierOperationDocument,
  ): Promise<void> {
    if (
      TERMINAL_STATUSES.includes(
        operation.status as (typeof TERMINAL_STATUSES)[number],
      )
    ) {
      if (
        operation.cleanupStatus === AuthIdentifierOperationCleanupStatus.Pending
      ) {
        await this.cleanup(operation);
      }
      return;
    }

    await this.attachMissingReservationReferences(operation);

    switch (operation.status) {
      case AuthIdentifierOperationStatus.Pending:
        await this.transition(
          operation.operationId,
          AuthIdentifierOperationStatus.Pending,
          AuthIdentifierOperationStatus.Applying,
        );
        break;
      case AuthIdentifierOperationStatus.FailedRetryable:
        await this.transition(
          operation.operationId,
          AuthIdentifierOperationStatus.FailedRetryable,
          operation.assignments.some((item) => item.status === 'compensated')
            ? AuthIdentifierOperationStatus.Compensating
            : AuthIdentifierOperationStatus.Applying,
        );
        break;
      case AuthIdentifierOperationStatus.Applying:
        await this.recoverApplying(operation);
        break;
      case AuthIdentifierOperationStatus.Compensating:
        await this.recoverCompensating(operation);
        break;
      case AuthIdentifierOperationStatus.Finalizing:
        await this.finalize(operation);
        break;
    }
  }

  private async attachMissingReservationReferences(
    operation: AuthIdentifierOperationDocument,
  ): Promise<void> {
    const reservations = await this.identifierModel
      .find({ pendingOperationId: operation.operationId })
      .limit(this.maxAssignments + 1)
      .lean()
      .exec();
    if (reservations.length > this.maxAssignments) {
      await this.transition(
        operation.operationId,
        operation.status,
        AuthIdentifierOperationStatus.FailedRetryable,
      );
      return;
    }

    for (const reservation of reservations) {
      const assignment = operation.assignments.find(
        (item) =>
          !item.targetReservationId &&
          item.subjectType === reservation.subjectType &&
          item.subjectId === reservation.subjectId &&
          String(item.action) === String(reservation.pendingAction),
      );
      if (!assignment) {
        continue;
      }

      const correlation = this.correlationFor(
        reservation.normalizedIdentifier,
        operation.manifestKeyVersion,
      );
      await this.operationModel.updateOne(
        {
          operationId: operation.operationId,
          'assignments.assignmentId': assignment.assignmentId,
          'assignments.targetReservationId': { $exists: false },
          leaseOwner: this.instanceId,
        },
        {
          $set: {
            'assignments.$.targetReservationId': reservation._id,
            ...(assignment.identifierCorrelationHash || !correlation
              ? {}
              : {
                  'assignments.$.identifierCorrelationHash': correlation.hash,
                  'assignments.$.correlationKeyVersion': correlation.version,
                }),
          },
        },
      );
      assignment.targetReservationId = reservation._id;
    }
  }

  private async recoverApplying(
    operation: AuthIdentifierOperationDocument,
  ): Promise<void> {
    let retryRequired = false;
    for (const assignment of operation.assignments) {
      if (assignment.status === 'applied') {
        continue;
      }
      const reservation = await this.findReservation(operation, assignment);
      const expectedStatus =
        assignment.action === 'release'
          ? AuthIdentifierStatus.Released
          : AuthIdentifierStatus.Active;
      if (
        reservation?.status === expectedStatus &&
        reservation.lastOperationId === operation.operationId
      ) {
        await this.operationModel.updateOne(
          {
            operationId: operation.operationId,
            'assignments.assignmentId': assignment.assignmentId,
            leaseOwner: this.instanceId,
          },
          {
            $set: {
              'assignments.$.status': 'applied',
              'assignments.$.appliedAt': reservation.updatedAt,
            },
          },
        );
        assignment.status = AuthIdentifierAssignmentStatus.Applied;
      } else {
        retryRequired = true;
      }
    }

    await this.transition(
      operation.operationId,
      AuthIdentifierOperationStatus.Applying,
      retryRequired
        ? AuthIdentifierOperationStatus.FailedRetryable
        : AuthIdentifierOperationStatus.Finalizing,
    );
  }

  private async recoverCompensating(
    operation: AuthIdentifierOperationDocument,
  ): Promise<void> {
    let retryRequired = false;
    for (const assignment of [...operation.assignments].reverse()) {
      if (assignment.status === 'compensated') {
        continue;
      }
      if (assignment.status === 'applied') {
        retryRequired = true;
        continue;
      }

      const reservation = await this.findReservation(operation, assignment);
      if (
        !reservation ||
        reservation.pendingOperationId !== operation.operationId
      ) {
        retryRequired = true;
        continue;
      }

      const restoredStatus =
        assignment.action === 'retain'
          ? AuthIdentifierStatus.Conflict
          : assignment.action === 'release'
            ? AuthIdentifierStatus.Active
            : AuthIdentifierStatus.Released;
      await this.identifierModel.updateOne(
        { _id: reservation._id, pendingOperationId: operation.operationId },
        {
          $set: {
            status: restoredStatus,
            lastOperationId: operation.operationId,
          },
          $unset: { pendingOperationId: '', pendingAction: '' },
        },
      );
      await this.operationModel.updateOne(
        {
          operationId: operation.operationId,
          'assignments.assignmentId': assignment.assignmentId,
          leaseOwner: this.instanceId,
        },
        { $set: { 'assignments.$.status': 'compensated' } },
      );
      assignment.status = AuthIdentifierAssignmentStatus.Compensated;
    }

    await this.transition(
      operation.operationId,
      AuthIdentifierOperationStatus.Compensating,
      retryRequired
        ? AuthIdentifierOperationStatus.FailedRetryable
        : AuthIdentifierOperationStatus.Finalizing,
    );
  }

  private async finalize(
    operation: AuthIdentifierOperationDocument,
  ): Promise<void> {
    const failed =
      operation.result?.outcome ===
        AuthIdentifierOperationResultOutcome.Failure ||
      operation.assignments.every((item) => item.status === 'compensated');
    const terminalStatus = failed
      ? AuthIdentifierOperationStatus.FailedTerminal
      : AuthIdentifierOperationStatus.Completed;
    const reasonCategory =
      operation.result?.reasonCategory ??
      (failed
        ? 'identifier-operation-compensated'
        : 'identifier-operation-recovered');
    const eventId =
      await this.securityActivityService.recordIdentifierOperationTerminal({
        operationId: operation.operationId,
        operationType: operation.operationType,
        terminalStatus,
        actor: {
          actorType:
            operation.requestedBy.subjectType === 'member'
              ? SecurityActivityActorType.Member
              : SecurityActivityActorType.Staff,
          actorId: operation.requestedBy.subjectId,
        },
        outcome: failed
          ? SecurityActivityOutcome.Failure
          : SecurityActivityOutcome.Success,
        reasonCategory,
      });

    const cleanupRequired =
      operation.cleanupStatus === AuthIdentifierOperationCleanupStatus.Pending;
    await this.operationModel.findOneAndUpdate(
      {
        operationId: operation.operationId,
        status: AuthIdentifierOperationStatus.Finalizing,
        leaseOwner: this.instanceId,
      },
      [
        {
          $set: {
            status: terminalStatus,
            terminalEventId: eventId,
            terminalEventRecordedAt: '$$NOW',
            completedAt: '$$NOW',
            updatedAt: '$$NOW',
            ...(cleanupRequired
              ? {}
              : {
                  expiresAt: {
                    $dateAdd: {
                      startDate: '$$NOW',
                      unit: 'day',
                      amount: this.retentionDays,
                    },
                  },
                }),
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    );
  }

  private async cleanup(
    operation: AuthIdentifierOperationDocument,
  ): Promise<void> {
    let remainingCapacity = this.maxAssignments;
    const gated = await this.identifierModel
      .find({ activationGateOperationId: operation.operationId })
      .select({ _id: 1 })
      .limit(remainingCapacity)
      .lean()
      .exec();
    if (gated.length) {
      await this.identifierModel.updateMany(
        { _id: { $in: gated.map((item) => item._id) } },
        {
          ...(operation.status === AuthIdentifierOperationStatus.FailedTerminal
            ? { $set: { status: AuthIdentifierStatus.Released } }
            : {}),
          $unset: { activationGateOperationId: '' },
        },
      );
      remainingCapacity -= gated.length;
    }

    if (remainingCapacity > 0) {
      const batches = await this.repairBatchModel
        .find({
          parentOperationId: operation.operationId,
          expiresAt: { $exists: false },
        })
        .select({ _id: 1 })
        .limit(remainingCapacity)
        .lean()
        .exec();
      if (batches.length) {
        await this.repairBatchModel.updateMany(
          { _id: { $in: batches.map((item) => item._id) } },
          [{ $set: { expiresAt: '$$NOW' } }],
          { updatePipeline: true },
        );
      }
    }

    await this.renewLease(operation.operationId);
    const [gateRemaining, batchRemaining] = await Promise.all([
      this.identifierModel.exists({
        activationGateOperationId: operation.operationId,
      }),
      this.repairBatchModel.exists({
        parentOperationId: operation.operationId,
        expiresAt: { $exists: false },
      }),
    ]);
    if (gateRemaining || batchRemaining) {
      return;
    }

    await this.operationModel.findOneAndUpdate(
      {
        operationId: operation.operationId,
        status: { $in: TERMINAL_STATUSES },
        cleanupStatus: AuthIdentifierOperationCleanupStatus.Pending,
        terminalEventId: { $exists: true },
        terminalEventRecordedAt: { $exists: true },
        leaseOwner: this.instanceId,
      },
      [
        {
          $set: {
            cleanupStatus: AuthIdentifierOperationCleanupStatus.Completed,
            expiresAt: {
              $dateAdd: {
                startDate: '$$NOW',
                unit: 'day',
                amount: this.retentionDays,
              },
            },
            updatedAt: '$$NOW',
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    );
  }

  private async findReservation(
    operation: AuthIdentifierOperationDocument,
    assignment: AuthIdentifierOperationAssignment,
  ): Promise<AuthIdentifierDocument | null> {
    if (assignment.targetReservationId) {
      return this.identifierModel.findById(assignment.targetReservationId);
    }
    return this.identifierModel.findOne({
      pendingOperationId: operation.operationId,
      subjectType: assignment.subjectType,
      subjectId: assignment.subjectId,
      pendingAction: String(assignment.action) as AuthIdentifierPendingAction,
    });
  }

  private async transition(
    operationId: string,
    from: AuthIdentifierOperationStatus,
    to: AuthIdentifierOperationStatus,
  ): Promise<void> {
    if (from === to) {
      return;
    }
    await this.operationModel.updateOne(
      { operationId, status: from, leaseOwner: this.instanceId },
      { $set: { status: to } },
    );
  }

  private async releaseLease(operationId: string): Promise<void> {
    await this.operationModel.updateOne(
      { operationId, leaseOwner: this.instanceId },
      [
        {
          $set: { leaseExpiresAt: '$$NOW', updatedAt: '$$NOW' },
        },
      ],
      { updatePipeline: true },
    );
  }

  private correlationFor(
    normalizedIdentifier: string,
    requestedVersion?: number,
  ): { hash: string; version: number } | undefined {
    const version =
      requestedVersion ??
      this.configService.get<number>(
        'auth.auditCorrelationKeyRing.currentVersion',
      ) ??
      this.configService.get<number>('auth.auditCorrelationKeyVersion');
    if (!version) {
      return undefined;
    }
    const material = this.keyPolicy.getKeyMaterial(version);
    if (!material) {
      return undefined;
    }
    const key = Buffer.isBuffer(material)
      ? material
      : this.decodeConfiguredSecret(material);
    return {
      hash: createHmac('sha256', key)
        .update('book-library/auth-identifier-reconciliation/v1\0')
        .update(normalizedIdentifier)
        .digest('base64url'),
      version,
    };
  }

  private decodeConfiguredSecret(value: string): Buffer {
    const decoded = Buffer.from(value, 'base64url');
    return decoded.toString('base64url') === value
      ? decoded
      : Buffer.from(value, 'utf8');
  }

  private get leaseSeconds(): number {
    return (
      this.configService.get<number>('auth.identifierLeaseSeconds') ??
      DEFAULT_LEASE_SECONDS
    );
  }

  private get intervalSeconds(): number {
    return (
      this.configService.get<number>(
        'auth.identifierReconciliationIntervalSeconds',
      ) ?? DEFAULT_INTERVAL_SECONDS
    );
  }

  private get batchSize(): number {
    return (
      this.configService.get<number>(
        'auth.identifierReconciliationBatchSize',
      ) ?? DEFAULT_BATCH_SIZE
    );
  }

  private get retentionDays(): number {
    return (
      this.configService.get<number>('auth.identifierOperationRetentionDays') ??
      DEFAULT_RETENTION_DAYS
    );
  }

  private get maxAssignments(): number {
    return (
      this.configService.get<number>(
        'auth.identifierMaxOperationAssignments',
      ) ?? DEFAULT_MAX_ASSIGNMENTS
    );
  }
}
