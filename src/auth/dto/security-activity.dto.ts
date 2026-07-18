import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  SecurityActivityActorType,
  SecurityActivityEventType,
  SecurityActivityOutcome,
} from '../schemas/security-activity-event.schema';

export class SecurityActivityQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SecurityActivityEventType)
  eventType?: SecurityActivityEventType;

  @IsOptional()
  @IsEnum(SecurityActivityActorType)
  actorType?: SecurityActivityActorType;

  @IsOptional()
  @IsEnum(SecurityActivityOutcome)
  outcome?: SecurityActivityOutcome;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  operationId?: string;
}

export interface SecurityActivityEventViewDto {
  id: string;
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
  context?: Record<string, unknown>;
  createdAt: string;
}
