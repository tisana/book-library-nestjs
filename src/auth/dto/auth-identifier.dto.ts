import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  AuthIdentifierConflictResolutionStatus,
  AuthIdentifierSubjectType,
} from '../schemas/auth-identifier.schema';
import { AuthIdentifierOperationStatus } from '../schemas/auth-identifier-operation.schema';

export class AuthIdentifierSubjectDto {
  @ApiProperty({ enum: AuthIdentifierSubjectType })
  @IsEnum(AuthIdentifierSubjectType)
  subjectType: AuthIdentifierSubjectType;

  @ApiProperty()
  @IsString()
  subjectId: string;
}

export class AuthIdentifierReassignmentDto extends AuthIdentifierSubjectDto {
  @ApiProperty()
  @IsString()
  newIdentifier: string;
}

export class ResolveAuthIdentifierConflictDto {
  @ApiProperty()
  @IsString()
  operationId: string;

  @ApiPropertyOptional({ type: AuthIdentifierSubjectDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuthIdentifierSubjectDto)
  retainedSubject?: AuthIdentifierSubjectDto;

  @ApiProperty({ type: [AuthIdentifierReassignmentDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AuthIdentifierReassignmentDto)
  reassignments: AuthIdentifierReassignmentDto[];
}

export class AuthIdentifierConflictQueryDto extends PaginationQueryDto {}

export class AuthIdentifierConflictSubjectViewDto extends AuthIdentifierSubjectDto {
  @ApiProperty()
  displayLabel: string;
}

export class AuthIdentifierConflictViewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  normalizedIdentifier: string;

  @ApiProperty({ enum: AuthIdentifierConflictResolutionStatus })
  resolutionStatus: AuthIdentifierConflictResolutionStatus;

  @ApiProperty({ type: [AuthIdentifierConflictSubjectViewDto] })
  subjects: AuthIdentifierConflictSubjectViewDto[];
}

export class AuthIdentifierOperationStatusDto {
  @ApiProperty()
  operationId: string;

  @ApiProperty({ enum: AuthIdentifierOperationStatus })
  status: AuthIdentifierOperationStatus;

  @ApiProperty({ type: [AuthIdentifierSubjectDto] })
  subjects: AuthIdentifierSubjectDto[];

  @ApiPropertyOptional()
  currentStep?: string;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  outcome?: string;

  @ApiPropertyOptional()
  reasonCategory?: string;

  @ApiPropertyOptional()
  httpStatus?: number;
}

export class AuthIdentifierResolutionResultDto {
  @ApiProperty()
  operationId: string;

  @ApiProperty({ enum: ['completed', 'failed-terminal'] })
  status: 'completed' | 'failed-terminal';

  @ApiProperty()
  replayed: boolean;

  @ApiProperty()
  outcome: 'success' | 'failure';

  @ApiProperty()
  reasonCategory: string;
}
