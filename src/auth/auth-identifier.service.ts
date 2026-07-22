import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  SecurityActivityActorType,
  SecurityActivityOutcome,
} from './schemas/security-activity-event.schema';
import {
  AuthIdentifierModelName,
  AuthIdentifierPendingAction,
} from './schemas/auth-identifier.schema';
import { AuthIdentifierOperationModelName } from './schemas/auth-identifier-operation.schema';
import { SecurityActivityService } from './security-activity.service';
import {
  AuthIdentifierConflictResolutionStatus,
  AuthIdentifierDocument,
  AuthIdentifierStatus,
  AuthIdentifierSubjectType as PersistedSubjectType,
} from './schemas/auth-identifier.schema';
import { AuthIdentifierOperationStatus as PersistedOperationStatus } from './schemas/auth-identifier-operation.schema';
import {
  StaffUserDocument,
  StaffUserModelName,
} from '../staff-users/schemas/staff-user.schema';
import {
  MemberDocument,
  MemberModelName,
} from '../members/schemas/member.schema';
import {
  AuthIdentifierConflictQueryDto,
  AuthIdentifierConflictViewDto,
  AuthIdentifierOperationStatusDto,
  ResolveAuthIdentifierConflictDto,
} from './dto/auth-identifier.dto';

export type AuthIdentifierSubjectType = 'staff' | 'member';
export type AuthIdentifierAction = 'retain' | 'claim' | 'replace' | 'release';
export type AuthIdentifierOperationType =
  | 'claim'
  | 'replace'
  | 'release'
  | 'resolve-conflict'
  | 'offline-repair';
export type AuthIdentifierOperationStatus =
  | 'pending'
  | 'applying'
  | 'compensating'
  | 'finalizing'
  | 'failed-retryable'
  | 'completed'
  | 'failed-terminal';

export interface AuthIdentifierActorReference {
  subjectType: AuthIdentifierSubjectType;
  subjectId: string;
}

export interface AuthIdentifierAssignmentInput {
  assignmentId: string;
  subjectType: AuthIdentifierSubjectType;
  subjectId: string;
  action: AuthIdentifierAction;
  normalizedIdentifier?: string;
  identifierType?: 'email' | 'member-number' | 'login-identifier';
  sourceReservationId?: string;
  identifierCorrelationHash?: string;
  correlationKeyVersion?: number;
}

interface PersistedAssignment extends AuthIdentifierAssignmentInput {
  status: 'pending' | 'applied' | 'compensated';
  targetReservationId?: string;
  appliedAt?: Date;
}

interface IdentifierOperationDocument {
  operationId: string;
  operationType: AuthIdentifierOperationType;
  status: AuthIdentifierOperationStatus;
  assignments: PersistedAssignment[];
  result?: AuthIdentifierOperationResult['result'];
  requestedBy?: AuthIdentifierActorReference;
  retainedSubject?: AuthIdentifierActorReference;
  completedAt?: Date;
  cleanupStatus?: 'not-required' | 'pending' | 'completed';
  terminalEventId?: string;
  terminalEventRecordedAt?: Date;
}

interface IdentifierReservationDocument {
  _id: unknown;
  normalizedIdentifier: string;
  subjectType: AuthIdentifierSubjectType;
  subjectId: string;
  status: 'pending' | 'active' | 'released' | 'conflict';
  pendingOperationId?: string;
  activationGateOperationId?: string;
  conflictingSubjects?: AuthIdentifierActorReference[];
  conflictResolutionStatus?: AuthIdentifierConflictResolutionStatus;
  identifierType?: 'email' | 'member-number' | 'login-identifier';
}

interface QueryLike<T> {
  lean?: () => QueryLike<T>;
  exec?: () => Promise<T>;
  then?: Promise<T>['then'];
}

interface PersistenceModel<T> {
  db?: {
    startSession?: () => Promise<ClientSession>;
  };
  create: (
    documents: Partial<T> | Partial<T>[],
    options?: { session?: ClientSession },
  ) => Promise<T | T[]>;
  findOne: (
    filter: Record<string, unknown>,
    projection?: Record<string, unknown>,
    options?: { session?: ClientSession },
  ) => QueryLike<T | null> | Promise<T | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => QueryLike<T | null> | Promise<T | null>;
  updateOne: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => QueryLike<unknown> | Promise<unknown>;
}

export interface AuthIdentifierAggregateAdapter {
  apply(
    assignment: AuthIdentifierAssignmentInput,
    options: { session?: ClientSession },
  ): Promise<void>;
  compensate(
    assignment: AuthIdentifierAssignmentInput,
    options: { session?: ClientSession },
  ): Promise<void>;
  isApplied?(
    assignment: AuthIdentifierAssignmentInput,
    options: { session?: ClientSession },
  ): Promise<boolean>;
}

export interface AuthIdentifierOperationInput {
  operationId: string;
  operationType: AuthIdentifierOperationType;
  assignments: AuthIdentifierAssignmentInput[];
  requestedBy: AuthIdentifierActorReference;
  successHttpStatus?: number;
  successReasonCategory?: string;
  failureHttpStatus?: number;
  failureReasonCategory?: string;
  compensateOnFailure?: boolean;
  cleanupStatus?: 'not-required' | 'pending';
  resumeId?: string;
  retainedSubject?: AuthIdentifierActorReference;
}

