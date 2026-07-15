import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  SecurityActivityActorType,
  SecurityActivityEventDocument,
  SecurityActivityEventModelName,
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from './schemas/security-activity-event.schema';

export interface RecordSecurityActivityInput {
  eventId?: string;
  eventType: SecurityActivityEventType;
  actorType?: SecurityActivityActorType;
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
}

export interface SecurityActivityActorReference {
  actorType: SecurityActivityActorType;
  actorId?: string;
}

export interface RecordIdentifierOperationTerminalInput {
  operationId: string;
  operationType: string;
  terminalStatus: 'completed' | 'failed-terminal';
  actor?: SecurityActivityActorReference;
  outcome: SecurityActivityOutcome;
  reasonCategory: string;
}

export interface RecordIdentifierRepairResumedInput {
  operationId: string;
  resumeId: string;
  originalActor?: SecurityActivityActorReference;
  resumingActor: SecurityActivityActorReference;
}

const sensitiveKeyPattern =
  /password|token|secret|authorization|cookie|credential/i;

@Injectable()
export class SecurityActivityService {
  constructor(
    @InjectModel(SecurityActivityEventModelName)
    private readonly securityActivityEventModel: Model<SecurityActivityEventDocument>,
  ) {}

  async record(input: RecordSecurityActivityInput): Promise<void> {
    await this.securityActivityEventModel.create({
      ...input,
      actorType: input.actorType ?? SecurityActivityActorType.Unknown,
      context: this.redactContext(input.context ?? {}) as Record<
        string,
        unknown
      >,
      createdAt: new Date(),
    });
  }

  async recordIdentifierOperationTerminal(
    input: RecordIdentifierOperationTerminalInput,
    session?: ClientSession,
  ): Promise<string> {
    const eventId = `auth-identifier-operation:${input.operationId}:${input.terminalStatus}`;
    const resolvedConflict =
      input.terminalStatus === 'completed' &&
      (input.operationType === 'resolve-conflict' ||
        input.operationType === 'offline-repair');
    await this.recordIdempotent(
      {
        eventId,
        eventType: resolvedConflict
          ? SecurityActivityEventType.IdentifierConflictResolved
          : SecurityActivityEventType.IdentifierReservationRecovered,
        actorType: input.actor?.actorType ?? SecurityActivityActorType.System,
        actorId: input.actor?.actorId,
        targetType: 'auth-identifier-operation',
        targetId: input.operationId,
        operationId: input.operationId,
        outcome: input.outcome,
        reasonCategory: this.safeReasonCategory(
          input.reasonCategory,
          'identifier-operation-terminal',
        ),
        context: {
          operationType: input.operationType,
          terminalStatus: input.terminalStatus,
        },
      },
      session,
    );
    return eventId;
  }

  async recordIdentifierRepairResumed(
    input: RecordIdentifierRepairResumedInput,
    session?: ClientSession,
  ): Promise<string> {
    const eventId = `identifier-repair-resumed:${input.operationId}:${input.resumeId}`;
    await this.recordIdempotent(
      {
        eventId,
        eventType: SecurityActivityEventType.IdentifierRepairResumed,
        actorType: input.resumingActor.actorType,
        actorId: input.resumingActor.actorId,
        targetType: 'auth-identifier-operation',
        targetId: input.operationId,
        operationId: input.operationId,
        outcome: SecurityActivityOutcome.Success,
        reasonCategory: 'identifier-repair-resumed',
        context: {
          originalActor: this.safeActorReference(input.originalActor),
          resumingActor: this.safeActorReference(input.resumingActor),
        },
      },
      session,
    );
    return eventId;
  }

  private async recordIdempotent(
    input: RecordSecurityActivityInput & { eventId: string },
    session?: ClientSession,
  ): Promise<void> {
    const event = {
      ...input,
      actorType: input.actorType ?? SecurityActivityActorType.Unknown,
      context: this.redactContext(input.context ?? {}) as Record<
        string,
        unknown
      >,
      createdAt: new Date(),
    };
    try {
      await this.securityActivityEventModel.updateOne(
        { eventId: input.eventId },
        { $setOnInsert: event },
        { upsert: true, session },
      );
    } catch (error) {
      if (!this.isDuplicateKey(error)) {
        throw error;
      }
    }
  }

  private safeActorReference(
    actor?: SecurityActivityActorReference,
  ): SecurityActivityActorReference | undefined {
    if (!actor) {
      return undefined;
    }
    return {
      actorType: actor.actorType,
      ...(actor.actorId ? { actorId: actor.actorId } : {}),
    };
  }

  private isDuplicateKey(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private safeReasonCategory(value: string | undefined, fallback: string) {
    return value && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value) ? value : fallback;
  }

  redactContext(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactContext(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sensitiveKeyPattern.test(key)
          ? '[REDACTED]'
          : this.redactContext(entry),
      ]),
    );
  }
}
