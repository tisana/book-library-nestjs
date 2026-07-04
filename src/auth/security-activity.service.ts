import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SecurityActivityActorType,
  SecurityActivityEventDocument,
  SecurityActivityEventModelName,
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from './schemas/security-activity-event.schema';

export interface RecordSecurityActivityInput {
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
  requestId?: string;
  ipHash?: string;
  userAgentHash?: string;
  context?: Record<string, unknown>;
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