export interface AuthIdentifierOperationResult {
  operationId: string;
  status: 'completed' | 'failed-terminal';
  httpStatus: number;
  replayed: boolean;
  result: {
    outcome: 'success' | 'failure';
    reasonCategory: string;
    httpStatus: number;
  };
}

export interface AuthIdentifierServiceOptions {
  maxAssignments?: number;
  operationRetentionDays?: number;
  transactionStrategy?: 'auto' | 'required' | 'disabled';
}

const terminalStatuses = new Set<AuthIdentifierOperationStatus>([
  'completed',
  'failed-terminal',
]);

const allowedTransitions: Record<
  AuthIdentifierOperationStatus,
  ReadonlySet<AuthIdentifierOperationStatus>
> = {
  pending: new Set(['applying', 'compensating', 'failed-retryable']),
  applying: new Set(['compensating', 'finalizing', 'failed-retryable']),
  compensating: new Set(['finalizing', 'failed-retryable']),
  finalizing: new Set(['completed', 'failed-terminal']),
  'failed-retryable': new Set(['applying', 'compensating']),
  completed: new Set(),
  'failed-terminal': new Set(),
};

@Injectable()
export class AuthIdentifierService {
  private readonly maxAssignments: number;
  private readonly operationRetentionMs: number;
  private readonly transactionStrategy: 'auto' | 'required' | 'disabled';

  constructor(
    @InjectModel(AuthIdentifierModelName)
    private readonly identifierModel: PersistenceModel<IdentifierReservationDocument>,
    @InjectModel(AuthIdentifierOperationModelName)
    private readonly operationModel: PersistenceModel<IdentifierOperationDocument>,
    private readonly securityActivityService: SecurityActivityService,
    @Optional() options: AuthIdentifierServiceOptions = {},
    @Optional()
    @InjectModel(StaffUserModelName)
    private readonly staffUserModel?: Model<StaffUserDocument>,
    @Optional()
    @InjectModel(MemberModelName)
    private readonly memberModel?: Model<MemberDocument>,
  ) {
    this.maxAssignments = options.maxAssignments ?? 20;
    this.operationRetentionMs =
      (options.operationRetentionDays ?? 90) * 24 * 60 * 60 * 1000;
    this.transactionStrategy = options.transactionStrategy ?? 'auto';
  }

  async execute(
    input: AuthIdentifierOperationInput,
    aggregate: AuthIdentifierAggregateAdapter,
  ): Promise<AuthIdentifierOperationResult> {
    this.validateInput(input);

    const existing = await this.findOperation(input.operationId);
    if (existing) {
      return this.resumeOrReplay(existing, input, aggregate);
    }

    if (this.transactionStrategy !== 'disabled') {
      try {
        return await this.executeInTransaction(input, aggregate);
      } catch (error) {
        if (
          this.transactionStrategy === 'required' ||
          !this.isTransactionUnavailable(error)
        ) {
          throw error;
        }
      }
    }

    return this.executeSaga(input, aggregate);
  }

  async reconcile(
    input: AuthIdentifierOperationInput,
    aggregate: AuthIdentifierAggregateAdapter,
  ): Promise<AuthIdentifierOperationResult> {
    this.validateInput(input);
    const operation = await this.findOperation(input.operationId);
    if (!operation) {
      throw new ConflictException('Identifier operation is not retained');
    }
    return this.resumeOrReplay(operation, input, aggregate);
  }

  async resolveActiveIdentifier(normalizedIdentifier: string): Promise<{
    subjectType: AuthIdentifierSubjectType;
    subjectId: string;
  } | null> {
    const reservation = await this.resolveQuery(
      this.identifierModel.findOne({ normalizedIdentifier }),
    );
    if (!reservation || reservation.status !== 'active') {
      return null;
    }

    if (reservation.activationGateOperationId) {
      const gate = await this.findOperation(
        reservation.activationGateOperationId,
      );
      if (!gate || gate.status !== 'completed') {
        return null;
      }
    }

    return {
      subjectType: reservation.subjectType,
      subjectId: reservation.subjectId,
    };
  }

