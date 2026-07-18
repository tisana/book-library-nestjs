import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac } from 'node:crypto';
import { ClientSession, Model } from 'mongoose';
import {
  createPaginatedResult,
  PaginatedResult,
} from '../common/dto/pagination-query.dto';
import {
  SecurityActivityEventViewDto,
  SecurityActivityQueryDto,
} from './dto/security-activity.dto';
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
  persistenceBoundary?: 'security-event' | 'browser-origin-denial';
}

export interface RecordFailedSignInInput {
  normalizedIdentifier?: string;
  subject?: { subjectType: 'staff' | 'member'; subjectId: string };
  reasonCategory: string;
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
  /password|token|secret|authorization|cookie|credential|identifier|email|login/i;

@Injectable()
export class SecurityActivityService {
  constructor(
    @InjectModel(SecurityActivityEventModelName)
    private readonly securityActivityEventModel: Model<SecurityActivityEventDocument>,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async record(input: RecordSecurityActivityInput): Promise<void> {
    return this.persist(input, false);
  }

  private async persist(
    input: RecordSecurityActivityInput,
    allowIdentifierCorrelation: boolean,
  ): Promise<void> {
    if (input.persistenceBoundary === 'browser-origin-denial') {
      throw new Error('Browser-origin denials are operational telemetry only');
    }
    if (
      !allowIdentifierCorrelation &&
      (input.identifierCorrelationHash || input.correlationKeyVersion)
    ) {
      throw new Error(
        'Identifier correlation must be derived by SecurityActivityService',
      );
    }
    const event = { ...input };
    delete event.persistenceBoundary;
    await this.securityActivityEventModel.create({
      ...event,
      actorType: input.actorType ?? SecurityActivityActorType.Unknown,
      context: this.redactContext(input.context ?? {}) as Record<
        string,
        unknown
      >,
      createdAt: new Date(),
    });
  }

  async recordFailedSignIn(input: RecordFailedSignInInput): Promise<void> {
    const correlation = input.subject
      ? undefined
      : this.identifierCorrelation(input.normalizedIdentifier);
    await this.persist({
      eventType: SecurityActivityEventType.SignInFailure,
      actorType: SecurityActivityActorType.Unknown,
      ...(input.subject
        ? {
            subjectType: input.subject.subjectType,
            subjectId: input.subject.subjectId,
          }
        : {}),
      outcome: SecurityActivityOutcome.Failure,
      reasonCategory: this.safeReasonCategory(
        input.reasonCategory,
        'sign-in-failed',
      ),
      ...(correlation
        ? {
            identifierCorrelationHash: correlation.hash,
            correlationKeyVersion: correlation.version,
          }
        : {}),
    }, true);
  }

  async list(
    query: SecurityActivityQueryDto,
  ): Promise<PaginatedResult<SecurityActivityEventViewDto>> {
    const filter: Record<string, unknown> = {};
    if (query.eventType) filter.eventType = query.eventType;
    if (query.actorType) filter.actorType = query.actorType;
    if (query.outcome) filter.outcome = query.outcome;
    if (query.operationId) filter.operationId = query.operationId;
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    const [events, total] = await Promise.all([
      this.securityActivityEventModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.securityActivityEventModel.countDocuments(filter).exec(),
    ]);
    return createPaginatedResult(
      events.map((event) => this.toView(event)),
      total,
      query,
    );
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

  private identifierCorrelation(
    normalizedIdentifier?: string,
  ): { hash: string; version: number } | undefined {
    if (!normalizedIdentifier) return undefined;
    const ring = this.configService?.get<{
      currentVersion: number;
      keysByVersion: Readonly<Record<string, string>>;
    }>('auth.auditCorrelationKeyRing');
    const version = ring?.currentVersion;
    const material = version ? ring.keysByVersion[String(version)] : undefined;
    if (!version || !material) return undefined;
    return {
      hash: createHmac('sha256', Buffer.from(material, 'base64url'))
        .update('book-library/auth-sign-in/v1\0', 'utf8')
        .update(normalizedIdentifier, 'utf8')
        .digest('base64url'),
      version,
    };
  }

  private toView(event: Record<string, any>): SecurityActivityEventViewDto {
    return {
      id: event._id.toString(),
      ...(event.eventId ? { eventId: event.eventId } : {}),
      eventType: event.eventType,
      actorType: event.actorType,
      ...(event.actorId ? { actorId: event.actorId } : {}),
      ...(event.targetType ? { targetType: event.targetType } : {}),
      ...(event.targetId ? { targetId: event.targetId } : {}),
      ...(event.clientId ? { clientId: event.clientId } : {}),
      ...(event.subjectType ? { subjectType: event.subjectType } : {}),
      ...(event.subjectId ? { subjectId: event.subjectId } : {}),
      outcome: event.outcome,
      ...(event.reasonCategory
        ? { reasonCategory: event.reasonCategory }
        : {}),
      ...(event.identifierCorrelationHash
        ? { identifierCorrelationHash: event.identifierCorrelationHash }
        : {}),
      ...(event.correlationKeyVersion
        ? { correlationKeyVersion: event.correlationKeyVersion }
        : {}),
      ...(event.operationId ? { operationId: event.operationId } : {}),
      ...(event.requestId ? { requestId: event.requestId } : {}),
      ...(event.context
        ? {
            context: this.redactContext(event.context) as Record<
              string,
              unknown
            >,
          }
        : {}),
      createdAt: new Date(event.createdAt).toISOString(),
    };
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
