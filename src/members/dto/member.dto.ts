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
  @IsString()
  memberNumber: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsMongoId()
  membershipTypeId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  activeLoanCount?: number;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsMongoId()
  membershipTypeId?: string;

  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  activeLoanCount?: number;
}

export class MemberQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @IsOptional()
  @IsMongoId()
  membershipTypeId?: string;
}

export interface MemberResponseDto {
  id: string;
  memberNumber: string;
  fullName: string;
  email?: string;
  phone?: string;
  membershipTypeId: string;
  status: MemberStatus;
  activeLoanCount: number;
}

export interface MemberPolicyStatusResponseDto {
  memberId: string;
  status: MemberStatus;
  membershipTypeId: string;
  maxActiveLoans: number;
  activeLoanCount: number;
  remainingAllowance: number;
  eligibleByStatus: boolean;
  withinLimit: boolean;
  limitReached: boolean;
}
