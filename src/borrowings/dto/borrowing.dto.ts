import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a12' })
  @IsMongoId()
  memberId: string;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a13' })
  @IsMongoId()
  bookId: string;
}

export class ReturnBorrowingDto {
  @ApiPropertyOptional({ example: '2026-06-01T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  returnedAt?: string;
}

export class BorrowingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '665f4d3b8f4c8a001f5f0a12' })
  @IsOptional()
  @IsMongoId()
  memberId?: string;

  @ApiPropertyOptional({ example: '665f4d3b8f4c8a001f5f0a13' })
  @IsOptional()
  @IsMongoId()
  bookId?: string;

  @ApiPropertyOptional({ enum: LoanState, example: LoanState.Active })
  @IsOptional()
  @IsEnum(LoanState)
  status?: LoanState;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  overdueOnly?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  currentOnly?: boolean;
}

export class BorrowingResponseDto {
  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a14' })
  id: string;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a12' })
  memberId: string;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a13' })
  bookId: string;

  @ApiPropertyOptional({ example: 'Clean Code' })
  bookTitle?: string;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a15' })
  bookCategoryId: string;

  @ApiProperty({ example: '2026-06-01T09:00:00.000Z' })
  borrowedAt: string;

  @ApiProperty({ example: '2026-06-15T09:00:00.000Z' })
  dueAt: string;

  @ApiPropertyOptional({ example: '2026-06-10T09:00:00.000Z' })
  returnedAt?: string;

  @ApiProperty({ enum: LoanState, example: LoanState.Active })
  status: LoanState;

  @ApiProperty({ example: '665f4d3b8f4c8a001f5f0a16' })
  borrowedByStaffId: string;

  @ApiPropertyOptional({ example: '665f4d3b8f4c8a001f5f0a17' })
  returnedByStaffId?: string;
}