  async listConflicts(
    query: AuthIdentifierConflictQueryDto,
  ): Promise<AuthIdentifierConflictViewDto[]> {
    const model = this.identifierModel as unknown as Model<AuthIdentifierDocument>;
    const conflicts = await model
      .find({ status: AuthIdentifierStatus.Conflict })
      .sort({ updatedAt: -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec();

    return Promise.all(
      conflicts.map(async (conflict) => ({
        id: String(conflict._id),
        normalizedIdentifier: conflict.normalizedIdentifier,
        resolutionStatus:
          conflict.conflictResolutionStatus ??
          AuthIdentifierConflictResolutionStatus.ManualRepairRequired,
        subjects: await Promise.all(
          (conflict.conflictingSubjects ?? []).map(async (subject) => ({
            ...subject,
            displayLabel: await this.safeDisplayLabel(subject),
          })),
        ),
      })),
    );
  }

  async resolveConflict(
    conflictId: string,
    dto: ResolveAuthIdentifierConflictDto,
    actor: AuthIdentifierActorReference,
  ): Promise<AuthIdentifierOperationResult> {
    const model = this.identifierModel as unknown as Model<AuthIdentifierDocument>;
    const conflict = await model.findById(conflictId).lean().exec();
    if (!conflict || conflict.status !== AuthIdentifierStatus.Conflict) {
      throw new NotFoundException('Identifier conflict not found');
    }
    if (
      conflict.conflictResolutionStatus !==
      AuthIdentifierConflictResolutionStatus.Reviewable
    ) {
      throw new UnprocessableEntityException(
        'Identifier conflict requires offline repair',
      );
    }

    const subjects = conflict.conflictingSubjects ?? [];
    this.validateConflictMapping(subjects, conflict.normalizedIdentifier, dto);
    const retained = dto.retainedSubject;
    const assignments: AuthIdentifierAssignmentInput[] = [
      ...(retained
        ? [
            {
              assignmentId: `${dto.operationId}:retain`,
              subjectType: retained.subjectType,
              subjectId: retained.subjectId,
              action: 'retain' as const,
              sourceReservationId: conflictId,
            },
          ]
        : []),
      ...dto.reassignments.map((item) => ({
        assignmentId: `${dto.operationId}:${item.subjectType}:${item.subjectId}`,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        action: 'replace' as const,
        normalizedIdentifier: this.normalizeIdentifier(item.newIdentifier),
        identifierType:
          item.subjectType === 'staff'
            ? ('email' as const)
            : ('login-identifier' as const),
        sourceReservationId: conflictId,
      })),
    ];
    const finalAssignmentId = retained
      ? undefined
      : assignments[assignments.length - 1]?.assignmentId;

    return this.execute(
      {
        operationId: dto.operationId,
        operationType: 'resolve-conflict',
        assignments,
        requestedBy: actor,
        retainedSubject: retained,
        successHttpStatus: 200,
        successReasonCategory: 'identifier-conflict-resolved',
        failureHttpStatus: 409,
        failureReasonCategory: 'identifier-conflict-resolution-failed',
        compensateOnFailure: true,
      },
      this.conflictAggregateAdapter(
        conflictId,
        conflict.normalizedIdentifier,
        finalAssignmentId,
      ),
    );
  }

  async getOperationStatus(
    operationId: string,
  ): Promise<AuthIdentifierOperationStatusDto> {
    const operation = (await this.findOperation(
      operationId,
    )) as IdentifierOperationDocument | null;
    if (!operation) throw new NotFoundException('Identifier operation not found');

    const subjects = Array.from(
      new Map(
        operation.assignments.map((assignment) => [
          `${assignment.subjectType}:${assignment.subjectId}`,
          {
            subjectType: assignment.subjectType as PersistedSubjectType,
            subjectId: assignment.subjectId,
          },
        ]),
      ).values(),
    );
    return {
      operationId: operation.operationId,
      status: operation.status as PersistedOperationStatus,
      subjects,
      currentStep: operation.status,
      completedAt: operation.completedAt,
      outcome: operation.result?.outcome,
      reasonCategory: operation.result?.reasonCategory,
      httpStatus: operation.result?.httpStatus,
    };
  }

  validateTransition(
    from: AuthIdentifierOperationStatus,
    to: AuthIdentifierOperationStatus,
  ): void {
    if (!allowedTransitions[from]?.has(to)) {
      throw new ConflictException(
        `Invalid identifier operation transition: ${from} -> ${to}`,
      );
    }
  }

  private async executeInTransaction(
    input: AuthIdentifierOperationInput,
    aggregate: AuthIdentifierAggregateAdapter,
  ): Promise<AuthIdentifierOperationResult> {
    const startSession = this.operationModel.db?.startSession;
    if (!startSession) {
      throw new Error('Transactions are unavailable');
    }

    const session = await startSession.call(this.operationModel.db);
    let result: AuthIdentifierOperationResult | undefined;
    try {
      if (typeof session.withTransaction !== 'function') {
        throw new Error('Transactions are unavailable');
      }
      await session.withTransaction(async () => {
        await this.createOperation(input, session);
        await this.transition(
          input.operationId,
          'pending',
          'applying',
          session,
        );
        await this.applyAssignments(input, aggregate, session);
        await this.beginFinalizing(input, 'applying', 'completed', session);
        result = await this.finishTerminal(input, 'completed', session);
      });
    } finally {
      await session.endSession();
    }

    if (!result) {
      throw new Error('Identifier transaction did not produce a result');
    }
    return result;
  }

  private async executeSaga(
    input: AuthIdentifierOperationInput,
    aggregate: AuthIdentifierAggregateAdapter,
  ): Promise<AuthIdentifierOperationResult> {
    let operation = await this.findOperation(input.operationId);
    if (!operation) {
      try {
        operation = await this.createOperation(input);
      } catch (error) {
        if (!this.isDuplicateKey(error)) {
          throw error;
        }
        operation = await this.findOperation(input.operationId);
        if (!operation) {
          throw error;
        }
      }
    }

    if (terminalStatuses.has(operation.status)) {
      return this.replay(operation);
    }

    if (operation.status === 'finalizing') {
      const terminalStatus =
        operation.result?.outcome === 'failure'
          ? 'failed-terminal'
          : 'completed';
      return this.finishTerminal(input, terminalStatus);
    }

    if (operation.status === 'compensating') {
      await this.compensateAssignments(input, operation, aggregate);
      await this.beginFinalizing(input, 'compensating', 'failed-terminal');
      return this.finishTerminal(input, 'failed-terminal');
    }

    const startingStatus = operation.status;
    if (startingStatus !== 'applying') {
      this.validateTransition(startingStatus, 'applying');
      await this.transition(input.operationId, startingStatus, 'applying');
    }

    try {
      await this.applyAssignments(input, aggregate);
      await this.beginFinalizing(input, 'applying', 'completed');
      return this.finishTerminal(input, 'completed');
    } catch (error) {
      if (!input.compensateOnFailure) {
        await this.transition(
          input.operationId,
          'applying',
          'failed-retryable',
        );
        throw error;
      }

      try {
        await this.synchronizeAppliedAssignments(input, aggregate);
      } catch (synchronizationError) {
        await this.transition(
          input.operationId,
          'applying',
          'failed-retryable',
        );
        throw synchronizationError;
      }
      await this.transition(input.operationId, 'applying', 'compensating');
      const latest = await this.findOperation(input.operationId);
      if (!latest) {
        throw error;
      }
      await this.compensateAssignments(input, latest, aggregate);
      await this.beginFinalizing(input, 'compensating', 'failed-terminal');
      return this.finishTerminal(input, 'failed-terminal');
    }
  }

  private async resumeOrReplay(
    operation: IdentifierOperationDocument,
    input: AuthIdentifierOperationInput,
    aggregate: AuthIdentifierAggregateAdapter,
  ): Promise<AuthIdentifierOperationResult> {
    if (operation.operationType !== input.operationType) {
      throw new ConflictException('Operation id is already in use');
    }
    this.assertOperationManifest(operation, input);
    if (terminalStatuses.has(operation.status)) {
      return this.replay(operation);
    }

    if (operation.operationType === 'offline-repair') {
      if (!input.resumeId) {
        throw new UnprocessableEntityException(
          'A stable resume id is required for offline repair reconciliation',
        );
      }
      await this.securityActivityService.recordIdentifierRepairResumed({
        operationId: input.operationId,
        resumeId: input.resumeId,
        originalActor: this.toSecurityActor(operation.requestedBy),
        resumingActor: this.toSecurityActor(input.requestedBy)!,
      });
      await this.executeQuery(
        this.operationModel.updateOne(
          { operationId: input.operationId },
          {
            $set: {
              lastResumedBy: input.requestedBy,
              lastResumedAt: new Date(),
            },
          },
        ),
      );
    }

    return this.executeSaga(input, aggregate);
  }

  private async createOperation(
    input: AuthIdentifierOperationInput,
    session?: ClientSession,
  ): Promise<IdentifierOperationDocument> {
    const persistedAssignments: PersistedAssignment[] = input.assignments.map(
      (assignment) => ({
        assignmentId: assignment.assignmentId,
        subjectType: assignment.subjectType,
        subjectId: assignment.subjectId,
        action: assignment.action,
        sourceReservationId: assignment.sourceReservationId,
        identifierCorrelationHash: assignment.identifierCorrelationHash,
        correlationKeyVersion: assignment.correlationKeyVersion,
        status: 'pending',
      }),
    );
    const created = await this.operationModel.create(
      [
        {
          operationId: input.operationId,
          operationType: input.operationType,
          status: 'pending',
          assignments: persistedAssignments,
          requestedBy: input.requestedBy,
          retainedSubject: input.retainedSubject,
          cleanupStatus: input.cleanupStatus ?? 'not-required',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Partial<IdentifierOperationDocument>,
      ],
      session ? { session } : undefined,
    );
    return (
      Array.isArray(created) ? created[0] : created
    ) as IdentifierOperationDocument;
  }

  private async applyAssignments(
    input: AuthIdentifierOperationInput,
    aggregate: AuthIdentifierAggregateAdapter,
    session?: ClientSession,
  ): Promise<void> {
    for (const assignment of input.assignments) {
      const operation = await this.findOperation(input.operationId, session);
      const persisted = operation?.assignments.find(
        (item) => item.assignmentId === assignment.assignmentId,
      );
      let reservation = await this.findRecoverableReservation(
        input.operationId,
        assignment,
        persisted,
        session,
      );
      reservation ??= await this.reserveAssignment(
        input.operationId,
        assignment,
        input.requestedBy.subjectId,
        session,
      );
      await this.attachReservationReference(
        input.operationId,
        assignment.assignmentId,
        reservation,
        session,
      );
      if (persisted?.status !== 'applied') {
        const alreadyApplied = aggregate.isApplied
          ? await aggregate.isApplied(assignment, { session })
          : false;
        if (!alreadyApplied) {
          await aggregate.apply(assignment, { session });
        }
        await this.markAssignmentApplied(
          input.operationId,
          assignment.assignmentId,
          session,
        );
      }
      await this.finalizeReservation(
        input.operationId,
        assignment,
        reservation,
        input.requestedBy.subjectId,
        session,
      );
    }
  }

  private async findRecoverableReservation(
    operationId: string,
    assignment: AuthIdentifierAssignmentInput,
    persisted?: PersistedAssignment,
    session?: ClientSession,
  ): Promise<IdentifierReservationDocument | null> {
    if (persisted?.targetReservationId) {
      const referenced = await this.resolveQuery(
        this.identifierModel.findOne(
          { _id: persisted.targetReservationId },
          undefined,
          session ? { session } : undefined,
        ),
      );
      if (referenced) {
        return referenced;
      }
    }

    return this.resolveQuery(
      this.identifierModel.findOne(
        {
          pendingOperationId: operationId,
          subjectType: assignment.subjectType,
          subjectId: assignment.subjectId,
          pendingAction:
            assignment.action === 'retain'
              ? AuthIdentifierPendingAction.ResolveConflict
              : assignment.action,
        },
        undefined,
        session ? { session } : undefined,
      ),
    );
  }

  private async markAssignmentApplied(
    operationId: string,
    assignmentId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.executeQuery(
      this.operationModel.updateOne(
        { operationId, 'assignments.assignmentId': assignmentId },
        {
          $set: {
            'assignments.$.status': 'applied',
            'assignments.$.appliedAt': new Date(),
            updatedAt: new Date(),
          },
        },
        session ? { session } : undefined,
      ),
    );
  }

  private async reserveAssignment(
    operationId: string,
    assignment: AuthIdentifierAssignmentInput,
    actorId: string,
    session?: ClientSession,
  ): Promise<IdentifierReservationDocument> {
    const options: Record<string, unknown> = {
      returnDocument: 'after',
      session,
    };
    let filter: Record<string, unknown>;
    let update: Record<string, unknown>;

    if (assignment.action === 'release' || assignment.action === 'retain') {
      if (!assignment.sourceReservationId) {
        throw new UnprocessableEntityException(
          'Source reservation is required for this assignment',
        );
      }
      filter = {
        _id: assignment.sourceReservationId,
        $or: [
          { pendingOperationId: operationId },
          {
            status: {
              $in:
                assignment.action === 'retain'
                  ? ['conflict']
                  : ['active', 'conflict'],
            },
          },
        ],
      };
      update = {
        $set: {
          status: 'pending',
          pendingAction:
            assignment.action === 'retain'
              ? AuthIdentifierPendingAction.ResolveConflict
              : AuthIdentifierPendingAction.Release,
          pendingOperationId: operationId,
          subjectType: assignment.subjectType,
          subjectId: assignment.subjectId,
          updatedBy: actorId,
          updatedAt: new Date(),
        },
      };
    } else {
      if (!assignment.normalizedIdentifier || !assignment.identifierType) {
        throw new UnprocessableEntityException(
          'A normalized identifier and type are required',
        );
      }
      filter = {
        normalizedIdentifier: assignment.normalizedIdentifier,
        $or: [
          { pendingOperationId: operationId },
          { status: 'released' },
          {
            status: 'active',
            subjectType: assignment.subjectType,
            subjectId: assignment.subjectId,
          },
        ],
      };
      update = {
        $set: {
          normalizedIdentifier: assignment.normalizedIdentifier,
          identifierType: assignment.identifierType,
          subjectType: assignment.subjectType,
          subjectId: assignment.subjectId,
          status: 'pending',
          pendingAction: assignment.action,
          pendingOperationId: operationId,
          updatedBy: actorId,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdBy: actorId,
          createdAt: new Date(),
        },
      };
      options.upsert = true;
    }

    try {
      const reservation = await this.resolveQuery(
        this.identifierModel.findOneAndUpdate(filter, update, options),
      );
      if (!reservation) {
        throw new ConflictException('Identifier reservation is unavailable');
      }
      return reservation;
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        throw new ConflictException('Identifier reservation is unavailable');
      }
      throw error;
    }
  }

  private async attachReservationReference(
    operationId: string,
    assignmentId: string,
    reservation: IdentifierReservationDocument,
    session?: ClientSession,
  ): Promise<void> {
    await this.executeQuery(
      this.operationModel.updateOne(
        {
          operationId,
          'assignments.assignmentId': assignmentId,
        },
        {
          $set: {
            'assignments.$.targetReservationId': String(reservation._id),
            updatedAt: new Date(),
          },
        },
        session ? { session } : undefined,
      ),
    );
  }

  private async finalizeReservation(
    operationId: string,
    assignment: AuthIdentifierAssignmentInput,
    reservation: IdentifierReservationDocument,
    actorId: string,
    session?: ClientSession,
  ): Promise<void> {
    const released = assignment.action === 'release';
    await this.executeQuery(
      this.identifierModel.updateOne(
        { _id: reservation._id, pendingOperationId: operationId },
        {
          $set: {
            status: released ? 'released' : 'active',
            lastOperationId: operationId,
            updatedBy: actorId,
            updatedAt: new Date(),
            ...(released ? { releasedAt: new Date() } : {}),
          },
          $unset: {
            pendingOperationId: '',
            pendingAction: '',
          },
        },
        session ? { session } : undefined,
      ),
    );
  }

  private async compensateAssignments(
    input: AuthIdentifierOperationInput,
    operation: IdentifierOperationDocument,
    aggregate: AuthIdentifierAggregateAdapter,
    session?: ClientSession,
  ): Promise<void> {
    const applied = [...operation.assignments]
      .filter((assignment) => assignment.status === 'applied')
      .reverse();

    for (const persisted of applied) {
      const assignment = input.assignments.find(
        (item) => item.assignmentId === persisted.assignmentId,
      );
      if (!assignment) {
        throw new ConflictException(
          'Cannot safely compensate an incomplete assignment manifest',
        );
      }
      await aggregate.compensate(assignment, { session });

      const restoredStatus =
        assignment.action === 'release'
          ? 'active'
          : assignment.action === 'retain'
            ? 'conflict'
            : 'released';
      await this.executeQuery(
        this.identifierModel.updateOne(
          {
            _id:
              persisted.targetReservationId ?? assignment.sourceReservationId,
            lastOperationId: input.operationId,
          },
          {
            $set: {
              status: restoredStatus,
              updatedBy: input.requestedBy.subjectId,
              updatedAt: new Date(),
            },
            $unset: {
              pendingOperationId: '',
              pendingAction: '',
              ...(restoredStatus !== 'released' ? { releasedAt: '' } : {}),
            },
          },
          session ? { session } : undefined,
        ),
      );
      await this.executeQuery(
        this.operationModel.updateOne(
          {
            operationId: input.operationId,
            'assignments.assignmentId': assignment.assignmentId,
          },
          {
            $set: {
              'assignments.$.status': 'compensated',
              updatedAt: new Date(),
            },
          },
          session ? { session } : undefined,
        ),
      );
    }
  }

  private async synchronizeAppliedAssignments(
    input: AuthIdentifierOperationInput,
    aggregate: AuthIdentifierAggregateAdapter,
  ): Promise<void> {
    const operation = await this.findOperation(input.operationId);
    if (!operation) {
      throw new ConflictException('Identifier operation is not retained');
    }
    const pending = operation.assignments.filter(
      (assignment) => assignment.status === 'pending',
    );
    if (pending.length > 0 && !aggregate.isApplied) {
      throw new ConflictException(
        'Aggregate state cannot be proven safe for compensation',
      );
    }

    for (const persisted of pending) {
      const assignment = input.assignments.find(
        (item) => item.assignmentId === persisted.assignmentId,
      );
      if (
        assignment &&
        (await aggregate.isApplied!(assignment, { session: undefined }))
      ) {
        await this.markAssignmentApplied(
          input.operationId,
          assignment.assignmentId,
        );
      }
    }
  }

  private async beginFinalizing(
    input: AuthIdentifierOperationInput,
    from: 'applying' | 'compensating',
    terminalStatus: 'completed' | 'failed-terminal',
    session?: ClientSession,
  ): Promise<void> {
    this.validateTransition(from, 'finalizing');
    const updated = await this.resolveQuery(
      this.operationModel.findOneAndUpdate(
        { operationId: input.operationId, status: from },
        {
          $set: {
            status: 'finalizing',
            result: this.terminalResult(input, terminalStatus),
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after', session },
      ),
    );
    if (!updated) {
      throw new ConflictException(
        'Identifier operation state changed concurrently',
      );
    }
  }

  private async finishTerminal(
    input: AuthIdentifierOperationInput,
    status: 'completed' | 'failed-terminal',
    session?: ClientSession,
  ): Promise<AuthIdentifierOperationResult> {
    const success = status === 'completed';
    const result = this.terminalResult(input, status);
    const eventId =
      await this.securityActivityService.recordIdentifierOperationTerminal(
        {
          operationId: input.operationId,
          operationType: input.operationType,
          terminalStatus: status,
          actor: this.toSecurityActor(input.requestedBy),
          outcome: success
            ? SecurityActivityOutcome.Success
            : SecurityActivityOutcome.Failure,
          reasonCategory: result.reasonCategory,
        },
        session,
      );

    const now = new Date();
    const terminalSet: Record<string, unknown> = {
      status,
      result,
      terminalEventId: eventId,
      terminalEventRecordedAt: now,
      completedAt: now,
      updatedAt: now,
    };
    if ((input.cleanupStatus ?? 'not-required') !== 'pending') {
      terminalSet.expiresAt = new Date(
        now.getTime() + this.operationRetentionMs,
      );
    }

    const updated = await this.resolveQuery(
      this.operationModel.findOneAndUpdate(
        { operationId: input.operationId, status: 'finalizing' },
        { $set: terminalSet },
        { returnDocument: 'after', session },
      ),
    );
    if (!updated) {
      const current = await this.findOperation(input.operationId, session);
      if (current && terminalStatuses.has(current.status)) {
        return this.replay(current);
      }
      throw new ConflictException(
        'Identifier operation could not be finalized safely',
      );
    }

    return {
      operationId: input.operationId,
      status,
      httpStatus: result.httpStatus,
      replayed: false,
      result,
    };
  }

  private terminalResult(
    input: AuthIdentifierOperationInput,
    status: 'completed' | 'failed-terminal',
  ): AuthIdentifierOperationResult['result'] {
    const success = status === 'completed';
    return {
      outcome: success ? 'success' : 'failure',
      reasonCategory: success
        ? this.safeReasonCategory(
            input.successReasonCategory,
            'identifier-operation-completed',
          )
        : this.safeReasonCategory(
            input.failureReasonCategory,
            'identifier-operation-compensated',
          ),
      httpStatus: success
        ? (input.successHttpStatus ?? 200)
        : (input.failureHttpStatus ?? 409),
    };
  }

  private replay(
    operation: IdentifierOperationDocument,
  ): AuthIdentifierOperationResult {
    if (!terminalStatuses.has(operation.status) || !operation.result) {
      throw new ConflictException('Identifier operation is not terminal');
    }
    return {
      operationId: operation.operationId,
      status: operation.status as 'completed' | 'failed-terminal',
      httpStatus: operation.result.httpStatus,
      replayed: true,
      result: operation.result,
    };
  }

  private async transition(
    operationId: string,
    from: AuthIdentifierOperationStatus,
    to: AuthIdentifierOperationStatus,
    session?: ClientSession,
  ): Promise<void> {
    this.validateTransition(from, to);
    const updated = await this.resolveQuery(
      this.operationModel.findOneAndUpdate(
        { operationId, status: from },
        { $set: { status: to, updatedAt: new Date() } },
        { returnDocument: 'after', session },
      ),
    );
    if (!updated) {
      throw new ConflictException(
        'Identifier operation state changed concurrently',
      );
    }
  }

  private validateInput(input: AuthIdentifierOperationInput): void {
    if (!input.operationId?.trim()) {
      throw new UnprocessableEntityException('Operation id is required');
    }
    if (
      input.assignments.length === 0 ||
      input.assignments.length > this.maxAssignments
    ) {
      throw new UnprocessableEntityException(
        `Identifier operations require 1-${this.maxAssignments} assignments`,
      );
    }
    if (
      new Set(input.assignments.map((assignment) => assignment.assignmentId))
        .size !== input.assignments.length
    ) {
      throw new UnprocessableEntityException(
        'Assignment ids must be unique within an operation',
      );
    }
  }

  private assertOperationManifest(
    operation: IdentifierOperationDocument,
    input: AuthIdentifierOperationInput,
  ): void {
    if (operation.assignments.length !== input.assignments.length) {
      throw new ConflictException(
        'Operation id is already bound to another assignment manifest',
      );
    }
    const matches = operation.assignments.every((persisted) => {
      const candidate = input.assignments.find(
        (item) => item.assignmentId === persisted.assignmentId,
      );
      return (
        candidate?.subjectType === persisted.subjectType &&
        candidate.subjectId === persisted.subjectId &&
        candidate.action === persisted.action &&
        String(candidate.sourceReservationId ?? '') ===
          String(persisted.sourceReservationId ?? '') &&
        candidate.identifierCorrelationHash ===
          persisted.identifierCorrelationHash &&
        candidate.correlationKeyVersion === persisted.correlationKeyVersion
      );
    });
    if (!matches) {
      throw new ConflictException(
        'Operation id is already bound to another assignment manifest',
      );
    }
  }

  private async findOperation(
    operationId: string,
    session?: ClientSession,
  ): Promise<IdentifierOperationDocument | null> {
    return this.resolveQuery(
      this.operationModel.findOne(
        { operationId },
        undefined,
        session ? { session } : undefined,
      ),
    );
  }

  private async resolveQuery<T>(query: QueryLike<T> | Promise<T>): Promise<T> {
    const leanQuery =
      typeof (query as QueryLike<T>).lean === 'function'
        ? (query as QueryLike<T>).lean!()
        : query;
    if (typeof (leanQuery as QueryLike<T>).exec === 'function') {
      return (leanQuery as QueryLike<T>).exec!();
    }
    return Promise.resolve(leanQuery as T);
  }

  private async executeQuery(query: QueryLike<unknown> | Promise<unknown>) {
    if (typeof (query as QueryLike<unknown>).exec === 'function') {
      return (query as QueryLike<unknown>).exec!();
    }
    return Promise.resolve(query);
  }

  private validateConflictMapping(
    subjects: AuthIdentifierActorReference[],
    originalIdentifier: string,
    dto: ResolveAuthIdentifierConflictDto,
  ): void {
    const subjectKeys = new Set(
      subjects.map((item) => `${item.subjectType}:${item.subjectId}`),
    );
    const retainedKey = dto.retainedSubject
      ? `${dto.retainedSubject.subjectType}:${dto.retainedSubject.subjectId}`
      : undefined;
    if (retainedKey && !subjectKeys.has(retainedKey)) {
      throw new UnprocessableEntityException('Retained subject is not a claimant');
    }

    const reassignmentKeys = dto.reassignments.map(
      (item) => `${item.subjectType}:${item.subjectId}`,
    );
    if (new Set(reassignmentKeys).size !== reassignmentKeys.length) {
      throw new UnprocessableEntityException('Each subject may be reassigned once');
    }
    const accounted = new Set([
      ...(retainedKey ? [retainedKey] : []),
      ...reassignmentKeys,
    ]);
    if (
      accounted.size !== subjectKeys.size ||
      [...accounted].some((key) => !subjectKeys.has(key))
    ) {
      throw new UnprocessableEntityException(
        'Every conflicting subject must be retained or reassigned',
      );
    }

    const replacements = dto.reassignments.map((item) =>
      this.normalizeIdentifier(item.newIdentifier),
    );
    if (
      new Set(replacements).size !== replacements.length ||
      replacements.some((identifier) => identifier === originalIdentifier)
    ) {
      throw new UnprocessableEntityException(
        'Replacement identifiers must be unique',
      );
    }
  }

  private conflictAggregateAdapter(
    conflictId: string,
    originalIdentifier: string,
    releaseOnAssignmentId?: string,
  ): AuthIdentifierAggregateAdapter {
    return {
      apply: async (assignment, { session }) => {
        if (assignment.action !== 'retain') {
          await this.updateAggregateIdentifier(
            assignment,
            assignment.normalizedIdentifier!,
            session,
          );
        }
        if (assignment.assignmentId === releaseOnAssignmentId) {
          await this.releaseOriginalConflict(conflictId, assignment, session);
        }
      },
      compensate: async (assignment, { session }) => {
        if (assignment.action !== 'retain') {
          await this.updateAggregateIdentifier(
            assignment,
            originalIdentifier,
            session,
          );
        }
        if (assignment.assignmentId === releaseOnAssignmentId) {
          await (
            this.identifierModel as unknown as Model<AuthIdentifierDocument>
          ).updateOne(
            { _id: conflictId },
            {
              $set: {
                status: AuthIdentifierStatus.Conflict,
                conflictResolutionStatus:
                  AuthIdentifierConflictResolutionStatus.Reviewable,
              },
              $unset: { releasedAt: '' },
            },
            { session },
          );
        }
      },
      isApplied: async (assignment, { session }) => {
        if (assignment.action === 'retain') return false;
        const identifier = assignment.normalizedIdentifier;
        const model = (
          assignment.subjectType === 'staff'
            ? this.staffUserModel
            : this.memberModel
        ) as unknown as Model<Record<string, unknown>> | undefined;
        if (!model || !identifier) return false;
        const field =
          assignment.subjectType === 'staff' ? 'email' : 'loginIdentifier';
        const found = await model
          .findOne({ _id: assignment.subjectId, [field]: identifier })
          .session(session ?? null)
          .lean()
          .exec();
        return Boolean(found);
      },
    };
  }

  private async updateAggregateIdentifier(
    assignment: AuthIdentifierAssignmentInput,
    normalizedIdentifier: string,
    session?: ClientSession,
  ): Promise<void> {
    const model = (
      assignment.subjectType === 'staff'
        ? this.staffUserModel
        : this.memberModel
    ) as unknown as Model<Record<string, unknown>> | undefined;
    if (!model) throw new NotFoundException('Identifier subject not found');
    const field = assignment.subjectType === 'staff' ? 'email' : 'loginIdentifier';
    const result = await model.updateOne(
      { _id: assignment.subjectId },
      {
        $set: { [field]: normalizedIdentifier },
        $inc: { authVersion: 1 },
      },
      { session },
    );
    if (!result.matchedCount) throw new NotFoundException('Identifier subject not found');
  }

  private async releaseOriginalConflict(
    conflictId: string,
    assignment: AuthIdentifierAssignmentInput,
    session?: ClientSession,
  ): Promise<void> {
    await (
      this.identifierModel as unknown as Model<AuthIdentifierDocument>
    ).updateOne(
      { _id: conflictId, status: AuthIdentifierStatus.Conflict },
      {
        $set: {
          status: AuthIdentifierStatus.Released,
          subjectType: assignment.subjectType,
          subjectId: assignment.subjectId,
          releasedAt: new Date(),
        },
        $unset: { conflictingSubjects: '', conflictResolutionStatus: '' },
      },
      { session },
    );
  }

  private async safeDisplayLabel(
    subject: AuthIdentifierActorReference,
  ): Promise<string> {
    try {
      if (subject.subjectType === 'staff' && this.staffUserModel) {
        const user = await this.staffUserModel
          .findById(subject.subjectId)
          .select({ displayName: 1, email: 1 })
          .lean()
          .exec();
        if (user) return user.displayName || user.email;
      }
      if (subject.subjectType === 'member' && this.memberModel) {
        const member = await this.memberModel
          .findById(subject.subjectId)
          .select({ fullName: 1, memberNumber: 1 })
          .lean()
          .exec();
        if (member) return member.fullName || member.memberNumber;
      }
    } catch {
      // A missing or malformed legacy subject remains reviewable by opaque id.
    }
    return `${subject.subjectType} ${subject.subjectId}`;
  }

  private normalizeIdentifier(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      throw new UnprocessableEntityException('Replacement identifier is required');
    }
    return normalized;
  }

  private isDuplicateKey(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private isTransactionUnavailable(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /transactions? (are|is) unavailable|transaction numbers are only allowed|replica set/i.test(
      message,
    );
  }

  private toSecurityActor(
    actor?: AuthIdentifierActorReference,
  ): { actorType: SecurityActivityActorType; actorId: string } | undefined {
    if (!actor) {
      return undefined;
    }
    return {
      actorType:
        actor.subjectType === 'staff'
          ? SecurityActivityActorType.Staff
          : SecurityActivityActorType.Member,
      actorId: actor.subjectId,
    };
  }

  private safeReasonCategory(value: string | undefined, fallback: string) {
    return value && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value) ? value : fallback;
  }
}
