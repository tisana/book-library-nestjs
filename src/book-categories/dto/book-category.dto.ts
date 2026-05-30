import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LibraryItemStatus } from '../../common/enums/library-status.enum';

export class CreateBookCategoryDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  loanPeriodDays: number;
}

export class UpdateBookCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  loanPeriodDays?: number;

  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;
}

export class BookCategoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;
}

export interface BookCategoryResponseDto {
  id: string;
  code: string;
  name: string;
  loanPeriodDays: number;
  status: LibraryItemStatus;
}
