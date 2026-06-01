import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { LibraryItemStatus } from '../../common/enums/library-status.enum';

export class CreateBookCategoryDto {
  @ApiProperty({ example: 'FIC' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Fiction' })
  @IsString()
  name: string;

  @ApiProperty({ minimum: 1, example: 14 })
  @IsInt()
  @Min(1)
  loanPeriodDays: number;
}

export class UpdateBookCategoryDto {
  @ApiPropertyOptional({ example: 'Fiction' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ minimum: 1, example: 14 })
  @IsOptional()
  @IsInt()
  @Min(1)
  loanPeriodDays?: number;

  @ApiPropertyOptional({
    enum: LibraryItemStatus,
    enumName: 'LibraryItemStatus',
  })
  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;
}

export class BookCategoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: LibraryItemStatus,
    enumName: 'LibraryItemStatus',
  })
  @IsOptional()
  @IsEnum(LibraryItemStatus)
  status?: LibraryItemStatus;
}

export class BookCategoryResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'FIC' })
  code: string;

  @ApiProperty({ example: 'Fiction' })
  name: string;

  @ApiProperty({ minimum: 1, example: 14 })
  loanPeriodDays: number;

  @ApiProperty({
    enum: LibraryItemStatus,
    enumName: 'LibraryItemStatus',
  })
  status: LibraryItemStatus;
}
