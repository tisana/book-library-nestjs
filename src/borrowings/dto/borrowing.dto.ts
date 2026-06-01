import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LoanState } from '../../common/enums/library-status.enum';

export class CreateBorrowingDto {
  @IsMongoId()
  memberId: string;

  @IsMongoId()
  bookId: string;
}

export class ReturnBorrowingDto {
  @IsOptional()
  @IsDateString()
  returnedAt?: string;
}

export class BorrowingQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsMongoId()
  memberId?: string;

  @IsOptional()
  @IsMongoId()
  bookId?: string;

  @IsOptional()
  @IsEnum(LoanState)
  status?: LoanState;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  overdueOnly?: boolean;
}

export interface BorrowingResponseDto {
  id: string;
  memberId: string;
  bookId: string;
  bookCategoryId: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string;
  status: LoanState;
  borrowedByStaffId: string;
  returnedByStaffId?: string;
}
