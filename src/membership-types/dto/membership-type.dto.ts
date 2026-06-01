import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LibraryItemStatus } from '../../common/enums/library-status.enum';

export class CreateMembershipTypeDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  maxActiveLoans: number;
}

export class UpdateMembershipTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxActiveLoans?: number;

  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;
}

export class MembershipTypeQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;
}

export interface MembershipTypeResponseDto {
  id: string;
  code: string;
  name: string;
  maxActiveLoans: number;
  status: LibraryItemStatus;
}
