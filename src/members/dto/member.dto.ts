import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MemberStatus } from '../../common/enums/library-status.enum';

export class CreateMemberDto {
  @ApiProperty({ example: 'M-10001' })
  @IsString()
  memberNumber: string;

  @ApiProperty({ example: 'Jane Reader' })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: 'jane.reader@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+66123456789' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a11' })
  @IsMongoId()
  membershipTypeId: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  activeLoanCount?: number;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ example: 'Jane Reader' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'jane.reader@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+66123456789' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '665f4d3b8f4c8a001f5f0a11' })
  @IsOptional()
  @IsMongoId()
  membershipTypeId?: string;

  @ApiPropertyOptional({ enum: MemberStatus, example: MemberStatus.Active })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @ApiPropertyOptional({ example: 2, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  activeLoanCount?: number;
}

export class MemberQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'jane' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: MemberStatus, example: MemberStatus.Active })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @ApiPropertyOptional({ example: '665f4d3b8f4c8a001f5f0a11' })
  @IsOptional()
  @IsMongoId()
  membershipTypeId?: string;
}

export class MemberResponseDto {
  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a12' })
  id: string;

  @ApiProperty({ example: 'M-10001' })
  memberNumber: string;

  @ApiProperty({ example: 'Jane Reader' })
  fullName: string;

  @ApiPropertyOptional({ example: 'jane.reader@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: '+66123456789' })
  phone?: string;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a11' })
  membershipTypeId: string;

  @ApiProperty({ enum: MemberStatus, example: MemberStatus.Active })
  status: MemberStatus;

  @ApiProperty({ example: 2, minimum: 0 })
  activeLoanCount: number;
}

export class MemberPolicyStatusResponseDto {
  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a12' })
  memberId: string;

  @ApiProperty({ enum: MemberStatus, example: MemberStatus.Active })
  status: MemberStatus;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a11' })
  membershipTypeId: string;

  @ApiProperty({ example: 5, minimum: 0 })
  maxActiveLoans: number;

  @ApiProperty({ example: 2, minimum: 0 })
  activeLoanCount: number;

  @ApiProperty({ example: 3, minimum: 0 })
  remainingAllowance: number;

  @ApiProperty({ example: true })
  eligibleByStatus: boolean;

  @ApiProperty({ example: true })
  withinLimit: boolean;

  @ApiProperty({ example: false })
  limitReached: boolean;
}
